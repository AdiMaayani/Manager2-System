export interface CompanySettings {
  companyName: string;
  legalName?: string | null;
  registrationNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  updatedAt: string;
}

export interface UpdateCompanySettingsRequest {
  companyName: string;
  legalName?: string;
  registrationNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
}
