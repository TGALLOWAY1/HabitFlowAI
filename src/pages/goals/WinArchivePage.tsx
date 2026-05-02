import React, { useMemo, useState } from 'react';
import { Trophy, Star, TrendingUp, Flag, Loader2, AlertCircle } from 'lucide-react';
import { useCompletedGoals } from '../../lib/useCompletedGoals';
import { useGoalsWithProgress } from '../../lib/useGoalsWithProgress';
import { useGoalTracks } from '../../lib/useGoalTracks';
import { buildIterationChains, type IterationChain } from '../../utils/goalIterationChains';
import { AchievementSectionHeader } from '../../components/goals/achievements/AchievementSectionHeader';
import { SingleAchievementCard } from '../../components/goals/achievements/SingleAchievementCard';
import { ProgressiveAchievementCard } from '../../components/goals/achievements/ProgressiveAchievementCard';
import { TrackAchievementRow } from '../../components/goals/achievements/TrackAchievementRow';
import type { Goal } from '../../types';

interface WinArchivePageProps {
    onViewGoal?: (goalId: string) => void;
    onViewTrack?: (trackId: string) => void;
}

const SINGLE_PREVIEW_LIMIT = 8;
const PROGRESSIVE_PREVIEW_LIMIT = 4;

export const WinArchivePage: React.FC<WinArchivePageProps> = ({ onViewGoal, onViewTrack }) => {
    const { data: completedGoals, loading: completedLoading, error: completedError } = useCompletedGoals();
    const { data: tracks, loading: tracksLoading } = useGoalTracks();
    const { data: activeGoalsWithProgress, loading: activeGoalsLoading } = useGoalsWithProgress();

    const [singleExpanded, setSingleExpanded] = useState(false);
    const [progressiveExpanded, setProgressiveExpanded] = useState(false);

    const { singleGoals, progressiveChains, milestoneCards, trackRows } = useMemo(() => {
        const goals = completedGoals ?? [];
        const single = goals
            .filter(g => g.completedAt && !g.trackId && g.type === 'onetime')
            .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

        const progressiveCandidates = goals.filter(g => g.completedAt && !g.trackId && g.type === 'cumulative');
        const progressive = buildIterationChains(progressiveCandidates);

        // Surface in-progress cumulative goals that have crossed at least one
        // milestone. Each appears as a Progressive-style card whose nodes are
        // the milestone values + the final target, with completion flags.
        type MilestoneCard = { chain: IterationChain; completed: boolean[] };
        const milestone: MilestoneCard[] = [];
        for (const gp of activeGoalsWithProgress ?? []) {
            const { goal, progress } = gp;
            if (goal.trackId) continue;
            if (goal.type !== 'cumulative') continue;
            const ms = goal.milestones ?? [];
            if (ms.length === 0) continue;
            const states = progress.milestoneStates ?? [];
            const anyCompleted = states.some(s => s.completed);
            if (!anyCompleted) continue;

            const sorted = ms.slice().sort((a, b) => a.value - b.value);
            const target = goal.targetValue ?? 0;
            const targets = [...sorted.map(m => m.value), target];
            const stateById = new Map(states.map(s => [s.id, s]));
            const completedFlags = [
                ...sorted.map(m => stateById.get(m.id)?.completed === true),
                !!goal.completedAt,
            ];
            milestone.push({
                chain: { head: goal, goals: [goal], targets },
                completed: completedFlags,
            });
        }
        milestone.sort((a, b) => {
            const at = a.chain.head.completedAt ?? a.chain.head.createdAt;
            const bt = b.chain.head.completedAt ?? b.chain.head.createdAt;
            return (bt ?? '').localeCompare(at ?? '');
        });

        // Track rows include both completed and not-yet-completed (active/locked)
        // goals so the user can see the full track progression with greyed-out
        // milestones for goals still ahead. TrackAchievementRow already renders
        // locked goals with a lock icon — we just need to feed them in.
        const trackedGoalsByTrackId = new Map<string, Goal[]>();
        const seenIds = new Set<string>();
        const collect = (g: Goal) => {
            if (!g.trackId || seenIds.has(g.id)) return;
            seenIds.add(g.id);
            const list = trackedGoalsByTrackId.get(g.trackId) ?? [];
            list.push(g);
            trackedGoalsByTrackId.set(g.trackId, list);
        };
        for (const g of goals) collect(g);
        for (const gp of activeGoalsWithProgress ?? []) collect(gp.goal);

        const rows = (tracks ?? [])
            .map(track => {
                const members = trackedGoalsByTrackId.get(track.id) ?? [];
                // Only surface tracks that have at least one earned goal —
                // the Achievements page is for celebrating progress, not
                // listing every empty track.
                if (!members.some(g => g.completedAt)) return null;
                return { track, goals: members };
            })
            .filter((r): r is { track: typeof tracks[number]; goals: Goal[] } => r !== null)
            .sort((a, b) => {
                const at = a.track.completedAt ?? a.track.updatedAt ?? '';
                const bt = b.track.completedAt ?? b.track.updatedAt ?? '';
                return bt.localeCompare(at);
            });

        return { singleGoals: single, progressiveChains: progressive, milestoneCards: milestone, trackRows: rows };
    }, [completedGoals, tracks, activeGoalsWithProgress]);

    const loading = completedLoading || tracksLoading || activeGoalsLoading;
    const hasAnyAchievements = singleGoals.length > 0 || progressiveChains.length > 0 || milestoneCards.length > 0 || trackRows.length > 0;

    if (loading && !completedGoals) {
        return (
            <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="text-emerald-500 animate-spin" size={32} />
                    <div className="text-neutral-400 text-sm sm:text-base">Loading your wins...</div>
                </div>
            </div>
        );
    }

    if (completedError) {
        return (
            <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                <div className="mb-6 sm:mb-8">
                    <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Achievements</h1>
                    <p className="text-neutral-400 text-sm sm:text-base">A gallery of your accomplishments.</p>
                </div>
                <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex items-start gap-3">
                    <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                    <div className="flex-1">
                        <div className="text-red-400 font-medium mb-1">Error</div>
                        <div className="text-red-300 text-sm">{completedError.message}</div>
                    </div>
                </div>
            </div>
        );
    }

    const visibleSingles = singleExpanded ? singleGoals : singleGoals.slice(0, SINGLE_PREVIEW_LIMIT);
    const visibleProgressives = progressiveExpanded ? progressiveChains : progressiveChains.slice(0, PROGRESSIVE_PREVIEW_LIMIT);
    const hasProgressiveContent = progressiveChains.length > 0 || milestoneCards.length > 0;

    return (
        <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <div className="mb-6 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">Achievements</h1>
                <p className="text-sm sm:text-base text-neutral-400">A gallery of your accomplishments.</p>
            </div>

            {!hasAnyAchievements ? (
                <div className="text-center py-16 sm:py-20">
                    <div className="max-w-md mx-auto">
                        <div className="w-16 h-16 mx-auto bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                            <Trophy className="text-amber-400/50" size={32} />
                        </div>
                        <h2 className="text-lg font-semibold text-white mb-2">Your gallery awaits</h2>
                        <p className="text-neutral-400 text-sm mb-1">Every completed goal becomes a badge here.</p>
                        <p className="text-neutral-500 text-xs">Complete your first goal to get started.</p>
                    </div>
                </div>
            ) : (
                <div className="space-y-8 sm:space-y-10">
                    <section>
                        <AchievementSectionHeader
                            icon={Star}
                            title="Single Achievements"
                            description="One-time goals you've completed."
                            iconColor="text-emerald-400"
                            iconBg="bg-emerald-500/10"
                            showViewAll={singleGoals.length > SINGLE_PREVIEW_LIMIT}
                            onViewAll={() => setSingleExpanded(v => !v)}
                            viewAllLabel={singleExpanded ? 'Show less' : 'View all'}
                        />
                        {singleGoals.length === 0 ? (
                            <p className="text-xs sm:text-sm text-neutral-500 italic pl-1">Complete a one-time goal to see it here.</p>
                        ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                                {visibleSingles.map((goal, idx) => (
                                    <SingleAchievementCard
                                        key={goal.id}
                                        goal={goal}
                                        onClick={onViewGoal}
                                        animationDelayMs={idx * 40}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    <section>
                        <AchievementSectionHeader
                            icon={TrendingUp}
                            title="Progressive Achievements"
                            description="Goals with milestones or increasing targets."
                            iconColor="text-purple-400"
                            iconBg="bg-purple-500/10"
                            showViewAll={progressiveChains.length > PROGRESSIVE_PREVIEW_LIMIT}
                            onViewAll={() => setProgressiveExpanded(v => !v)}
                            viewAllLabel={progressiveExpanded ? 'Show less' : 'View all'}
                        />
                        {!hasProgressiveContent ? (
                            <p className="text-xs sm:text-sm text-neutral-500 italic pl-1">Complete a cumulative goal or cross a milestone to see it here.</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                                {visibleProgressives.map((chain, idx) => (
                                    <ProgressiveAchievementCard
                                        key={chain.head.id}
                                        chain={chain}
                                        onClick={onViewGoal}
                                        animationDelayMs={idx * 40}
                                    />
                                ))}
                                {milestoneCards.map(({ chain, completed }, idx) => (
                                    <ProgressiveAchievementCard
                                        key={`milestone-${chain.head.id}`}
                                        chain={chain}
                                        completed={completed}
                                        onClick={onViewGoal}
                                        animationDelayMs={(visibleProgressives.length + idx) * 40}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    <section>
                        <AchievementSectionHeader
                            icon={Flag}
                            title="Track Achievements"
                            description="Milestones earned as part of goal tracks."
                            iconColor="text-cyan-400"
                            iconBg="bg-cyan-500/10"
                        />
                        {trackRows.length === 0 ? (
                            <p className="text-xs sm:text-sm text-neutral-500 italic pl-1">Complete a goal in a track to see it here.</p>
                        ) : (
                            <div>
                                {trackRows.map(({ track, goals }) => (
                                    <TrackAchievementRow
                                        key={track.id}
                                        track={track}
                                        goals={goals}
                                        onViewGoal={onViewGoal}
                                        onViewTrack={onViewTrack}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}

            <style>{`
                @keyframes win-card-enter {
                    from { opacity: 0; transform: translateY(12px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .win-card-animate {
                    animation: win-card-enter 0.35s ease-out;
                }
            `}</style>
        </div>
    );
};
