import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { getTaskDetail, updateTask, assignPriorities } from '../lib/tasks';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/ThemeContext';
import { useToast } from '../components/Toast';
import { TAG_COLORS, TAG_ICONS, TASK_TAGS, TaskTag } from '../lib/types';

export default function EditTaskScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const [loadingTask, setLoadingTask] = useState(true);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [taskType, setTaskType] = useState<'one_time' | 'recurring' | 'challenge'>('recurring');
  const [recurrenceRule, setRecurrenceRule] = useState<string>('daily');
  const [timeBlock, setTimeBlock] = useState<string>('morning');
  const [deadline, setDeadline] = useState('');
  const [selectedTags, setSelectedTags] = useState<TaskTag[]>([]);
  const [saving, setSaving] = useState(false);
  const [targetAmount, setTargetAmount] = useState('');
  const [targetUnit, setTargetUnit] = useState('');

  useEffect(() => {
    if (!taskId) return;
    (async () => {
      try {
        const task = await getTaskDetail(taskId);
        if (task) {
          setTitle(task.title || '');
          setNotes(task.notes || '');
          setTaskType(task.task_type || 'recurring');
          setRecurrenceRule(task.recurrence_rule || 'daily');
          setTimeBlock(task.time_block || 'morning');
          setDeadline(task.deadline || '');
          setSelectedTags((task.tags || []) as TaskTag[]);
          setTargetAmount(task.target_amount ? String(task.target_amount) : '');
          setTargetUnit(task.target_unit || '');
        }
      } catch (e: any) {
        toast.error('Something went wrong', e.message);
      } finally {
        setLoadingTask(false);
      }
    })();
  }, [taskId]);

  const toggleTag = (tag: TaskTag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Oops', 'Task title is required'); return; }
    if (selectedTags.length === 0) { toast.error('Oops', 'Select at least one tag'); return; }

    setSaving(true);
    try {
      const updates: any = {
        title: title.trim(),
        notes: notes.trim() || null,
        time_block: timeBlock,
        tags: selectedTags,
      };

      if (taskType === 'recurring') {
        updates.recurrence_rule = recurrenceRule;
      }
      if (taskType === 'one_time' || taskType === 'challenge') {
        updates.deadline = deadline || null;
      }
      if (taskType === 'challenge') {
        updates.target_amount = targetAmount ? Number(targetAmount) : null;
        updates.target_unit = targetUnit.trim() || null;
      }

      await updateTask(taskId!, updates);

      // Recalculate priorities after edit
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const today = new Date().toISOString().split('T')[0];
          await assignPriorities(user.id, today);
        }
      } catch {}

      toast.success('Done!', 'Task updated!'); router.back();
    } catch (error: any) {
      toast.error('Something went wrong', error.message);
    } finally {
      setSaving(false);
    }
  };

  const s = makeStyles(theme);

  const OptionButton = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity style={[s.optionBtn, selected && s.optionBtnSelected]} onPress={onPress}>
      <Text style={[s.optionText, selected && s.optionTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  if (loadingTask) {
    return (
      <View style={[s.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>Edit Task</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.label}>Title</Text>
        <TextInput style={s.input} placeholder="e.g. Morning workout" placeholderTextColor={theme.textTertiary} value={title} onChangeText={setTitle} />

        <Text style={s.label}>Notes (optional)</Text>
        <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Any extra context..." placeholderTextColor={theme.textTertiary} value={notes} onChangeText={setNotes} multiline />

        <Text style={s.label}>Tag</Text>
        <View style={s.tagsGrid}>
          {TASK_TAGS.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            const color = TAG_COLORS[tag];
            const icon = TAG_ICONS[tag];
            return (
              <TouchableOpacity
                key={tag}
                style={[s.tagChip, isSelected && { backgroundColor: color + '20', borderColor: color }]}
                onPress={() => toggleTag(tag)}
              >
                <Text style={{ fontSize: 14 }}>{icon}</Text>
                <Text style={[s.tagChipText, isSelected && { color }]}>{tag}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.label}>Type</Text>
        <View style={s.optionRow}>
          <View style={[s.typeBadge, { backgroundColor: theme.surface, borderColor: theme.surfaceBorder }]}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary }}>
              {taskType === 'one_time' ? 'One-time' : taskType === 'recurring' ? 'Recurring' : 'Challenge'}
            </Text>
          </View>
          <Text style={{ fontSize: 11, color: theme.textTertiary, marginLeft: 8, alignSelf: 'center' }}>
            (Type cannot be changed)
          </Text>
        </View>

        {taskType === 'recurring' && (
          <>
            <Text style={s.label}>Frequency</Text>
            <View style={s.optionRow}>
              <OptionButton label="Daily" selected={recurrenceRule === 'daily'} onPress={() => setRecurrenceRule('daily')} />
              <OptionButton label="Weekdays" selected={recurrenceRule === 'weekdays'} onPress={() => setRecurrenceRule('weekdays')} />
            </View>
            <View style={s.optionRow}>
              <OptionButton label="Mon/Wed/Fri" selected={recurrenceRule === 'mon_wed_fri'} onPress={() => setRecurrenceRule('mon_wed_fri')} />
              <OptionButton label="Tue/Thu" selected={recurrenceRule === 'tue_thu'} onPress={() => setRecurrenceRule('tue_thu')} />
            </View>
            <View style={s.optionRow}>
              <OptionButton label="Weekends" selected={recurrenceRule === 'weekends'} onPress={() => setRecurrenceRule('weekends')} />
            </View>
          </>
        )}

        {(taskType === 'one_time' || taskType === 'challenge') && (
          <>
            <Text style={s.label}>Deadline (YYYY-MM-DD)</Text>
            <TextInput style={s.input} placeholder="e.g. 2026-02-20" placeholderTextColor={theme.textTertiary} value={deadline} onChangeText={setDeadline} />
          </>
        )}

        {taskType === 'challenge' && (
          <>
            <Text style={s.label}>Goal</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="e.g. 500"
                placeholderTextColor={theme.textTertiary}
                value={targetAmount}
                onChangeText={setTargetAmount}
                keyboardType="numeric"
              />
              <TextInput
                style={[s.input, { flex: 1 }]}
                placeholder="e.g. pages"
                placeholderTextColor={theme.textTertiary}
                value={targetUnit}
                onChangeText={setTargetUnit}
              />
            </View>
          </>
        )}

        <Text style={s.label}>Time Block</Text>
        <View style={s.optionRow}>
          <OptionButton label="Morning" selected={timeBlock === 'morning'} onPress={() => setTimeBlock('morning')} />
          <OptionButton label="Afternoon" selected={timeBlock === 'afternoon'} onPress={() => setTimeBlock('afternoon')} />
          <OptionButton label="Evening" selected={timeBlock === 'evening'} onPress={() => setTimeBlock('evening')} />
        </View>

        <TouchableOpacity style={s.saveButton} onPress={handleSave} disabled={saving}>
          <Text style={s.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const makeStyles = (t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: t.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20 },
  backBtn: { color: t.primary, fontSize: 16, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '700', color: t.textPrimary },
  scroll: { flex: 1, paddingHorizontal: 20 },
  label: { fontSize: 14, fontWeight: '600', color: t.textSecondary, marginBottom: 8, marginTop: 20 },
  input: { backgroundColor: t.inputBg, borderRadius: 12, padding: 16, fontSize: 16, color: t.textPrimary, borderWidth: 1, borderColor: t.inputBorder },
  tagsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: t.surface, borderWidth: 1, borderColor: t.surfaceBorder },
  tagChipText: { fontSize: 12, fontWeight: '600', color: t.textSecondary },
  optionRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  optionBtn: { backgroundColor: t.surface, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: t.surfaceBorder },
  optionBtnSelected: { backgroundColor: t.primary, borderColor: t.primary },
  optionText: { color: t.textSecondary, fontSize: 14, fontWeight: '600' },
  optionTextSelected: { color: '#fff' },
  typeBadge: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1 },
  saveButton: { backgroundColor: t.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 30 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});