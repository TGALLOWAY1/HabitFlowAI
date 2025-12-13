import { useState } from 'react';
import { JournalDisplay } from '../components/Journal/JournalDisplay';
import { JournalEditor } from '../components/Journal/JournalEditor';
import type { JournalEntry } from '../models/persistenceTypes';
import { LayoutTemplate, History } from 'lucide-react';

type JournalTab = 'templates' | 'history';

export function JournalPage() {
    const [activeTab, setActiveTab] = useState<JournalTab>('templates');
    const [editingEntry, setEditingEntry] = useState<JournalEntry | undefined>(undefined);
    // If true, we are in a special "Edit Mode" that overrides the tabs
    const [isEditingExisting, setIsEditingExisting] = useState(false);

    // Key to force refresh of list after save
    const [refreshKey, setRefreshKey] = useState(0);

    const handleEdit = (entry: JournalEntry) => {
        setEditingEntry(entry);
        setIsEditingExisting(true);
    };

    const handleSave = () => {
        setEditingEntry(undefined);
        setIsEditingExisting(false);
        setRefreshKey(prev => prev + 1);
        // Switch to history to see new/updated entry
        setActiveTab('history');
    };

    const handleCancel = () => {
        setEditingEntry(undefined);
        setIsEditingExisting(false);
        // If we were editing, go back to history. If we were creating (templates), we stay in templates (handled by editor logic mostly, but if top level cancel:
        if (activeTab === 'templates') {
            // No-op or reset default state if needed
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            {/* Header Removed (Handled by App.tsx) */}
            {/* <div className="flex justify-between items-end mb-6">...</div> */}

            {/* Tab Navigation (Hidden when editing an existing entry to focus) */}
            {!isEditingExisting && (
                <div className="flex gap-4 border-b border-white/5 mb-6">
                    <button
                        onClick={() => setActiveTab('templates')}
                        className={`pb-3 px-4 text-sm font-medium transition-colors relative ${activeTab === 'templates' ? 'text-emerald-400' : 'text-white/40 hover:text-white/60'}`}
                    >
                        <div className="flex items-center gap-2">
                            <LayoutTemplate size={16} />
                            Templates
                        </div>
                        {activeTab === 'templates' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-t-full" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`pb-3 px-4 text-sm font-medium transition-colors relative ${activeTab === 'history' ? 'text-emerald-400' : 'text-white/40 hover:text-white/60'}`}
                    >
                        <div className="flex items-center gap-2">
                            <History size={16} />
                            History
                        </div>
                        {activeTab === 'history' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-400 rounded-t-full" />
                        )}
                    </button>
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
                ) : activeTab === 'templates' ? (
                    // Templates Tab (New Entry Mode)
                    <div className="animate-in fade-in duration-300">
                        <JournalEditor
                            onSave={handleSave}
                            onCancel={() => {
                                // If cancelling a new entry from templates, we just stay here
                                // The editor handles internal reset
                            }}
                        />
                    </div>
                ) : (
                    // History Tab
                    <div className="animate-in fade-in duration-300" key={refreshKey}>
                        <JournalDisplay onEdit={handleEdit} />
                    </div>
                )}
            </div>
        </div>
    );
}
