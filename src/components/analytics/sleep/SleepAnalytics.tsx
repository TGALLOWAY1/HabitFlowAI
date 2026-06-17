import React from 'react';
import type { SleepAnalyticsSummary } from '../../../lib/analyticsClient';
import { SleepSummaryCards } from './SleepSummaryCards';
import { SleepDurationTrendChart } from './SleepDurationTrendChart';
import { SleepScheduleTrendChart } from './SleepScheduleTrendChart';
import { SleepWeeklySummary } from './SleepWeeklySummary';
import { SleepFactorsPanel } from './SleepFactorsPanel';
import { SleepAchievements } from './SleepAchievements';

interface Props {
  data: SleepAnalyticsSummary | null;
  loading: boolean;
}

export const SleepAnalytics: React.FC<Props> = ({ data, loading }) => {
  return (
    <div className="space-y-4">
      <SleepSummaryCards data={data} loading={loading} />
      <SleepScheduleTrendChart data={data} loading={loading} />
      <SleepDurationTrendChart data={data} loading={loading} />
      <SleepFactorsPanel data={data} loading={loading} />
      <SleepWeeklySummary data={data} loading={loading} />
      <SleepAchievements data={data} loading={loading} />
    </div>
  );
};
