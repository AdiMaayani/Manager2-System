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

export const SMART_ASSIGNMENT_PROFILE_KEYS = {
  Default: 'Default',
  Regular: 'Regular',
  Project: 'Project',
  ServiceCall: 'ServiceCall',
} as const;

export type SmartAssignmentProfileKey =
  (typeof SMART_ASSIGNMENT_PROFILE_KEYS)[keyof typeof SMART_ASSIGNMENT_PROFILE_KEYS];

export const MISSING_AVAILABILITY_MODES = {
  NeutralScore: 'NeutralScore',
  Reject: 'Reject',
} as const;

export type MissingAvailabilityMode =
  (typeof MISSING_AVAILABILITY_MODES)[keyof typeof MISSING_AVAILABILITY_MODES];

export interface SmartAssignmentPolicyWeights {
  professionalFit: number;
  availability: number;
  workload: number;
  geography: number;
  experience: number;
}

export interface SmartAssignmentPolicyEditable {
  displayName: string;
  description: string;
  isActive: boolean;
  weights: SmartAssignmentPolicyWeights;
  missingCriticalSkillRejects: boolean;
  exactRequiredRoleMandatory: boolean;
  missingAvailabilityMode: MissingAvailabilityMode;
  missingAvailabilityScore: number;
  missingRouteScore: number;
  missingWorkloadScore: number;
  missingExperienceScore: number;
  noRequirementsProfessionalFitScore: number;
  useContinuityAsTieBreak: boolean;
  enableBatchSimulatedLoadBalancing: boolean;
}

export type SmartAssignmentPolicyProfile = Omit<SmartAssignmentPolicyEditable, 'description'> & {
  description?: string | null;
  profileKey: SmartAssignmentProfileKey;
  version: number;
  isPersisted: boolean;
  updatedAtUtc?: string | null;
  updatedByUserId?: number | null;
  changeReason?: string | null;
};

export interface UpdateSmartAssignmentPolicyRequest extends SmartAssignmentPolicyEditable {
  expectedVersion: number;
  changeReason?: string | null;
}

export interface SmartAssignmentPreviewScores {
  professionalFit: number;
  availability: number;
  workload: number;
  geography: number;
  experience: number;
}

export interface SmartAssignmentPolicyPreviewRequest {
  policy: SmartAssignmentPolicyEditable & { profileKey: SmartAssignmentProfileKey };
  sampleScores: SmartAssignmentPreviewScores;
}

export interface SmartAssignmentPolicyPreviewContribution {
  factorCode?: string | null;
  key?: string | null;
  label?: string | null;
  score: number;
  weightPercent: number;
  weightedContribution: number;
}

export interface SmartAssignmentPolicyPreviewResponse {
  totalScore: number;
  contributions: SmartAssignmentPolicyPreviewContribution[];
}
