import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTasks } from '../../context/TaskContext';

interface AddTaskInputProps {
    defaultPlacement?: 'inbox' | 'today';
    placeholder?: string;
}

export const AddTaskInput: React.FC<AddTaskInputProps> = ({
    defaultPlacement = 'inbox',
    placeholder = "Add a task..."
}) => {
    const { addTask } = useTasks();
    const [title, setTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim() || isSubmitting) return;

        try {
            setIsSubmitting(true);
            await addTask({
                title: title.trim(),
                listPlacement: defaultPlacement
            });
            setTitle('');
        } catch (error) {
            console.error('Failed to add task', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                <Plus size={16} />
            </div>
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={placeholder}
                disabled={isSubmitting}
                className="
          w-full bg-neutral-900 border border-neutral-800 rounded-lg py-2.5 pl-9 pr-4
          text-sm text-neutral-200 placeholder-neutral-500
          focus:outline-none focus:border-neutral-600 focus:bg-neutral-800
          transition-all duration-200
        "
                autoFocus={defaultPlacement === 'inbox'}
            />
        </form>
    );
};
