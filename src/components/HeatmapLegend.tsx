import React from 'react';
import { getHeatmapColor, HEATMAP_LEVELS } from '../theme/heatmap';
import { useTheme } from '../theme/ThemeContext';

export const HeatmapLegend: React.FC = React.memo(() => {
    const { resolvedMode } = useTheme();
    const levels = Array.from({ length: HEATMAP_LEVELS }, (_, i) => i);
    return (
        <div className="flex items-center justify-end gap-2 mt-4 text-xs text-content-muted">
            <span>Low</span>
            <div className="flex items-center gap-1">
                {levels.map((level) => (
                    <div
                        key={level}
                        className="w-3 h-3 rounded-sm"
                        style={{ background: getHeatmapColor(level, resolvedMode) }}
                    />
                ))}
            </div>
            <span>High</span>
        </div>
    );
});
