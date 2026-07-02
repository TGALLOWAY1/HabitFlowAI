import { Clock, PenLine, LayoutTemplate } from 'lucide-react';

type JournalTab = 'free' | 'templates' | 'history' | 'review';

interface JournalCardProps {
    onNavigateToJournal: (tab?: JournalTab) => void;
}

const ACTIONS: { icon: typeof PenLine; label: string; tab: JournalTab; color: string }[] = [
    { icon: PenLine, label: 'Free', tab: 'free', color: 'text-emerald-400' },
    { icon: LayoutTemplate, label: 'Template', tab: 'templates', color: 'text-emerald-400' },
    { icon: Clock, label: 'History', tab: 'history', color: 'text-emerald-400' },
];

export const JournalCard: React.FC<JournalCardProps> = ({ onNavigateToJournal }) => {
    return (
        <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm flex flex-col">
            <p className="text-xs font-medium text-neutral-400 mb-3">Journal</p>
            <div className="flex items-center justify-between flex-1">
                {ACTIONS.map(({ icon: Icon, label, tab, color }) => (
                    <button
                        key={label}
                        onClick={() => onNavigateToJournal(tab)}
                        className="flex flex-col items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-neutral-800/50 transition-colors flex-1"
                    >
                        <Icon size={18} className={color} />
                        <span className="text-[10px] text-neutral-500">{label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
