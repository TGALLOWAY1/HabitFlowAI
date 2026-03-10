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
            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm animate-pulse">
                <div className="h-4 w-20 bg-neutral-800 rounded mb-2" />
                <div className="h-3 w-16 bg-neutral-800 rounded" />
            </div>
        );
    }

    return (
        <button
            onClick={onNavigateToTasks}
            className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm text-left w-full hover:bg-neutral-800/50 transition-colors group"
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-neutral-800 text-blue-400">
                        <CheckSquare size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-white">
                            {totalCount === 0
                                ? 'Tasks'
                                : `${completedCount}/${totalCount} tasks`}
                        </p>
                        <p className="text-xs text-neutral-500">
                            {totalCount === 0
                                ? 'Nothing for today'
                                : totalCount === completedCount
                                    ? 'All done!'
                                    : `${totalCount - completedCount} remaining`}
                        </p>
                    </div>
                </div>
                <ChevronRight size={16} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
            </div>
        </button>
    );
};
