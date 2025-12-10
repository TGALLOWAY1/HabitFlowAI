import React, { useMemo, useState } from 'react';
import { format, startOfWeek, addDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, Check } from 'lucide-react';
import { cn } from '../utils/cn';
import { DndContext, useDraggable, useDroppable, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { useHabitStore } from '../store/HabitContext';
import type { Habit } from '../models/persistenceTypes';
import { WeeklyHabitEditModal } from './WeeklyHabitEditModal';

// Draggable Wrapper for Habit Events
const DraggableHabit = ({ habit, dayIndex, children, onClick }: { habit: Habit, dayIndex: number, children: React.ReactNode, onClick: (e: React.MouseEvent) => void }) => {
    // Unique ID for this specific instance (habit + day)
    const id = `habit-${habit.id}-day-${dayIndex}`;

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: id,
        data: { habit, dayIndex }
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            onClick={onClick}
            className={`${isDragging ? 'opacity-30' : 'opacity-100'} h-full w-full`}
        >
            {children}
        </div>
    );
};

// Droppable Slot for 30-min Grid Cells
const DroppableSlot = ({ dayIndex, time, children }: { dayIndex: number, time: string, children?: React.ReactNode }) => {
    const id = `slot-${dayIndex}-${time}`;
    const { setNodeRef, isOver } = useDroppable({
        id: id,
        data: { dayIndex, time }
    });

    return (
        <div
            ref={setNodeRef}
            className={`h-[40px] border-b border-white/5 w-full relative group transition-colors ${isOver ? 'bg-emerald-500/10' : ''}`}
        >
            {children}
        </div>
    );
};

export const CalendarView: React.FC = () => {
    const { habits, updateHabit } = useHabitStore();
    const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
    const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

    // Sensors with activation constraint to distinguish click vs drag
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 8,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250,
                tolerance: 5,
            },
        })
    );

    // Navigation
    const handlePrevWeek = () => setCurrentWeekStart(prev => addDays(prev, -7));
    const handleNextWeek = () => setCurrentWeekStart(prev => addDays(prev, 7));
    const weekDays = useMemo(() => eachDayOfInterval({
        start: currentWeekStart,
        end: addDays(currentWeekStart, 6)
    }), [currentWeekStart]);

    // Data Filtering
    const weeklyHabits = useMemo(() => habits.filter(h => h.goal.frequency === 'weekly' && !h.archived), [habits]);

    // Split into "Scheduled" and "Unassigned"
    const scheduledHabits = useMemo(() =>
        weeklyHabits.filter(h => h.assignedDays && h.assignedDays.length > 0 && h.scheduledTime),
        [weeklyHabits]);

    const unassignedHabits = useMemo(() =>
        weeklyHabits.filter(h => !h.assignedDays || h.assignedDays.length === 0 || !h.scheduledTime),
        [weeklyHabits]);

    // Time Slots (6 AM - 11 PM, 30 min increments)
    const timeSlots = useMemo(() => {
        const slots = [];
        for (let h = 6; h <= 23; h++) {
            const hStr = h.toString().padStart(2, '0');
            slots.push({ hour: h, minute: 0, timeStr: `${hStr}:00` });
            slots.push({ hour: h, minute: 30, timeStr: `${hStr}:30` });
        }
        return slots;
    }, []);

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.data.current && over.data.current) {
            const habit = active.data.current.habit as Habit;
            const sourceDayIndex = active.data.current.dayIndex as number;

            const targetDayIndex = over.data.current.dayIndex as number;
            const targetTime = over.data.current.time as string;

            // Logic:
            // 1. If day changed: remove sourceDayIndex from assignedDays, add targetDayIndex.
            // 2. Update scheduledTime to targetTime.

            let newAssignedDays = [...(habit.assignedDays || [])];

            if (sourceDayIndex !== targetDayIndex) {
                // Remove old day, add new day
                newAssignedDays = newAssignedDays.filter(d => d !== sourceDayIndex);
                if (!newAssignedDays.includes(targetDayIndex)) {
                    newAssignedDays.push(targetDayIndex);
                }
            }

            await updateHabit(habit.id, {
                scheduledTime: targetTime,
                assignedDays: newAssignedDays.sort()
            });
        }
    };

    // Helper to calculate top/height percentages
    const getEventStyle = (time: string, duration: number = 30) => {
        const [h, m] = time.split(':').map(Number);
        const startMinutes = (h * 60) + m;
        const dayStartMinutes = 6 * 60; // 6 AM
        const totalMinutes = (23 * 60 + 30) - dayStartMinutes; // Until 11:30 PM

        const top = ((startMinutes - dayStartMinutes) / totalMinutes) * 100;
        const height = (duration / totalMinutes) * 100;

        // Return simplified style for absolute positioning within the day column
        // But for Draggable in a specific slot, we might need adjustments. 
        // Actually, sticking to Absolute positioning relative to the DAY COLUMN is best visually.
        // But DnD kit works best with direct parent-child? 
        // Strategy: Render events absolutely positioned in the Day Column container as before, 
        // but use the collision detection against the DroppableSlots rendered behind them.

        return { top: `${Math.max(0, top)}%`, height: `${height}%` };
    };

    const handleHabitClick = (habit: Habit) => {
        // e.stopPropagation(); // Handled by Sensor activation constraint usually, but good to keep if issues arise
        setEditingHabit(habit);
    };

    // Render Event Block (extracted for re-use in DragOverlay if needed)
    const renderEventBlock = (habit: Habit, style?: React.CSSProperties) => {
        const isNonNegotiable = habit.nonNegotiable;
        return (
            <div
                className={cn(
                    "rounded px-2 py-1 transition-colors cursor-move group overflow-hidden z-20 hover:shadow-lg hover:scale-[1.02] active:scale-95 duration-100 h-full w-full border",
                    isNonNegotiable
                        ? "bg-emerald-500/20 border-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.4)]"
                        : "bg-emerald-500/20 border-emerald-500/50 hover:bg-emerald-500/30"
                )}
                style={style}
                title={`${habit.name} (${habit.scheduledTime})${isNonNegotiable ? ' - Non-Negotiable' : ''}`}
            >
                <div className={cn("text-xs font-medium truncate", isNonNegotiable ? "text-yellow-100" : "text-emerald-100")}>
                    {habit.name}
                </div>
                <div className="text-[10px] text-emerald-300/80 truncate">
                    {habit.scheduledTime} ({habit.durationMinutes}m)
                </div>
            </div>
        );
    };

    return (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="flex flex-col h-full gap-4 relative">
                <WeeklyHabitEditModal
                    habit={editingHabit}
                    isOpen={!!editingHabit}
                    onClose={() => setEditingHabit(null)}
                    onSave={async (id, updates) => { await updateHabit(id, updates); }}
                />

                {/* Header */}
                <div className="flex items-center justify-between bg-neutral-900/50 p-4 rounded-xl border border-white/5 backdrop-blur-sm">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <CalendarIcon className="text-emerald-400" />
                        Weekly Calendar
                    </h2>
                    <div className="flex items-center gap-4">
                        <button onClick={handlePrevWeek} className="p-2 hover:bg-white/5 rounded-lg text-neutral-400 hover:text-white">
                            <ChevronLeft size={20} />
                        </button>
                        <span className="font-medium text-neutral-200">
                            {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
                        </span>
                        <button onClick={handleNextWeek} className="p-2 hover:bg-white/5 rounded-lg text-neutral-400 hover:text-white">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {/* Calendar Grid Container */}
                <div className="flex-1 bg-neutral-900/50 rounded-xl border border-white/5 backdrop-blur-sm overflow-hidden flex flex-col relative min-h-[400px]">
                    {/* Header Row (Days) */}
                    <div className="flex border-b border-white/5 bg-neutral-900 sticky top-0 z-20 pr-4">
                        <div className="w-16 flex-shrink-0 border-r border-white/5" />
                        {weekDays.map(day => (
                            <div key={day.toISOString()} className="flex-1 p-2 text-center border-r border-white/5 last:border-0 border-b border-transparent">
                                <div className="text-xs font-medium text-neutral-500 uppercase">{format(day, 'EEE')}</div>
                                <div className={`text-lg font-bold ${isSameDay(day, new Date()) ? 'text-emerald-400' : 'text-neutral-300'}`}>
                                    {format(day, 'd')}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Scrollable Time Grid */}
                    <div className="flex-1 overflow-y-auto relative scrollbar-thin scrollbar-thumb-neutral-700">
                        <div className="flex relative min-h-[1000px]">
                            {/* Time Labels Column */}
                            <div className="w-16 flex-shrink-0 border-r border-white/5 bg-neutral-900/50 z-10">
                                {timeSlots.map((slot, i) => (
                                    <div key={i} className="h-[40px] text-[10px] text-neutral-500 text-right pr-2 pt-1 border-b border-white/5 last:border-0">
                                        {slot.minute === 0 ? slot.timeStr : ''}
                                    </div>
                                ))}
                            </div>

                            {/* Grid Columns */}
                            <div className="flex-1 flex relative">
                                {/* Vertical Day Columns Wrapper used for relative positioning of Events */}
                                <div className="absolute inset-0 flex">
                                    {weekDays.map((day, _) => {
                                        const jsDayIndex = day.getDay();

                                        return (
                                            <div key={day.toISOString()} className="flex-1 border-r border-white/5 last:border-0 h-full relative group">
                                                {/* Droppable Background Slots */}
                                                <div className="absolute inset-0 flex flex-col z-0">
                                                    {timeSlots.map((slot, i) => (
                                                        <DroppableSlot key={i} dayIndex={jsDayIndex} time={slot.timeStr} />
                                                    ))}
                                                </div>

                                                {/* Events Layer */}
                                                <div className="absolute inset-0 w-full h-full z-10 pointer-events-none">
                                                    {scheduledHabits
                                                        .filter(h => h.assignedDays?.includes(jsDayIndex))
                                                        .map(habit => {
                                                            const style = getEventStyle(habit.scheduledTime!, habit.durationMinutes);
                                                            return (
                                                                <div
                                                                    key={`${habit.id}-${jsDayIndex}`}
                                                                    className="absolute left-1 right-1 pointer-events-auto"
                                                                    style={style}
                                                                >
                                                                    <DraggableHabit
                                                                        habit={habit}
                                                                        dayIndex={jsDayIndex}
                                                                        onClick={() => handleHabitClick(habit)}
                                                                    >
                                                                        {renderEventBlock(habit)}
                                                                    </DraggableHabit>
                                                                </div>
                                                            );
                                                        })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Unassigned Habits Table */}
                {unassignedHabits.length > 0 && (
                    <div className="bg-neutral-900/50 rounded-xl border border-white/5 backdrop-blur-sm p-6 overflow-hidden flex flex-col max-h-[40%] shrink-0">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 shrink-0">
                            <Clock className="text-yellow-500" size={18} />
                            Unassigned Habits
                            <span className="text-xs font-normal text-neutral-500 ml-2">
                                (Set a time to move these to the calendar)
                            </span>
                        </h3>
                        <div className="overflow-auto min-h-0">
                            <table className="w-full text-left text-sm text-neutral-400">
                                <thead className="text-xs uppercase text-neutral-300 sticky top-0 bg-neutral-900 z-10">
                                    <tr>
                                        <th className="px-4 py-3">Habit Name</th>
                                        <th className="px-4 py-3">Assigned Days</th>
                                        <th className="px-4 py-3">Preferred Time</th>
                                        <th className="px-4 py-3">Duration (Min)</th>
                                        <th className="px-4 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {unassignedHabits.map(habit => (
                                        <UnassignedHabitRow key={habit.id} habit={habit} onUpdate={updateHabit} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
            <DragOverlay>
                {/* Optional: Add DragOverlay logic if needed for better visuals, currently opacity-30 in DraggableHabit suffices for MVP DnD */}
            </DragOverlay>
        </DndContext>
    );
};

// Row Component for inline editing (unchanged logic, just re-declaring to keep file self-contained)
const UnassignedHabitRow = ({ habit, onUpdate }: { habit: Habit, onUpdate: any }) => {
    const [assignedDays, setAssignedDays] = useState<number[]>(habit.assignedDays || []);
    const [time, setTime] = useState(habit.scheduledTime || '');
    const [duration, setDuration] = useState(habit.durationMinutes?.toString() || '30');

    // Check if dirty
    // Create copies before sorting to avoid mutating state/props
    const currentDaysSorted = [...assignedDays].sort().join(',');
    const originalDaysSorted = [...(habit.assignedDays || [])].sort().join(',');

    const isDaysDirty = currentDaysSorted !== originalDaysSorted;
    const isTimeDirty = time !== (habit.scheduledTime || '');
    const isDurationDirty = duration !== (habit.durationMinutes?.toString() || '30');

    const isDirty = isDaysDirty || isTimeDirty || isDurationDirty;

    const handleSave = async () => {
        if (!time) return;

        await onUpdate(habit.id, {
            assignedDays,
            scheduledTime: time,
            durationMinutes: Number(duration)
        });
    };

    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    return (
        <tr className="hover:bg-white/[0.02] transition-colors">
            <td className="px-4 py-3 font-medium text-white">{habit.name}</td>
            <td className="px-4 py-3">
                <div className="flex gap-1">
                    {days.map((d, i) => (
                        <button
                            key={i}
                            onClick={() => setAssignedDays(prev =>
                                prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
                            )}
                            className={`w-6 h-6 text-[10px] rounded flex items-center justify-center transition-colors ${assignedDays.includes(i) ? 'bg-emerald-500 text-neutral-900 font-bold' : 'bg-neutral-800 hover:bg-neutral-700'
                                }`}
                        >
                            {d}
                        </button>
                    ))}
                </div>
            </td>
            <td className="px-4 py-3">
                <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="bg-neutral-800 border-white/10 rounded px-2 py-1 text-white focus:border-emerald-500 focus:outline-none"
                />
            </td>
            <td className="px-4 py-3">
                <input
                    type="number"
                    value={duration}
                    onChange={e => setDuration(e.target.value)}
                    className="bg-neutral-800 border-white/10 rounded px-2 py-1 text-white w-20 focus:border-emerald-500 focus:outline-none"
                    min="5" step="5"
                />
            </td>
            <td className="px-4 py-3 text-right">
                <button
                    onClick={handleSave}
                    disabled={!isDirty || !time}
                    className={`p-1.5 rounded-lg transition-colors ${isDirty && time
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white cursor-pointer'
                        : 'bg-white/5 text-neutral-600 cursor-not-allowed'
                        }`}
                    title={!time ? "Time required" : !isDirty ? "No changes" : "Save Changes"}
                >
                    <Check size={16} />
                </button>
            </td>
        </tr>
    );
}

export default CalendarView;
