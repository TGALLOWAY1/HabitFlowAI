import React from 'react';

type Props = {
  size?: number;
  className?: string;
};

/**
 * Minimal Gratitude Jar icon (dark-mode friendly).
 * - Thin stroke
 * - Soft corners
 * - Uses currentColor (no fills/gradients)
 */
export const GratitudeJarIcon: React.FC<Props> = ({ size = 20, className }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M8 6.5h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="7"
        y="8"
        width="10"
        height="13"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* subtle inner “spark” */}
      <path
        d="M12 12.2v2.6M10.7 13.5h2.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
};


