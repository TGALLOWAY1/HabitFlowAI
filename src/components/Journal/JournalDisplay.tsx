import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fetchEntries, deleteEntry } from '../../api/journal';
import type { JournalEntry } from '../../models/persistenceTypes';
import { JOURNAL_TEMPLATES } from '../../data/journalTemplates';
import { Trash2, Edit2, BookOpen } from 'lucide-react';

interface JournalDisplayProps {
    onEdit: (entry: JournalEntry) => void;
}

export function JournalDisplay({ onEdit }: JournalDisplayProps) {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);

    const loadEntries = async () => {
        try {
            setLoading(true);
            const data = await fetchEntries();
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
        const template = JOURNAL_TEMPLATES.find(t => t.id === id);
        return template ? template.title : id;
    };

    if (loading) {
        return <div className="text-center p-8 text-white/50">Loading journal history...</div>;
    }

    if (entries.length === 0) {
        return (
            <div className="text-center p-12 bg-white/5 rounded-2xl border border-white/10">
                <BookOpen className="w-12 h-12 text-white/20 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-white mb-2">No Entries Yet</h3>
                <p className="text-white/60">Start your journaling habit today.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {entries.map((entry) => (
                <div
                    key={entry.id}
                    className="group relative bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-xl p-5 transition-all duration-300"
                >
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                                    {getTemplateTitle(entry.templateId)}
                                </span>
                                {entry.mode === 'deep' && (
                                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-400 bg-purple-400/10 px-2 py-0.5 rounded-full">
                                        Deep
                                    </span>
                                )}
                            </div>
                            <h4 className="text-lg font-medium text-white">
                                {format(new Date(entry.date), 'EEEE, MMMM do, yyyy')}
                            </h4>
                        </div>

                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => onEdit(entry)}
                                className="p-2 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                title="Edit Entry"
                            >
                                <Edit2 size={16} />
                            </button>
                            <button
                                onClick={() => handleDelete(entry.id)}
                                className="p-2 text-red-400/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                title="Delete Entry"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="text-white/70 line-clamp-3 text-sm font-light italic leading-relaxed">
                        {entry.persona && <span className="text-white/40 not-italic mr-2">[{entry.persona}]</span>}
                        {Object.values(entry.content).join(' ').slice(0, 200)}...
                    </div>
                </div>
            ))}
        </div>
    );
}
