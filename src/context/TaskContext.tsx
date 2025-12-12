import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Task, CreateTaskRequest, UpdateTaskRequest } from '../types/task';

interface TaskContextType {
    tasks: Task[];
    loading: boolean;
    error: string | null;
    addTask: (req: CreateTaskRequest) => Promise<void>;
    updateTask: (id: string, req: UpdateTaskRequest) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
    refreshTasks: () => Promise<void>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const useTasks = () => {
    const context = useContext(TaskContext);
    if (!context) {
        throw new Error('useTasks must be used within a TaskProvider');
    }
    return context;
};

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTasks = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/tasks');
            if (!response.ok) throw new Error('Failed to fetch tasks');
            const data = await response.json();
            setTasks(data.tasks);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTasks();
    }, [fetchTasks]);

    const addTask = async (req: CreateTaskRequest) => {
        try {
            const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req),
            });

            if (!response.ok) {
                throw new Error('Failed to create task');
            }

            const data = await response.json();
            setTasks(prev => [data.task, ...prev]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add task');
            throw err;
        }
    };

    const updateTask = async (id: string, req: UpdateTaskRequest) => {
        try {
            // Optimistic update
            setTasks(prev => prev.map(t =>
                t.id === id ? { ...t, ...req, status: req.status || t.status } : t
            ));

            const response = await fetch(`/api/tasks/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req),
            });

            if (!response.ok) {
                // Revert on failure (could implement more robust rollback)
                await fetchTasks();
                throw new Error('Failed to update task');
            }

            const data = await response.json();
            setTasks(prev => prev.map(t => t.id === id ? data.task : t));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update task');
            throw err;
        }
    };

    const deleteTask = async (id: string) => {
        try {
            // Optimistic update
            setTasks(prev => prev.filter(t => t.id !== id));

            const response = await fetch(`/api/tasks/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                await fetchTasks();
                throw new Error('Failed to delete task');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete task');
            throw err;
        }
    };

    return (
        <TaskContext.Provider value={{
            tasks,
            loading,
            error,
            addTask,
            updateTask,
            deleteTask,
            refreshTasks: fetchTasks
        }}>
            {children}
        </TaskContext.Provider>
    );
};
