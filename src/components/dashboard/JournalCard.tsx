import { useState, useEffect } from 'react';
import { BookOpen, ChevronRight } from 'lucide-react';
import { fetchEntries } from '../../api/journal';
import type { JournalEntry } from '../../models/persistenceTypes';

interface JournalCardProps {
    onNavigateToJournal: () => void;
}

export const JournalCard: React.FC<JournalCardProps> = ({ onNavigateToJournal }) => {
    const [latestEntry, setLatestEntry] = useState<JournalEntry | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetchEntries()
            .then(entries => {
                if (cancelled) return;
                // Most recent first
                const sorted = entries.sort(
                    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );
                setLatestEntry(sorted[0] ?? null);
            })
            .catch(() => {
                // Silently fail — card shows empty state
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    // Extract preview text from content record
    const previewText = latestEntry
        ? Object.values(latestEntry.content).filter(Boolean).join(' ').slice(0, 120)
        : null;

    const templateLabel = latestEntry?.templateId
        ?.replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());

    if (loading) {
        return (
            <div className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm animate-pulse">
                <div className="h-4 w-24 bg-neutral-800 rounded mb-3" />
                <div className="h-3 w-full bg-neutral-800 rounded" />
            </div>
        );
    }

    return (
        <button
            onClick={onNavigateToJournal}
            className="bg-neutral-900/50 rounded-2xl border border-white/5 p-4 backdrop-blur-sm text-left w-full hover:bg-neutral-800/50 transition-colors group"
        >
            {latestEntry && previewText ? (
                <>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <BookOpen size={14} className="text-amber-400" />
                            <span className="text-xs font-medium text-neutral-400">Journal</span>
                            {templateLabel && (
                                <span className="px-1.5 py-0.5 bg-neutral-800 rounded text-[10px] text-neutral-500">
                                    {templateLabel}
                                </span>
                            )}
                        </div>
                        <span className="text-[10px] text-neutral-600">{latestEntry.date}</span>
                    </div>
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                        {previewText}
                    </p>
                </>
            ) : (
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-neutral-800 text-amber-400">
                            <BookOpen size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">Start a journal entry</p>
                            <p className="text-xs text-neutral-500">Reflect on your day</p>
                        </div>
                    </div>
                    <ChevronRight size={16} className="text-neutral-600 group-hover:text-neutral-400 transition-colors" />
                </div>
            )}
        </button>
    );
};
