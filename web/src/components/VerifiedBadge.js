import React from 'react';
import { motion } from 'framer-motion';

export default function VerifiedBadge({ tier = 'personal', size = 14, className = '', showTooltip = true }) {
  const colors = {
    personal: { bg: '#1D9BF0', border: '#1a8fd1' },
    business: { bg: '#F59E0B', border: '#D97706' },
  };
  const c = colors[tier] || colors.personal;

  return (
    <motion.span
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      title={showTooltip ? (tier === 'business' ? 'Verified Business' : 'Verified Account') : undefined}
    >
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        <path
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          fill={c.bg}
          stroke={c.border}
          strokeWidth="0.5"
        />
        <path
          d="M9 12l2 2 4-4"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.span>
  );
}

export function VerifiedBadgeInline({ user, size = 14, className = '' }) {
  if (!user?.badge_verified) return null;
  return (
    <VerifiedBadge
      tier={user.verification_tier || 'personal'}
      size={size}
      className={className}
    />
  );
}
