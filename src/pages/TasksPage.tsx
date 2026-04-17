import React from 'react';
import { useTasks } from '../context/TaskContext';
import { TaskItem } from '../components/tasks/TaskItem';
import { AddTaskInput } from '../components/tasks/AddTaskInput';

export const TasksPage: React.FC = () => {
    const { tasks, loading, error } = useTasks();

    if (loading) return (
        <div className="flex items-center justify-center h-full text-content-muted animate-pulse">
            Loading tasks...
        </div>
    );

    if (error) return (
        <div className="p-8 text-red-400 bg-red-900/10 rounded-xl border border-red-900/20">
            <h3 className="font-bold mb-2">Error loading tasks</h3>
            <p>{error}</p>
        </div>
    );

    const inboxTasks = tasks.filter(t => t.listPlacement === 'inbox' && t.status !== 'deleted');
    const todayTasks = tasks.filter(t => t.listPlacement === 'today' && t.status !== 'deleted');

    // Sort: Active first, then by createdAt (newest for inbox, manual for today?)
    // For now, let's keep it simple: Active first, then newest.
    const sortTasks = (taskList: typeof tasks) => {
        return [...taskList].sort((a, b) => {
            // Completed last
            if (a.status === 'completed' && b.status !== 'completed') return 1;
            if (a.status !== 'completed' && b.status === 'completed') return -1;

            // Newest first
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    };

    const sortedInbox = sortTasks(inboxTasks);
    const sortedToday = sortTasks(todayTasks);

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Description - sits like a definition under the Tasks header */}
            <p className="text-content-muted text-sm -mt-3">
                A one-time action with a clear finish. Once completed, it's done.
            </p>

            <div className="flex flex-col md:flex-row h-full gap-6">

                {/* TODAY COLUMN */}
                <div className="flex-1 flex flex-col min-w-0 bg-surface-0/30 rounded-xl border border-line-subtle/50 overflow-hidden">
                    <div className="p-4 border-b border-line-subtle/50 bg-surface-0/50 flex items-baseline justify-between">
                        <h2 className="text-lg font-medium text-emerald-500/90">Today</h2>
                        {todayTasks.filter(t => t.status !== 'completed').length > 0 && (
                            <span className="text-xs text-content-muted font-mono">{todayTasks.filter(t => t.status !== 'completed').length} active</span>
                        )}
                    </div>

                    <div className="p-4 bg-surface-0/20 border-b border-line-subtle/30">
                        <AddTaskInput defaultPlacement="today" placeholder="Add directly to today..." />
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                        <div className="space-y-1">
                            {sortedToday.map(task => (
                                <TaskItem key={task.id} task={task} />
                            ))}
                            {sortedToday.length === 0 && (
                                <div className="py-8 text-center">
                                    <p className="text-content-muted text-sm mb-3">Commit what matters for today.</p>
                                    <div className="flex flex-wrap justify-center gap-1.5">
                                        {['Email recruiter', 'Refill prescription', 'Schedule workout'].map((ex) => (
                                            <span key={ex} className="px-2.5 py-1 text-[11px] text-content-muted bg-surface-1/50 rounded-full border border-line-subtle">
                                                {ex}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* INBOX COLUMN */}
                <div className="flex-1 flex flex-col min-w-0 bg-surface-0/30 rounded-xl border border-line-subtle/50 overflow-hidden">
                    <div className="p-4 border-b border-line-subtle/50 bg-surface-0/50 flex items-baseline justify-between">
                        <h2 className="text-lg font-medium text-content-secondary">Inbox</h2>
                        {inboxTasks.filter(t => t.status !== 'completed').length > 0 && (
                            <span className="text-xs text-content-muted font-mono">{inboxTasks.filter(t => t.status !== 'completed').length} pending</span>
                        )}
                    </div>

                    <div className="p-4 bg-surface-0/20 border-b border-line-subtle/30">
                        <AddTaskInput defaultPlacement="inbox" placeholder="Capture to inbox..." />
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                        <div className="space-y-1">
                            {sortedInbox.map(task => (
                                <TaskItem key={task.id} task={task} />
                            ))}
                            {sortedInbox.length === 0 && (
                                <div className="py-8 text-center">
                                    <p className="text-content-muted text-sm mb-3">Capture what's on your mind.</p>
                                    <div className="flex flex-wrap justify-center gap-1.5">
                                        {['Call landlord', 'Buy groceries', 'Send invoice'].map((ex) => (
                                            <span key={ex} className="px-2.5 py-1 text-[11px] text-content-muted bg-surface-1/50 rounded-full border border-line-subtle">
                                                {ex}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
            <div className="text-center text-xs text-content-muted pb-2">
                Tasks reset visually at midnight, but remain in your list until completed or deleted.
            </div>
        </div>
    );
};
