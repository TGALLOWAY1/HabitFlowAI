import React, { useState } from 'react';
import { Check, Trash2, ArrowRight, ArrowLeft } from 'lucide-react';
import type { Task } from '../../types/task';
import { useTasks } from '../../context/TaskContext';

interface TaskItemProps {
    task: Task;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
    const { updateTask, deleteTask } = useTasks();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleToggle = async () => {
        const newStatus = task.status === 'completed' ? 'active' : 'completed';
        await updateTask(task.id, { status: newStatus });
    };

    const handleDetail = async () => {
        if (confirm('Permanently delete this task?')) {
            setIsDeleting(true);
            await deleteTask(task.id);
        }
    };

    const handleMoveToToday = async () => {
        await updateTask(task.id, { listPlacement: 'today' });
    };

    const handleMoveToInbox = async () => {
        await updateTask(task.id, { listPlacement: 'inbox' });
    };

    const isCompleted = task.status === 'completed';

    return (
        <div className={`group flex items-center gap-3 py-2 px-1 transition-all duration-300 ${isCompleted ? 'opacity-40' : 'opacity-100'}`}>
            {/* Checkbox */}
            <button
                onClick={handleToggle}
                className={`
          flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors
          ${isCompleted
                        ? 'bg-accent-soft border-emerald-500 text-emerald-500'
                        : 'border-line-strong hover:border-neutral-500 text-transparent'
                    }
        `}
            >
                <Check size={12} strokeWidth={3} />
            </button>

            {/* Title */}
            <span
                className={`flex-grow text-sm font-light text-content-primary transition-all ${isCompleted ? 'line-through text-content-muted' : ''}`}
            >
                {task.title}
            </span>

            {/* Actions (visible on hover) */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {task.listPlacement === 'inbox' && !isCompleted && (
                    <button
                        onClick={handleMoveToToday}
                        className="p-1.5 text-content-muted hover:text-accent-contrast hover:bg-accent-strong/10 rounded transition-colors"
                        title="Move to Today"
                    >
                        <ArrowRight size={14} />
                    </button>
                )}

                {task.listPlacement === 'today' && !isCompleted && (
                    <button
                        onClick={handleMoveToInbox}
                        className="p-1.5 text-content-muted hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                        title="Move to Inbox"
                    >
                        <ArrowLeft size={14} />
                    </button>
                )}

                <button
                    onClick={handleDetail}
                    className="p-1.5 text-content-muted hover:text-danger-contrast hover:bg-danger-soft rounded transition-colors"
                    title="Delete"
                    disabled={isDeleting}
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};
