import React, { useState } from 'react';
import type { SleepAnalyticsSummary } from '../../../lib/analyticsClient';
import { SleepSummaryCards } from './SleepSummaryCards';
import { SleepDurationTrendChart } from './SleepDurationTrendChart';
import { SleepScheduleTrendChart } from './SleepScheduleTrendChart';
import { SleepWeeklySummary } from './SleepWeeklySummary';
import { SleepFactorsPanel } from './SleepFactorsPanel';
import { SleepAchievements } from './SleepAchievements';
import { SleepNightsEditor } from './SleepNightsEditor';
import { SleepEntryForm } from '../../SleepEntryForm';

interface Props {
  data: SleepAnalyticsSummary | null;
  loading: boolean;
  /** Called after a night is saved so the dashboard can refresh. */
  onReload?: () => void;
}

export const SleepAnalytics: React.FC<Props> = ({ data, loading, onReload }) => {
  const [editDayKey, setEditDayKey] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <SleepSummaryCards data={data} loading={loading} />
      <SleepNightsEditor nights={data?.nights ?? []} onEditNight={setEditDayKey} />
      <SleepScheduleTrendChart data={data} loading={loading} />
      <SleepDurationTrendChart data={data} loading={loading} />
      <SleepFactorsPanel data={data} loading={loading} />
      <SleepWeeklySummary data={data} loading={loading} />
      <SleepAchievements data={data} loading={loading} />

      <SleepEntryForm
        isOpen={editDayKey !== null}
        initialDayKey={editDayKey ?? undefined}
        onClose={() => setEditDayKey(null)}
        onSaved={() => onReload?.()}
      />
    </div>
  );
};
