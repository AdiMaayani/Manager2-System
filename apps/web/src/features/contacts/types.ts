export interface Contact {
  contactId: number;
  fullName: string;
  jobTitle?: string;
  contactCategory: string;
  customerId?: number;
  companyName?: string;
  phone?: string;
  secondaryPhone?: string;
  email?: string;
  preferredChannel?: string;
  city?: string;
  address?: string;
  status?: string;
  notes?: string;
  isActive: boolean;
  updatedAt?: string | null;
}

export interface CreateContactRequest {
  fullName: string;
  jobTitle?: string;
  contactCategory: string;
  customerId?: number;
  companyName?: string;
  phone?: string;
  email?: string;
  preferredChannel?: string;
  city?: string;
  status?: string;
  notes?: string;
  isActive?: boolean;
}
