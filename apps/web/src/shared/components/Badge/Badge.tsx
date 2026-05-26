import type { ReactNode } from 'react';
import './Badge.css';

interface BadgeProps {
  variant?: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
  children: ReactNode;
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return <span className={`badge badge--${variant}`}>{children}</span>;
}
