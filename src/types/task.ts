export interface Task {
    id: string;
    userId: string;
    title: string;
    status: 'active' | 'completed' | 'deleted';
    listPlacement: 'inbox' | 'today';
    linkedGoalId?: string;
    createdAt: string; // ISO8601
    completedAt?: string;
    movedToTodayAt?: string;
}

export type CreateTaskRequest = Pick<Task, 'title'> & Partial<Pick<Task, 'listPlacement' | 'linkedGoalId'>>;

export type UpdateTaskRequest = Partial<Pick<Task, 'title' | 'status' | 'listPlacement' | 'linkedGoalId' | 'completedAt'>>;
