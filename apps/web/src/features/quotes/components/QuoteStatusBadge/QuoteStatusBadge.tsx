import { Badge } from '@shared/components/Badge';
import { getQuoteStatusBadgeVariant, getQuoteStatusLabel } from '../../constants/quoteStatus';
import type { QuoteStatus } from '../../types';

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
}

export function QuoteStatusBadge({ status }: QuoteStatusBadgeProps) {
  return <Badge variant={getQuoteStatusBadgeVariant(status)}>{getQuoteStatusLabel(status)}</Badge>;
}
