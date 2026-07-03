/**
 * Demo-mode sample data for the AI Routine Builder ("Suggest with AI").
 *
 * The public demo is read-only and BYOK (see docs/DEMO_ARCHITECTURE.md), so it
 * can't call Gemini. To let visitors see exactly what "Suggest with AI"
 * produces, demo mode injects these pre-authored sample variants instead of
 * hitting the /ai/suggest-variants endpoint (which the read-only guard would
 * reject anyway). The output flows through the identical downstream code path
 * in RoutineEditorModal.handleSuggestVariants, so the drafts appear as the same
 * editable, sparkle-tabbed variants the real model returns.
 *
 * To change what the demo drafts look like, edit the entries below. Keys are
 * lower-cased routine titles; any title without a specific entry falls back to
 * `genericDrafts`.
 */

import type { RoutineVariant } from '../models/persistenceTypes';

/**
 * Author-facing shape: only the fields that matter for a draft. The editor
 * reassigns id, sortOrder, isAiGenerated, step ids, linkedHabitIds, and
 * timestamps downstream, so those are filled in by `toVariants` below.
 */
interface DemoSuggestedStep {
  title: string;
  instruction?: string;
  timerSeconds?: number;
}

interface DemoSuggestedVariant {
  name: string;
  description?: string;
  estimatedDurationMinutes: number;
  steps: DemoSuggestedStep[];
}

/**
 * Sample drafts keyed by lower-cased routine title. "Morning Kickstart" is the
 * routine the product tour features, so it gets a tailored Quick/Standard/Deep
 * set — including the Deep variant the seeded routine doesn't ship with, which
 * is exactly the kind of addition the AI makes.
 */
const DEMO_SUGGESTIONS: Record<string, DemoSuggestedVariant[]> = {
  'morning kickstart': [
    {
      name: 'Quick',
      description: 'Bare minimum for a rough morning — momentum over completeness.',
      estimatedDurationMinutes: 5,
      steps: [
        { title: 'Glass of water', instruction: 'Rehydrate before coffee.' },
        { title: 'Three deep breaths', instruction: 'In for four, out for six.', timerSeconds: 60 },
        { title: "Name today's one priority", instruction: 'Say it out loud, then start it.' },
      ],
    },
    {
      name: 'Standard',
      description: 'A balanced start when you have a normal amount of time.',
      estimatedDurationMinutes: 20,
      steps: [
        { title: 'Glass of water', instruction: 'Rehydrate before coffee.' },
        { title: '10-minute walk', instruction: 'Outside if possible — daylight resets your clock.', timerSeconds: 600 },
        { title: '5-minute journal', instruction: 'Three lines: focus, worry, one thing you are grateful for.', timerSeconds: 300 },
        { title: 'Plan the first deep-work block', instruction: 'Define what "done" looks like today.' },
      ],
    },
    {
      name: 'Deep',
      description: 'A full runway for a protected morning — body, mind, and plan.',
      estimatedDurationMinutes: 40,
      steps: [
        { title: 'Glass of water', instruction: 'Rehydrate before coffee.' },
        { title: '15-minute walk', instruction: 'No podcast — let your mind wander.', timerSeconds: 900 },
        { title: 'Meditate', instruction: 'Follow the breath; return gently when it drifts.', timerSeconds: 900 },
        { title: 'Mobility flow', instruction: 'Hips, shoulders, spine.', timerSeconds: 300 },
        { title: 'Journal + plan', instruction: "Review yesterday, set today's three priorities.", timerSeconds: 300 },
      ],
    },
  ],
};

/**
 * Fallback for any routine without a tailored entry: three time-scaled drafts
 * that reference the routine by name so the shape still reads as a real result.
 */
function genericDrafts(routineTitle: string): DemoSuggestedVariant[] {
  const title = routineTitle.trim() || 'this routine';
  return [
    {
      name: 'Quick',
      description: `The shortest version of ${title} for low-energy days.`,
      estimatedDurationMinutes: 5,
      steps: [
        { title: 'Set up', instruction: `Get ready to start ${title}.` },
        { title: 'Core step', instruction: 'The one thing that matters most.', timerSeconds: 180 },
      ],
    },
    {
      name: 'Standard',
      description: `A balanced version of ${title}.`,
      estimatedDurationMinutes: 15,
      steps: [
        { title: 'Set up', instruction: `Get ready to start ${title}.` },
        { title: 'Core step', instruction: 'The one thing that matters most.', timerSeconds: 300 },
        { title: 'Follow-through', instruction: 'Round it out and reset for next time.', timerSeconds: 300 },
      ],
    },
    {
      name: 'Deep',
      description: `The full version of ${title} when you have time to spare.`,
      estimatedDurationMinutes: 30,
      steps: [
        { title: 'Set up', instruction: `Get ready to start ${title}.` },
        { title: 'Warm up', instruction: 'Ease in.', timerSeconds: 300 },
        { title: 'Core step', instruction: 'The one thing that matters most.', timerSeconds: 600 },
        { title: 'Follow-through', instruction: 'Round it out and reset for next time.', timerSeconds: 300 },
        { title: 'Reflect', instruction: 'Note what worked so tomorrow is easier.' },
      ],
    },
  ];
}

/**
 * Return demo AI-suggested variants for a routine title, mirroring the shape of
 * the real `suggestVariants` response. Includes a short simulated delay so the
 * editor's loading spinner reads like a genuine model call.
 */
export async function getDemoSuggestedVariants(
  routineTitle: string,
): Promise<{ suggestedVariants: RoutineVariant[] }> {
  // Brief simulated latency so the "generating" spinner is visible.
  await new Promise((resolve) => setTimeout(resolve, 900));

  const drafts =
    DEMO_SUGGESTIONS[routineTitle.trim().toLowerCase()] ?? genericDrafts(routineTitle);
  const now = new Date().toISOString();

  const suggestedVariants: RoutineVariant[] = drafts.map((draft, index) => ({
    id: crypto.randomUUID(),
    name: draft.name,
    description: draft.description,
    estimatedDurationMinutes: draft.estimatedDurationMinutes,
    sortOrder: index,
    steps: draft.steps.map((step) => ({ id: crypto.randomUUID(), ...step })),
    linkedHabitIds: [],
    isAiGenerated: true,
    createdAt: now,
    updatedAt: now,
  }));

  return { suggestedVariants };
}
