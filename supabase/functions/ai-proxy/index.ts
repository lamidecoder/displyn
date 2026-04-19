import "https://esm.sh/@supabase/functions-js/src/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";
const DAILY_LIMIT = 40;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Extract user ID from the Supabase JWT in the Authorization header.
 * Returns null if no valid token.
 */
function getUserIdFromToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  try {
    // Decode JWT payload (middle part)
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.sub || null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== RATE LIMITING =====
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("authorization");
    const userId = getUserIdFromToken(authHeader);
    const todayStr = new Date().toISOString().split("T")[0];

    if (userId) {
      // Check current usage
      const { data: usage } = await supabase
        .from("ai_usage")
        .select("call_count")
        .eq("user_id", userId)
        .eq("date", todayStr)
        .single();

      const currentCount = usage?.call_count || 0;

      if (currentCount >= DAILY_LIMIT) {
        return new Response(
          JSON.stringify({
            error: `Daily AI limit reached (${DAILY_LIMIT} calls). Try again tomorrow.`,
            limit_reached: true,
            daily_limit: DAILY_LIMIT,
            calls_used: currentCount,
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Increment usage (upsert)
      if (usage) {
        await supabase
          .from("ai_usage")
          .update({ call_count: currentCount + 1 })
          .eq("user_id", userId)
          .eq("date", todayStr);
      } else {
        await supabase
          .from("ai_usage")
          .insert({ user_id: userId, date: todayStr, call_count: 1 });
      }
    }

    // ===== ROUTE REQUEST =====
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "chat";

    // ===== WHISPER TRANSCRIPTION =====
    if (action === "transcribe") {
      const formData = await req.formData();
      const audioFile = formData.get("file");
      if (!audioFile) {
        return new Response(
          JSON.stringify({ error: "No audio file provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const whisperForm = new FormData();
      whisperForm.append("file", audioFile);
      whisperForm.append("model", "whisper-1");
      whisperForm.append("language", "en");

      const whisperRes = await fetch(WHISPER_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: whisperForm,
      });

      if (!whisperRes.ok) {
        const errText = await whisperRes.text();
        return new Response(
          JSON.stringify({ error: `Whisper API ${whisperRes.status}: ${errText.slice(0, 200)}` }),
          { status: whisperRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const whisperData = await whisperRes.json();
      return new Response(JSON.stringify(whisperData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== VOICE-TO-TASK: Whisper + GPT in one call =====
    if (action === "voice-to-task") {
      const formData = await req.formData();
      const audioFile = formData.get("file");
      const systemPrompt = formData.get("system_prompt") as string | null;
      if (!audioFile) {
        return new Response(
          JSON.stringify({ error: "No audio file provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 1: Whisper transcription
      const whisperForm = new FormData();
      whisperForm.append("file", audioFile);
      whisperForm.append("model", "whisper-1");
      whisperForm.append("language", "en");

      const whisperRes = await fetch(WHISPER_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: whisperForm,
      });

      if (!whisperRes.ok) {
        const errText = await whisperRes.text();
        return new Response(
          JSON.stringify({ error: `Whisper API ${whisperRes.status}: ${errText.slice(0, 200)}` }),
          { status: whisperRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const whisperData = await whisperRes.json();
      const transcription = whisperData?.text || "";

      if (!transcription.trim()) {
        return new Response(
          JSON.stringify({ transcription: "", tasks: [] }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 2: GPT task parsing (server-side, no extra round trip)
      const messages = [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: `Parse this task description into a JSON array of tasks:\n\n"${transcription}"` },
      ];

      const gptRes = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.4,
          max_tokens: 512,
        }),
      });

      if (!gptRes.ok) {
        const errText = await gptRes.text();
        return new Response(
          JSON.stringify({
            transcription,
            tasks: null,
            error: `GPT ${gptRes.status}: ${errText.slice(0, 200)}`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const gptData = await gptRes.json();
      const rawContent = gptData?.choices?.[0]?.message?.content || "[]";

      // Increment usage a second time for the GPT call
      if (userId) {
        const { data: usage2 } = await supabase
          .from("ai_usage")
          .select("call_count")
          .eq("user_id", userId)
          .eq("date", todayStr)
          .single();
        if (usage2) {
          await supabase
            .from("ai_usage")
            .update({ call_count: usage2.call_count + 1 })
            .eq("user_id", userId)
            .eq("date", todayStr);
        }
      }

      return new Response(
        JSON.stringify({ transcription, tasks_raw: rawContent }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== CHAT COMPLETIONS =====
    const body = await req.json();
    const { messages, model = "gpt-4o-mini", temperature = 0.7, max_tokens = 1024 } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "messages array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model, messages, temperature, max_tokens }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(
        JSON.stringify({ error: `OpenAI ${openaiRes.status}: ${errText.slice(0, 200)}` }),
        { status: openaiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiRes.json();
    return new Response(JSON.stringify(openaiData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
