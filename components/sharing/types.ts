export type ShareFormat = '1:1' | '9:16';

export type ShareData =
  | {
      type: 'weekly_stats';
      streak: number;
      completionRate: number;
      done: number;
      missed: number;
      bestDay: string;
      weekRange: string;
      displayName: string;
    }
  | {
      type: 'streak';
      streak: number;
      completionRate: number;
      totalDone: number;
    }
  | {
      type: 'nyla_mirror';
      title: string;
      strengths: string[];
      blindSpots: string[];
      primaryTag?: string;
    }
  | {
      type: 'challenge';
      challengeName: string;
      targetAmount: number;
      targetUnit: string;
      currentProgress: number;
      durationDays: number;
      dailyAverage: number;
      daysLeft: number;
      dailyTarget: number;
      remaining: number;
      deadline: string | null;
      tag: string | null;
      tagIcon: string | null;
    }
  | {
      type: 'monthly_reflection';
      month: string;
      completionRate: number;
      streak: number;
      totalTasks: number;
      nylaSummary: string;
      topTag: string;
      topTagIcon: string;
    }
  | {
      type: 'multi_challenge';
      challenges: Array<{
        challengeName: string;
        targetAmount: number;
        targetUnit: string;
        currentProgress: number;
        percentage: number;
      }>;
    };

export interface GradientBg {
  id: string;
  name: string;
  colors: [string, string];
}
