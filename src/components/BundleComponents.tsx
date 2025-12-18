import React from 'react';
import { type Habit, type DayLog } from '../types';
import { cn } from '../utils/cn';
import { Check, ListTodo, Layers } from 'lucide-react';
import { format } from 'date-fns';
import { createPortal } from 'react-dom';

interface BundleRowProps {
    habit: Habit;
    subHabits: Habit[];
    logs: Record<string, DayLog>;
    dates: Date[];
    onToggle: (habitId: string, date: string) => Promise<void>;
    onChoiceSelect: (habitId: string, date: string, optionKey: string) => Promise<void>;
    isExpanded: boolean;
    onToggleExpand: () => void;
    deleteHabit: (id: string) => Promise<void>;
    deleteConfirmId: string | null;
    setDeleteConfirmId: (id: string | null) => void;
    onEditHabit: (habit: Habit) => void;
    handleCellClick: (e: React.MouseEvent, habit: Habit, dateStr: string, log?: DayLog) => void;
}

export const DailyBundleRow: React.FC<BundleRowProps> = ({
    habit,
    subHabits,
    logs,
    dates,
    onToggle,
    onChoiceSelect,
    isExpanded,
    onToggleExpand,
    deleteHabit,
    deleteConfirmId,
    setDeleteConfirmId,
    onEditHabit,
    handleCellClick
}) => {
    // Determine Bundle Type
    const isChoice = habit.bundleType === 'choice';

    return (
        <div className="flex flex-col border-b border-white/5 bg-neutral-900/30">
            {/* Parent Row */}
            <div className="flex">
                <div
                    className="w-64 flex-shrink-0 p-4 border-r border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] group relative"
                    onClick={isChoice ? undefined : onToggleExpand} // Disable expand for choice
                >
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                            <span className="font-medium text-neutral-200 flex items-center gap-2">
                                {habit.name}
                                {isChoice ? <Layers size={14} className="text-amber-400" /> : <ListTodo size={14} className="text-indigo-400" />}
                            </span>
                            <span className="text-xs text-neutral-500">
                                {isChoice ? (habit.bundleOptions?.length || 0) + ' Options' : (subHabits.length || 0) + ' items'}
                            </span>
                        </div>
                    </div>

                    {!isChoice && (
                        <div className={`absolute bottom-0 left-0 w-full h-[2px] transition-colors ${isExpanded ? 'bg-indigo-500' : 'bg-transparent group-hover:bg-indigo-500/30'}`} />
                    )}

                    {/* Actions Context Menu */}
                    <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex gap-2 bg-neutral-900/80 p-1 rounded">
                        <button onClick={(e) => { e.stopPropagation(); onEditHabit(habit); }} className="text-xs text-neutral-500 hover:text-white">Edit</button>
                    </div>
                </div>

                {/* Days Grid */}
                <div className="flex">
                    {dates.map(date => {
                        const dateStr = format(date, 'yyyy-MM-dd');
                        const log = logs[`${habit.id}-${dateStr}`];

                        // Choice Bundle Logic
                        if (isChoice) {
                            return (
                                <ChoiceCell
                                    key={dateStr}
                                    habit={habit}
                                    dateStr={dateStr}
                                    log={log}
                                    onToggle={onToggle}
                                    onChoiceSelect={onChoiceSelect}
                                />
                            );
                        }

                        // Checklist Bundle Logic (Existing)
                        const totalChildren = subHabits.length;
                        const completedChildren = subHabits.filter((c: Habit) => logs[`${c.id}-${dateStr}`]?.completed).length;

                        return (
                            <div key={dateStr} className="w-16 flex-shrink-0 border-r border-white/5 flex items-center justify-center p-2">
                                <div
                                    className="relative w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors p-1"
                                    onClick={() => {
                                        const isAllComplete = totalChildren > 0 && completedChildren === totalChildren;
                                        const targetState = !isAllComplete;
                                        subHabits.forEach(sub => {
                                            const isSubComplete = !!logs[`${sub.id}-${dateStr}`]?.completed;
                                            if (isSubComplete !== targetState) {
                                                onToggle(sub.id, dateStr);
                                            }
                                        });
                                    }}
                                >
                                    <div className="text-[10px] font-medium text-neutral-400 mb-1">
                                        {completedChildren}/{totalChildren}
                                    </div>
                                    <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                                        <div
                                            className={cn(
                                                "h-full transition-all duration-300",
                                                completedChildren === totalChildren ? "bg-emerald-500" : "bg-indigo-500"
                                            )}
                                            style={{ width: `${totalChildren > 0 ? (completedChildren / totalChildren) * 100 : 0}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Expanded Children (Checklist Only) */}
            {isExpanded && !isChoice && (
                <div className="flex flex-col">
                    {subHabits.map((child: Habit) => (
                        <div key={child.id} className="flex border-b border-white/5 last:border-0 bg-neutral-900/50">
                            {/* Child Name Cell */}
                            <div
                                className="w-64 flex-shrink-0 p-4 pl-12 border-r border-white/5 flex items-center justify-between cursor-pointer hover:bg-white/[0.02] group relative"
                                onClick={(e) => {
                                    handleCellClick(e, child, format(new Date(), 'yyyy-MM-dd'));
                                }}
                            >
                                <span className="text-sm text-neutral-400 truncate">{child.name}</span>
                                {/* Child Actions */}
                                <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex gap-2 bg-neutral-900/80 p-1 rounded">
                                    <button onClick={(e) => { e.stopPropagation(); onEditHabit(child); }} className="text-[10px] text-neutral-500 hover:text-white uppercase tracking-wider font-semibold">Edit</button>
                                    <button onClick={(e) => { e.stopPropagation(); if (deleteConfirmId === child.id) deleteHabit(child.id); else setDeleteConfirmId(child.id); }} className="text-[10px] text-red-500 hover:text-red-400 uppercase tracking-wider font-semibold">
                                        {deleteConfirmId === child.id ? 'Sure?' : 'Del'}
                                    </button>
                                </div>
                            </div>
                            {/* Child Days Grid */}
                            <div className="flex">
                                {dates.map(date => {
                                    const dateStr = format(date, 'yyyy-MM-dd');
                                    const log = logs[`${child.id}-${dateStr}`];
                                    const isDone = log?.completed;
                                    return (
                                        <div key={dateStr} className="w-16 flex-shrink-0 border-r border-white/5 flex items-center justify-center p-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); onToggle(child.id, dateStr); }}
                                                className={cn("w-6 h-6 rounded flex items-center justify-center transition-colors", isDone ? "bg-indigo-500/20 text-indigo-400" : "bg-neutral-800 text-neutral-700 hover:bg-neutral-700")}
                                            >
                                                <Check size={14} className={isDone ? 'opacity-100' : 'opacity-0'} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ChoiceCell: React.FC<{
    habit: Habit;
    dateStr: string;
    log: DayLog | undefined;
    onToggle: (habitId: string, date: string) => Promise<void>;
    onChoiceSelect: (habitId: string, date: string, optionKey: string) => Promise<void>;
}> = ({ habit, dateStr, log, onToggle, onChoiceSelect }) => {
    const isCompleted = log?.completed;
    const currentOptionKey = log?.bundleOptionId;
    const currentOption = habit.bundleOptions?.find(o => o.key === currentOptionKey);
    const [showMenu, setShowMenu] = React.useState(false);
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const [menuPos, setMenuPos] = React.useState({ top: 0, left: 0 });

    const toggleMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (showMenu) {
            setShowMenu(false);
        } else {
            // Calculate position
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                setMenuPos({ top: rect.bottom + 4, left: rect.left + (rect.width / 2) });
            }
            setShowMenu(true);
        }
    };

    const handleGenericToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isCompleted) {
            onToggle(habit.id, dateStr);
        } else {
            toggleMenu(e);
        }
    };

    // Close on click outside
    React.useEffect(() => {
        const close = () => setShowMenu(false);
        if (showMenu) {
            window.addEventListener('click', close);
            window.addEventListener('scroll', close, true); // Close on scroll
            return () => {
                window.removeEventListener('click', close);
                window.removeEventListener('scroll', close, true);
            };
        }
    }, [showMenu]);

    return (
        <div className="w-16 flex-shrink-0 border-r border-white/5 relative flex items-center justify-center p-2">
            <button
                ref={triggerRef}
                onClick={handleGenericToggle}
                className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center transition-all relative group/btn",
                    isCompleted
                        ? (currentOption ? "bg-amber-500 text-neutral-900" : "bg-emerald-500 text-neutral-900")
                        : "bg-neutral-800 text-neutral-600 hover:bg-neutral-700"
                )}
            >
                {isCompleted && (
                    currentOption ? (
                        <span className="text-[10px] font-bold uppercase truncate max-w-[36px] px-1 pointer-events-none">
                            {currentOption.label.substring(0, 3)}
                        </span>
                    ) : (
                        <Check size={18} />
                    )
                )}
                {/* Hover Hint if Completed */}
                {isCompleted && !showMenu && (
                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover/btn:opacity-100 pointer-events-none whitespace-nowrap z-20">
                        {currentOption ? currentOption.label : 'Generic Complete'}
                    </div>
                )}
            </button>

            {/* Portal Menu */}
            {showMenu && createPortal(
                <div
                    className="fixed w-32 bg-neutral-800 border border-white/10 rounded-lg shadow-xl z-[9999] overflow-hidden flex flex-col p-1"
                    style={{
                        top: menuPos.top,
                        left: menuPos.left,
                        transform: 'translateX(-50%)' // Center align
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="text-[10px] uppercase text-neutral-500 px-2 py-1 font-semibold">Select Option</div>
                    {habit.bundleOptions?.map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => {
                                onChoiceSelect(habit.id, dateStr, opt.key || '');
                                setShowMenu(false);
                            }}
                            className={cn(
                                "text-left px-2 py-1.5 text-xs rounded hover:bg-white/10 transition-colors flex items-center gap-2",
                                currentOptionKey === opt.key ? "text-amber-400" : "text-neutral-300"
                            )}
                        >
                            {currentOptionKey === opt.key && <div className="w-1 h-1 rounded-full bg-amber-400" />}
                            <span className="truncate">{opt.label}</span>
                        </button>
                    ))}
                    <div className="h-[1px] bg-white/5 my-1" />
                    <button
                        onClick={() => {
                            onToggle(habit.id, dateStr); // Toggle off
                            setShowMenu(false);
                        }}
                        className="text-left px-2 py-1.5 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    >
                        Uncheck / Clear
                    </button>
                </div>,
                document.body
            )}
        </div>
    );
};
