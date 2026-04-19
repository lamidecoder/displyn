import { supabase } from './supabase';

// ============ BADGE DEFINITIONS ============

export interface BadgeDef {
  id: string;
  title: string;
  streakRequired: number;
  icon: string;
  color: string;
  description: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'getting_started',       title: 'Getting Started',       streakRequired: 3,    icon: '🔥', color: '#CD7F32', description: '3-day streak — the journey begins.' },
  { id: 'week_warrior',          title: 'Week Warrior',          streakRequired: 7,    icon: '🔥', color: '#C0C0C0', description: '7-day streak — a full week of discipline.' },
  { id: 'consistency_builder',   title: 'Consistency Builder',   streakRequired: 14,   icon: '🔥', color: '#FFD700', description: '14-day streak — habits are forming.' },
  { id: 'monthly_machine',       title: 'Monthly Machine',       streakRequired: 30,   icon: '💎', color: '#8B5CF6', description: '30-day streak — one month down.' },
  { id: 'discipline_king',       title: 'Discipline King',       streakRequired: 60,   icon: '👑', color: '#3B82F6', description: '60-day streak — discipline is your identity.' },
  { id: 'quarter_master',        title: 'Quarter Master',        streakRequired: 90,   icon: '⭐', color: '#10B981', description: '90-day streak — a full quarter of consistency.' },
  { id: 'half_year_hero',        title: 'Half-Year Hero',        streakRequired: 180,  icon: '🛡️', color: '#EF4444', description: '180-day streak — half a year, no breaks.' },
  { id: 'year_one',              title: 'Year One',              streakRequired: 365,  icon: '👑', color: '#E5E4E2', description: '365-day streak — a full year of execution.' },
  { id: 'unstoppable',           title: 'Unstoppable',           streakRequired: 500,  icon: '🔮', color: '#A78BFA', description: '500-day streak — beyond most humans.' },
  { id: 'two_year_titan',        title: 'Two-Year Titan',        streakRequired: 730,  icon: '🔥', color: '#1F2937', description: '730-day streak — two years of relentless action.' },
  { id: 'the_thousand',          title: 'The Thousand',          streakRequired: 1000, icon: '💎', color: '#60A5FA', description: '1000-day streak — legendary territory.' },
  { id: 'living_legend',         title: 'Living Legend',         streakRequired: 1500, icon: '🌟', color: '#F59E0B', description: '1500-day streak — you inspire others.' },
  { id: 'displyn_immortal',      title: 'Displyn Immortal',      streakRequired: 2000, icon: '🏆', color: '#FBBF24', description: '2000-day streak — the ultimate badge of discipline.' },
];

// ============ BADGE STORAGE (Supabase profiles table) ============

/**
 * Get earned badge IDs for a user from their profile.
 * Badges are stored as a JSON array in the `badges` column.
 */
export async function getEarnedBadges(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('badges')
    .eq('id', userId)
    .single();

  if (error || !data) return [];
  return data.badges || [];
}

/**
 * Check the user's current streak against badge thresholds.
 * Awards any new badges they've earned.
 * Returns newly awarded badge IDs (empty if none).
 */
export async function checkAndAwardBadges(
  userId: string,
  currentStreak: number
): Promise<BadgeDef[]> {
  const earned = await getEarnedBadges(userId);
  const earnedSet = new Set(earned);

  const newBadges: BadgeDef[] = [];

  for (const badge of BADGES) {
    if (currentStreak >= badge.streakRequired && !earnedSet.has(badge.id)) {
      newBadges.push(badge);
      earnedSet.add(badge.id);
    }
  }

  if (newBadges.length > 0) {
    // Save updated badges to profile
    const updatedBadges = Array.from(earnedSet);
    await supabase
      .from('profiles')
      .update({ badges: updatedBadges })
      .eq('id', userId);
  }

  return newBadges;
}

/**
 * Get the user's highest earned badge (or null if none).
 */
export function getHighestBadge(earnedBadgeIds: string[]): BadgeDef | null {
  const earnedSet = new Set(earnedBadgeIds);
  let highest: BadgeDef | null = null;

  for (const badge of BADGES) {
    if (earnedSet.has(badge.id)) {
      highest = badge;
    }
  }

  return highest;
}

/**
 * Get the next badge the user can earn.
 */
export function getNextBadge(earnedBadgeIds: string[]): BadgeDef | null {
  const earnedSet = new Set(earnedBadgeIds);

  for (const badge of BADGES) {
    if (!earnedSet.has(badge.id)) {
      return badge;
    }
  }

  return null; // All badges earned!
}
