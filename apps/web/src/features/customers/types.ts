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
