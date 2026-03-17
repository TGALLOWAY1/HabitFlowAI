import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  examples?: string[];
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  examples,
  ctaLabel,
  onCtaClick,
  className = '',
  children,
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center ${className}`}>
      <div className="w-14 h-14 bg-neutral-800 rounded-full flex items-center justify-center mb-5">
        <Icon size={28} className="text-neutral-500" />
      </div>

      <h3 className="text-lg font-semibold text-white mb-2 max-w-md">
        {title}
      </h3>

      <p className="text-sm text-neutral-400 mb-4 max-w-sm leading-relaxed">
        {description}
      </p>

      {examples && examples.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 mb-6 max-w-sm">
          {examples.map((example) => (
            <span
              key={example}
              className="px-3 py-1 text-xs text-neutral-400 bg-neutral-800/80 rounded-full border border-white/5"
            >
              {example}
            </span>
          ))}
        </div>
      )}

      {ctaLabel && onCtaClick && (
        <button
          onClick={onCtaClick}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-900 font-medium rounded-lg transition-colors text-sm"
        >
          {ctaLabel}
        </button>
      )}

      {children}
    </div>
  );
};
