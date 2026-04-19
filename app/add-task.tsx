import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { createTask } from '../lib/tasks';
import { useTheme } from '../lib/ThemeContext';
import { useToast } from '../components/Toast';
import { useProfile } from '../lib/ProfileContext';
import { buildTemplatePrefill, getRecommendedTemplates, logTemplateUsage, TaskTemplate } from '../lib/templates';
import { TAG_COLORS, TAG_ICONS, TASK_TAGS, TaskTag } from '../lib/types';

function formatDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export default function AddTaskScreen() {
  const { theme } = useTheme();
  const toast = useToast();
  const { profile } = useProfile();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [taskType, setTaskType] = useState<'one_time' | 'recurring' | 'challenge'>('recurring');
  const [recurrenceRule, setRecurrenceRule] = useState<string>('daily');
  const [timeBlock, setTimeBlock] = useState<string>('morning');
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date());
  const [challengeDeadline, setChallengeDeadline] = useState<Date>(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showChallengeDatePicker, setShowChallengeDatePicker] = useState(false);
  const [selectedTags, setSelectedTags] = useState<TaskTag[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTemplateSheet, setShowTemplateSheet] = useState(false);
  const [templateMode, setTemplateMode] = useState<'scratch' | 'templates'>('scratch');
  const [templateCategory, setTemplateCategory] = useState<string>('all');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  // Challenge-specific
  const [targetAmount, setTargetAmount] = useState('');
  const [targetUnit, setTargetUnit] = useState('');

  const toggleTag = (tag: TaskTag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const loadTemplates = async () => {
    setTemplateLoading(true);
    try {
      const focusTags = (profile?.focus_tags || []) as string[];
      const all = await getRecommendedTemplates(focusTags, taskType);
      let filtered = all;
      if (templateCategory !== 'all') {
        filtered = filtered.filter((t) => t.category.toLowerCase() === templateCategory.toLowerCase());
      }
      if (templateSearch.trim()) {
        const q = templateSearch.trim().toLowerCase();
        filtered = filtered.filter((t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.tag || '').toLowerCase().includes(q)
        );
      }
      setTemplates(filtered);
    } catch {
      setTemplates([]);
    } finally {
      setTemplateLoading(false);
    }
  };

  useEffect(() => {
    if (showTemplateSheet && templateMode === 'templates') {
      loadTemplates();
    }
  }, [showTemplateSheet, templateMode, taskType, templateCategory, templateSearch]);

  const availableCategories = useMemo(() => {
    const base = ['all'];
    const categories = Array.from(new Set((templates || []).map((t) => t.category.toLowerCase())));
    return [...base, ...categories];
  }, [templates]);

  const handleSelectTaskType = (type: 'one_time' | 'recurring' | 'challenge') => {
    setTaskType(type);
    setTemplateMode('scratch');
    setTemplateCategory('all');
    setTemplateSearch('');
    setShowTemplateSheet(true);
  };

  const handleApplyTemplate = async (template: TaskTemplate) => {
    const prefill = buildTemplatePrefill(template);

    setTitle(prefill.title || '');
    if (prefill.time_block) setTimeBlock(prefill.time_block);
    if (prefill.recurrence_rule && taskType === 'recurring') setRecurrenceRule(prefill.recurrence_rule);

    if (prefill.tags?.length) {
      const normalized = prefill.tags
        .map((tag) => TASK_TAGS.find((t) => t.toLowerCase() === tag.toLowerCase()))
        .filter(Boolean) as TaskTag[];
      if (normalized.length) setSelectedTags(Array.from(new Set(normalized)));
    }

    if (taskType === 'one_time' && prefill.deadline) {
      setScheduledDate(new Date(prefill.deadline + 'T00:00:00'));
    }

    if (taskType === 'challenge') {
      if (typeof prefill.target_amount === 'number') setTargetAmount(String(prefill.target_amount));
      if (prefill.target_unit) setTargetUnit(prefill.target_unit);
      if (prefill.deadline) setChallengeDeadline(new Date(prefill.deadline + 'T00:00:00'));
    }

    try {
      await logTemplateUsage(template.id);
    } catch {}
    setShowTemplateSheet(false);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Oops', 'Task title is required'); return; }
    if (selectedTags.length === 0) { toast.error('Oops', 'Select at least one tag'); return; }
    if (taskType === 'challenge') {
      if (!targetAmount || isNaN(Number(targetAmount)) || Number(targetAmount) <= 0) {
        toast.error('Oops', 'Enter a valid target amount'); return;
      }
      if (!targetUnit.trim()) { toast.error('Oops', 'Enter a target unit (e.g. pages, km, hours)'); return; }
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      let deadlineValue: string | null = null;
      if (taskType === 'one_time') {
        deadlineValue = formatDateStr(scheduledDate);
      } else if (taskType === 'challenge') {
        deadlineValue = formatDateStr(challengeDeadline);
      }

      await createTask({
        user_id: user.id,
        title: title.trim(),
        notes: notes.trim() || null,
        task_type: taskType,
        recurrence_rule: taskType === 'recurring' ? recurrenceRule : null,
        time_block: timeBlock,
        deadline: deadlineValue,
        tags: selectedTags,
        is_active: true,
        target_amount: taskType === 'challenge' ? Number(targetAmount) : null,
        target_unit: taskType === 'challenge' ? targetUnit.trim() : null,
      });
      toast.success('Done!', 'Task created!'); router.back();
    } catch (error: any) {
      toast.error('Something went wrong', error.message);
    } finally {
      setLoading(false);
    }
  };

  const s = makeStyles(theme);

  const OptionButton = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <TouchableOpacity style={[s.optionBtn, selected && s.optionBtnSelected]} onPress={onPress}>
      <Text style={[s.optionText, selected && s.optionTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={s.backBtn}>← Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>New Task</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.label}>Title</Text>
        <TextInput style={s.input} placeholder="e.g. Morning workout" placeholderTextColor={theme.textTertiary} value={title} onChangeText={setTitle} />

        <Text style={s.label}>Notes (optional)</Text>
        <TextInput style={[s.input, { height: 80, textAlignVertical: 'top' }]} placeholder="Any extra context..." placeholderTextColor={theme.textTertiary} value={notes} onChangeText={setNotes} multiline />

        <Text style={s.label}>Tag (required)</Text>
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
          <OptionButton label="Recurring" selected={taskType === 'recurring'} onPress={() => handleSelectTaskType('recurring')} />
          <OptionButton label="One-time" selected={taskType === 'one_time'} onPress={() => handleSelectTaskType('one_time')} />
          <OptionButton label="Challenge" selected={taskType === 'challenge'} onPress={() => handleSelectTaskType('challenge')} />
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

        {taskType === 'one_time' && (
          <>
            <Text style={s.label}>Scheduled Date</Text>
            <TouchableOpacity
              style={s.datePickerBtn}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={s.datePickerIcon}>📅</Text>
              <Text style={s.datePickerText}>{formatDateDisplay(scheduledDate)}</Text>
              <Text style={s.datePickerArrow}>▾</Text>
            </TouchableOpacity>
            {formatDateStr(scheduledDate) === formatDateStr(new Date()) && (
              <Text style={[s.dateHint, { color: theme.primary }]}>Scheduled for today</Text>
            )}
            {showDatePicker && (
              <DateTimePicker
                value={scheduledDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(event, selected) => {
                  setShowDatePicker(Platform.OS === 'ios');
                  if (selected) setScheduledDate(selected);
                }}
                themeVariant="dark"
              />
            )}
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
            <Text style={s.label}>Deadline</Text>
            <TouchableOpacity
              style={s.datePickerBtn}
              onPress={() => setShowChallengeDatePicker(true)}
            >
              <Text style={s.datePickerIcon}>📅</Text>
              <Text style={s.datePickerText}>{formatDateDisplay(challengeDeadline)}</Text>
              <Text style={s.datePickerArrow}>▾</Text>
            </TouchableOpacity>
            {showChallengeDatePicker && (
              <DateTimePicker
                value={challengeDeadline}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={(event, selected) => {
                  setShowChallengeDatePicker(Platform.OS === 'ios');
                  if (selected) setChallengeDeadline(selected);
                }}
                themeVariant="dark"
              />
            )}
            <View style={s.challengePreview}>
              <Text style={s.challengePreviewText}>
                {targetAmount && targetUnit
                  ? `📊 ${targetAmount} ${targetUnit} by ${formatDateDisplay(challengeDeadline)}`
                  : '📊 Fill in the goal details above'}
              </Text>
              {targetAmount && (() => {
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const dl = new Date(challengeDeadline); dl.setHours(0, 0, 0, 0);
                const daysLeft = Math.max(Math.ceil((dl.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)), 1);
                const daily = Math.ceil(Number(targetAmount) / daysLeft);
                return (
                  <Text style={s.challengePreviewSub}>
                    ≈ {daily} {targetUnit || 'units'}/day · {daysLeft} days left
                  </Text>
                );
              })()}
            </View>
          </>
        )}

        <Text style={s.label}>Time Block</Text>
        <View style={s.optionRow}>
          <OptionButton label="Morning" selected={timeBlock === 'morning'} onPress={() => setTimeBlock('morning')} />
          <OptionButton label="Afternoon" selected={timeBlock === 'afternoon'} onPress={() => setTimeBlock('afternoon')} />
          <OptionButton label="Evening" selected={timeBlock === 'evening'} onPress={() => setTimeBlock('evening')} />
        </View>

        <TouchableOpacity style={s.saveButton} onPress={handleSave} disabled={loading}>
          <Text style={s.saveButtonText}>{loading ? 'Saving...' : 'Create Task'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal
        visible={showTemplateSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTemplateSheet(false)}
      >
        <View style={s.sheetBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowTemplateSheet(false)} />
          <View style={s.sheetCard}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>
                {taskType === 'one_time' ? 'One-time Task' : taskType === 'recurring' ? 'Recurring Task' : 'Challenge Task'}
              </Text>
              <TouchableOpacity onPress={() => setShowTemplateSheet(false)}>
                <Text style={s.sheetClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={s.sheetModeRow}>
              <TouchableOpacity
                style={[s.sheetModeBtn, templateMode === 'scratch' && s.sheetModeBtnActive]}
                onPress={() => setTemplateMode('scratch')}
              >
                <Text style={[s.sheetModeText, templateMode === 'scratch' && s.sheetModeTextActive]}>
                  Create from scratch
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.sheetModeBtn, templateMode === 'templates' && s.sheetModeBtnActive]}
                onPress={() => setTemplateMode('templates')}
              >
                <Text style={[s.sheetModeText, templateMode === 'templates' && s.sheetModeTextActive]}>
                  Use template
                </Text>
              </TouchableOpacity>
            </View>

            {templateMode === 'scratch' ? (
              <View style={s.sheetScratchWrap}>
                <Text style={s.sheetHint}>You can continue filling this task manually.</Text>
                <TouchableOpacity style={s.sheetPrimaryBtn} onPress={() => setShowTemplateSheet(false)}>
                  <Text style={s.sheetPrimaryBtnText}>Continue</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flex: 1 }}>
                <TextInput
                  style={s.templateSearch}
                  placeholder="Search templates..."
                  placeholderTextColor={theme.textTertiary}
                  value={templateSearch}
                  onChangeText={setTemplateSearch}
                />

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ maxHeight: 48 }}
                  contentContainerStyle={s.categoryRow}
                >
                  {availableCategories.map((cat) => {
                    const active = templateCategory === cat;
                    const label = cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1);
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[s.categoryChip, active && s.categoryChipActive]}
                        onPress={() => setTemplateCategory(cat)}
                      >
                        <Text style={[s.categoryChipText, active && s.categoryChipTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {templateLoading ? (
                  <View style={s.templateLoadingWrap}>
                    <ActivityIndicator color={theme.primary} />
                    <Text style={s.sheetHint}>Loading templates...</Text>
                  </View>
                ) : (
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                    {templates.map((tpl) => (
                      <TouchableOpacity key={tpl.id} style={s.templateItem} onPress={() => handleApplyTemplate(tpl)}>
                        <View style={s.templateItemLeft}>
                          <Text style={s.templateIcon}>{tpl.icon || '✨'}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={s.templateTitle}>{tpl.name}</Text>
                            {!!tpl.description && <Text style={s.templateDesc}>{tpl.description}</Text>}
                          </View>
                        </View>
                        <Text style={s.templateArrow}>›</Text>
                      </TouchableOpacity>
                    ))}
                    {!templates.length && (
                      <Text style={[s.sheetHint, { textAlign: 'center', marginTop: 24 }]}>
                        No templates found for this filter.
                      </Text>
                    )}
                    <View style={{ height: 16 }} />
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </View>
      </Modal>
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
  saveButton: { backgroundColor: t.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 30 },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: t.inputBg,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: t.inputBorder,
    gap: 10,
  },
  datePickerIcon: { fontSize: 16 },
  datePickerText: { flex: 1, fontSize: 15, fontWeight: '600', color: t.textPrimary },
  datePickerArrow: { fontSize: 12, color: t.textSecondary },
  dateHint: { fontSize: 12, fontWeight: '500', marginTop: 6 },
  challengePreview: { backgroundColor: t.surface, borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: t.surfaceBorder },
  challengePreviewText: { fontSize: 14, fontWeight: '600', color: t.textPrimary },
  challengePreviewSub: { fontSize: 12, color: t.textSecondary, marginTop: 6 },

  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: t.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    minHeight: 360,
    maxHeight: '80%',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderColor: t.surfaceBorder,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: t.textPrimary },
  sheetClose: { fontSize: 18, color: t.textSecondary, padding: 6 },
  sheetModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  sheetModeBtn: {
    flex: 1,
    backgroundColor: t.surface,
    borderWidth: 1,
    borderColor: t.surfaceBorder,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  sheetModeBtnActive: {
    backgroundColor: t.primaryMuted,
    borderColor: t.primary,
  },
  sheetModeText: { fontSize: 13, color: t.textSecondary, fontWeight: '600' },
  sheetModeTextActive: { color: t.primary },
  sheetScratchWrap: {
    paddingVertical: 16,
    gap: 12,
  },
  sheetHint: { color: t.textSecondary, fontSize: 13 },
  sheetPrimaryBtn: {
    backgroundColor: t.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetPrimaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  templateSearch: {
    backgroundColor: t.inputBg,
    borderColor: t.inputBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: t.textPrimary,
    fontSize: 14,
    marginBottom: 10,
  },
  categoryRow: {
    gap: 8,
    paddingBottom: 10,
    alignItems: 'center',
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: t.surfaceBorder,
    backgroundColor: t.surface,
  },
  categoryChipActive: {
    borderColor: t.primary,
    backgroundColor: t.primaryMuted,
  },
  categoryChipText: { color: t.textSecondary, fontSize: 12, fontWeight: '600' },
  categoryChipTextActive: { color: t.primary },
  templateLoadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: t.surfaceBorder,
    backgroundColor: t.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  templateItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    paddingRight: 10,
  },
  templateIcon: { fontSize: 18 },
  templateTitle: { color: t.textPrimary, fontSize: 14, fontWeight: '700' },
  templateDesc: { color: t.textSecondary, fontSize: 12, marginTop: 2 },
  templateArrow: { color: t.textTertiary, fontSize: 20, lineHeight: 20 },
});