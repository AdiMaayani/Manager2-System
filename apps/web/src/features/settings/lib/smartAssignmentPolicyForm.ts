import {
  MISSING_AVAILABILITY_MODES,
  SMART_ASSIGNMENT_PROFILE_KEYS,
  type SmartAssignmentPolicyEditable,
  type SmartAssignmentPolicyPreviewRequest,
  type SmartAssignmentPolicyProfile,
  type SmartAssignmentPreviewScores,
  type SmartAssignmentProfileKey,
  type UpdateSmartAssignmentPolicyRequest,
} from '../types';

export const DEFAULT_SMART_ASSIGNMENT_WEIGHTS = Object.freeze({
  professionalFit: 35,
  availability: 25,
  workload: 15,
  geography: 15,
  experience: 10,
});

export const DEFAULT_SMART_ASSIGNMENT_PREVIEW_SCORES: SmartAssignmentPreviewScores = Object.freeze({
  professionalFit: 85,
  availability: 75,
  workload: 65,
  geography: 70,
  experience: 60,
});

const PROFILE_LABELS: Record<SmartAssignmentProfileKey, string> = {
  [SMART_ASSIGNMENT_PROFILE_KEYS.Default]: 'ברירת מחדל',
  [SMART_ASSIGNMENT_PROFILE_KEYS.Regular]: 'משימה כללית',
  [SMART_ASSIGNMENT_PROFILE_KEYS.Project]: 'משימת פרויקט',
  [SMART_ASSIGNMENT_PROFILE_KEYS.ServiceCall]: 'קריאת שירות',
};

const PROFILE_DESCRIPTIONS: Record<SmartAssignmentProfileKey, string> = {
  [SMART_ASSIGNMENT_PROFILE_KEYS.Default]: 'מדיניות הבסיס כאשר אין פרופיל פעיל ומוגדר לסוג המשימה.',
  [SMART_ASSIGNMENT_PROFILE_KEYS.Regular]: 'מדיניות למשימות כלליות שאינן משויכות לפרויקט או לקריאת שירות.',
  [SMART_ASSIGNMENT_PROFILE_KEYS.Project]: 'מדיניות למשימות המשויכות לפרויקט.',
  [SMART_ASSIGNMENT_PROFILE_KEYS.ServiceCall]: 'מדיניות לקריאות שירות.',
};

const SCORE_KEYS = [
  'missingAvailabilityScore',
  'missingRouteScore',
  'missingWorkloadScore',
  'missingExperienceScore',
  'noRequirementsProfessionalFitScore',
] as const;

export interface SmartAssignmentPolicyValidation {
  isValid: boolean;
  weightTotal: number;
  errors: string[];
}

export interface SmartAssignmentPolicyControlAccess {
  canEdit: boolean;
  canPreview: boolean;
  canSave: boolean;
  canReset: boolean;
}

export function getSmartAssignmentPolicyControlAccess(
  canManageSettings: boolean,
): SmartAssignmentPolicyControlAccess {
  return {
    canEdit: canManageSettings,
    canPreview: canManageSettings,
    canSave: canManageSettings,
    canReset: canManageSettings,
  };
}

export function getSmartAssignmentProfileLabel(profileKey: SmartAssignmentProfileKey): string {
  return PROFILE_LABELS[profileKey];
}

export function createDefaultSmartAssignmentPolicy(
  profileKey: SmartAssignmentProfileKey,
): SmartAssignmentPolicyEditable {
  return {
    displayName: PROFILE_LABELS[profileKey],
    description: PROFILE_DESCRIPTIONS[profileKey],
    isActive: true,
    weights: { ...DEFAULT_SMART_ASSIGNMENT_WEIGHTS },
    missingCriticalSkillRejects: true,
    exactRequiredRoleMandatory: false,
    missingAvailabilityMode: MISSING_AVAILABILITY_MODES.NeutralScore,
    missingAvailabilityScore: 50,
    missingRouteScore: 50,
    missingWorkloadScore: 50,
    missingExperienceScore: 40,
    noRequirementsProfessionalFitScore: 50,
    useContinuityAsTieBreak: true,
    enableBatchSimulatedLoadBalancing: true,
  };
}

export function editablePolicyFromProfile(
  profile: SmartAssignmentPolicyProfile,
): SmartAssignmentPolicyEditable {
  return {
    displayName: profile.displayName,
    description: profile.description ?? '',
    isActive: profile.isActive,
    weights: { ...profile.weights },
    missingCriticalSkillRejects: profile.missingCriticalSkillRejects,
    exactRequiredRoleMandatory: profile.exactRequiredRoleMandatory,
    missingAvailabilityMode: profile.missingAvailabilityMode,
    missingAvailabilityScore: profile.missingAvailabilityScore,
    missingRouteScore: profile.missingRouteScore,
    missingWorkloadScore: profile.missingWorkloadScore,
    missingExperienceScore: profile.missingExperienceScore,
    noRequirementsProfessionalFitScore: profile.noRequirementsProfessionalFitScore,
    useContinuityAsTieBreak: profile.useContinuityAsTieBreak,
    enableBatchSimulatedLoadBalancing: profile.enableBatchSimulatedLoadBalancing,
  };
}

export function calculateSmartAssignmentWeightTotal(policy: SmartAssignmentPolicyEditable): number {
  return Object.values(policy.weights).reduce((total, weight) => total + weight, 0);
}

function isScore(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function hasAtMostTwoDecimalPlaces(value: number): boolean {
  return Number.isFinite(value)
    && Math.abs(value * 100 - Math.round(value * 100)) <= 0.0000001;
}

export function validateSmartAssignmentPolicy(
  policy: SmartAssignmentPolicyEditable,
): SmartAssignmentPolicyValidation {
  const errors: string[] = [];
  const weights = Object.values(policy.weights);
  const weightTotal = calculateSmartAssignmentWeightTotal(policy);

  if (!policy.displayName.trim()) errors.push('יש להזין שם פרופיל.');
  if (weights.some((weight) => !isScore(weight))) {
    errors.push('כל משקל חייב להיות מספר בין 0 ל־100.');
  }
  if (weights.some((weight) => isScore(weight) && !hasAtMostTwoDecimalPlaces(weight))) {
    errors.push('כל משקל יכול לכלול עד שתי ספרות אחרי הנקודה.');
  }
  if (!Number.isFinite(weightTotal) || Math.abs(weightTotal - 100) > 0.0001) {
    errors.push('סכום המשקלים חייב להיות 100%.');
  }
  if (!Object.values(MISSING_AVAILABILITY_MODES).includes(policy.missingAvailabilityMode)) {
    errors.push('אופן הטיפול במידע זמינות חסר אינו תקין.');
  }
  if (SCORE_KEYS.some((key) => !isScore(policy[key]))) {
    errors.push('כל ציון ברירת מחדל חייב להיות מספר בין 0 ל־100.');
  }
  if (SCORE_KEYS.some((key) => isScore(policy[key]) && !hasAtMostTwoDecimalPlaces(policy[key]))) {
    errors.push('כל ציון ברירת מחדל יכול לכלול עד שתי ספרות אחרי הנקודה.');
  }

  return { isValid: errors.length === 0, weightTotal, errors };
}

function policyComparable(policy: SmartAssignmentPolicyEditable) {
  return {
    displayName: policy.displayName,
    description: policy.description,
    isActive: policy.isActive,
    weights: {
      professionalFit: policy.weights.professionalFit,
      availability: policy.weights.availability,
      workload: policy.weights.workload,
      geography: policy.weights.geography,
      experience: policy.weights.experience,
    },
    missingCriticalSkillRejects: policy.missingCriticalSkillRejects,
    exactRequiredRoleMandatory: policy.exactRequiredRoleMandatory,
    missingAvailabilityMode: policy.missingAvailabilityMode,
    missingAvailabilityScore: policy.missingAvailabilityScore,
    missingRouteScore: policy.missingRouteScore,
    missingWorkloadScore: policy.missingWorkloadScore,
    missingExperienceScore: policy.missingExperienceScore,
    noRequirementsProfessionalFitScore: policy.noRequirementsProfessionalFitScore,
    useContinuityAsTieBreak: policy.useContinuityAsTieBreak,
    enableBatchSimulatedLoadBalancing: policy.enableBatchSimulatedLoadBalancing,
  };
}

export function getSmartAssignmentPolicySignature(policy: SmartAssignmentPolicyEditable): string {
  return JSON.stringify(policyComparable(policy));
}

export function isSmartAssignmentPolicyDirty(
  policy: SmartAssignmentPolicyEditable,
  baseline: SmartAssignmentPolicyEditable,
): boolean {
  return getSmartAssignmentPolicySignature(policy) !== getSmartAssignmentPolicySignature(baseline);
}

function sanitizedPolicy(policy: SmartAssignmentPolicyEditable): SmartAssignmentPolicyEditable {
  return {
    ...policyComparable(policy),
    displayName: policy.displayName.trim(),
    description: policy.description.trim(),
  };
}

export function buildSmartAssignmentUpdateRequest(
  policy: SmartAssignmentPolicyEditable,
  expectedVersion: number,
  changeReason: string,
): UpdateSmartAssignmentPolicyRequest {
  const trimmedReason = changeReason.trim();
  return {
    ...sanitizedPolicy(policy),
    expectedVersion,
    changeReason: trimmedReason || null,
  };
}

export function buildSmartAssignmentPreviewRequest(
  profileKey: SmartAssignmentProfileKey,
  policy: SmartAssignmentPolicyEditable,
  sampleScores: SmartAssignmentPreviewScores,
): SmartAssignmentPolicyPreviewRequest {
  return {
    policy: { profileKey, ...sanitizedPolicy(policy) },
    sampleScores: { ...sampleScores },
  };
}

export function getSmartAssignmentPreviewSignature(
  profileKey: SmartAssignmentProfileKey,
  policy: SmartAssignmentPolicyEditable,
  sampleScores: SmartAssignmentPreviewScores,
): string {
  return JSON.stringify(buildSmartAssignmentPreviewRequest(profileKey, policy, sampleScores));
}

export function validateSmartAssignmentPreviewScores(
  sampleScores: SmartAssignmentPreviewScores,
): string | null {
  return Object.values(sampleScores).every(isScore)
    ? null
    : 'כל ציוני הדוגמה חייבים להיות מספרים בין 0 ל־100.';
}
