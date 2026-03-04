import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Task, CreateTaskRequest, UpdateTaskRequest } from '../types/task';
import {
    fetchTasks as fetchTasksFromApi,
    createTask as createTaskApi,
    updateTask as updateTaskApi,
    deleteTask as deleteTaskApi,
} from '../lib/persistenceClient';

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
            const list = await fetchTasksFromApi();
            setTasks(list);
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
            const task = await createTaskApi(req);
            setTasks(prev => [task, ...prev]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add task');
            throw err;
        }
    };

    const updateTask = async (id: string, req: UpdateTaskRequest) => {
        try {
            setTasks(prev => prev.map(t =>
                t.id === id ? { ...t, ...req, status: req.status || t.status } : t
            ));
            const task = await updateTaskApi(id, req);
            setTasks(prev => prev.map(t => t.id === id ? task : t));
        } catch (err) {
            await fetchTasks();
            setError(err instanceof Error ? err.message : 'Failed to update task');
            throw err;
        }
    };

    const deleteTask = async (id: string) => {
        try {
            setTasks(prev => prev.filter(t => t.id !== id));
            await deleteTaskApi(id);
        } catch (err) {
            await fetchTasks();
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
