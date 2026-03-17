import React from 'react';
import { useTasks } from '../context/TaskContext';
import { TaskItem } from '../components/tasks/TaskItem';
import { AddTaskInput } from '../components/tasks/AddTaskInput';

export const TasksPage: React.FC = () => {
    const { tasks, loading, error } = useTasks();

    if (loading) return (
        <div className="flex items-center justify-center h-full text-neutral-500 animate-pulse">
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
            {/* Concrete helper copy */}
            <div className="mb-2 px-1">
                <p className="text-neutral-400 text-sm leading-relaxed">
                    Capture anything on your mind, then commit what matters for today.
                </p>
            </div>

            <div className="flex flex-col md:flex-row h-full gap-6">

                {/* INBOX COLUMN */}
                <div className="flex-1 flex flex-col min-w-0 bg-neutral-900/30 rounded-xl border border-neutral-800/50 overflow-hidden">
                    <div className="p-4 border-b border-neutral-800/50 bg-neutral-900/50 flex items-baseline justify-between">
                        <h2 className="text-lg font-medium text-neutral-300">Inbox</h2>
                        {inboxTasks.filter(t => t.status !== 'completed').length > 0 && (
                            <span className="text-xs text-neutral-600 font-mono">{inboxTasks.filter(t => t.status !== 'completed').length} pending</span>
                        )}
                    </div>

                    <div className="p-4 bg-neutral-900/20 border-b border-neutral-800/30">
                        <AddTaskInput defaultPlacement="inbox" placeholder="Capture to inbox..." />
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                        <div className="space-y-1">
                            {sortedInbox.map(task => (
                                <TaskItem key={task.id} task={task} />
                            ))}
                            {sortedInbox.length === 0 && (
                                <div className="py-8 text-center">
                                    <p className="text-neutral-500 text-sm mb-3">Capture what's on your mind.</p>
                                    <div className="flex flex-wrap justify-center gap-1.5">
                                        {['Call landlord', 'Buy groceries', 'Send invoice'].map((ex) => (
                                            <span key={ex} className="px-2.5 py-1 text-[11px] text-neutral-600 bg-neutral-800/50 rounded-full border border-white/5">
                                                {ex}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* TODAY COLUMN */}
                <div className="flex-1 flex flex-col min-w-0 bg-neutral-900/30 rounded-xl border border-neutral-800/50 overflow-hidden">
                    <div className="p-4 border-b border-neutral-800/50 bg-neutral-900/50 flex items-baseline justify-between">
                        <h2 className="text-lg font-medium text-emerald-500/90">Today</h2>
                        {todayTasks.filter(t => t.status !== 'completed').length > 0 && (
                            <span className="text-xs text-neutral-600 font-mono">{todayTasks.filter(t => t.status !== 'completed').length} active</span>
                        )}
                    </div>

                    <div className="p-4 bg-neutral-900/20 border-b border-neutral-800/30">
                        <AddTaskInput defaultPlacement="today" placeholder="Add directly to today..." />
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                        <div className="space-y-1">
                            {sortedToday.map(task => (
                                <TaskItem key={task.id} task={task} />
                            ))}
                            {sortedToday.length === 0 && (
                                <div className="py-8 text-center">
                                    <p className="text-neutral-500 text-sm mb-3">Commit what matters for today.</p>
                                    <div className="flex flex-wrap justify-center gap-1.5">
                                        {['Email recruiter', 'Refill prescription', 'Schedule workout'].map((ex) => (
                                            <span key={ex} className="px-2.5 py-1 text-[11px] text-neutral-600 bg-neutral-800/50 rounded-full border border-white/5">
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
            <div className="text-center text-xs text-neutral-600 pb-2">
                Tasks reset visually at midnight, but remain in your list until completed or deleted.
            </div>
        </div>
    );
};
