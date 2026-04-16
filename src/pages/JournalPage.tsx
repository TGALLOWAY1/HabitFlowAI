import { useState } from 'react';
import { JournalDisplay } from '../components/Journal/JournalDisplay';
import { JournalEditor } from '../components/Journal/JournalEditor';
import type { JournalEntry } from '../models/persistenceTypes';
import { PenLine, LayoutTemplate, History } from 'lucide-react';
import { JournalSummaryBanner } from '../components/Journal/JournalSummaryBanner';

type JournalTab = 'free' | 'templates' | 'history';

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
        { id: 'free', label: 'Free Write', icon: PenLine },
        { id: 'templates', label: 'Templates', icon: LayoutTemplate },
        { id: 'history', label: 'History', icon: History },
    ];

    return (
        <div className="px-3 sm:px-4 pb-0 max-w-4xl mx-auto">
            {/* AI Weekly Summary Banner */}
            {!isEditingExisting && <JournalSummaryBanner />}

            {/* Tab Navigation (Hidden when editing an existing entry to focus) */}
            {!isEditingExisting && (
                <div className="flex gap-4 border-b border-line-subtle mb-4">
                    {tabs.map(({ id, label, icon: Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            className={`pb-3 px-3 text-sm font-medium transition-colors relative ${activeTab === id ? 'text-accent-contrast' : 'text-content-primary/40 hover:text-content-primary/60'}`}
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
                ) : (
                    // History Tab
                    <div className="animate-in fade-in duration-300">
                        <JournalDisplay onEdit={handleEdit} lastSavedEntry={lastSavedEntry} />
                    </div>
                )}
            </div>
        </div>
    );
}
