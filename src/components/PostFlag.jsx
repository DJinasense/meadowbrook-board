import React from 'react';
import { Star, TrafficCone } from 'lucide-react';

// The three labels a member can put on a post. `alert_type` in the database
// holds the key. Admin approval is still required before any email goes out.
export const FLAG_ORDER = ['urgent', 'construction', 'attention'];

export const FLAGS = {
  urgent: {
    label: 'Urgent',
    hint: 'Safety or an emergency: everyone should see this right away',
    Icon: Star,
    filled: true,
    color: 'text-red-600 dark:text-red-400',
  },
  construction: {
    label: 'Building work',
    hint: 'Construction, repairs, or a water shutoff',
    Icon: TrafficCone,
    filled: false,
    color: 'text-orange-500 dark:text-orange-400',
  },
  attention: {
    label: 'Heads up',
    hint: 'Good to know, but not an emergency',
    Icon: Star,
    filled: true,
    color: 'text-yellow-500 dark:text-yellow-400',
  },
};

export function FlagIcon({ type, className = '' }) {
  const flag = FLAGS[type];
  if (!flag) return null;
  const { Icon } = flag;
  return (
    <Icon
      className={`w-3.5 h-3.5 shrink-0 ${flag.color} ${flag.filled ? 'fill-current' : ''} ${className}`}
      title={flag.label}
      aria-label={flag.label}
    />
  );
}
