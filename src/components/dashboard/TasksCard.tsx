import { CheckSquare, ChevronRight } from 'lucide-react';
import { useTasks } from '../../context/TaskContext';

interface TasksCardProps {
    onNavigateToTasks: () => void;
}

export const TasksCard: React.FC<TasksCardProps> = ({ onNavigateToTasks }) => {
    const { tasks, loading } = useTasks();

    const todayTasks = tasks.filter(t => t.listPlacement === 'today' && t.status !== 'deleted');
    const completedCount = todayTasks.filter(t => t.status === 'completed').length;
    const totalCount = todayTasks.length;

    if (loading) {
        return (
            <div className="bg-surface-0/50 rounded-2xl border border-line-subtle p-4 backdrop-blur-sm animate-pulse">
                <div className="h-4 w-20 bg-surface-1 rounded mb-2" />
                <div className="h-3 w-16 bg-surface-1 rounded" />
            </div>
        );
    }

    return (
        <button
            onClick={onNavigateToTasks}
            className="bg-surface-0/50 rounded-2xl border border-line-subtle p-4 backdrop-blur-sm text-left w-full hover:bg-surface-1/50 transition-colors group"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-surface-1 text-blue-400">
                        <CheckSquare size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-content-primary">
                            {totalCount === 0
                                ? 'Tasks'
                                : `${completedCount}/${totalCount} tasks`}
                        </p>
                    </div>
                </div>
                <ChevronRight size={16} className="text-content-muted group-hover:text-content-secondary transition-colors" />
            </div>
        </button>
    );
};
