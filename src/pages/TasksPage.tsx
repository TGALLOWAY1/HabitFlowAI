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
            {/* Philosophy Header */}
            <div className="mb-2 px-1">
                <p className="text-neutral-500 text-sm max-w-lg leading-relaxed">
                    Tasks are transient obligations, not signals of growth.
                    <br />
                    Capture them here to clear your mind — not to measure your worth.
                </p>
            </div>

            <div className="flex flex-col md:flex-row h-full gap-6">

                {/* INBOX COLUMN */}
                <div className="flex-1 flex flex-col min-w-0 bg-neutral-900/30 rounded-xl border border-neutral-800/50 overflow-hidden">
                    <div className="p-4 border-b border-neutral-800/50 bg-neutral-900/50 flex items-baseline justify-between">
                        <h2 className="text-lg font-medium text-neutral-300">Inbox</h2>
                        <span className="text-xs text-neutral-500 font-mono">{inboxTasks.filter(t => t.status !== 'completed').length} pending</span>
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
                                <div className="py-12 text-center text-neutral-600 text-sm">
                                    Inbox empty
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* TODAY COLUMN */}
                <div className="flex-1 flex flex-col min-w-0 bg-neutral-900/30 rounded-xl border border-neutral-800/50 overflow-hidden">
                    <div className="p-4 border-b border-neutral-800/50 bg-neutral-900/50 flex items-baseline justify-between">
                        <h2 className="text-lg font-medium text-emerald-500/90">Today</h2>
                        <span className="text-xs text-neutral-500 font-mono">{todayTasks.filter(t => t.status !== 'completed').length} active</span>
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
                                <div className="py-12 text-center text-neutral-600 text-sm">
                                    No tasks committed for today
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
