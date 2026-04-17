import { useEffect, useState } from 'react';
import { format, subDays } from 'date-fns';
import { fetchEntries, deleteEntry } from '../../api/journal';
import type { JournalEntry } from '../../models/persistenceTypes';
import { JOURNAL_TEMPLATES } from '../../data/journalTemplates';
import { Trash2, Edit2, BookOpen, Sparkles } from 'lucide-react';

interface JournalDisplayProps {
    onEdit: (entry: JournalEntry) => void;
    lastSavedEntry?: JournalEntry;
}

export function JournalDisplay({ onEdit, lastSavedEntry }: JournalDisplayProps) {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const loadEntries = async () => {
        try {
            setLoading(true);
            const startDate = format(subDays(new Date(), 90), 'yyyy-MM-dd');
            const data = await fetchEntries({ startDate });
            setEntries(data);
        } catch (error) {
            console.error('Failed to load journal entries', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEntries();
    }, []);

    // Optimistic update: merge saved entry into local state without refetching
    useEffect(() => {
        if (!lastSavedEntry) return;
        setEntries(prev => {
            const filtered = prev.filter(e => e.id !== lastSavedEntry.id);
            // Insert at correct position (sorted by date desc)
            const idx = filtered.findIndex(e => e.date < lastSavedEntry.date);
            if (idx === -1) return [...filtered, lastSavedEntry];
            return [...filtered.slice(0, idx), lastSavedEntry, ...filtered.slice(idx)];
        });
    }, [lastSavedEntry]);

    const handleDelete = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this entry?')) return;

        try {
            await deleteEntry(id);
            setEntries(entries.filter(e => e.id !== id));
        } catch (error) {
            console.error('Failed to delete entry', error);
        }
    };

    const getTemplateTitle = (id: string) => {
        if (id === 'free-write') return 'Free Write';
        if (id === 'ai-weekly-summary') return 'AI Weekly Summary';
        const template = JOURNAL_TEMPLATES.find(t => t.id === id);
        return template ? template.title : id;
    };

    if (loading) {
        return <div className="text-center p-8 text-content-primary/50">Loading journal history...</div>;
    }

    if (entries.length === 0) {
        return (
            <div className="flex flex-col items-center text-center p-8 sm:p-12 bg-white/5 rounded-2xl border border-line-subtle">
                <div className="w-14 h-14 bg-surface-1 rounded-full flex items-center justify-center mb-5">
                    <BookOpen size={28} className="text-content-muted" />
                </div>
                <h3 className="text-lg font-semibold text-content-primary mb-2">No entries yet</h3>
                <p className="text-sm text-content-secondary mb-4 max-w-sm leading-relaxed">
                    Use journaling to reflect, review, or just get thoughts out of your head.
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                    {['Quick Free Write', 'Morning Reflection', 'Evening Review'].map((ex) => (
                        <span key={ex} className="px-3 py-1 text-xs text-content-secondary bg-surface-1/80 rounded-full border border-line-subtle">
                            {ex}
                        </span>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {entries.map((entry) => (
                <div
                    key={entry.id}
                    className="group relative bg-white/5 hover:bg-surface-2 border border-line-subtle hover:border-line-strong rounded-xl p-5 transition-all duration-300"
                >
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold uppercase tracking-wider text-accent-contrast bg-emerald-400/10 px-2 py-0.5 rounded-full">
                                    {getTemplateTitle(entry.templateId)}
                                </span>
                                {entry.mode === 'deep' && (
                                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">
                                        Deep
                                    </span>
                                )}
                                {entry.templateId === 'ai-weekly-summary' && (
                                    <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">
                                        <Sparkles size={10} />
                                        AI
                                    </span>
                                )}
                            </div>
                            <h4 className="text-lg font-medium text-content-primary">
                                {format(new Date(entry.date + 'T00:00:00'), 'EEEE, MMMM do, yyyy')}
                            </h4>
                        </div>

                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => onEdit(entry)}
                                className="p-2 text-content-primary/40 hover:text-content-primary hover:bg-surface-2 rounded-lg transition-colors"
                                title="Edit Entry"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button
                                onClick={() => handleDelete(entry.id)}
                                className="p-2 text-danger-contrast/40 hover:text-danger-contrast hover:bg-danger-soft rounded-lg transition-colors"
                                title="Delete Entry"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="text-content-primary/70 line-clamp-3 text-sm font-light italic leading-relaxed">
                        {entry.persona && <span className="text-content-primary/40 not-italic mr-2">[{entry.persona}]</span>}
                        {Object.values(entry.content).join(' ').slice(0, 200)}...
                    </div>
                </div>
            ))}
        </div>
    );
}
