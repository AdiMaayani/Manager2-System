export interface Customer {
  customerId: number;
  customerName: string;
  customerType: string;
  primaryPhone?: string;
  primaryEmail?: string;
  city?: string;
  region?: string;
  address?: string;
  status?: string;
  notes?: string;
  isActive: boolean;
}

export interface CreateCustomerRequest {
  customerName: string;
  customerType: string;
  primaryPhone?: string;
  primaryEmail?: string;
  city?: string;
  region?: string;
  address?: string;
  status?: string;
  notes?: string;
  isActive: boolean;
}

export interface CustomerSite {
  siteId: number;
  customerId: number;
  siteName: string;
  addressLine?: string | null;
  city?: string | null;
  isPrimary: boolean;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
}
