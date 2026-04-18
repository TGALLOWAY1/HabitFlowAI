import React, { useEffect, useRef, useState } from 'react';
import { Check, Trash2, ArrowRight, ArrowLeft, Pencil } from 'lucide-react';
import type { Task } from '../../types/task';
import { useTasks } from '../../context/TaskContext';

interface TaskItemProps {
    task: Task;
}

export const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
    const { updateTask, deleteTask } = useTasks();
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [draftTitle, setDraftTitle] = useState(task.title);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

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

    const startEditing = () => {
        setDraftTitle(task.title);
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setDraftTitle(task.title);
        setIsEditing(false);
    };

    const commitEditing = async () => {
        const trimmed = draftTitle.trim();
        if (!trimmed || trimmed === task.title) {
            cancelEditing();
            return;
        }
        setIsEditing(false);
        try {
            await updateTask(task.id, { title: trimmed });
        } catch {
            setDraftTitle(task.title);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            void commitEditing();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEditing();
        }
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

            {/* Title (click to edit) or inline edit input */}
            {isEditing ? (
                <input
                    ref={inputRef}
                    type="text"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => void commitEditing()}
                    className="flex-grow text-sm font-light text-neutral-100 bg-neutral-800 border border-neutral-600 rounded px-2 py-0.5 focus:outline-none focus:border-emerald-500"
                    aria-label="Edit task title"
                />
            ) : (
                <button
                    type="button"
                    onClick={startEditing}
                    className={`flex-grow text-left text-sm font-light text-neutral-200 transition-all cursor-text ${isCompleted ? 'line-through text-neutral-500' : ''}`}
                    title="Click to edit"
                >
                    {task.title}
                </button>
            )}

            {/* Actions (visible on hover) */}
            {!isEditing && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        onClick={startEditing}
                        className="p-1.5 text-neutral-500 hover:text-sky-400 hover:bg-sky-500/10 rounded transition-colors"
                        title="Edit"
                    >
                        <Pencil size={14} />
                    </button>

                    {task.listPlacement === 'inbox' && !isCompleted && (
                        <button
                            onClick={handleMoveToToday}
                            className="p-1.5 text-neutral-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
                            title="Move to Today"
                        >
                            <ArrowRight size={14} />
                        </button>
                    )}

                    {task.listPlacement === 'today' && !isCompleted && (
                        <button
                            onClick={handleMoveToInbox}
                            className="p-1.5 text-neutral-500 hover:text-amber-400 hover:bg-amber-500/10 rounded transition-colors"
                            title="Move to Inbox"
                        >
                            <ArrowLeft size={14} />
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
            )}
        </div>
    );
};
