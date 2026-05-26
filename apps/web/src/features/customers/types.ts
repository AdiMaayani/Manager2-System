export interface Customer {
  customerId: number;
  customerName: string;
  customerType: string;
  primaryPhone?: string;
  primaryEmail?: string;
  city?: string;
  region?: string;
  status?: string;
  isActive: boolean;
}
