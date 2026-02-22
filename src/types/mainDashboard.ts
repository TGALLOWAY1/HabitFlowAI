export type DashboardCadenceFilter = 'all' | 'daily' | 'weekly';

export interface MainDashboardCategoryOption {
  id: string;
  name: string;
  color?: string;
}

export interface MainDashboardMonthlySummary {
  completed: number;
  goal: number;
  percent: number;
}

export interface MainDashboardWeeklySummary {
  startDayKey: string;
  endDayKey: string;
  referenceDayKey: string;
  completed: number;
  goal: number;
  percent: number;
}

export interface MainDashboardHeatmapHabit {
  habitId: string;
  habitName: string;
  categoryId: string;
  categoryName: string;
  cadence: 'daily' | 'weekly';
  dayCompletion: Record<string, boolean>;
  monthlyCompleted: number;
  monthlyGoal: number;
  monthlyPercent: number;
}

export interface MainDashboardCategoryRollup {
  categoryId: string;
  categoryName: string;
  color?: string;
  completed: number;
  goal: number;
  percent: number;
}

export interface MainDashboardResponse {
  month: string;
  startDayKey: string;
  endDayKey: string;
  days: string[];
  dailyCounts: Record<string, number>;
  dailyPercent: Record<string, number>;
  monthlySummary: MainDashboardMonthlySummary;
  weeklySummary: MainDashboardWeeklySummary;
  heatmap: {
    habits: MainDashboardHeatmapHabit[];
  };
  categoryRollup: MainDashboardCategoryRollup[];
  categoryOptions: MainDashboardCategoryOption[];
  filters: {
    categoryId?: string;
    cadence: DashboardCadenceFilter;
    includeWeekly: boolean;
    timeZone: string;
  };
}

export interface MainDashboardQuery {
  month: string;
  categoryId?: string;
  cadence: DashboardCadenceFilter;
  includeWeekly: boolean;
  timeZone: string;
}
