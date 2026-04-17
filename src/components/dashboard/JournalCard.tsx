import { Clock, PenLine, LayoutTemplate } from 'lucide-react';

interface JournalCardProps {
    onNavigateToJournal: () => void;
}

export const JournalCard: React.FC<JournalCardProps> = ({ onNavigateToJournal }) => {
    return (
        <div className="bg-surface-0/50 rounded-2xl border border-line-subtle p-4 backdrop-blur-sm">
            <p className="text-xs font-medium text-content-secondary mb-3">Journal</p>
            <div className="flex items-center justify-around">
                <button
                    onClick={onNavigateToJournal}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-surface-1/50 transition-colors min-w-[48px]"
                >
                    <PenLine size={18} className="text-accent-contrast" />
                    <span className="text-[10px] text-content-muted">Free</span>
                </button>
                <button
                    onClick={onNavigateToJournal}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-surface-1/50 transition-colors min-w-[48px]"
                >
                    <LayoutTemplate size={18} className="text-accent-contrast" />
                    <span className="text-[10px] text-content-muted">Template</span>
                </button>
                <button
                    onClick={onNavigateToJournal}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-surface-1/50 transition-colors min-w-[48px]"
                >
                    <Clock size={18} className="text-accent-contrast" />
                    <span className="text-[10px] text-content-muted">History</span>
                </button>
            </div>
        </div>
    );
};
