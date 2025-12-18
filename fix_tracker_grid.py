
import os

target_file = '/Users/tjgalloway/Programming Projects 2025/HabitFlowAI/src/components/TrackerGrid.tsx'

with open(target_file, 'r') as f:
    lines = f.readlines()

# Find the Weekly Habits section start.
cutoff_index = -1
for i, line in enumerate(lines):
    if "{/* Weekly Habits Section - Redesigned as Cards */ }" in line:
        cutoff_index = i
        break
    if "{/* Weekly Habits Section - Redesigned as Cards */}" in line: # Try without space
        cutoff_index = i
        break

if cutoff_index == -1:
    print("Could not find cutoff point")
    # Fallback to search for lines around where it was
    for i, line in enumerate(lines):
         if "weeklyHabits.length > 0" in line and i > 1200:
             cutoff_index = i - 1 # backup a bit
             break
    
    if cutoff_index == -1:
         print("Really could not find cutoff")
         exit(1)

content_top = lines[:cutoff_index+1]

new_bottom = """
                    {weeklyHabits.length > 0 && (
                        <div className="flex flex-col border-t border-white/5 mt-8 pt-8">
                             <div className="px-6 mb-6">
                                <h3 className="text-lg font-medium text-emerald-400 flex items-center gap-2">
                                    <span>Weekly Progress</span>
                                    <span className="text-xs text-neutral-500 font-normal px-2 py-0.5 rounded-full bg-neutral-800 border border-white/5">Resets Monday</span>
                                </h3>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-6">
                                {weeklyHabits.map(habit => (
                                    <WeeklyHabitCard
                                        key={habit.id}
                                        habit={habit}
                                        logs={logs}
                                        goals={progressData?.goalsWithProgress.map(g => g.goal)}
                                        potentialEvidence={potentialEvidence?.some(e => e.habitId === habit.id)}
                                        onToggle={(h) => handleToggle(h.id, format(new Date(), 'yyyy-MM-dd'))}
                                        onLogValue={(e, h, val) => {
                                            // Open popover for quantity inputs
                                            handleOpenPopover(e, h, format(new Date(), 'yyyy-MM-dd'), val);
                                        }}
                                        onEdit={(h) => onEditHabit(h)}
                                        onViewHistory={(h) => setHistoryModalHabitId(h.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </DndContext>

            {/* Modals */}
            <NumericInputPopover
                isOpen={popoverState.isOpen}
                onClose={() => setPopoverState(prev => ({ ...prev, isOpen: false }))}
                onSubmit={async (val) => {
                    try {
                        const { habitId, date } = popoverState;
                        // Use type assertion to access potential extra fields
                        const state = popoverState as any;
                        if (state.bundleOptionId) {
                            await upsertHabitEntry(habitId, date, {
                                value: val,
                                bundleOptionId: state.bundleOptionId
                            });
                        } else {
                            await upsertHabitEntry(habitId, date, { value: val });
                        }
                        refreshProgress();
                        setPopoverState(prev => ({ ...prev, isOpen: false }));
                    } catch (error) {
                        console.error('Failed to update log:', error);
                        setPopoverState(prev => ({ ...prev, isOpen: false }));
                    }
                }}
                initialValue={popoverState.initialValue}
                unit={popoverState.unit}
                position={popoverState.position}
            />

            {historyModalHabitId && (
                <HabitHistoryModal
                    habitId={historyModalHabitId}
                    onClose={() => setHistoryModalHabitId(null)}
                />
            )}

            {/* Habit Choice Log Modal */}
            {choiceLogState && (
                <HabitLogModal
                    isOpen={!!choiceLogState}
                    onClose={() => setChoiceLogState(null)}
                    habit={choiceLogState.habit}
                    date={choiceLogState.date}
                    existingEntry={logs[`${choiceLogState.habit.id}-${choiceLogState.date}`] ? {
                        bundleOptionId: logs[`${choiceLogState.habit.id}-${choiceLogState.date}`].bundleOptionId,
                        value: logs[`${choiceLogState.habit.id}-${choiceLogState.date}`].value
                    } : undefined}
                    onSave={handleChoiceSave}
                />
            )}
        </div>
    );
};

export default TrackerGrid;
"""

final_content = "".join(content_top) + new_bottom

with open(target_file, 'w') as f:
    f.write(final_content)

print(f"Successfully rewrote TrackerGrid.tsx, new length {len(final_content)} bytes")
