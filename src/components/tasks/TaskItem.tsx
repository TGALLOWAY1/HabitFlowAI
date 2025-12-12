import React, { useState } from 'react';
import { Check, Trash2, ArrowRight } from 'lucide-react';
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

    const isCompleted = task.status === 'completed';

    return (
        <div className={`group flex items-center gap-3 py-2 px-1 transition-all duration-300 ${isCompleted ? 'opacity-40' : 'opacity-100'}`}>
            {/* Checkbox */}
            <button
                onClick={handleToggle}
                className={`
          flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors
          ${isCompleted
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500'
                        : 'border-neutral-700 hover:border-neutral-500 text-transparent'
                    }
        `}
            >
                <Check size={12} strokeWidth={3} />
            </button>

            {/* Title */}
            <span
                className={`flex-grow text-sm font-light text-neutral-200 transition-all ${isCompleted ? 'line-through text-neutral-500' : ''}`}
            >
                {task.title}
            </span>

            {/* Actions (visible on hover) */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {task.listPlacement === 'inbox' && !isCompleted && (
                    <button
                        onClick={handleMoveToToday}
                        className="p-1.5 text-neutral-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                        title="Move to Today"
                    >
                        <ArrowRight size={14} />
                    </button>
                )}

                <button
                    onClick={handleDetail}
                    className="p-1.5 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="Delete"
                    disabled={isDeleting}
                >
                    <Trash2 size={14} />
                </button>
            </div>
        </div>
    );
};
