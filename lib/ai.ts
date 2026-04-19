import { TaskTag } from './types';
import { supabase } from './supabase';
import { getNylaContext, NylaProfile } from './nylaContext';

// ============ CUSTOM ERROR CLASSES ============

export class AIRateLimitError extends Error {
  callsUsed: number;
  dailyLimit: number;
  constructor(message: string, callsUsed = 20, dailyLimit = 20) {
    super(message);
    this.name = 'AIRateLimitError';
    this.callsUsed = callsUsed;
    this.dailyLimit = dailyLimit;
  }
}

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIUnavailableError';
  }
}

// ============ AI PROXY CONFIG (Supabase Edge Function) ============

const SUPABASE_URL = 'https://kskvwbamxvurxjryfqkn.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_j-F7EMc-ekc5OTxSP9Kgvg_t9lrOqcd';
const AI_PROXY_URL = `${SUPABASE_URL}/functions/v1/ai-proxy`;
const OPENAI_MODEL = 'gpt-4o-mini';
const AI_REQUEST_TIMEOUT_MS = 25000;

/**
 * Get the current user's access token for authenticated Edge Function calls.
 * Refreshes the session first to avoid expired JWT errors.
 */
async function getAuthToken(): Promise<string> {
  // Try refreshing first to ensure token is valid
  const { data: { session: refreshed } } = await supabase.auth.refreshSession();
  if (refreshed?.access_token) return refreshed.access_token;

  // Fallback to existing session
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || SUPABASE_ANON_KEY;
}

/**
 * Call AI via Supabase Edge Function proxy.
 * Returns the text response.
 */
async function callAI(
  prompt: string,
  systemMessage?: string
): Promise<string> {
  const messages: any[] = [];

  if (systemMessage) {
    messages.push({ role: 'system', content: systemMessage });
  }
  messages.push({ role: 'user', content: prompt });

  const token = await getAuthToken();

  const payload = JSON.stringify({
    model: OPENAI_MODEL,
    messages,
    temperature: 0.4,
    max_tokens: 512,
  });

  const doRequest = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
    try {
      return await fetch(AI_PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': SUPABASE_ANON_KEY,
        },
        body: payload,
        signal: controller.signal,
      });
    } catch (networkError: any) {
      if (networkError?.name === 'AbortError') {
        throw new AIUnavailableError('Request timed out. Please try again.');
      }
      throw new AIUnavailableError(`Network error: ${networkError.message}`);
    } finally {
      clearTimeout(timeout);
    }
  };

  let response: Response;
  try {
    response = await doRequest();
  } catch (firstError: any) {
    const isRetriable = firstError instanceof AIUnavailableError;
    if (!isRetriable) throw firstError;
    await new Promise((r) => setTimeout(r, 700));
    response = await doRequest();
  }

  if (response.status === 429) {
    const data = await response.json();
    throw new AIRateLimitError(
      data.error || 'Daily AI limit reached. Try again tomorrow.',
      data.calls_used || 40,
      data.daily_limit || 40
    );
  }

  if (!response.ok) {
    let errorText = '';
    try { errorText = await response.text(); } catch {}
    throw new AIUnavailableError(`AI ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new AIUnavailableError(`AI Error: ${data.error}`);
  }

  const text = data?.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(`Empty AI response: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return text.trim();
}

/**
 * Call OpenAI and parse the response as JSON.
 */
async function callAIJSON<T = any>(
  prompt: string,
  systemMessage?: string
): Promise<T> {
  const text = await callAI(prompt, systemMessage);

  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(cleaned);
}

// ============ WHISPER AUDIO TRANSCRIPTION ============

/**
 * Transcribe an audio file via Supabase Edge Function proxy (Whisper).
 * @param audioUri - Local file URI of the recorded audio
 * @returns The transcribed text
 */
export async function transcribeAudio(audioUri: string): Promise<string> {
  const formData = new FormData();

  // Create the file object for upload
  const uriParts = audioUri.split('.');
  const fileExtension = uriParts[uriParts.length - 1];

  formData.append('file', {
    uri: audioUri,
    name: `recording.${fileExtension}`,
    type: `audio/${fileExtension === 'm4a' ? 'mp4' : fileExtension}`,
  } as any);

  const token = await getAuthToken();

  let response: Response;
  try {
    response = await fetch(`${AI_PROXY_URL}?action=transcribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: formData,
    });
  } catch (networkError: any) {
    throw new AIUnavailableError(`Network error during transcription: ${networkError.message}`);
  }

  if (response.status === 429) {
    const data = await response.json();
    throw new AIRateLimitError(
      data.error || 'Daily AI limit reached. Try again tomorrow.',
      data.calls_used || 40,
      data.daily_limit || 40
    );
  }

  if (!response.ok) {
    let errorText = '';
    try { errorText = await response.text(); } catch {}
    throw new Error(`Transcription ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`Transcription error: ${data.error}`);
  }

  if (!data?.text) {
    throw new Error('Transcription returned empty result');
  }

  return data.text.trim();
}

/**
 * Combined voice-to-task: sends audio to Edge Function which runs
 * Whisper + GPT in a single server-side call (eliminates one round trip).
 */
export async function voiceToTask(audioUri: string, profile?: NylaProfile | null): Promise<{ transcription: string; tasks: ParsedTask[] }> {
  const formData = new FormData();

  const uriParts = audioUri.split('.');
  const fileExtension = uriParts[uriParts.length - 1];

  formData.append('file', {
    uri: audioUri,
    name: `recording.${fileExtension}`,
    type: `audio/${fileExtension === 'm4a' ? 'mp4' : fileExtension}`,
  } as any);

  formData.append('system_prompt', getTaskParseSystem(profile));

  const token = await getAuthToken();

  let response: Response;
  try {
    response = await fetch(`${AI_PROXY_URL}?action=voice-to-task`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'apikey': SUPABASE_ANON_KEY,
      },
      body: formData,
    });
  } catch (networkError: any) {
    throw new AIUnavailableError(`Network error: ${networkError.message}`);
  }

  if (response.status === 429) {
    const data = await response.json();
    throw new AIRateLimitError(
      data.error || 'Daily AI limit reached. Try again tomorrow.',
      data.calls_used || 40,
      data.daily_limit || 40
    );
  }

  if (!response.ok) {
    let errorText = '';
    try { errorText = await response.text(); } catch {}
    throw new AIUnavailableError(`Voice-to-task ${response.status}: ${errorText.slice(0, 200)}`);
  }

  const data = await response.json();

  if (data.error && !data.tasks_raw) {
    throw new AIUnavailableError(data.error);
  }

  const transcription = data.transcription || '';

  if (!transcription.trim()) {
    return { transcription: '', tasks: [] };
  }

  let tasks: ParsedTask[] = [];
  if (data.tasks_raw) {
    const cleaned = data.tasks_raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    tasks = JSON.parse(cleaned);
  }

  return { transcription, tasks: Array.isArray(tasks) ? tasks : [tasks] };
}

// ============ AI REFLECTION SUMMARY ============

interface ReflectionContext {
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  missedTasks: number;
  topTags: { tag: string; rate: number }[];
  neglectedTags: string[];
  streak: number;
  peakTime: string;
  reflectionText?: string;
  mood?: string;
  challengeReflections?: { title: string; outcome: string; achieved: number; target: number; reflection: string; mood: string }[];
}

const REFLECTION_RULES = `Your job is to write a brief weekly reflection summary (2-4 sentences) based on the user's actual task data.

Rules:
- ONLY reference data that is provided. Never fabricate stats or percentages.
- Be encouraging but honest. Acknowledge good performance and gently note areas for improvement.
- Keep it concise: 2-4 sentences max.
- If the user wrote a personal reflection or selected a mood, weave that into your summary naturally.
- Do NOT use emojis.
- Do NOT use bullet points or lists — write in flowing sentences.
- Never refer to yourself as "I" or "Nyla" in the output — just speak naturally.`;

export async function generateReflectionSummary(
  ctx: ReflectionContext,
  profile?: NylaProfile | null
): Promise<string> {
  const parts: string[] = [
    `Weekly Task Data:`,
    `- Completion rate: ${ctx.completionRate}%`,
    `- Total tasks: ${ctx.totalTasks} (${ctx.completedTasks} done, ${ctx.missedTasks} missed)`,
    `- Current streak: ${ctx.streak} day(s)`,
    `- Most productive time: ${ctx.peakTime}`,
  ];

  if (ctx.topTags.length > 0) {
    parts.push(`- Top focus areas: ${ctx.topTags.map((t) => `${t.tag} (${t.rate}%)`).join(', ')}`);
  }

  if (ctx.neglectedTags.length > 0) {
    parts.push(`- Neglected areas: ${ctx.neglectedTags.join(', ')}`);
  }

  if (ctx.mood) {
    parts.push(`- User's mood this week: ${ctx.mood}`);
  }

  if (ctx.reflectionText) {
    parts.push(`- User's own reflection: "${ctx.reflectionText}"`);
  }

  parts.push(`\nWrite a brief, personalized weekly reflection summary based on this data.`);

  return callAI(parts.join('\n'), getNylaContext(profile) + '\n\n' + REFLECTION_RULES);
}

// ============ AI BEHAVIOURAL MIRROR ============

interface BehaviourContext {
  completionRate: number;
  totalTasks: number;
  completedTasks: number;
  missedTasks: number;
  topTags: { tag: string; rate: number }[];
  neglectedTags: string[];
  streak: number;
  peakTime: string;
  challengeReflections?: { title: string; outcome: string; achieved: number; target: number; reflection: string; mood: string }[];
}

export interface BehaviouralMirror {
  title: string;
  strengths: string[];
  blindSpots: string[];
}

const BEHAVIOUR_RULES = `Your job is to generate "Nyla's Mirror" — a weekly personality snapshot based on the user's task data.

You MUST respond with valid JSON only — no explanation, no markdown, no code fences.

The JSON must match this schema:
{
  "title": "string — a short, catchy personality title for the user this week, e.g. 'A Responsible Planner', 'The Grinder', 'The Balancer', 'Work In Progress'",
  "strengths": ["array of 1-3 short strength observations, each 1-2 sentences"],
  "blindSpots": ["array of 0-2 short blind spot observations, each 1-2 sentences"]
}

Rules:
- The title should be creative but accurate. It must reflect the user's actual behaviour.
- Strengths: highlight what the user did well (consistency, focus areas, streak, completion rate). Be specific — reference their data.
- Blind spots: gently highlight areas to improve. Only include if the data clearly supports it.
- If there are no clear negatives, return an empty blindSpots array. NEVER fabricate weaknesses.
- If there's not enough data to determine strengths, say something like "Keep logging tasks so I can unlock your behavioural insights."
- Do NOT use emojis.
- Keep each observation concise — 1-2 sentences max.
- Never refer to yourself as "Nyla" in the output — just speak naturally.`;

export async function generateBehaviouralMirror(
  ctx: BehaviourContext,
  profile?: NylaProfile | null
): Promise<BehaviouralMirror> {
  const parts: string[] = [
    `Weekly Task Data:`,
    `- Completion rate: ${ctx.completionRate}%`,
    `- Total tasks: ${ctx.totalTasks} (${ctx.completedTasks} done, ${ctx.missedTasks} missed)`,
    `- Current streak: ${ctx.streak} day(s)`,
    `- Most productive time: ${ctx.peakTime}`,
  ];

  if (ctx.topTags.length > 0) {
    parts.push(`- Top focus areas: ${ctx.topTags.map((t) => `${t.tag} (${t.rate}%)`).join(', ')}`);
  }

  if (ctx.neglectedTags.length > 0) {
    parts.push(`- Neglected areas: ${ctx.neglectedTags.join(', ')}`);
  }

  if (ctx.challengeReflections && ctx.challengeReflections.length > 0) {
    parts.push(`\nRecent Challenge Outcomes:`);
    ctx.challengeReflections.forEach((cr) => {
      parts.push(`- "${cr.title}": ${cr.outcome} (${cr.achieved}/${cr.target}). User reflected: "${cr.reflection || 'No reflection'}". Mood: ${cr.mood || 'not specified'}.`);
    });
  }

  parts.push(`\nGenerate the behavioural mirror based on this data.`);

  return callAIJSON<BehaviouralMirror>(parts.join('\n'), getNylaContext(profile) + '\n\n' + BEHAVIOUR_RULES);
}

// ============ AI WEEKLY REFLECTION SUMMARY (Structured) ============

export interface StructuredReflection {
  strengths: string;
  struggles: string;
  emotionalPattern: string;
  focusNextWeek: string;
}

const STRUCTURED_REFLECTION_RULES = `Your job is to write a structured weekly reflection based on the user's actual task data.

You MUST respond with valid JSON only — no explanation, no markdown, no code fences.

The JSON must match this schema:
{
  "strengths": "string — 2-3 sentences about what the user did well this week",
  "struggles": "string — 1-2 sentences about what was challenging or where they fell short",
  "emotionalPattern": "string — 1-2 sentences about the emotional pattern observed (based on mood, consistency, task types)",
  "focusNextWeek": "string — 1-2 sentences suggesting what to focus on next week"
}

Rules:
- ONLY reference data that is provided. Never fabricate stats or percentages.
- Be encouraging but honest.
- If there's not enough data for a section, keep it brief and general rather than fabricating details.
- Do NOT use emojis or bullet points within each field — write flowing text.
- If the user provided a personal reflection or mood, weave that into the emotional pattern.
- Never refer to yourself as "Nyla" in the output — just speak naturally.`;

export async function generateStructuredReflection(
  ctx: ReflectionContext,
  profile?: NylaProfile | null
): Promise<StructuredReflection> {
  const parts: string[] = [
    `Weekly Task Data:`,
    `- Completion rate: ${ctx.completionRate}%`,
    `- Total tasks: ${ctx.totalTasks} (${ctx.completedTasks} done, ${ctx.missedTasks} missed)`,
    `- Current streak: ${ctx.streak} day(s)`,
    `- Most productive time: ${ctx.peakTime}`,
  ];

  if (ctx.topTags.length > 0) {
    parts.push(`- Top focus areas: ${ctx.topTags.map((t) => `${t.tag} (${t.rate}%)`).join(', ')}`);
  }

  if (ctx.neglectedTags.length > 0) {
    parts.push(`- Neglected areas: ${ctx.neglectedTags.join(', ')}`);
  }

  if (ctx.mood) {
    parts.push(`- User's mood this week: ${ctx.mood}`);
  }

  if (ctx.reflectionText) {
    parts.push(`- User's own reflection: "${ctx.reflectionText}"`);
  }

  if (ctx.challengeReflections && ctx.challengeReflections.length > 0) {
    parts.push(`\nRecent Challenge Outcomes:`);
    ctx.challengeReflections.forEach((cr) => {
      parts.push(`- "${cr.title}": ${cr.outcome} (${cr.achieved}/${cr.target}). User reflected: "${cr.reflection || 'No reflection'}". Mood: ${cr.mood || 'not specified'}.`);
    });
  }

  parts.push(`\nGenerate a structured weekly reflection based on this data.`);

  return callAIJSON<StructuredReflection>(parts.join('\n'), getNylaContext(profile) + '\n\n' + STRUCTURED_REFLECTION_RULES);
}

// ============ AI TASK PARSING (Voice & Text) ============

const ALL_TAG_DESCRIPTIONS = `TAG SELECTION — tags must be exactly one of:
- "Work & Career" — job tasks, meetings, emails, presentations, deadlines, interviews, office work, career development
- "Health & Fitness" — exercise, gym, running, yoga, sports, workouts, physical health, diet plans, stretching
- "Learning & Skill Building" — studying, reading books, courses, tutorials, certifications, learning a language, research
- "Finance & Money" — bills, budgeting, investing, saving, bank tasks, subscriptions, funding, payments, financial planning
- "Personal Growth" — journaling, meditation, goal setting, self-improvement habits, mindset work, affirmations, therapy
- "Relationships & Social" — calling family/friends, date nights, meetups, social events, gifts, catching up with people
- "Admin & Life Maintenance" — errands, groceries, cleaning, laundry, appointments, car maintenance, home repairs, paperwork, admin tasks
- "Self-Care" — shower, skincare, grooming, haircut, spa, nails, bath, hygiene routines, relaxation rituals, massage, dental care
- "Creative & Expression" — art, music, writing, photography, design, content creation, crafts, creative projects
- "Spiritual / Purpose" — prayer, church, mosque, temple, spiritual reading, volunteering, charity, purpose-driven reflection
- "Lifestyle & Leisure" — hobbies, gaming, travel, movies, dining out, shopping for fun, entertainment, leisure activities

Pick the MOST SPECIFIC tag. For example:
- "Have a shower" → "Self-Care" (NOT "Lifestyle & Leisure")
- "Do skincare routine" → "Self-Care" (NOT "Health & Fitness")
- "Call mum" → "Relationships & Social"
- "Fund website servers" → "Finance & Money"
- "Go to the gym" → "Health & Fitness"
- "Clean the house" → "Admin & Life Maintenance"
- "Read 50 pages" → "Learning & Skill Building"`;

function buildTagSection(profile?: NylaProfile | null): string {
  if (profile?.app_mode === 'focused' && profile.focus_tags && profile.focus_tags.length > 0) {
    return `TAG SELECTION — the user is in Focused Mode. You MUST assign exactly one tag from this restricted list:\n${profile.focus_tags.map(t => `- "${t}"`).join('\n')}\nDo NOT use any tags outside this list.`;
  }
  return ALL_TAG_DESCRIPTIONS;
}

function getTaskParseSystem(profile?: NylaProfile | null): string {
  return `${getNylaContext(profile)}

Users will describe one or more tasks in natural language. Your job is to extract structured task data for EACH separate task mentioned.

You MUST respond with a valid JSON ARRAY only — no explanation, no markdown, no code fences.

Each item in the array must match this schema:
{
  "title": "string - concise task title",
  "task_type": "one_time" | "recurring" | "challenge",
  "recurrence_rule": "daily" | "weekdays" | "weekends" | "mon_wed_fri" | "tue_thu" | "custom" | null,
  "custom_days": ["mon","tue","wed","thu","fri","sat","sun"] | null,
  "time_block": "morning" | "afternoon" | "evening",
  "tags": ["exactly one tag from the allowed list"],
  "deadline": "YYYY-MM-DD" | null,
  "target_amount": number | null,
  "target_unit": "string" | null,
  "notes": "string" | null
}

Rules:
- If the user mentions multiple tasks or activities, create a SEPARATE object for each one.
- task_type is "recurring" if the user mentions any repeating schedule for that task.
- task_type is "challenge" if the user mentions a measurable goal with a target number/amount and a deadline.
- task_type is "one_time" for everything else.
- For recurring tasks, pick the best matching recurrence_rule. Use "custom" with custom_days if it doesn't fit standard rules.
- For challenge tasks, extract target_amount (number), target_unit (e.g. "pages", "km", "hours"), and deadline.
- time_block: infer from context, default to "morning" if unclear.
- Today's date is ${new Date().toISOString().split('T')[0]}.
- ALWAYS return an array, even if there is only one task — e.g. [{ ... }]

${buildTagSection(profile)}`;
}

export interface ParsedTask {
  title: string;
  task_type: 'one_time' | 'recurring' | 'challenge';
  recurrence_rule: string | null;
  custom_days: string[] | null;
  time_block: 'morning' | 'afternoon' | 'evening';
  tags: TaskTag[];
  deadline: string | null;
  target_amount: number | null;
  target_unit: string | null;
  notes: string | null;
}

export async function parseTaskFromText(userInput: string, profile?: NylaProfile | null): Promise<ParsedTask[]> {
  const prompt = `Parse this task description into a JSON array of tasks:\n\n"${userInput}"`;
  return callAIJSON<ParsedTask[]>(prompt, getTaskParseSystem(profile));
}

// ============ AI CHALLENGE CREATION ============

const CHALLENGE_RULES = `Users describe a goal. You break it down into a structured challenge task with daily targets.

You MUST respond with valid JSON only — no explanation, no markdown, no code fences.

The JSON must match this schema:
{
  "title": "string - concise challenge title",
  "target_amount": number,
  "target_unit": "string (e.g. pages, km, hours, sessions)",
  "deadline": "YYYY-MM-DD",
  "daily_target": number,
  "days_left": number,
  "tags": ["exactly one tag from the allowed list"],
  "time_block": "morning" | "afternoon" | "evening",
  "motivation": "string - one sentence of encouragement"
}

Rules:
- Calculate daily_target as: ceil(target_amount / days_left)
- days_left is the number of days from today to the deadline (inclusive)
- If no deadline is mentioned, suggest one (30 days from today)
- tags must be exactly one of: "Work & Career", "Health & Fitness", "Learning & Skill Building", "Finance & Money", "Personal Growth", "Relationships & Social", "Admin & Life Maintenance", "Self-Care", "Creative & Expression", "Spiritual / Purpose", "Lifestyle & Leisure"
- Today's date is ${new Date().toISOString().split('T')[0]}.`;

export interface ParsedChallenge {
  title: string;
  target_amount: number;
  target_unit: string;
  deadline: string;
  daily_target: number;
  days_left: number;
  tags: TaskTag[];
  time_block: 'morning' | 'afternoon' | 'evening';
  motivation: string;
}

export async function parseChallengeFromText(userInput: string, profile?: NylaProfile | null): Promise<ParsedChallenge> {
  const prompt = `Break down this goal into a challenge task:\n\n"${userInput}"`;
  return callAIJSON<ParsedChallenge>(prompt, getNylaContext(profile) + '\n\n' + CHALLENGE_RULES);
}

// ============ AI SMART SUGGESTIONS ============

const SUGGESTIONS_RULES = `Based on the user's activity data, suggest 2-3 new tasks the user should consider adding.

You MUST respond with valid JSON only — no explanation, no markdown, no code fences.

The JSON must be an array matching this schema:
[
  {
    "title": "string - concise task title",
    "reason": "string - one sentence explaining why this is suggested",
    "task_type": "one_time" | "recurring" | "challenge",
    "tags": ["exactly one tag"],
    "time_block": "morning" | "afternoon" | "evening"
  }
]

Rules:
- Focus suggestions on neglected areas or areas where the user shows declining performance.
- Keep suggestions practical and actionable.
- Do NOT suggest tasks the user is already doing (check the active task list).
- tags must be exactly one of: "Work & Career", "Health & Fitness", "Learning & Skill Building", "Finance & Money", "Personal Growth", "Relationships & Social", "Admin & Life Maintenance", "Self-Care", "Creative & Expression", "Spiritual / Purpose", "Lifestyle & Leisure"`;

export interface TaskSuggestion {
  title: string;
  reason: string;
  task_type: 'one_time' | 'recurring' | 'challenge';
  tags: TaskTag[];
  time_block: 'morning' | 'afternoon' | 'evening';
}

export async function getSmartSuggestions(
  activeTasks: string[],
  neglectedAreas: string[],
  topAreas: string[],
  profile?: NylaProfile | null
): Promise<TaskSuggestion[]> {
  let tagRestriction = '';
  if (profile?.app_mode === 'focused' && profile.focus_tags && profile.focus_tags.length > 0) {
    tagRestriction = `\nIMPORTANT: Only suggest tasks within these tags: ${profile.focus_tags.join(', ')}. Do NOT suggest tasks outside these areas.`;
  }

  const prompt = [
    `User's current active tasks: ${activeTasks.join(', ') || 'None'}`,
    `Neglected areas (low/no activity): ${neglectedAreas.join(', ') || 'None'}`,
    `Strong areas: ${topAreas.join(', ') || 'None'}`,
    tagRestriction,
    `\nSuggest 2-3 new tasks this user should consider.`,
  ].join('\n');

  return callAIJSON<TaskSuggestion[]>(prompt, getNylaContext(profile) + '\n\n' + SUGGESTIONS_RULES);
}

// ============ AI DAILY FOCUS ============

const FOCUS_RULES = `Write a short, powerful daily focus message for the user. This appears as "Today's Focus" when they open the app.

You MUST respond with valid JSON only — no explanation, no markdown, no code fences.

The JSON must match this schema:
{
  "message": "string - a 2-4 sentence motivational focus message"
}

Rules:
- MENTION SPECIFIC TASK NAMES from the data. For example: "Start with your business plan, then hit the gym."
- If there are overdue tasks, call them out by name with urgency.
- If a challenge deadline is near, make it the focus.
- Reference the user's streak or completion rate to motivate them.
- Write in second person ("you"), address the user by name once.
- Keep it to 2-4 sentences max. Punchy, not preachy.
- Do NOT use emojis.
- Do NOT use generic advice like "stay focused" or "take it one step at a time" — be SPECIFIC to their tasks.`;

export interface DailyFocus {
  message: string;
}

export interface DailyFocusContext {
  name?: string;
  tone?: string;
  allTasks: string[];
  overdueTasks: string[];
  challengesDueSoon: { title: string; daysLeft: number }[];
  completionRate7d: number;
  streak: number;
  priorityTasks: string[];
}

export async function generateDailyFocus(ctx: DailyFocusContext, profile?: NylaProfile | null): Promise<DailyFocus> {
  const parts: string[] = [
    `Today's pending tasks: ${ctx.allTasks.length > 0 ? ctx.allTasks.join(', ') : 'None'}`,
    `Overdue tasks: ${ctx.overdueTasks.length > 0 ? ctx.overdueTasks.join(', ') : 'None'}`,
    `Priority tasks: ${ctx.priorityTasks.length > 0 ? ctx.priorityTasks.join(', ') : 'None set'}`,
    `7-day completion rate: ${ctx.completionRate7d}%`,
    `Current streak: ${ctx.streak} day(s)`,
  ];

  if (ctx.challengesDueSoon.length > 0) {
    parts.push(`Challenges due soon: ${ctx.challengesDueSoon.map(c => `"${c.title}" (${c.daysLeft} days left)`).join(', ')}`);
  }

  parts.push('\nWrite the daily focus message.');

  return callAIJSON<DailyFocus>(parts.join('\n'), getNylaContext(profile) + '\n\n' + FOCUS_RULES);
}
