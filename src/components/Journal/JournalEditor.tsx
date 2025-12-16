import { useState, useEffect } from 'react';
import type { JournalEntry } from '../../models/persistenceTypes';
import { JOURNAL_TEMPLATES, FREE_WRITE_TEMPLATE, JOURNAL_CATEGORIES } from '../../data/journalTemplates';
import { createEntry, updateEntry } from '../../api/journal';
import {
    ChevronDown, ChevronUp, Save, X, Sparkles, ChevronLeft,
    Sunrise, Moon, Heart, Wind, Brain, Microscope, Dumbbell,
    Utensils, Target, Sprout, Users, PenLine, type LucideIcon
} from 'lucide-react';

interface JournalEditorProps {
    existingEntry?: JournalEntry;
    onSave: () => void;
    onCancel?: () => void;
}

// Map template/category IDs to Icons
const ICONS: Record<string, LucideIcon> = {
    'daily-structure': Sunrise,
    'mental-health': Brain,
    'physical-health': Dumbbell,
    'habits': Microscope,
    'personal-growth': Sprout,
    'relationships': Users,
    'morning-primer': Sunrise,
    'daily-retrospective': Moon,
    'deep-gratitude': Heart,
    'thought-detox': Wind,
    'emotion-check-in': Brain,
    'habit-scientist': Microscope,
    'workout-log': Dumbbell,
    'diet-journal': Utensils,
    'woop-session': Target,
    'personal-growth-template': Sprout,
    'relationship-journal': Users,
    'free-write': PenLine
};

/**
 * JournalEditor with Query Parameter Navigation support.
 * Uses 'jView', 'jCat', 'jTmp' query params to persist state.
 */
export function JournalEditor({ existingEntry, onSave, onCancel }: JournalEditorProps) {
    // --- State Initialization ---
    // We read from URL params on mount/render to determine state, but also keep local state for instant UI updates.

    const getParams = () => new URLSearchParams(window.location.search);

    const [step, setStep] = useState<'selection' | 'writing'>(() => {
        if (existingEntry) return 'writing';
        const params = getParams();
        return params.get('jStep') === 'writing' ? 'writing' : 'selection';
    });

    // Selection View
    const [selectionView, setSelectionView] = useState<'categories' | 'templates'>(() => {
        const params = getParams();
        return (params.get('jView') === 'templates' || params.get('jCat')) ? 'templates' : 'categories';
    });

    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(() => {
        return getParams().get('jCat');
    });

    // Editor State
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
        return existingEntry?.templateId || getParams().get('jTmp') || '';
    });

    // Mode, Content, Date are local ephemeral state (lost on refresh unless saved, or we could persist content to localStorage)
    const [mode, setMode] = useState<'standard' | 'deep' | 'free'>(existingEntry?.mode || 'standard');
    const [content, setContent] = useState<Record<string, string>>(existingEntry?.content || {});
    const [date, setDate] = useState<string>(existingEntry?.date || new Date().toISOString().split('T')[0]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    // --- Synchronization ---

    // Listen for PopState to detect Browser Back interactions or URL changes via App.tsx
    useEffect(() => {
        const handlePopState = () => {
            if (existingEntry) return;

            const params = new URLSearchParams(window.location.search);
            const jStep = params.get('jStep');
            const jView = params.get('jView');
            const jCat = params.get('jCat');
            const jTmp = params.get('jTmp');

            if (jStep === 'writing') {
                setStep('writing');
                if (jTmp) setSelectedTemplateId(jTmp);
            } else {
                setStep('selection');
                if (jView === 'templates' || jCat) {
                    setSelectionView('templates');
                    setSelectedCategoryId(jCat);
                } else {
                    setSelectionView('categories');
                    setSelectedCategoryId(null);
                }
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [existingEntry]);

    // --- Helpers to update URL ---
    const updateUrl = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(window.location.search);

        Object.entries(updates).forEach(([key, value]) => {
            if (value === null) {
                params.delete(key);
            } else {
                params.set(key, value);
            }
        });

        const newUrl = `${window.location.pathname}?${params.toString()}`;
        // Push state so we can go "Forward" if we went back, or just add history
        window.history.pushState({}, '', newUrl);
    };

    // --- Handlers ---

    const handleSelectCategory = (categoryId: string) => {
        updateUrl({
            jView: 'templates',
            jCat: categoryId,
            jStep: null,
            jTmp: null
        });

        setSelectedCategoryId(categoryId);
        setSelectionView('templates');
    };

    const handleBackToCategories = () => {
        // EXPLICIT NAVIGATION: Go to Categories View (Clear other params)
        updateUrl({
            jView: null,
            jCat: null,
            jStep: null,
            jTmp: null
            // Keep view=journal
        });

        setSelectionView('categories');
        setSelectedCategoryId(null);
    };

    const handleSelectTemplate = (id: string) => {
        updateUrl({
            jStep: 'writing',
            jTmp: id,
        });

        if (id !== selectedTemplateId) {
            setContent({});
        }

        setSelectedTemplateId(id);
        setStep('writing');
        setMode(id === 'free-write' ? 'free' : 'standard');
    };

    const handleBackToSelection = () => {
        if (Object.keys(content).length > 0) {
            if (!window.confirm('Going back will discard your current draft. Continue?')) {
                return;
            }
        }
        setContent({});

        if (selectedTemplateId === 'free-write' || !selectedCategoryId) {
            // Free write or missing category -> Go to Categories
            handleBackToCategories();
        } else {
            // Go back to Template List for current Category
            updateUrl({
                jStep: null,
                jTmp: null,
                jView: 'templates',
                jCat: selectedCategoryId
            });
            setStep('selection');
            setSelectionView('templates');
        }
    };

    const handleAnswerChange = (promptId: string, value: string) => {
        setContent(prev => ({
            ...prev,
            [promptId]: value
        }));
    };

    const handleSave = async () => {
        if (!selectedTemplateId) return;

        try {
            setIsSubmitting(true);
            const payload = {
                templateId: selectedTemplateId,
                mode,
                persona: currentTemplate?.persona || 'None',
                content,
                date
            };

            if (existingEntry) {
                await updateEntry(existingEntry.id, payload);
            } else {
                await createEntry(payload);
            }
            onSave();
        } catch (error) {
            console.error('Failed to save entry', error);
            alert('Failed to save entry. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDiscard = () => {
        if (Object.keys(content).length > 0) {
            if (!window.confirm('Are you sure you want to discard this entry?')) return;
        }
        if (onCancel) {
            onCancel();
        } else {
            setContent({});

            // Go to Root (Categories)
            updateUrl({
                jStep: null,
                jView: null,
                jCat: null,
                jTmp: null
            });

            setStep('selection');
            setSelectionView('categories');
            setSelectedCategoryId(null);
            setMode('standard');
            setSelectedTemplateId('');
        }
    };


    // --- VIEW LOGIC ---
    const effectiveStep = existingEntry ? 'writing' : step;

    // Derived State
    const currentTemplate = selectedTemplateId === 'free-write'
        ? FREE_WRITE_TEMPLATE
        : JOURNAL_TEMPLATES.find(t => t.id === selectedTemplateId);

    const filteredTemplates = selectedCategoryId
        ? JOURNAL_TEMPLATES.filter(t => t.categoryId === selectedCategoryId)
        : [];

    const selectedCategory = selectedCategoryId
        ? JOURNAL_CATEGORIES.find(c => c.id === selectedCategoryId)
        : null;


    // --- RENDER ---

    if (effectiveStep === 'selection' && selectionView === 'categories') {
        return (
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative max-w-5xl mx-auto h-[80vh] flex flex-col">
                <div className="flex justify-between items-start mb-8">
                    <div>
                        <h2 className="text-3xl font-bold text-white mb-2">Journaling</h2>
                        <p className="text-white/40">Choose a loose category or start free-writing.</p>
                    </div>
                    {onCancel && (
                        <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-lg text-white/50 transition-colors">
                            <X size={24} />
                        </button>
                    )}
                </div>

                <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                    <div className="mb-8">
                        <button
                            onClick={() => handleSelectTemplate('free-write')}
                            className="w-full text-left group flex items-center gap-6 p-6 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/50 rounded-2xl transition-all duration-300"
                        >
                            <div className="p-4 bg-emerald-500/20 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform">
                                <PenLine size={32} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white mb-1">Quick Free Write</h3>
                                <p className="text-emerald-200/60 text-sm">Just a blank page. No structure, no prompts.</p>
                            </div>
                        </button>
                    </div>

                    <h3 className="text-sm font-semibold text-white/30 uppercase tracking-widest mb-4">Categories</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {JOURNAL_CATEGORIES.map(category => {
                            const Icon = ICONS[category.id] || Brain;
                            const count = JOURNAL_TEMPLATES.filter(t => t.categoryId === category.id).length;
                            return (
                                <button
                                    key={category.id}
                                    onClick={() => handleSelectCategory(category.id)}
                                    className="text-left group flex flex-col p-6 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 rounded-2xl transition-all duration-300 relative overflow-hidden h-full"
                                >
                                    <div className="mb-4 text-white/60 p-3 bg-white/5 rounded-xl w-fit group-hover:text-emerald-400 group-hover:bg-emerald-400/10 group-hover:scale-110 transition-all">
                                        <Icon size={28} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">{category.title}</h3>
                                    <p className="text-white/50 text-sm leading-relaxed mb-4 flex-1">{category.description}</p>
                                    <div className="flex items-center gap-2 text-xs font-medium text-white/30 group-hover:text-white/50 transition-colors pt-4 border-t border-white/5">
                                        <span>{count} Templates</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    if (effectiveStep === 'selection' && selectionView === 'templates') {
        return (
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl relative max-w-5xl mx-auto h-[80vh] flex flex-col">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleBackToCategories}
                            className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
                        >
                            <ChevronLeft size={24} />
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                {(() => {
                                    const Icon = selectedCategory ? (ICONS[selectedCategory.id] || Brain) : Brain;
                                    return (
                                        <>
                                            <span className="text-emerald-400/80"><Icon size={24} /></span>
                                            {selectedCategory?.title}
                                        </>
                                    );
                                })()}
                            </h2>
                            <p className="text-white/40 text-sm mt-1">Select a template</p>
                        </div>
                    </div>
                    {onCancel && (
                        <button onClick={onCancel} className="p-2 hover:bg-white/10 rounded-lg text-white/50 transition-colors">
                            <X size={24} />
                        </button>
                    )}
                </div>

                <div className="overflow-y-auto pr-2 custom-scrollbar flex-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredTemplates.map(template => {
                            const Icon = ICONS[template.id] || Brain;
                            return (
                                <button
                                    key={template.id}
                                    onClick={() => handleSelectTemplate(template.id)}
                                    className="text-left group flex flex-col p-6 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-emerald-500/50 rounded-2xl transition-all duration-300 relative overflow-hidden min-h-[180px]"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="text-emerald-400 p-3 bg-emerald-400/10 rounded-xl w-fit group-hover:scale-110 transition-transform">
                                            <Icon size={28} />
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-bold text-white mb-2 text-balance leading-tight">{template.title}</h3>
                                    <p className="text-white/50 text-sm leading-relaxed line-clamp-2">{template.description}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    }

    if (!currentTemplate) return null;

    const prompts = mode === 'deep' && currentTemplate.prompts.deep
        ? [...currentTemplate.prompts.standard, ...currentTemplate.prompts.deep]
        : currentTemplate.prompts.standard;

    const WritingIcon = (selectedTemplateId === 'free-write')
        ? PenLine
        : (ICONS[selectedTemplateId] || ICONS[currentTemplate.categoryId] || Brain);

    return (
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-0 shadow-2xl relative max-w-4xl mx-auto h-[85vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-white/5 bg-zinc-900/95 backdrop-blur z-10">
                <div className="flex items-center gap-4">
                    {!existingEntry && (
                        <button
                            onClick={handleBackToSelection}
                            className="flex items-center gap-1 text-sm text-white/50 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                        >
                            <ChevronLeft size={16} />
                            Back to Templates
                        </button>
                    )}
                    <div className="h-6 w-px bg-white/10 mx-2 hidden md:block"></div>
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <span className="text-emerald-400">
                                <WritingIcon size={20} />
                            </span>
                            {currentTemplate.title}
                        </h2>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="bg-transparent text-white/60 text-sm text-right focus:outline-none focus:text-white hover:text-white transition-colors cursor-pointer"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8 bg-[#0a0a0a]">
                {selectedTemplateId !== 'free-write' && (
                    <div className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-start gap-4">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Sparkles size={18} className="text-emerald-400" />
                        </div>
                        <div>
                            <h4 className="text-sm font-semibold text-emerald-200 uppercase tracking-widest mb-1">Active Persona</h4>
                            <p className="text-white/80 font-medium text-lg">{currentTemplate.persona}</p>
                            <p className="text-white/40 text-sm mt-1">Tone: {currentTemplate.tone}</p>
                        </div>
                    </div>
                )}

                {selectedTemplateId === 'free-write' ? (
                    <div className="relative h-full min-h-[500px]">
                        <textarea
                            className="w-full h-full min-h-[500px] bg-white/[0.02] border border-white/5 rounded-xl p-6 text-white/90 text-lg leading-relaxed focus:bg-white/[0.04] focus:border-white/10 focus:ring-0 focus:outline-none resize-none font-sans placeholder:text-white/20"
                            placeholder="Start writing..."
                            value={content['free-write'] || ''}
                            onChange={(e) => handleAnswerChange('free-write', e.target.value)}
                            autoFocus
                        />
                    </div>
                ) : (
                    <>
                        <div className="space-y-6">
                            {prompts.map((prompt) => (
                                <div key={prompt.id} className="group animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-backwards" style={{ animationDelay: `${prompts.indexOf(prompt) * 100}ms` }}>
                                    <label className="block text-white/90 text-lg font-medium mb-3">
                                        {prompt.text}
                                    </label>
                                    <textarea
                                        className="w-full bg-[#151515] border border-white/10 hover:border-white/20 focus:border-emerald-500/50 rounded-xl p-4 text-white/90 placeholder:text-white/10 focus:outline-none focus:bg-[#1a1a1a] transition-all resize-none min-h-[120px]"
                                        placeholder="Type your thoughts here..."
                                        value={content[prompt.id] || ''}
                                        onChange={(e) => handleAnswerChange(prompt.id, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>
                        {currentTemplate.prompts.deep && (
                            <div className="flex justify-center pt-8 pb-4">
                                <button
                                    onClick={() => setMode(mode === 'standard' ? 'deep' : 'standard')}
                                    className={`group flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all ${mode === 'deep'
                                        ? 'bg-purple-900/30 text-purple-300 border border-purple-500/30 hover:bg-purple-900/50'
                                        : 'bg-white/5 text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20'
                                        }`}
                                >
                                    {mode === 'standard' ? (
                                        <>
                                            <Sparkles size={16} className={mode === 'standard' ? 'group-hover:animate-pulse' : ''} />
                                            Active Deep Mode
                                            <ChevronDown size={16} />
                                        </>
                                    ) : (
                                        <>
                                            <ChevronUp size={16} />
                                            Return to Standard Mode
                                        </>
                                    )}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="px-6 py-4 border-t border-white/5 bg-zinc-900 flex justify-between items-center">
                <button
                    onClick={handleDiscard}
                    className="text-white/40 hover:text-red-400 text-sm font-medium transition-colors px-2 py-1"
                >
                    Discard Draft
                </button>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 disabled:opacity-50 disabled:scale-100"
                    >
                        <Save size={18} />
                        {isSubmitting ? 'Saving...' : 'Save Entry'}
                    </button>
                </div>
            </div>
        </div>
    );
}
