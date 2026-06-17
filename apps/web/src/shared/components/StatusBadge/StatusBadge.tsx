import { Badge } from '../Badge';
import { resolveStatus, type StatusDomain } from '@shared/status';

interface StatusBadgeProps {
  domain: StatusDomain;
  status?: string | null;
  /** Override the resolved label (keeps the resolved colour). */
  label?: string;
}

/**
 * Status pill backed by the central status registry so the same semantic state
 * always renders with the same colour and label across every screen.
 */
export function StatusBadge({ domain, status, label }: StatusBadgeProps) {
  const meta = resolveStatus(domain, status);
  return <Badge variant={meta.variant}>{label ?? meta.label}</Badge>;
}
