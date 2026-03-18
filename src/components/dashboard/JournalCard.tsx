import { Clock, PenLine, LayoutTemplate } from 'lucide-react';

interface JournalCardProps {
    onNavigateToJournal: () => void;
}

export const JournalCard: React.FC<JournalCardProps> = ({ onNavigateToJournal }) => {
    return (
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm">
            <p className="text-xs font-medium text-neutral-400 mb-3">Journal</p>
            <div className="flex items-center justify-around">
                <button
                    onClick={onNavigateToJournal}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-neutral-800/50 transition-colors min-w-[48px]"
                >
                    <PenLine size={18} className="text-emerald-400" />
                    <span className="text-[10px] text-neutral-500">Free</span>
                </button>
                <button
                    onClick={onNavigateToJournal}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-neutral-800/50 transition-colors min-w-[48px]"
                >
                    <LayoutTemplate size={18} className="text-emerald-400" />
                    <span className="text-[10px] text-neutral-500">Template</span>
                </button>
                <button
                    onClick={onNavigateToJournal}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-neutral-800/50 transition-colors min-w-[48px]"
                >
                    <Clock size={18} className="text-emerald-400" />
                    <span className="text-[10px] text-neutral-500">History</span>
                </button>
            </div>
        </div>
    );
};
