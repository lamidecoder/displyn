-- ============================================================
-- Expand template library for in-frame Task Creator
-- Uses existing TaskTag values; categories are UI grouping only
-- ============================================================

INSERT INTO task_templates (name, description, task_type, category, tag, icon, payload, sort_order)
SELECT
  seed.name,
  seed.description,
  seed.task_type::text,
  seed.category,
  seed.tag,
  seed.icon,
  seed.payload::jsonb,
  seed.sort_order
FROM (
  VALUES
    ('Brush Your Teeth', 'Daily hygiene habit.', 'recurring', 'selfcare', 'Self-Care', '🪥', '{"title":"Brush your teeth","tag":"Self-Care","time_block":"morning","recurrence_type":"daily"}', 1000),
    ('Take a Shower', 'Daily shower routine.', 'recurring', 'selfcare', 'Self-Care', '🚿', '{"title":"Take a shower","tag":"Self-Care","time_block":"morning","recurrence_type":"daily"}', 1010),
    ('Wash Face', 'Simple face wash routine.', 'recurring', 'selfcare', 'Self-Care', '🧼', '{"title":"Wash face","tag":"Self-Care","time_block":"morning","recurrence_type":"daily"}', 1020),
    ('Skin Care', 'Complete skincare routine.', 'recurring', 'selfcare', 'Self-Care', '🧴', '{"title":"Skincare routine","tag":"Self-Care","time_block":"evening","recurrence_type":"daily"}', 1030),
    ('Dental Check-Up', 'Book or attend dental check-up.', 'one_time', 'selfcare', 'Self-Care', '🦷', '{"title":"Dental check-up","tag":"Self-Care","time_block":"afternoon"}', 1040),
    ('Take a Cold Shower', 'Cold exposure for energy.', 'one_time', 'selfcare', 'Self-Care', '🧊', '{"title":"Take a cold shower","tag":"Self-Care","time_block":"morning"}', 1050),
    ('Take a Selfie', 'Capture progress selfie.', 'one_time', 'selfcare', 'Self-Care', '📸', '{"title":"Take a selfie","tag":"Self-Care","time_block":"afternoon"}', 1060),

    ('Eat Breakfast', 'Healthy breakfast habit.', 'recurring', 'health', 'Health & Fitness', '🥣', '{"title":"Eat breakfast","tag":"Health & Fitness","time_block":"morning","recurrence_type":"daily"}', 1070),
    ('Eat a Healthy Meal', 'Nutrition check-in meal.', 'one_time', 'health', 'Health & Fitness', '🥗', '{"title":"Eat a healthy meal","tag":"Health & Fitness","time_block":"afternoon"}', 1080),
    ('Go for a Walk', 'Walk for movement and focus.', 'one_time', 'health', 'Health & Fitness', '🚶', '{"title":"Go for a walk","tag":"Health & Fitness","time_block":"afternoon"}', 1090),
    ('Take the Stairs', 'Use stairs for extra movement.', 'one_time', 'health', 'Health & Fitness', '🪜', '{"title":"Take the stairs","tag":"Health & Fitness","time_block":"afternoon"}', 1100),
    ('Health Checkup', 'General health checkup.', 'one_time', 'health', 'Health & Fitness', '💗', '{"title":"Health checkup","tag":"Health & Fitness","time_block":"afternoon"}', 1110),
    ('Work Out', 'General workout session.', 'recurring', 'health', 'Health & Fitness', '🏋️', '{"title":"Workout","tag":"Health & Fitness","time_block":"afternoon","recurrence_type":"daily"}', 1120),
    ('Run', 'Cardio run routine.', 'recurring', 'health', 'Health & Fitness', '🏃', '{"title":"Run","tag":"Health & Fitness","time_block":"afternoon","recurrence_type":"daily"}', 1130),
    ('Cycle', 'Cycling session.', 'recurring', 'health', 'Health & Fitness', '🚴', '{"title":"Cycle","tag":"Health & Fitness","time_block":"afternoon","recurrence_type":"daily"}', 1140),
    ('Swim', 'Swimming routine.', 'recurring', 'health', 'Health & Fitness', '🏊', '{"title":"Swim","tag":"Health & Fitness","time_block":"afternoon","recurrence_type":"daily"}', 1150),
    ('Yoga', 'Yoga practice.', 'recurring', 'health', 'Health & Fitness', '🧘', '{"title":"Yoga","tag":"Health & Fitness","time_block":"morning","recurrence_type":"daily"}', 1160),
    ('Dance', 'Dance practice session.', 'recurring', 'health', 'Health & Fitness', '💃', '{"title":"Dance practice","tag":"Health & Fitness","time_block":"evening","recurrence_type":"daily"}', 1170),
    ('Pilates', 'Pilates session.', 'recurring', 'health', 'Health & Fitness', '🤸', '{"title":"Pilates","tag":"Health & Fitness","time_block":"morning","recurrence_type":"daily"}', 1180),
    ('Tennis', 'Tennis practice.', 'recurring', 'health', 'Health & Fitness', '🎾', '{"title":"Tennis practice","tag":"Health & Fitness","time_block":"afternoon","recurrence_type":"daily"}', 1190),
    ('Traditional Strength Training', 'Strength session.', 'recurring', 'health', 'Health & Fitness', '💪', '{"title":"Strength training","tag":"Health & Fitness","time_block":"afternoon","recurrence_type":"daily"}', 1200),
    ('Boxing', 'Boxing session.', 'recurring', 'health', 'Health & Fitness', '🥊', '{"title":"Boxing session","tag":"Health & Fitness","time_block":"afternoon","recurrence_type":"daily"}', 1210),
    ('Drink Water', 'Hydration habit.', 'recurring', 'health', 'Health & Fitness', '💧', '{"title":"Drink water","tag":"Health & Fitness","time_block":"morning","recurrence_type":"daily"}', 1220),
    ('Take Vitamins', 'Daily vitamins.', 'recurring', 'health', 'Health & Fitness', '💊', '{"title":"Take vitamins","tag":"Health & Fitness","time_block":"morning","recurrence_type":"daily"}', 1230),
    ('Record Weight', 'Track body weight.', 'recurring', 'health', 'Health & Fitness', '⚖️', '{"title":"Record weight","tag":"Health & Fitness","time_block":"morning","recurrence_type":"daily"}', 1240),
    ('Record Lean Body Mass', 'Track lean body mass.', 'recurring', 'health', 'Health & Fitness', '📈', '{"title":"Record lean body mass","tag":"Health & Fitness","time_block":"morning","recurrence_type":"daily"}', 1250),
    ('Record Fat Percentage', 'Track body fat percentage.', 'recurring', 'health', 'Health & Fitness', '📊', '{"title":"Record fat percentage","tag":"Health & Fitness","time_block":"morning","recurrence_type":"daily"}', 1260),
    ('Record Height', 'Track height measurement.', 'one_time', 'health', 'Health & Fitness', '📏', '{"title":"Record height","tag":"Health & Fitness","time_block":"afternoon"}', 1270),
    ('Record Blood Glucose', 'Track blood glucose.', 'recurring', 'health', 'Health & Fitness', '🩸', '{"title":"Record blood glucose","tag":"Health & Fitness","time_block":"morning","recurrence_type":"daily"}', 1280),
    ('Sleep', 'Sleep consistency habit.', 'recurring', 'health', 'Health & Fitness', '😴', '{"title":"Sleep on time","tag":"Health & Fitness","time_block":"evening","recurrence_type":"daily"}', 1290),
    ('Record Blood Pressure', 'Track blood pressure.', 'recurring', 'health', 'Health & Fitness', '🩺', '{"title":"Record blood pressure","tag":"Health & Fitness","time_block":"morning","recurrence_type":"daily"}', 1300),
    ('Limit Coffee', 'Reduce coffee intake.', 'recurring', 'health', 'Health & Fitness', '☕', '{"title":"Limit coffee","tag":"Health & Fitness","time_block":"afternoon","recurrence_type":"daily"}', 1310),
    ('Limit Alcoholic Drinks', 'Reduce alcohol intake.', 'recurring', 'health', 'Health & Fitness', '🍷', '{"title":"Limit alcoholic drinks","tag":"Health & Fitness","time_block":"evening","recurrence_type":"daily"}', 1320),
    ('Wash Your Hands', 'Hand hygiene habit.', 'recurring', 'health', 'Health & Fitness', '🧽', '{"title":"Wash your hands","tag":"Health & Fitness","time_block":"afternoon","recurrence_type":"daily"}', 1330),
    ('Time in Daylight', 'Get daylight exposure.', 'one_time', 'health', 'Health & Fitness', '🌤️', '{"title":"Spend time in daylight","tag":"Health & Fitness","time_block":"afternoon"}', 1340),

    ('Read a Book', 'Daily reading habit.', 'recurring', 'mindset', 'Learning & Skill Building', '📖', '{"title":"Read a book","tag":"Learning & Skill Building","time_block":"evening","recurrence_type":"daily"}', 1350),
    ('Learn', 'General learning block.', 'recurring', 'mindset', 'Learning & Skill Building', '📚', '{"title":"Learn","tag":"Learning & Skill Building","time_block":"evening","recurrence_type":"daily"}', 1360),
    ('Learn a Language', 'Language learning session.', 'recurring', 'mindset', 'Learning & Skill Building', '🈶', '{"title":"Learn a language","tag":"Learning & Skill Building","time_block":"evening","recurrence_type":"daily"}', 1370),
    ('Play Instrument', 'Practice instrument.', 'recurring', 'mindset', 'Creative & Expression', '🎹', '{"title":"Play instrument","tag":"Creative & Expression","time_block":"evening","recurrence_type":"daily"}', 1380),
    ('Journal Your Thoughts', 'Write your thoughts.', 'recurring', 'mindset', 'Personal Growth', '📝', '{"title":"Journal your thoughts","tag":"Personal Growth","time_block":"evening","recurrence_type":"daily"}', 1390),
    ('Listen to a Podcast', 'Learning by listening.', 'one_time', 'mindset', 'Learning & Skill Building', '🎙️', '{"title":"Listen to a podcast","tag":"Learning & Skill Building","time_block":"afternoon"}', 1400),
    ('Listen to an Audiobook', 'Audiobook learning session.', 'one_time', 'mindset', 'Learning & Skill Building', '🎧', '{"title":"Listen to an audiobook","tag":"Learning & Skill Building","time_block":"afternoon"}', 1410),
    ('Meditate', 'Mindfulness practice.', 'recurring', 'mindset', 'Personal Growth', '🧘‍♂️', '{"title":"Meditate","tag":"Personal Growth","time_block":"morning","recurrence_type":"daily"}', 1420),
    ('Smile', 'Intentional positive mood.', 'one_time', 'mindset', 'Personal Growth', '🙂', '{"title":"Smile intentionally","tag":"Personal Growth","time_block":"afternoon"}', 1430),
    ('Wake Up on Time', 'Consistent wake-up.', 'recurring', 'mindset', 'Personal Growth', '⏰', '{"title":"Wake up on time","tag":"Personal Growth","time_block":"morning","recurrence_type":"daily"}', 1440),
    ('Go to Sleep on Time', 'Consistent bedtime.', 'recurring', 'mindset', 'Personal Growth', '🌙', '{"title":"Go to sleep on time","tag":"Personal Growth","time_block":"evening","recurrence_type":"daily"}', 1450),
    ('Reflect on My Day', 'End-of-day reflection.', 'recurring', 'mindset', 'Personal Growth', '🤔', '{"title":"Reflect on my day","tag":"Personal Growth","time_block":"evening","recurrence_type":"daily"}', 1460),
    ('Mindful Session', 'Focused mindful session.', 'recurring', 'mindset', 'Personal Growth', '🧠', '{"title":"Mindful session","tag":"Personal Growth","time_block":"morning","recurrence_type":"daily"}', 1470),

    ('Pray', 'Prayer routine.', 'recurring', 'mindset', 'Spiritual / Purpose', '🙏', '{"title":"Pray","tag":"Spiritual / Purpose","time_block":"morning","recurrence_type":"daily"}', 1480),
    ('Read Bible', 'Read a Bible passage.', 'recurring', 'mindset', 'Spiritual / Purpose', '📘', '{"title":"Read Bible","tag":"Spiritual / Purpose","time_block":"morning","recurrence_type":"daily"}', 1490),

    ('Plan Tomorrow', 'Set tomorrow priorities.', 'one_time', 'work', 'Work & Career', '📋', '{"title":"Plan tomorrow","tag":"Work & Career","time_block":"evening"}', 1500),
    ('Clean up Email', 'Inbox cleanup block.', 'one_time', 'work', 'Work & Career', '📨', '{"title":"Clean up email","tag":"Work & Career","time_block":"afternoon"}', 1510),
    ('Set Daily Goals', 'Define today goals.', 'one_time', 'work', 'Work & Career', '🗓️', '{"title":"Set daily goals","tag":"Work & Career","time_block":"morning"}', 1520),
    ('Deep Work', 'High-focus work sprint.', 'one_time', 'work', 'Work & Career', '🧠', '{"title":"Deep work","tag":"Work & Career","time_block":"morning"}', 1530),
    ('Take Breaks', 'Intentional work breaks.', 'recurring', 'work', 'Work & Career', '⏳', '{"title":"Take breaks","tag":"Work & Career","time_block":"afternoon","recurrence_type":"daily"}', 1540),
    ('Listen to Music', 'Focused music time.', 'one_time', 'work', 'Creative & Expression', '🎵', '{"title":"Listen to music","tag":"Creative & Expression","time_block":"afternoon"}', 1550),

    ('Smile at a Stranger', 'Social confidence action.', 'one_time', 'social', 'Relationships & Social', '🙂', '{"title":"Smile at a stranger","tag":"Relationships & Social","time_block":"afternoon"}', 1560),
    ('Give a Compliment', 'Give someone a compliment.', 'one_time', 'social', 'Relationships & Social', '🤗', '{"title":"Give a compliment","tag":"Relationships & Social","time_block":"afternoon"}', 1570),
    ('Leave the House', 'Step out and reset.', 'one_time', 'social', 'Relationships & Social', '🏠', '{"title":"Leave the house","tag":"Relationships & Social","time_block":"afternoon"}', 1580),
    ('Start a Conversation', 'Initiate one conversation.', 'one_time', 'social', 'Relationships & Social', '💬', '{"title":"Start a conversation","tag":"Relationships & Social","time_block":"afternoon"}', 1590),
    ('Give Someone a Hug', 'Connection action.', 'one_time', 'social', 'Relationships & Social', '🤗', '{"title":"Give someone a hug","tag":"Relationships & Social","time_block":"afternoon"}', 1600),
    ('Help Someone', 'Perform one helpful action.', 'one_time', 'social', 'Relationships & Social', '🧑‍🤝‍🧑', '{"title":"Help someone","tag":"Relationships & Social","time_block":"afternoon"}', 1610),
    ('Call Parents', 'Reach out to parents.', 'one_time', 'social', 'Relationships & Social', '👨‍👩‍👧‍👦', '{"title":"Call parents","tag":"Relationships & Social","time_block":"evening"}', 1620),
    ('Meet a Friend', 'Social catch-up.', 'one_time', 'social', 'Relationships & Social', '👥', '{"title":"Meet a friend","tag":"Relationships & Social","time_block":"evening"}', 1630),
    ('Have Sex', 'Intimacy and connection.', 'one_time', 'social', 'Lifestyle & Leisure', '💞', '{"title":"Have sex","tag":"Lifestyle & Leisure","time_block":"evening"}', 1640),

    ('Track Expenses', 'Log daily expenses.', 'recurring', 'finance', 'Finance & Money', '💰', '{"title":"Track expenses","tag":"Finance & Money","time_block":"evening","recurrence_type":"daily"}', 1650),

    ('Make Your Bed', 'Simple room reset.', 'recurring', 'home', 'Admin & Life Maintenance', '🛏️', '{"title":"Make your bed","tag":"Admin & Life Maintenance","time_block":"morning","recurrence_type":"daily"}', 1660),
    ('Take the Trash Out', 'Home chore task.', 'one_time', 'home', 'Admin & Life Maintenance', '🗑️', '{"title":"Take the trash out","tag":"Admin & Life Maintenance","time_block":"afternoon"}', 1670),
    ('Laundry', 'Laundry chore task.', 'one_time', 'home', 'Admin & Life Maintenance', '👕', '{"title":"Do laundry","tag":"Admin & Life Maintenance","time_block":"afternoon"}', 1680),
    ('Walk Your Dog', 'Walk your dog.', 'one_time', 'home', 'Admin & Life Maintenance', '🐕', '{"title":"Walk your dog","tag":"Admin & Life Maintenance","time_block":"afternoon"}', 1690),
    ('Water Plant', 'Water indoor/outdoor plants.', 'one_time', 'home', 'Admin & Life Maintenance', '🪴', '{"title":"Water plants","tag":"Admin & Life Maintenance","time_block":"morning"}', 1700),
    ('Clear the Fridge', 'Clean and organize fridge.', 'one_time', 'home', 'Admin & Life Maintenance', '🧊', '{"title":"Clear the fridge","tag":"Admin & Life Maintenance","time_block":"afternoon"}', 1710),
    ('Wash the Dishes', 'Kitchen cleanup.', 'one_time', 'home', 'Admin & Life Maintenance', '🍽️', '{"title":"Wash the dishes","tag":"Admin & Life Maintenance","time_block":"evening"}', 1720),
    ('Vacuum', 'Vacuum cleaning task.', 'one_time', 'home', 'Admin & Life Maintenance', '🧹', '{"title":"Vacuum","tag":"Admin & Life Maintenance","time_block":"afternoon"}', 1730),
    ('Dust', 'Dust surfaces.', 'one_time', 'home', 'Admin & Life Maintenance', '🪶', '{"title":"Dust","tag":"Admin & Life Maintenance","time_block":"afternoon"}', 1740)
) AS seed(name, description, task_type, category, tag, icon, payload, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM task_templates t
  WHERE t.name = seed.name
    AND t.task_type = seed.task_type::text
);

-- Additional templates and challenge variants
INSERT INTO task_templates (name, description, task_type, category, tag, icon, payload, sort_order)
SELECT
  seed.name,
  seed.description,
  seed.task_type::text,
  seed.category,
  seed.tag,
  seed.icon,
  seed.payload::jsonb,
  seed.sort_order
FROM (
  VALUES
    -- Health & Fitness
    ('Steps', 'Daily step goal habit.', 'recurring', 'health', 'Health & Fitness', '👣', '{"title":"Hit daily step goal","tag":"Health & Fitness","time_block":"afternoon","recurrence_type":"daily"}', 1820),
    ('Climb Flights', 'Take stairs and log flights climbed.', 'recurring', 'health', 'Health & Fitness', '🪜', '{"title":"Climb flights","tag":"Health & Fitness","time_block":"afternoon","recurrence_type":"daily"}', 1830),
    ('Burn Calories', 'Target calorie burn activity.', 'recurring', 'health', 'Health & Fitness', '🔥', '{"title":"Burn calories","tag":"Health & Fitness","time_block":"afternoon","recurrence_type":"daily"}', 1840),
    ('Face Mask', 'Skincare mask routine.', 'one_time', 'selfcare', 'Self-Care', '🧖', '{"title":"Apply face mask","tag":"Self-Care","time_block":"evening"}', 1850),
    ('Drink Tea', 'Tea and hydration pause.', 'one_time', 'selfcare', 'Self-Care', '🍵', '{"title":"Drink tea","tag":"Self-Care","time_block":"afternoon"}', 1860),
    ('Walk 10000 Steps Every Day (30 Days)', '30-day movement consistency challenge.', 'challenge', 'health', 'Health & Fitness', '👟', '{"title":"Walk 10,000 steps every day","tag":"Health & Fitness","time_block":"afternoon","target_amount":300000,"target_unit":"steps","deadline_offset_days":30}', 1870),
    ('Drink 2L Water Daily (21 Days)', 'Hydration consistency challenge.', 'challenge', 'health', 'Health & Fitness', '💧', '{"title":"Drink 2L of water daily","tag":"Health & Fitness","time_block":"morning","target_amount":42,"target_unit":"liters","deadline_offset_days":21}', 1880),
    ('Workout 5x Weekly (30 Days)', 'Complete 20 workouts in a month.', 'challenge', 'health', 'Health & Fitness', '🏋️', '{"title":"Workout 5 times weekly","tag":"Health & Fitness","time_block":"afternoon","target_amount":20,"target_unit":"workouts","deadline_offset_days":30}', 1890),

    -- Work & Career
    ('Prioritize Top 3 Tasks', 'Set top 3 priorities for the day.', 'recurring', 'work', 'Work & Career', '✅', '{"title":"Prioritize top 3 tasks","tag":"Work & Career","time_block":"morning","recurrence_type":"daily"}', 1900),
    ('Read Industry News', 'Stay current in your field.', 'recurring', 'work', 'Work & Career', '📰', '{"title":"Read industry news","tag":"Work & Career","time_block":"morning","recurrence_type":"daily"}', 1910),
    ('No Social Media During Work Hours', 'Protect focus during work.', 'recurring', 'work', 'Work & Career', '🚫', '{"title":"No social media during work","tag":"Work & Career","time_block":"afternoon","recurrence_type":"daily"}', 1920),
    ('Update LinkedIn Profile', 'Refresh professional profile.', 'one_time', 'work', 'Work & Career', '💼', '{"title":"Update LinkedIn profile","tag":"Work & Career","time_block":"afternoon"}', 1930),
    ('Update Resume', 'Refresh your resume content.', 'one_time', 'work', 'Work & Career', '📄', '{"title":"Update resume","tag":"Work & Career","time_block":"afternoon"}', 1940),
    ('Deep Work Daily (30 Days)', 'Build deep work consistency.', 'challenge', 'work', 'Work & Career', '🧠', '{"title":"Deep work every day","tag":"Work & Career","time_block":"morning","target_amount":30,"target_unit":"sessions","deadline_offset_days":30}', 1950),
    ('Inbox Zero (14 Days)', 'Keep inbox at zero.', 'challenge', 'work', 'Work & Career', '📨', '{"title":"Inbox zero challenge","tag":"Work & Career","time_block":"evening","target_amount":14,"target_unit":"days","deadline_offset_days":14}', 1960),

    -- Learning & Skill Building
    ('Homework', 'Complete homework session.', 'one_time', 'mindset', 'Learning & Skill Building', '📘', '{"title":"Do homework","tag":"Learning & Skill Building","time_block":"evening"}', 1970),
    ('Take Notes on What You Learned', 'Capture key takeaways daily.', 'recurring', 'mindset', 'Learning & Skill Building', '🗒️', '{"title":"Take notes on what you learned","tag":"Learning & Skill Building","time_block":"evening","recurrence_type":"daily"}', 1980),
    ('Read 30 Minutes Daily (60 Days)', 'Long-form reading consistency.', 'challenge', 'mindset', 'Learning & Skill Building', '📚', '{"title":"Read 30 minutes daily","tag":"Learning & Skill Building","time_block":"evening","target_amount":60,"target_unit":"days","deadline_offset_days":60}', 1990),
    ('Learn 300 New Words', 'Language vocabulary challenge.', 'challenge', 'mindset', 'Learning & Skill Building', '🈶', '{"title":"Learn 300 new words","tag":"Learning & Skill Building","time_block":"evening","target_amount":300,"target_unit":"words","deadline_offset_days":30}', 2000),

    -- Finance & Money
    ('Check Bank Balance', 'Daily money awareness.', 'recurring', 'finance', 'Finance & Money', '🏦', '{"title":"Check bank balance","tag":"Finance & Money","time_block":"evening","recurrence_type":"daily"}', 2010),
    ('Transfer to Savings', 'Move money to savings account.', 'recurring', 'finance', 'Finance & Money', '💸', '{"title":"Transfer to savings","tag":"Finance & Money","time_block":"evening","recurrence_type":"daily"}', 2020),
    ('Create a Budget', 'Set up your monthly budget.', 'one_time', 'finance', 'Finance & Money', '📊', '{"title":"Create a budget","tag":"Finance & Money","time_block":"afternoon"}', 2030),
    ('No Impulse Buys (21 Days)', 'Spend intentionally challenge.', 'challenge', 'finance', 'Finance & Money', '🛒', '{"title":"No impulse buys","tag":"Finance & Money","time_block":"afternoon","target_amount":21,"target_unit":"days","deadline_offset_days":21}', 2040),
    ('Save 500 This Month', 'Monthly savings challenge.', 'challenge', 'finance', 'Finance & Money', '💰', '{"title":"Save 500 this month","tag":"Finance & Money","time_block":"evening","target_amount":500,"target_unit":"dollars","deadline_offset_days":30}', 2050),

    -- Personal Growth
    ('Practice Gratitude', 'Daily gratitude habit.', 'recurring', 'mindset', 'Personal Growth', '🙏', '{"title":"Practice gratitude","tag":"Personal Growth","time_block":"evening","recurrence_type":"daily"}', 2060),
    ('Set Daily Intentions', 'Start day with intention.', 'recurring', 'mindset', 'Personal Growth', '🎯', '{"title":"Set daily intentions","tag":"Personal Growth","time_block":"morning","recurrence_type":"daily"}', 2070),
    ('Write Down 3 Wins', 'Celebrate progress daily.', 'recurring', 'mindset', 'Personal Growth', '🏆', '{"title":"Write down 3 wins","tag":"Personal Growth","time_block":"evening","recurrence_type":"daily"}', 2080),
    ('Create a Vision Board', 'Define goals visually.', 'one_time', 'mindset', 'Personal Growth', '🖼️', '{"title":"Create a vision board","tag":"Personal Growth","time_block":"afternoon"}', 2090),
    ('Journal Every Day (30 Days)', 'Build journaling consistency.', 'challenge', 'mindset', 'Personal Growth', '📝', '{"title":"Journal every day","tag":"Personal Growth","time_block":"evening","target_amount":30,"target_unit":"days","deadline_offset_days":30}', 2100),
    ('No Social Media (30 Days)', 'Digital discipline challenge.', 'challenge', 'mindset', 'Personal Growth', '📵', '{"title":"No social media","tag":"Personal Growth","time_block":"afternoon","target_amount":30,"target_unit":"days","deadline_offset_days":30}', 2110),

    -- Relationships & Social
    ('Call a Friend', 'Connect with one friend.', 'recurring', 'social', 'Relationships & Social', '📞', '{"title":"Call a friend","tag":"Relationships & Social","time_block":"evening","recurrence_type":"daily"}', 2120),
    ('Text Someone You Have Not Spoken To', 'Reconnect with someone.', 'one_time', 'social', 'Relationships & Social', '💬', '{"title":"Text someone you have not spoken to","tag":"Relationships & Social","time_block":"evening"}', 2130),
    ('Family Time (No Phones)', 'Dedicated screen-free family time.', 'recurring', 'social', 'Relationships & Social', '👨‍👩‍👧‍👦', '{"title":"Family time (no phones)","tag":"Relationships & Social","time_block":"evening","recurrence_type":"daily"}', 2140),
    ('Give a Compliment Daily (30 Days)', 'Daily positive social action.', 'challenge', 'social', 'Relationships & Social', '🌟', '{"title":"Give a compliment daily","tag":"Relationships & Social","time_block":"afternoon","target_amount":30,"target_unit":"compliments","deadline_offset_days":30}', 2150),
    ('Leave the House Daily (14 Days)', 'Rebuild social momentum.', 'challenge', 'social', 'Relationships & Social', '🚶', '{"title":"Leave the house daily","tag":"Relationships & Social","time_block":"afternoon","target_amount":14,"target_unit":"days","deadline_offset_days":14}', 2160),

    -- Admin & Life Maintenance
    ('Mop the Floor', 'Floor cleaning routine.', 'one_time', 'home', 'Admin & Life Maintenance', '🧽', '{"title":"Mop the floor","tag":"Admin & Life Maintenance","time_block":"afternoon"}', 2170),
    ('Clean the Kitchen', 'Kitchen reset and cleanup.', 'one_time', 'home', 'Admin & Life Maintenance', '🧼', '{"title":"Clean the kitchen","tag":"Admin & Life Maintenance","time_block":"afternoon"}', 2180),
    ('Clean the Bathroom', 'Bathroom cleaning task.', 'one_time', 'home', 'Admin & Life Maintenance', '🛁', '{"title":"Clean the bathroom","tag":"Admin & Life Maintenance","time_block":"afternoon"}', 2190),
    ('Declutter 1 Area Per Day (30 Days)', 'Daily declutter challenge.', 'challenge', 'home', 'Admin & Life Maintenance', '📦', '{"title":"Declutter one area daily","tag":"Admin & Life Maintenance","time_block":"afternoon","target_amount":30,"target_unit":"areas","deadline_offset_days":30}', 2200),
    ('No Dishes in Sink (21 Days)', 'Kitchen consistency challenge.', 'challenge', 'home', 'Admin & Life Maintenance', '🍽️', '{"title":"No dishes in sink","tag":"Admin & Life Maintenance","time_block":"evening","target_amount":21,"target_unit":"days","deadline_offset_days":21}', 2210),

    -- Creative & Expression
    ('Draw or Sketch', 'Creative drawing session.', 'recurring', 'mindset', 'Creative & Expression', '✏️', '{"title":"Draw or sketch","tag":"Creative & Expression","time_block":"evening","recurrence_type":"daily"}', 2220),
    ('Write Creatively', 'Creative writing practice.', 'recurring', 'mindset', 'Creative & Expression', '🖋️', '{"title":"Write creatively","tag":"Creative & Expression","time_block":"evening","recurrence_type":"daily"}', 2230),
    ('Practice Photography', 'Photo practice session.', 'one_time', 'mindset', 'Creative & Expression', '📷', '{"title":"Practice photography","tag":"Creative & Expression","time_block":"afternoon"}', 2240),
    ('Draw Every Day (30 Days)', 'Daily drawing challenge.', 'challenge', 'mindset', 'Creative & Expression', '🎨', '{"title":"Draw every day","tag":"Creative & Expression","time_block":"evening","target_amount":30,"target_unit":"days","deadline_offset_days":30}', 2250),
    ('Post 30 Photos in 30 Days', 'Consistency content challenge.', 'challenge', 'mindset', 'Creative & Expression', '🖼️', '{"title":"Post 30 photos","tag":"Creative & Expression","time_block":"afternoon","target_amount":30,"target_unit":"photos","deadline_offset_days":30}', 2260),

    -- Spiritual / Purpose
    ('Morning Devotional', 'Start day with devotion.', 'recurring', 'mindset', 'Spiritual / Purpose', '📖', '{"title":"Morning devotional","tag":"Spiritual / Purpose","time_block":"morning","recurrence_type":"daily"}', 2270),
    ('Acts of Kindness', 'Do one intentional kind act.', 'recurring', 'mindset', 'Spiritual / Purpose', '🤝', '{"title":"Act of kindness","tag":"Spiritual / Purpose","time_block":"afternoon","recurrence_type":"daily"}', 2280),
    ('Read Scripture Daily (30 Days)', 'Scripture reading challenge.', 'challenge', 'mindset', 'Spiritual / Purpose', '📘', '{"title":"Read scripture daily","tag":"Spiritual / Purpose","time_block":"morning","target_amount":30,"target_unit":"days","deadline_offset_days":30}', 2290),
    ('30 Acts of Kindness', 'Complete thirty acts of kindness.', 'challenge', 'mindset', 'Spiritual / Purpose', '💛', '{"title":"30 acts of kindness","tag":"Spiritual / Purpose","time_block":"afternoon","target_amount":30,"target_unit":"acts","deadline_offset_days":30}', 2300),

    -- Lifestyle & Leisure
    ('Watch a Show', 'Intentional leisure watch time.', 'one_time', 'social', 'Lifestyle & Leisure', '📺', '{"title":"Watch a show","tag":"Lifestyle & Leisure","time_block":"evening"}', 2310),
    ('Play a Video Game', 'Leisure gaming session.', 'one_time', 'social', 'Lifestyle & Leisure', '🎮', '{"title":"Play a video game","tag":"Lifestyle & Leisure","time_block":"evening"}', 2320),
    ('Plan Your Weekend', 'Intentional weekend planning.', 'one_time', 'social', 'Lifestyle & Leisure', '🗓️', '{"title":"Plan your weekend","tag":"Lifestyle & Leisure","time_block":"evening"}', 2330),
    ('Try a New Recipe Weekly (4 Weeks)', 'Lifestyle food exploration challenge.', 'challenge', 'social', 'Lifestyle & Leisure', '🍳', '{"title":"Try a new recipe weekly","tag":"Lifestyle & Leisure","time_block":"evening","target_amount":4,"target_unit":"recipes","deadline_offset_days":28}', 2340),
    ('No Takeaway (14 Days)', 'Reduce takeaway challenge.', 'challenge', 'social', 'Lifestyle & Leisure', '🥡', '{"title":"No takeaway food","tag":"Lifestyle & Leisure","time_block":"evening","target_amount":14,"target_unit":"days","deadline_offset_days":14}', 2350)
) AS seed(name, description, task_type, category, tag, icon, payload, sort_order)
WHERE NOT EXISTS (
  SELECT 1
  FROM task_templates t
  WHERE t.name = seed.name
    AND t.task_type = seed.task_type::text
);
