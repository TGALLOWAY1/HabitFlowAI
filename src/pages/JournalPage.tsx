import { useState } from 'react';
import { JournalDisplay } from '../components/Journal/JournalDisplay';
import { JournalEditor } from '../components/Journal/JournalEditor';
import type { JournalEntry } from '../models/persistenceTypes';
import { Plus, Book } from 'lucide-react';

export function JournalPage() {
    const [isEditing, setIsEditing] = useState(false);
    const [editingEntry, setEditingEntry] = useState<JournalEntry | undefined>(undefined);

    // Key to force refresh of list after save
    const [refreshKey, setRefreshKey] = useState(0);

    const handleCreateNew = () => {
        setEditingEntry(undefined);
        setIsEditing(true);
    };

    const handleEdit = (entry: JournalEntry) => {
        setEditingEntry(entry);
        setIsEditing(true);
    };

    const handleSave = () => {
        setIsEditing(false);
        setEditingEntry(undefined);
        setRefreshKey(prev => prev + 1);
    };

    const handleCancel = () => {
        setIsEditing(false);
        setEditingEntry(undefined);
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            {/* Header */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Book className="text-emerald-400" />
                        Journal
                    </h1>
                    <p className="text-white/40 mt-1">
                        Reflect, plan, and grow with psychology-backed templates.
                    </p>
                </div>
                {!isEditing && (
                    <button
                        onClick={handleCreateNew}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
                    >
                        <Plus size={20} />
                        New Entry
                    </button>
                )}
            </div>

            {/* Main Content */}
            <div className="relative">
                {isEditing ? (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <JournalEditor
                            existingEntry={editingEntry}
                            onSave={handleSave}
                            onCancel={handleCancel}
                        />
                    </div>
                ) : (
                    <div className="animate-in fade-in duration-300" key={refreshKey}>
                        <JournalDisplay onEdit={handleEdit} />
                    </div>
                )}
            </div>
        </div>
    );
}
