import React, { useState, useEffect } from 'react';
import { X, Plus, Copy, Loader2, Image as ImageIcon, Sparkles } from 'lucide-react';
import { uploadRoutineImage, deleteRoutineImage, suggestVariants } from '../lib/persistenceClient';
import { getGeminiApiKey, hasGeminiApiKey } from '../lib/geminiClient';
import { useRoutineStore } from '../store/RoutineContext';
import { useHabitStore } from '../store/HabitContext';
import { computeVariantLinkedHabits } from '../lib/routineVariantUtils';
import { VariantEditor } from './VariantEditor';
import type { Routine, RoutineVariant } from '../models/persistenceTypes';

interface RoutineEditorModalProps {
    isOpen: boolean;
    mode: 'create' | 'edit';
    initialRoutine?: Routine;
    initialVariantId?: string;
    onClose: () => void;
}

function createEmptyVariant(name: string = 'Default'): RoutineVariant {
    const now = new Date().toISOString();
    return {
        id: crypto.randomUUID(),
        name,
        estimatedDurationMinutes: 5,
        sortOrder: 0,
        steps: [],
        linkedHabitIds: [],
        isAiGenerated: false,
        createdAt: now,
        updatedAt: now,
    };
}

/**
 * Convert a legacy routine (with root-level steps) into a single-variant array.
 */
function routineToVariants(routine: Routine): RoutineVariant[] {
    if (routine.variants && routine.variants.length > 0) {
        return routine.variants.map(v => ({ ...v, steps: v.steps.map(s => ({ ...s })) }));
    }
    // Synthesize from root steps
    const totalSeconds = (routine.steps || []).reduce(
        (acc, step) => acc + (step.timerSeconds || 60), 0
    );
    const now = new Date().toISOString();
    return [{
        id: crypto.randomUUID(),
        name: 'Default',
        estimatedDurationMinutes: Math.max(1, Math.ceil(totalSeconds / 60)),
        sortOrder: 0,
        steps: (routine.steps || []).map(s => ({ ...s })),
        linkedHabitIds: routine.linkedHabitIds || [],
        isAiGenerated: false,
        createdAt: routine.createdAt || now,
        updatedAt: now,
    }];
}

export const RoutineEditorModal: React.FC<RoutineEditorModalProps> = ({
    isOpen,
    mode,
    initialRoutine,
    initialVariantId,
    onClose,
}) => {
    const { addRoutine, updateRoutine, refreshRoutines } = useRoutineStore();
    const { categories, habits, updateHabit } = useHabitStore();

    // Form State
    const [title, setTitle] = useState('');
    const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
    const [variants, setVariants] = useState<RoutineVariant[]>([createEmptyVariant()]);
    const [activeVariantIndex, setActiveVariantIndex] = useState(0);

    // UI State
    const [validationError, setValidationError] = useState<string | null>(null);
    const [uploadingRoutineImage, setUploadingRoutineImage] = useState(false);
    const [routineImageError, setRoutineImageError] = useState<string | null>(null);
    const [currentRoutineImageUrl, setCurrentRoutineImageUrl] = useState<string | null | undefined>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [isEditingStep, setIsEditingStep] = useState(false);

    const handleRoutineImageUpload = async (file: File) => {
        if (!initialRoutine?.id && mode === 'create') {
            setRoutineImageError('Please save the routine first before uploading an image.');
            return;
        }
        const routineId = initialRoutine?.id;
        if (!routineId) return;

        setUploadingRoutineImage(true);
        setRoutineImageError(null);
        try {
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
            if (!allowedTypes.includes(file.type.toLowerCase())) {
                throw new Error('Invalid image type. Only JPEG, PNG, and WebP images are allowed.');
            }
            if (file.size > 5 * 1024 * 1024) {
                throw new Error('Image file size exceeds 5MB limit.');
            }
            const result = await uploadRoutineImage(routineId, file);
            await updateRoutine(routineId, { imageId: result.imageId });
            setCurrentRoutineImageUrl(result.imageUrl);
            await refreshRoutines();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to upload image.';
            setRoutineImageError(errorMessage);
        } finally {
            setUploadingRoutineImage(false);
        }
    };

    // Initialize state
    useEffect(() => {
        if (!isOpen) return;

        if (mode === 'edit' && initialRoutine) {
            setTitle(initialRoutine.title);
            setCategoryId(initialRoutine.categoryId);
            const converted = routineToVariants(initialRoutine);
            setVariants(converted);
            const targetIndex = initialVariantId
                ? converted.findIndex(v => v.id === initialVariantId)
                : -1;
            setActiveVariantIndex(targetIndex >= 0 ? targetIndex : 0);
            setCurrentRoutineImageUrl(initialRoutine.imageUrl);
        } else {
            setTitle('');
            setCategoryId(undefined);
            setVariants([createEmptyVariant()]);
            setActiveVariantIndex(0);
            setCurrentRoutineImageUrl(null);
        }
        setValidationError(null);
        setAiError(null);
        setIsEditingStep(false);
    }, [isOpen, mode, initialRoutine]);

    // Variant management
    const addVariant = () => {
        if (variants.length >= 10) {
            setValidationError('Cannot exceed 10 variants per routine');
            return;
        }
        const newVariant = createEmptyVariant(`Variant ${variants.length + 1}`);
        newVariant.sortOrder = variants.length;
        setVariants([...variants, newVariant]);
        setActiveVariantIndex(variants.length);
    };

    const copyVariant = () => {
        if (variants.length >= 10) {
            setValidationError('Cannot exceed 10 variants per routine');
            return;
        }
        const source = variants[activeVariantIndex];
        const copy: RoutineVariant = {
            ...source,
            id: crypto.randomUUID(),
            name: `${source.name} (Copy)`,
            sortOrder: variants.length,
            steps: source.steps.map(s => ({ ...s, id: crypto.randomUUID() })),
            isAiGenerated: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setVariants([...variants, copy]);
        setActiveVariantIndex(variants.length);
    };

    const deleteVariant = (index: number) => {
        if (variants.length <= 1) return;
        const newVariants = variants.filter((_, i) => i !== index);
        setVariants(newVariants);
        setActiveVariantIndex(Math.min(activeVariantIndex, newVariants.length - 1));
    };

    const updateVariantAtIndex = (index: number, updated: RoutineVariant) => {
        const newVariants = [...variants];
        newVariants[index] = updated;
        setVariants(newVariants);
    };

    // AI Suggest Variants
    const handleSuggestVariants = async () => {
        if (!hasGeminiApiKey()) {
            setAiError('No Gemini API key configured. Add your key in Settings.');
            return;
        }
        if (!title.trim()) {
            setAiError('Please enter a routine title first.');
            return;
        }

        setAiLoading(true);
        setAiError(null);
        try {
            const activeVariant = variants[activeVariantIndex];
            const result = await suggestVariants({
                routineTitle: title.trim(),
                categoryId,
                existingSteps: (activeVariant?.steps || []).map(s => ({
                    title: s.title,
                    instruction: s.instruction,
                    timerSeconds: s.timerSeconds,
                })),
                geminiApiKey: getGeminiApiKey(),
            });

            if (result.suggestedVariants && result.suggestedVariants.length > 0) {
                const newVariants = result.suggestedVariants.map((sv, idx) => ({
                    ...sv,
                    id: crypto.randomUUID(),
                    sortOrder: variants.length + idx,
                    isAiGenerated: true,
                    steps: (sv.steps || []).map(s => ({
                        ...s,
                        id: s.id || crypto.randomUUID(),
                    })),
                    linkedHabitIds: computeVariantLinkedHabits(sv.steps || []),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                }));

                // Add suggested variants (don't replace existing ones)
                const total = variants.length + newVariants.length;
                if (total > 10) {
                    setAiError(`Can only add ${10 - variants.length} more variants (max 10).`);
                    return;
                }
                setVariants([...variants, ...newVariants]);
                setActiveVariantIndex(variants.length); // Focus on first new variant
            } else {
                setAiError('No suggestions generated. Try adjusting the routine title or steps.');
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Failed to generate suggestions.';
            setAiError(msg);
        } finally {
            setAiLoading(false);
        }
    };

    const validate = (): string | null => {
        if (!title.trim()) return 'Routine title is required';
        for (const variant of variants) {
            if (!variant.name.trim()) return `Variant name is required (variant #${variants.indexOf(variant) + 1})`;
            if (variant.steps.length === 0) return `"${variant.name}": Add at least one step`;
            for (const step of variant.steps) {
                if (!step.title.trim()) return `"${variant.name}": All steps must have a title`;
                if (step.trackingFields && step.trackingFields.length > 0) {
                    for (const field of step.trackingFields) {
                        if (!field.label.trim()) {
                            return `"${variant.name}" → "${step.title}": All tracking fields must have a label`;
                        }
                    }
                }
            }
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const error = validate();
        if (error) {
            setValidationError(error);
            return;
        }

        try {
            // Compute routine-level linkedHabitIds as union of all variants
            const allLinkedHabitIds = new Set<string>();
            for (const v of variants) {
                for (const hId of v.linkedHabitIds || []) {
                    allLinkedHabitIds.add(hId);
                }
            }
            const linkedHabitIds = Array.from(allLinkedHabitIds);

            const routineData: any = {
                title: title.trim(),
                categoryId,
                variants: variants.map((v, i) => ({ ...v, sortOrder: i })),
                linkedHabitIds,
                defaultVariantId: variants[0]?.id,
                steps: [], // Empty — steps now live inside variants
            };

            let savedRoutine: Routine;
            if (mode === 'create') {
                savedRoutine = await addRoutine(routineData);
            } else if (initialRoutine) {
                savedRoutine = await updateRoutine(initialRoutine.id, routineData);
            } else {
                throw new Error('No initial routine for edit mode');
            }

            // Bi-directional sync: Update linked habits
            const previousLinkedHabitIds = initialRoutine?.linkedHabitIds || [];
            const validHabits = habits.filter(h => linkedHabitIds.includes(h.id));

            for (const habit of validHabits) {
                if (!habit.linkedRoutineIds?.includes(savedRoutine.id)) {
                    await updateHabit(habit.id, {
                        linkedRoutineIds: [...(habit.linkedRoutineIds || []), savedRoutine.id]
                    });
                }
            }

            const removedHabitIds = previousLinkedHabitIds.filter(id => !linkedHabitIds.includes(id));
            for (const hId of removedHabitIds) {
                const habit = habits.find(h => h.id === hId);
                if (habit && habit.linkedRoutineIds?.includes(savedRoutine.id)) {
                    await updateHabit(habit.id, {
                        linkedRoutineIds: habit.linkedRoutineIds.filter(rid => rid !== savedRoutine.id)
                    });
                }
            }
            onClose();
        } catch (err) {
            console.error(err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to save routine';
            setValidationError(errorMessage);
        }
    };

    if (!isOpen) return null;

    const activeVariant = variants[activeVariantIndex];

    return (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-4xl max-h-[90dvh] h-[85vh] bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden">

                {/* Header — hidden when editing a step to maximize space */}
                {!isEditingStep && (
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-neutral-900 z-10">
                    <h2 className="text-xl font-bold text-white">
                        {mode === 'create' ? 'Create Routine' : 'Edit Routine'}
                    </h2>
                    <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-400 hover:text-white -mr-2" aria-label="Close">
                        <X size={24} />
                    </button>
                </div>
                )}

                {/* Main Content */}
                <div className="flex-1 flex overflow-hidden min-h-0">
                    <div className="flex-1 overflow-y-auto modal-scroll p-8 space-y-8">

                        {/* Title & Category — hidden when editing a step */}
                        {!isEditingStep && <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => { setTitle(e.target.value); setValidationError(null); }}
                                    className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-3 text-lg text-white focus:outline-none focus:border-emerald-500 placeholder-neutral-600"
                                    placeholder="e.g., Morning Startup"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Category (Optional)</label>
                                <select
                                    value={categoryId || ''}
                                    onChange={e => setCategoryId(e.target.value || undefined)}
                                    className="w-full bg-neutral-800 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-emerald-500"
                                >
                                    <option value="">-- No Category --</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Routine Image Upload (edit mode only) */}
                            {mode === 'edit' && initialRoutine?.id && (
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-2">Routine Image (Optional)</label>
                                    <div className="space-y-2">
                                        {currentRoutineImageUrl && (
                                            <div className="relative w-full aspect-video bg-neutral-800 rounded-lg overflow-hidden border border-white/5">
                                                <img src={currentRoutineImageUrl} alt={title} className="w-full h-full object-cover" />
                                                <button
                                                    onClick={async () => {
                                                        if (confirm('Delete this routine image?')) {
                                                            try {
                                                                await deleteRoutineImage(initialRoutine.id);
                                                                await updateRoutine(initialRoutine.id, { imageId: undefined });
                                                                setCurrentRoutineImageUrl(null);
                                                                await refreshRoutines();
                                                            } catch (error) {
                                                                setRoutineImageError('Failed to delete image.');
                                                            }
                                                        }
                                                    }}
                                                    className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 hover:opacity-100 transition-opacity hover:bg-black/70"
                                                    title="Remove Image"
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <input
                                                id="routine-image-upload"
                                                type="file"
                                                accept="image/jpeg,image/jpg,image/png,image/webp"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) handleRoutineImageUpload(e.target.files[0]);
                                                    e.target.value = '';
                                                }}
                                                disabled={uploadingRoutineImage}
                                            />
                                            <label
                                                htmlFor="routine-image-upload"
                                                className={`flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-white/10 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 transition-colors cursor-pointer ${uploadingRoutineImage ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {uploadingRoutineImage ? (
                                                    <><Loader2 size={16} className="animate-spin" /> Uploading...</>
                                                ) : (
                                                    <><ImageIcon size={16} /> {currentRoutineImageUrl ? 'Replace Image' : 'Upload Image'}</>
                                                )}
                                            </label>
                                            <span className="text-xs text-neutral-500">JPEG, PNG, or WebP (max 5MB)</span>
                                        </div>
                                        {routineImageError && <p className="text-xs text-red-400">{routineImageError}</p>}
                                    </div>
                                </div>
                            )}
                        </div>}

                        {/* Variant Tabs — header/tabs hidden when editing a step */}
                        <div className="space-y-4">
                            {!isEditingStep && <><div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-neutral-400">Variants</label>
                                {hasGeminiApiKey() && (
                                    <button
                                        type="button"
                                        onClick={handleSuggestVariants}
                                        disabled={aiLoading || !title.trim()}
                                        className="flex items-center gap-1.5 text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Suggest variants with AI"
                                    >
                                        {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        Suggest with AI
                                    </button>
                                )}
                            </div>

                            {aiError && (
                                <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{aiError}</p>
                            )}

                            {/* Tab Bar */}
                            <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-white/5">
                                {variants.map((v, i) => (
                                    <button
                                        key={v.id}
                                        onClick={() => setActiveVariantIndex(i)}
                                        className={`px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                                            i === activeVariantIndex
                                                ? 'bg-neutral-800 text-white border-b-2 border-emerald-500'
                                                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
                                        } ${v.isAiGenerated ? 'italic' : ''}`}
                                    >
                                        {v.name || 'Untitled'}
                                        {v.isAiGenerated && <Sparkles size={10} className="inline ml-1 text-purple-400" />}
                                    </button>
                                ))}
                                <div className="flex items-center gap-1 border-l border-white/10 pl-2 ml-1 flex-shrink-0">
                                    <button
                                        type="button"
                                        onClick={copyVariant}
                                        disabled={variants.length >= 10}
                                        className="p-2 text-neutral-500 hover:text-white transition-colors disabled:opacity-40 rounded-lg hover:bg-neutral-800/50"
                                        title="Copy current variant"
                                    >
                                        <Copy size={14} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={addVariant}
                                        disabled={variants.length >= 10}
                                        className="p-2 text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-40 rounded-lg hover:bg-neutral-800/50"
                                        title="Add variant"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                            </>}

                            {/* Active Variant Editor */}
                            {activeVariant && (
                                <VariantEditor
                                    variant={activeVariant}
                                    onChange={(updated) => updateVariantAtIndex(activeVariantIndex, updated)}
                                    onDelete={variants.length > 1 ? () => deleteVariant(activeVariantIndex) : undefined}
                                    habits={habits}
                                    categoryId={categoryId}
                                    onEditingStepChange={setIsEditingStep}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer — hidden when editing a step to maximize space */}
                {!isEditingStep && <div className="px-6 py-3 border-t border-white/10 bg-neutral-900 flex justify-between items-center">
                    <div>
                        {validationError && (
                            <span className="text-red-400 text-sm">{validationError}</span>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-neutral-400 hover:text-white transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="px-6 py-2 bg-emerald-500 text-neutral-900 font-bold rounded-lg hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                        >
                            {mode === 'create' ? 'Create Routine' : 'Save Changes'}
                        </button>
                    </div>
                </div>}
            </div>
        </div>
    );
};
