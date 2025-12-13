import React from 'react';
import { getHeatmapColor } from '../utils/analytics';

export const HeatmapLegend: React.FC = React.memo(() => {
    return (
        <div className="flex items-center justify-end gap-2 mt-4 text-xs text-neutral-500">
            <span>Low</span>
            <div className="flex items-center gap-1">
                {/* 0 (Empty) */}
                <div className={`w-3 h-3 rounded-sm ${getHeatmapColor(0)}`} />
                {/* 1 */}
                <div className={`w-3 h-3 rounded-sm ${getHeatmapColor(1)}`} />
                {/* 2 */}
                <div className={`w-3 h-3 rounded-sm ${getHeatmapColor(2)}`} />
                {/* 3 */}
                <div className={`w-3 h-3 rounded-sm ${getHeatmapColor(3)}`} />
                {/* 4 (Max) */}
                <div className={`w-3 h-3 rounded-sm ${getHeatmapColor(4)}`} />
            </div>
            <span>High</span>
        </div>
    );
});
