import { useState } from 'react';
import { JournalDisplay } from '../components/Journal/JournalDisplay';
import { JournalEditor } from '../components/Journal/JournalEditor';
import type { JournalEntry } from '../models/persistenceTypes';
import { PenLine, LayoutTemplate, History, Sparkles } from 'lucide-react';
import { JournalSummaryCard } from '../components/Journal/JournalSummaryCard';

type JournalTab = 'free' | 'templates' | 'history' | 'summary';

export function JournalPage() {
    const [activeTab, setActiveTab] = useState<JournalTab>('free');
    const [editingEntry, setEditingEntry] = useState<JournalEntry | undefined>(undefined);
    // If true, we are in a special "Edit Mode" that overrides the tabs
    const [isEditingExisting, setIsEditingExisting] = useState(false);

    // Key to force remount of free-write editor after save
    const [freeWriteKey, setFreeWriteKey] = useState(0);
    // Last saved entry for optimistic updates (avoids full refetch)
    const [lastSavedEntry, setLastSavedEntry] = useState<JournalEntry | undefined>(undefined);

    const handleEdit = (entry: JournalEntry) => {
        setEditingEntry(entry);
        setIsEditingExisting(true);
    };

    const handleSave = (entry?: JournalEntry) => {
        setEditingEntry(undefined);
        setIsEditingExisting(false);
        if (entry) setLastSavedEntry(entry);
        setFreeWriteKey(prev => prev + 1);
        // Switch to history to see new/updated entry
        setActiveTab('history');
    };

    const handleCancel = () => {
        setEditingEntry(undefined);
        setIsEditingExisting(false);
    };

    const tabs: { id: JournalTab; label: string; icon: typeof PenLine }[] = [
        { id: 'free', label: 'Free', icon: PenLine },
        { id: 'templates', label: 'Templates', icon: LayoutTemplate },
        { id: 'history', label: 'History', icon: History },
        { id: 'summary', label: 'Summary', icon: Sparkles },
    ];

    return (
        <div className="px-3 sm:px-4 pb-0 max-w-4xl mx-auto overflow-hidden">
            {/* Description */}
            {!isEditingExisting && (
                <p className="text-neutral-400 text-sm leading-relaxed mb-4">
                    The journal is for reflection and notes — not a to-do list or tracker.
                </p>
            )}

            {/* Tab Navigation (Hidden when editing an existing entry to focus) */}
            {!isEditingExisting && (
                <div className="flex gap-4 border-b border-white/5 mb-4">
                    {tabs.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`pb-3 px-3 text-sm font-medium transition-colors relative ${activeTab === id ? 'text-emerald-400' : 'text-white/40 hover:text-white/60'}`}
                        >
                            <div className="flex items-center gap-2">
                                <Icon size={16} />
                                {label}
                            </div>
                            {activeTab === id && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Main Content */}
            <div className="relative">
                {isEditingExisting ? (
                    // Edit Mode (Existing Entry)
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <JournalEditor
                            existingEntry={editingEntry}
                            onSave={handleSave}
                            onCancel={handleCancel}
                        />
                    </div>
                ) : activeTab === 'free' ? (
                    // Free Write Tab — skip straight to writing
                    <div className="animate-in fade-in duration-300" key={freeWriteKey}>
                        <JournalEditor
                            initialTemplateId="free-write"
                            onSave={handleSave}
                            minimal
                        />
                    </div>
                ) : activeTab === 'templates' ? (
                    // Templates Tab (New Entry Mode)
                    <div className="animate-in fade-in duration-300">
                        <JournalEditor
                            onSave={handleSave}
                        />
                    </div>
                ) : activeTab === 'history' ? (
                    // History Tab
                    <div className="animate-in fade-in duration-300">
                        <JournalDisplay onEdit={handleEdit} lastSavedEntry={lastSavedEntry} />
                    </div>
                ) : (
                    // Summary Tab
                    <div className="animate-in fade-in duration-300">
                        <JournalSummaryCard />
                    </div>
                )}
            </div>
        </div>
    );
}
