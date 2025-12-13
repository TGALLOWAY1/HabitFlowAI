import React from 'react';
import { useHabitStore } from '../store/HabitContext';
import { YearHeatmapGrid } from './YearHeatmapGrid';
import { RecentHeatmapGrid } from './RecentHeatmapGrid';

interface HeatmapProps {
    habits?: any[];
    range?: 'year' | '90d' | '30d';
}

export const Heatmap: React.FC<HeatmapProps> = React.memo(({ habits: propHabits, range = 'year' }) => {
    const { habits: storeHabits } = useHabitStore();
    const habits = propHabits || storeHabits;

    if (range === 'year') {
        return <YearHeatmapGrid habits={habits} />;
    }

    return <RecentHeatmapGrid habits={habits} range={range} />;
});

