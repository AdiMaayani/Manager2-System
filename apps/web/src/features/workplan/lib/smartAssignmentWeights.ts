import type { SmartAssignmentWeights } from '../types';

export const SMART_ASSIGNMENT_WEIGHT_KEYS = [
  'professionalFit',
  'availability',
  'workload',
  'geography',
  'experience',
] as const satisfies readonly (keyof SmartAssignmentWeights)[];

export type SmartAssignmentWeightKey = (typeof SMART_ASSIGNMENT_WEIGHT_KEYS)[number];
export type SmartAssignmentWeightPresetKey =
  | 'balanced'
  | 'professional'
  | 'availabilityTravel'
  | 'workload'
  | 'manual';

export interface SmartAssignmentWeightPreset {
  key: Exclude<SmartAssignmentWeightPresetKey, 'manual'>;
  label: string;
  description: string;
  weights: SmartAssignmentWeights;
}

export const SMART_ASSIGNMENT_WEIGHT_LABELS: Record<SmartAssignmentWeightKey, string> = {
  professionalFit: 'מקצועיות',
  availability: 'זמינות',
  workload: 'איזון עומס',
  geography: 'זמן נסיעה',
  experience: 'ניסיון',
};

export const SMART_ASSIGNMENT_WEIGHT_PRESETS: readonly SmartAssignmentWeightPreset[] = [
  {
    key: 'balanced',
    label: 'מאוזן',
    description: 'איזון בין כל חמשת הגורמים.',
    weights: { professionalFit: 35, availability: 25, workload: 15, geography: 15, experience: 10 },
  },
  {
    key: 'professional',
    label: 'דגש מקצועיות',
    description: 'משקל גבוה להתאמת המקצועות הנדרשים.',
    weights: { professionalFit: 55, availability: 15, workload: 10, geography: 10, experience: 10 },
  },
  {
    key: 'availabilityTravel',
    label: 'זמינות ונסיעה',
    description: 'דגש על זמינות העובד וזמן הנסיעה.',
    weights: { professionalFit: 25, availability: 35, workload: 10, geography: 20, experience: 10 },
  },
  {
    key: 'workload',
    label: 'איזון עומס',
    description: 'דגש על חלוקה מאוזנת של עומס העבודה.',
    weights: { professionalFit: 25, availability: 20, workload: 30, geography: 15, experience: 10 },
  },
] as const;

export const DEFAULT_SMART_ASSIGNMENT_WEIGHTS: SmartAssignmentWeights = {
  ...SMART_ASSIGNMENT_WEIGHT_PRESETS[0].weights,
};

export function cloneSmartAssignmentWeights(
  weights: SmartAssignmentWeights,
): SmartAssignmentWeights {
  return { ...weights };
}

export function getSmartAssignmentWeightsTotal(weights: SmartAssignmentWeights): number {
  return SMART_ASSIGNMENT_WEIGHT_KEYS.reduce((sum, key) => sum + Number(weights[key]), 0);
}

function hasAtMostTwoDecimalPlaces(value: number): boolean {
  return Math.abs(value - Math.round(value * 100) / 100) < 1e-9;
}

export function getSmartAssignmentWeightsError(
  weights: SmartAssignmentWeights,
): string | null {
  for (const key of SMART_ASSIGNMENT_WEIGHT_KEYS) {
    const value = Number(weights[key]);
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      return `המשקל של ${SMART_ASSIGNMENT_WEIGHT_LABELS[key]} חייב להיות בין 0 ל־100.`;
    }
    if (!hasAtMostTwoDecimalPlaces(value)) {
      return `המשקל של ${SMART_ASSIGNMENT_WEIGHT_LABELS[key]} יכול לכלול עד שתי ספרות אחרי הנקודה.`;
    }
  }

  const total = getSmartAssignmentWeightsTotal(weights);
  if (Math.abs(total - 100) > 0.000001) {
    return `סכום המשקלים חייב להיות 100% (כעת ${total.toFixed(2).replace(/\.00$/, '')}%).`;
  }

  return null;
}

export function getSmartAssignmentPreset(
  key: Exclude<SmartAssignmentWeightPresetKey, 'manual'>,
): SmartAssignmentWeightPreset {
  return SMART_ASSIGNMENT_WEIGHT_PRESETS.find((preset) => preset.key === key)
    ?? SMART_ASSIGNMENT_WEIGHT_PRESETS[0];
}
