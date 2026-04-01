import React from 'react';
import {
  Trophy,
  Award,
  Medal,
  Crown,
  Star,
  Shield,
  Gem,
  Flame,
  Zap,
  Target,
  Heart,
  Sparkles,
  Rocket,
  Sun,
  Mountain,
  Swords,
  type LucideIcon,
} from 'lucide-react';

/**
 * A curated set of award/achievement icons paired with vibrant color combos.
 * Each completed goal gets a deterministic icon+color based on a hash of its ID,
 * so the badge is always the same for a given goal.
 */
const BADGE_VARIANTS: { icon: LucideIcon; bg: string; fg: string; glow: string }[] = [
  { icon: Trophy,   bg: 'bg-amber-500/20',   fg: 'text-amber-400',   glow: 'shadow-amber-500/20' },
  { icon: Award,    bg: 'bg-emerald-500/20',  fg: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
  { icon: Medal,    bg: 'bg-blue-500/20',     fg: 'text-blue-400',    glow: 'shadow-blue-500/20' },
  { icon: Crown,    bg: 'bg-yellow-500/20',   fg: 'text-yellow-400',  glow: 'shadow-yellow-500/20' },
  { icon: Star,     bg: 'bg-orange-500/20',   fg: 'text-orange-400',  glow: 'shadow-orange-500/20' },
  { icon: Shield,   bg: 'bg-indigo-500/20',   fg: 'text-indigo-400',  glow: 'shadow-indigo-500/20' },
  { icon: Gem,      bg: 'bg-purple-500/20',   fg: 'text-purple-400',  glow: 'shadow-purple-500/20' },
  { icon: Flame,    bg: 'bg-red-500/20',      fg: 'text-red-400',     glow: 'shadow-red-500/20' },
  { icon: Zap,      bg: 'bg-cyan-500/20',     fg: 'text-cyan-400',    glow: 'shadow-cyan-500/20' },
  { icon: Target,   bg: 'bg-teal-500/20',     fg: 'text-teal-400',    glow: 'shadow-teal-500/20' },
  { icon: Heart,    bg: 'bg-pink-500/20',     fg: 'text-pink-400',    glow: 'shadow-pink-500/20' },
  { icon: Sparkles, bg: 'bg-fuchsia-500/20',  fg: 'text-fuchsia-400', glow: 'shadow-fuchsia-500/20' },
  { icon: Rocket,   bg: 'bg-sky-500/20',      fg: 'text-sky-400',     glow: 'shadow-sky-500/20' },
  { icon: Sun,      bg: 'bg-lime-500/20',     fg: 'text-lime-400',    glow: 'shadow-lime-500/20' },
  { icon: Mountain, bg: 'bg-stone-500/20',    fg: 'text-stone-400',   glow: 'shadow-stone-500/20' },
  { icon: Swords,   bg: 'bg-rose-500/20',     fg: 'text-rose-400',    glow: 'shadow-rose-500/20' },
];

/** Simple hash of a string to a stable integer. */
function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface CelebratoryBadgeIconProps {
  goalId: string;
  /** Optional generated badge image URL (base64 data URL or remote URL). */
  badgeImageUrl?: string;
  /** Icon size in pixels (default 40) */
  size?: number;
  className?: string;
}

/**
 * Renders a celebratory badge icon for a completed goal.
 *
 * If `badgeImageUrl` is provided, shows the generated image.
 * Otherwise falls back to a deterministic Lucide icon derived from the goal ID.
 */
export const CelebratoryBadgeIcon: React.FC<CelebratoryBadgeIconProps> = ({
  goalId,
  badgeImageUrl,
  size = 40,
  className = '',
}) => {
  const [imgFailed, setImgFailed] = React.useState(false);
  const variant = BADGE_VARIANTS[hashId(goalId) % BADGE_VARIANTS.length];
  const Icon = variant.icon;

  const showImage = badgeImageUrl && !imgFailed;

  return (
    <div
      className={`w-full h-full flex items-center justify-center rounded-xl ${variant.bg} shadow-lg ${variant.glow} ${className}`}
    >
      {showImage ? (
        <img
          src={badgeImageUrl}
          alt="Goal badge"
          className="rounded-lg object-cover"
          style={{ width: size * 1.6, height: size * 1.6 }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <Icon className={variant.fg} size={size} strokeWidth={1.5} />
      )}
    </div>
  );
};
