export type QuoteStatus = 'Draft' | 'Sent' | 'Tracking' | 'Approved' | 'Rejected';

export interface QuoteLineItem {
  quoteLineItemId: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  sortOrder: number;
}

export interface QuoteListItem {
  quoteId: number;
  quoteNumber: string;
  customerId: number;
  customerName?: string | null;
  projectId?: number | null;
  projectTitle?: string | null;
  quoteDate: string;
  validUntil?: string | null;
  status: QuoteStatus;
  vatRate: number;
  subtotal: number;
  vatAmount: number;
  total: number;
  isActive: boolean;
}

export interface QuoteDetails extends QuoteListItem {
  notes?: string | null;
  lineItems: QuoteLineItem[];
}

export interface QuoteLineItemRequest {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  sortOrder?: number;
}

export interface SaveQuoteRequest {
  customerId: number;
  projectId?: number | null;
  quoteDate: string;
  validUntil?: string | null;
  status: QuoteStatus;
  notes?: string | null;
  vatRate: number;
  lineItems: QuoteLineItemRequest[];
}

export interface QuoteFilters {
  search?: string;
  customerId?: number;
  projectId?: number;
  status?: QuoteStatus | '';
  fromDate?: string;
  toDate?: string;
  includeInactive?: boolean;
}

export interface QuoteCustomerOption {
  customerId: number;
  customerName: string;
  isActive: boolean;
}

export interface QuoteProjectOption {
  workItemId: number;
  title: string;
  customerName?: string | null;
}
