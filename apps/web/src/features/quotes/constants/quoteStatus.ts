import type { QuoteStatus } from '../types';

type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

interface QuoteStatusMeta {
  label: string;
  badgeVariant: BadgeVariant;
}

// Canonical English status keys map to Hebrew labels and badge colors for the UI.
export const QUOTE_STATUS_META: Record<QuoteStatus, QuoteStatusMeta> = {
  Draft: { label: 'טיוטה', badgeVariant: 'neutral' },
  Sent: { label: 'נשלח', badgeVariant: 'primary' },
  Tracking: { label: 'במעקב', badgeVariant: 'warning' },
  Approved: { label: 'אושר', badgeVariant: 'success' },
  Rejected: { label: 'נדחה', badgeVariant: 'danger' },
};

export const QUOTE_STATUS_OPTIONS: QuoteStatus[] = [
  'Draft',
  'Sent',
  'Tracking',
  'Approved',
  'Rejected',
];

export function getQuoteStatusLabel(status: QuoteStatus): string {
  return QUOTE_STATUS_META[status]?.label ?? status;
}

export function getQuoteStatusBadgeVariant(status: QuoteStatus): BadgeVariant {
  return QUOTE_STATUS_META[status]?.badgeVariant ?? 'neutral';
}
