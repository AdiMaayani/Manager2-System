// Customer Systems Vault — client types mirroring the API DTOs.

export interface CustomerSystem {
  customerSystemId: number;
  customerId: number;
  siteId?: number | null;
  siteName?: string | null;
  systemType: string;
  systemName: string;
  vendor?: string | null;
  model?: string | null;
  host?: string | null;
  port?: number | null;
  url?: string | null;
  locationDescription?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
}

export interface SaveCustomerSystemRequest {
  customerId?: number;
  siteId?: number | null;
  systemType: string;
  systemName: string;
  vendor?: string | null;
  model?: string | null;
  host?: string | null;
  port?: number | null;
  url?: string | null;
  locationDescription?: string | null;
  notes?: string | null;
  isActive: boolean;
}

// Secret metadata only — the encrypted value and plaintext are never present here.
export interface CustomerSystemSecretMetadata {
  secretId: number;
  customerSystemId: number;
  secretType: string;
  username?: string | null;
  maskedPreview?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc?: string | null;
}

export interface CreateSecretRequest {
  secretType: string;
  username?: string | null;
  secretValue: string;
  notes?: string | null;
  isActive: boolean;
}

export interface UpdateSecretRequest {
  secretType: string;
  username?: string | null;
  // Omitted/empty keeps the existing stored secret (metadata-only edit).
  secretValue?: string | null;
  notes?: string | null;
  isActive: boolean;
}

// Returned only by the explicit reveal endpoint.
export interface RevealedSecret {
  secretId: number;
  customerSystemId: number;
  secretType: string;
  username?: string | null;
  secretValue: string;
  revealedAtUtc: string;
}
