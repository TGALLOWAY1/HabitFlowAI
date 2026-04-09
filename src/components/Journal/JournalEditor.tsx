import { useState, useEffect } from 'react';
import type { JournalEntry } from '../../models/persistenceTypes';
import { JOURNAL_TEMPLATES, FREE_WRITE_TEMPLATE, JOURNAL_CATEGORIES } from '../../data/journalTemplates';
import type { JournalTemplate } from '../../data/journalTemplates';
import { createEntry, updateEntry } from '../../api/journal';
import {
    ChevronDown, ChevronUp, ChevronRight, Save, Sparkles, ChevronLeft, Star,
    Sunrise, Moon, Heart, Wind, Brain, Microscope, Dumbbell,
    Utensils, Target, Sprout, Users, PenLine, type LucideIcon
} from 'lucide-react';
import { usePinnedJournalTemplates } from './usePinnedJournalTemplates';

interface JournalEditorProps {
    existingEntry?: JournalEntry;
    onSave: (entry?: JournalEntry) => void;
    onCancel?: () => void;
    initialTemplateId?: string;
    /** When true, renders without the card container, header row, and footer — just the editor content. */
    minimal?: boolean;
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
 * JournalEditor — gallery-style template selection with collapsible categories and pinning.
 * Uses 'jStep', 'jTmp' query params to persist writing-phase state.
 */
export function JournalEditor({ existingEntry, onSave, onCancel, initialTemplateId, minimal }: JournalEditorProps) {
    const getParams = () => new URLSearchParams(window.location.search);

    const [step, setStep] = useState<'selection' | 'writing'>(() => {
        if (existingEntry) return 'writing';
        if (initialTemplateId) return 'writing';
        return getParams().get('jStep') === 'writing' ? 'writing' : 'selection';
    });

    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() => {
        return existingEntry?.templateId || initialTemplateId || getParams().get('jTmp') || '';
    });

    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    const [mode, setMode] = useState<'standard' | 'deep' | 'free'>(existingEntry?.mode || (initialTemplateId === 'free-write' ? 'free' : 'standard'));
    const [content, setContent] = useState<Record<string, string>>(existingEntry?.content || {});
    const [date, setDate] = useState<string>(existingEntry?.date || new Date().toLocaleDateString('en-CA'));
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { pinnedIds, togglePin, isPinned } = usePinnedJournalTemplates();

    // Listen for PopState to detect Browser Back interactions
    useEffect(() => {
        const handlePopState = () => {
            if (existingEntry) return;
            const params = new URLSearchParams(window.location.search);
            const jStep = params.get('jStep');
            const jTmp = params.get('jTmp');

            if (jStep === 'writing') {
                setStep('writing');
                if (jTmp) setSelectedTemplateId(jTmp);
            } else {
                setStep('selection');
            }
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [existingEntry]);

    // --- Helpers to update URL ---
    const updateUrl = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(window.location.search);
        Object.entries(updates).forEach(([key, value]) => {
            if (value === null) params.delete(key);
            else params.set(key, value);
        });
        window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
    };

    // --- Handlers ---

    const toggleCategory = (categoryId: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(categoryId)) next.delete(categoryId);
            else next.add(categoryId);
            return next;
        });
    };

    const handleSelectTemplate = (id: string) => {
        updateUrl({ jStep: 'writing', jTmp: id });
        if (id !== selectedTemplateId) setContent({});
        setSelectedTemplateId(id);
        setStep('writing');
        setMode(id === 'free-write' ? 'free' : 'standard');
    };

    const handleBackToSelection = () => {
        if (Object.keys(content).length > 0) {
            if (!window.confirm('Going back will discard your current draft. Continue?')) return;
        }
        setContent({});
        updateUrl({ jStep: null, jTmp: null });
        setStep('selection');
    };

    const handleAnswerChange = (promptId: string, value: string) => {
        setContent(prev => ({ ...prev, [promptId]: value }));
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

            let savedEntry: JournalEntry;
            if (existingEntry) {
                savedEntry = await updateEntry(existingEntry.id, payload);
            } else {
                savedEntry = await createEntry(payload);
            }
            onSave(savedEntry);
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
            updateUrl({ jStep: null, jTmp: null });
            setStep('selection');
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

    // --- Template Card ---
    const renderTemplateCard = (template: JournalTemplate) => {
        const Icon = ICONS[template.id] || ICONS[template.categoryId] || Brain;
        const pinned = isPinned(template.id);

        return (
            <div key={template.id} className="relative group">
                <button
                    onClick={() => handleSelectTemplate(template.id)}
                    className="w-full text-left p-3.5 bg-white/[0.03] hover:bg-white/[0.07] border border-white/5 hover:border-emerald-500/30 rounded-lg transition-all duration-200"
                >
                    <div className="flex items-start gap-2.5">
                        <div className="p-1.5 bg-emerald-400/10 rounded-lg text-emerald-400 flex-shrink-0 mt-0.5">
                            <Icon size={14} />
                        </div>
                        <div className="min-w-0 pr-5">
                            <h4 className="text-sm font-semibold text-white leading-tight">{template.title}</h4>
                            <p className="text-white/40 text-xs mt-1 line-clamp-1">{template.description}</p>
                        </div>
                    </div>
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); togglePin(template.id); }}
                    className={`absolute top-2.5 right-2.5 p-1 rounded-md hover:bg-white/10 transition-all ${pinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                    aria-label={pinned ? 'Unpin template' : 'Pin template'}
                >
                    <Star size={12} className={pinned ? 'text-amber-400 fill-amber-400' : 'text-white/30'} />
                </button>
            </div>
        );
    };

    // --- RENDER ---

    // Gallery view: collapsible categories with pinned section
    if (effectiveStep === 'selection') {
        const pinnedTemplates = JOURNAL_TEMPLATES.filter(t => pinnedIds.includes(t.id));

        return (
            <div className="space-y-3">
                {/* Pinned section */}
                {pinnedTemplates.length > 0 && (
                    <div className="mb-1">
                        <h3 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Star size={12} className="text-amber-400 fill-amber-400" />
                            Pinned
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
                            {pinnedTemplates.map(template => renderTemplateCard(template))}
                        </div>
                    </div>
                )}

                {/* Category accordion sections */}
                {JOURNAL_CATEGORIES.map(category => {
                    const categoryTemplates = JOURNAL_TEMPLATES.filter(t => t.categoryId === category.id);
                    const isExpanded = expandedCategories.has(category.id);
                    const Icon = ICONS[category.id] || Brain;

                    return (
                        <div key={category.id}>
                            <button
                                onClick={() => toggleCategory(category.id)}
                                className="w-full text-left flex items-center justify-between p-3.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-xl transition-all group"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/5 rounded-lg text-white/50 group-hover:text-emerald-400 group-hover:bg-emerald-400/10 transition-all">
                                        <Icon size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-semibold text-white">{category.title}</h3>
                                        <p className="text-white/40 text-xs">{category.description}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-white/30">
                                    <span className="text-xs">{categoryTemplates.length}</span>
                                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mt-2.5 pl-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {categoryTemplates.map(template => renderTemplateCard(template))}
                                </div>
                            )}
                        </div>
                    );
                })}
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

    // Minimal mode: render just the editor content without container/header/footer chrome
    if (minimal) {
        return (
            <div className="flex flex-col h-[calc(100vh-21rem)]">
                <div className="flex-1 overflow-y-auto modal-scroll">
                    {selectedTemplateId === 'free-write' ? (
                        <div className="relative h-full">
                            <textarea
                                className="w-full h-full min-h-[300px] bg-white/[0.02] border border-white/5 rounded-xl p-4 sm:p-6 text-white/90 text-lg leading-relaxed focus:bg-white/[0.04] focus:border-white/10 focus:ring-0 focus:outline-none resize-none font-sans placeholder:text-white/20"
                                placeholder="Start writing..."
                                value={content['free-write'] || ''}
                                onChange={(e) => handleAnswerChange('free-write', e.target.value)}
                            />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {prompts.map((prompt) => (
                                <div key={prompt.id} className="group">
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
                    )}
                </div>
                <div className="flex justify-between items-center pt-3 pb-3 flex-shrink-0">
                    <button
                        onClick={handleDiscard}
                        className="text-white/40 hover:text-red-400 text-sm font-medium transition-colors px-2 py-1"
                    >
                        Discard Draft
                    </button>
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
        );
    }

    return (
        <div className="bg-zinc-900 border border-white/10 rounded-2xl p-0 shadow-2xl relative max-w-4xl mx-auto h-[calc(100vh-14rem)] flex flex-col overflow-hidden">
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

            <div className="flex-1 overflow-y-auto modal-scroll p-6 md:p-8 space-y-8 bg-[#0a0a0a]">
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
