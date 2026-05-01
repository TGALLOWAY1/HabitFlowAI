import React, { useCallback, useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Plus } from 'lucide-react';

export interface MilestoneRow {
    /** Local-only id used for React keys and dnd-kit. Distinct from server-assigned `Goal.milestones[i].id`. */
    rowKey: string;
    /** Optional server-assigned id, present only when editing an existing goal. */
    serverId?: string;
    valueText: string;
}

export interface MilestoneRowListProps {
    targetValueText: string;
    onTargetChange: (next: string) => void;
    unit: string;
    milestones: MilestoneRow[];
    onChange: (next: MilestoneRow[]) => void;
    /** Disable interactivity — used during submission. */
    disabled?: boolean;
    /** Maximum number of intermediate milestones (excludes the Final Goal row). */
    maxMilestones?: number;
}

const DEFAULT_MAX = 20;

interface RowProps {
    row: MilestoneRow;
    index: number;
    unit: string;
    invalid: boolean;
    onValueChange: (value: string) => void;
    onValueBlur: () => void;
    onRemove: () => void;
    disabled: boolean;
}

const SortableMilestoneRow: React.FC<RowProps> = ({
    row,
    index,
    unit,
    invalid,
    onValueChange,
    onValueBlur,
    onRemove,
    disabled,
}) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: row.rowKey,
        disabled,
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex items-center gap-3 py-2"
        >
            <button
                type="button"
                {...attributes}
                {...listeners}
                aria-label={`Reorder milestone ${index + 1}`}
                className="text-neutral-500 hover:text-neutral-300 cursor-grab disabled:cursor-not-allowed"
                disabled={disabled}
            >
                <GripVertical size={16} />
            </button>

            <input
                type="number"
                inputMode="decimal"
                value={row.valueText}
                onChange={(e) => onValueChange(e.target.value)}
                onBlur={onValueBlur}
                disabled={disabled}
                className={`w-24 bg-neutral-900/50 border rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-1 transition-all ${
                    invalid
                        ? 'border-red-500/50 focus:border-red-500/70 focus:ring-red-500/30'
                        : 'border-white/10 focus:border-emerald-500/50 focus:ring-emerald-500/50'
                }`}
                min="0"
                step="any"
                placeholder="e.g., 25"
            />

            <span className="flex-1 text-neutral-400 text-sm truncate">
                {unit || ' '}
            </span>

            <span className="text-neutral-500 text-sm whitespace-nowrap">
                Milestone {index + 1}
            </span>

            <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                aria-label={`Remove milestone ${index + 1}`}
                className="text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Trash2 size={16} />
            </button>
        </div>
    );
};

let nextRowKeySeed = 0;
export function makeMilestoneRowKey(): string {
    nextRowKeySeed += 1;
    return `ms-row-${Date.now()}-${nextRowKeySeed}`;
}

export const MilestoneRowList: React.FC<MilestoneRowListProps> = ({
    targetValueText,
    onTargetChange,
    unit,
    milestones,
    onChange,
    disabled = false,
    maxMilestones = DEFAULT_MAX,
}) => {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const targetValueNum = useMemo(() => {
        const n = parseFloat(targetValueText);
        return Number.isFinite(n) ? n : null;
    }, [targetValueText]);

    const finalGoalCount = useMemo(() => {
        return milestones.length + 1; // intermediate + final goal
    }, [milestones.length]);

    const valueValidity = useMemo(() => {
        return milestones.map((row) => {
            const v = parseFloat(row.valueText);
            if (row.valueText.trim() === '' || !Number.isFinite(v)) return { valid: false, parsed: null as number | null };
            if (v <= 0) return { valid: false, parsed: v };
            if (targetValueNum !== null && v >= targetValueNum) return { valid: false, parsed: v };
            return { valid: true, parsed: v };
        });
    }, [milestones, targetValueNum]);

    const duplicateValues = useMemo(() => {
        const seen = new Map<number, number>();
        const dupes = new Set<number>();
        valueValidity.forEach(({ parsed }, idx) => {
            if (parsed === null) return;
            if (seen.has(parsed)) {
                dupes.add(idx);
                dupes.add(seen.get(parsed)!);
            } else {
                seen.set(parsed, idx);
            }
        });
        return dupes;
    }, [valueValidity]);

    const handleValueChange = useCallback(
        (index: number, value: string) => {
            const next = milestones.slice();
            next[index] = { ...next[index], valueText: value };
            onChange(next);
        },
        [milestones, onChange],
    );

    const sortAscending = useCallback(() => {
        const sorted = milestones.slice().sort((a, b) => {
            const av = parseFloat(a.valueText);
            const bv = parseFloat(b.valueText);
            const aValid = Number.isFinite(av);
            const bValid = Number.isFinite(bv);
            if (!aValid && !bValid) return 0;
            if (!aValid) return 1; // empty rows sink to bottom
            if (!bValid) return -1;
            return av - bv;
        });
        // Skip onChange if order didn't change to avoid render loops
        const sameOrder = sorted.every((row, i) => row.rowKey === milestones[i].rowKey);
        if (!sameOrder) onChange(sorted);
    }, [milestones, onChange]);

    const handleRemove = useCallback(
        (index: number) => {
            const next = milestones.slice();
            next.splice(index, 1);
            onChange(next);
        },
        [milestones, onChange],
    );

    const handleAdd = useCallback(() => {
        if (milestones.length >= maxMilestones) return;
        onChange([...milestones, { rowKey: makeMilestoneRowKey(), valueText: '' }]);
    }, [milestones, onChange, maxMilestones]);

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over || active.id === over.id) return;
            const oldIndex = milestones.findIndex((m) => m.rowKey === active.id);
            const newIndex = milestones.findIndex((m) => m.rowKey === over.id);
            if (oldIndex === -1 || newIndex === -1) return;
            onChange(arrayMove(milestones, oldIndex, newIndex));
        },
        [milestones, onChange],
    );

    return (
        <div className="space-y-3">
            <div className="flex items-baseline justify-between">
                <label className="block text-sm font-medium text-neutral-400">Milestones</label>
                <div className="text-xs text-neutral-500">
                    {milestones.length === 0
                        ? 'No intermediate milestones'
                        : `${milestones.length} ${milestones.length === 1 ? 'milestone' : 'milestones'}`}
                    {' · '}
                    Final goal: {' '}
                    <span className="text-emerald-400">
                        {targetValueText.trim() || '—'}
                        {unit ? ` ${unit}` : ''}
                    </span>
                </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-neutral-900/40 px-3 py-1 divide-y divide-white/5">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext
                        items={milestones.map((m) => m.rowKey)}
                        strategy={verticalListSortingStrategy}
                    >
                        {milestones.map((row, idx) => (
                            <SortableMilestoneRow
                                key={row.rowKey}
                                row={row}
                                index={idx}
                                unit={unit}
                                invalid={!valueValidity[idx].valid || duplicateValues.has(idx)}
                                onValueChange={(v) => handleValueChange(idx, v)}
                                onValueBlur={sortAscending}
                                onRemove={() => handleRemove(idx)}
                                disabled={disabled}
                            />
                        ))}
                    </SortableContext>
                </DndContext>

                {/* Final Goal row (pinned, derived from targetValueText) */}
                <div className="flex items-center gap-3 py-2">
                    <span className="w-4" aria-hidden />
                    <input
                        type="number"
                        inputMode="decimal"
                        value={targetValueText}
                        onChange={(e) => onTargetChange(e.target.value)}
                        disabled={disabled}
                        className="w-24 bg-neutral-900/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                        min="0.01"
                        step="any"
                        placeholder="e.g., 100"
                        aria-label="Final goal target value"
                    />
                    <span className="flex-1 text-neutral-400 text-sm truncate">{unit || ' '}</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium whitespace-nowrap">
                        Final Goal
                    </span>
                    <span className="w-4" aria-hidden />
                </div>
            </div>

            <button
                type="button"
                onClick={handleAdd}
                onBlur={sortAscending}
                disabled={disabled || milestones.length >= maxMilestones}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-dashed border-white/15 rounded-xl text-neutral-300 hover:bg-neutral-800/30 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Add milestone"
            >
                <Plus size={18} />
                <span className="font-medium">Add Milestone</span>
                {milestones.length >= maxMilestones && (
                    <span className="text-xs text-neutral-500 ml-2">(max {maxMilestones})</span>
                )}
            </button>

            {/* Final goal row included in the count summary */}
            <p className="sr-only">{finalGoalCount} stages including final goal</p>
        </div>
    );
};
