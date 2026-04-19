-- ============================================================
-- Phase A: Seed initial system templates
-- ============================================================

-- One-time templates
INSERT INTO task_templates (name, description, task_type, category, tag, icon, payload, sort_order)
SELECT * FROM (
  VALUES
    (
      'Eat a Healthy Meal',
      'Simple one-time self-care meal check-in.',
      'one_time',
      'health',
      'Health & Fitness',
      '🥗',
      '{"title":"Eat a healthy meal","tag":"Health & Fitness","time_block":"afternoon"}'::jsonb,
      10
    ),
    (
      'Take a Walk',
      'Quick movement boost during the day.',
      'one_time',
      'health',
      'Health & Fitness',
      '🚶',
      '{"title":"Take a 20-minute walk","tag":"Health & Fitness","time_block":"afternoon"}'::jsonb,
      20
    ),
    (
      'Deep Work Sprint',
      'Focused one-time work session.',
      'one_time',
      'good',
      'Work & Career',
      '💻',
      '{"title":"Deep work sprint (45 mins)","tag":"Work & Career","time_block":"morning"}'::jsonb,
      30
    ),
    (
      'Journal Reflection',
      'Short written reflection.',
      'one_time',
      'good',
      'Personal Growth',
      '📝',
      '{"title":"Write a short journal reflection","tag":"Personal Growth","time_block":"evening"}'::jsonb,
      40
    )
) AS seed(name, description, task_type, category, tag, icon, payload, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM task_templates t
  WHERE t.name = seed.name
    AND t.task_type = seed.task_type
    AND t.category = seed.category
);

-- Recurring templates
INSERT INTO task_templates (name, description, task_type, category, tag, icon, payload, sort_order)
SELECT * FROM (
  VALUES
    (
      'Drink Water',
      'Hydration habit every day.',
      'recurring',
      'health',
      'Health & Fitness',
      '💧',
      '{"title":"Drink water","tag":"Health & Fitness","time_block":"morning","recurrence_type":"daily"}'::jsonb,
      50
    ),
    (
      'Morning Stretch',
      'Daily body reset habit.',
      'recurring',
      'health',
      'Health & Fitness',
      '🤸',
      '{"title":"Morning stretch (10 mins)","tag":"Health & Fitness","time_block":"morning","recurrence_type":"daily"}'::jsonb,
      60
    ),
    (
      'Read 20 Minutes',
      'Learning consistency habit.',
      'recurring',
      'good',
      'Learning & Skill Building',
      '📚',
      '{"title":"Read 20 minutes","tag":"Learning & Skill Building","time_block":"evening","recurrence_type":"daily"}'::jsonb,
      70
    ),
    (
      'Gym Routine',
      'Weekly custom-day workout pattern.',
      'recurring',
      'health',
      'Health & Fitness',
      '🏋️',
      '{"title":"Gym session","tag":"Health & Fitness","time_block":"evening","recurrence_type":"custom","custom_days":["mon","wed","fri"]}'::jsonb,
      80
    )
) AS seed(name, description, task_type, category, tag, icon, payload, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM task_templates t
  WHERE t.name = seed.name
    AND t.task_type = seed.task_type
    AND t.category = seed.category
);

-- Challenge templates
INSERT INTO task_templates (name, description, task_type, category, tag, icon, payload, sort_order)
SELECT * FROM (
  VALUES
    (
      'Read 300 Pages',
      'Monthly reading challenge.',
      'challenge',
      'good',
      'Learning & Skill Building',
      '📖',
      '{"title":"Read 300 pages this month","tag":"Learning & Skill Building","time_block":"evening","target_amount":300,"target_unit":"pages","deadline_offset_days":30}'::jsonb,
      90
    ),
    (
      'Save $500',
      'Short-term money discipline challenge.',
      'challenge',
      'todo',
      'Finance & Money',
      '💵',
      '{"title":"Save $500","tag":"Finance & Money","time_block":"afternoon","target_amount":500,"target_unit":"dollars","deadline_offset_days":30}'::jsonb,
      100
    ),
    (
      'Walk 100000 Steps',
      'Activity challenge for consistency.',
      'challenge',
      'health',
      'Health & Fitness',
      '👟',
      '{"title":"Walk 100,000 steps","tag":"Health & Fitness","time_block":"afternoon","target_amount":100000,"target_unit":"steps","deadline_offset_days":30}'::jsonb,
      110
    )
) AS seed(name, description, task_type, category, tag, icon, payload, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM task_templates t
  WHERE t.name = seed.name
    AND t.task_type = seed.task_type
    AND t.category = seed.category
);
