import React, { useRef, useEffect, useState } from 'react';
import { SkillNode } from './SkillNode';
import { HabitNode } from './HabitNode';
import type { SkillTreeIdentityNode } from '../../server/services/skillTreeService';

interface TreeCanvasProps {
    identity: SkillTreeIdentityNode;
}

export const TreeCanvas: React.FC<TreeCanvasProps> = ({ identity }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<SVGSVGElement>(null);
    const [connectors, setConnectors] = useState<React.ReactNode[]>([]);

    // Refs to store DOM elements for measurement
    const skillRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const habitRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Update connector paths when data or layout changes
    useEffect(() => {
        const updateConnectors = () => {
            if (!containerRef.current || !canvasRef.current) return;

            const containerRect = containerRef.current.getBoundingClientRect();
            const newConnectors: React.ReactNode[] = [];

            identity.skills.forEach(skill => {
                const skillEl = skillRefs.current.get(skill.id);
                if (!skillEl) return;

                const skillRect = skillEl.getBoundingClientRect();

                // Calculate Skill connection point (Bottom Center relative to container)
                const startX = skillRect.left + skillRect.width / 2 - containerRect.left;
                const startY = skillRect.bottom - containerRect.top;

                skill.linkedHabits.forEach(habit => {
                    const habitEl = habitRefs.current.get(habit.id);
                    if (!habitEl) return;

                    const habitRect = habitEl.getBoundingClientRect();

                    // Calculate Habit connection point (Top Center relative to container)
                    const endX = habitRect.left + habitRect.width / 2 - containerRect.left;
                    const endY = habitRect.top - containerRect.top;

                    // Draw Bezier Curve
                    // Control points create a smooth "vertical to horizontal" flow
                    const distY = endY - startY;
                    const controlY1 = startY + distY * 0.5;
                    const controlY2 = endY - distY * 0.5;

                    const pathData = `M ${startX} ${startY} C ${startX} ${controlY1}, ${endX} ${controlY2}, ${endX} ${endY}`;

                    newConnectors.push(
                        <g key={`${skill.id}-${habit.id}`}>
                            {/* Outer Glow / Stroke */}
                            <path
                                d={pathData}
                                stroke="#10b981"
                                strokeWidth="2"
                                fill="none"
                                className="opacity-30"
                            />
                            {/* Inner Core */}
                            <path
                                d={pathData}
                                stroke="#10b981"
                                strokeWidth="1"
                                fill="none"
                                className="opacity-60 filter drop-shadow-[0_0_3px_rgba(16,185,129,0.5)]"
                            />
                        </g>
                    );
                });
            });

            setConnectors(newConnectors);
        };

        // Run initially and on resize
        updateConnectors();
        window.addEventListener('resize', updateConnectors);

        // ResizeObserver for more robust change detection (e.g. font loading)
        const ro = new ResizeObserver(updateConnectors);
        if (containerRef.current) ro.observe(containerRef.current);

        return () => {
            window.removeEventListener('resize', updateConnectors);
            ro.disconnect();
        };
    }, [identity]);

    if (!identity.skills || identity.skills.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-20 text-neutral-500 border border-dashed border-white/10 rounded-xl">
                <p>No skills (goals) found in this category.</p>
                <button className="mt-4 text-emerald-400 hover:text-emerald-300">
                    + Create Goal
                </button>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full relative overflow-x-auto overflow-y-hidden pb-12 custom-scrollbar">
            {/* SVG Overlay Layer */}
            <svg
                ref={canvasRef}
                className="absolute top-0 left-0 w-full h-full pointer-events-none z-0"
                style={{ minWidth: '100%', minHeight: '100%' }}
            >
                {connectors}
            </svg>

            <div className="flex gap-16 px-12 min-w-max pt-8 relative z-10">
                {/* Render Skill Columns */}
                {identity.skills.map(skill => (
                    <div key={skill.id} className="flex flex-col items-center gap-12">
                        {/* 1. Skill Node (Goal) */}
                        <SkillNode
                            ref={(el) => {
                                if (el) skillRefs.current.set(skill.id, el);
                                else skillRefs.current.delete(skill.id);
                            }}
                            skill={skill}
                        />

                        {/* 2. Habit Nodes (Leaves) */}
                        {skill.linkedHabits.length > 0 ? (
                            <div className="flex flex-col gap-4">
                                {skill.linkedHabits.map(habit => (
                                    <HabitNode
                                        key={habit.id}
                                        ref={(el) => {
                                            if (el) habitRefs.current.set(habit.id, el);
                                            else habitRefs.current.delete(habit.id);
                                        }}
                                        habit={habit}
                                    />
                                ))}
                            </div>
                        ) : (
                            // Empty State for habits
                            <div className="flex flex-col items-center justify-center h-32 w-64 border border-dashed border-white/5 rounded-xl text-neutral-600 text-sm">
                                <span>No habits linked</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
