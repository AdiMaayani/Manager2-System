import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SMART_ASSIGNMENT_WEIGHTS,
  SMART_ASSIGNMENT_WEIGHT_PRESETS,
  getSmartAssignmentWeightsError,
  getSmartAssignmentWeightsTotal,
} from './smartAssignmentWeights';

describe('smart assignment weights', () => {
  it('defines the approved presets with an exact total of 100 percent', () => {
    expect(SMART_ASSIGNMENT_WEIGHT_PRESETS.map((preset) => ({
      key: preset.key,
      weights: preset.weights,
      total: getSmartAssignmentWeightsTotal(preset.weights),
    }))).toEqual([
      { key: 'balanced', weights: { professionalFit: 35, availability: 25, workload: 15, geography: 15, experience: 10 }, total: 100 },
      { key: 'professional', weights: { professionalFit: 55, availability: 15, workload: 10, geography: 10, experience: 10 }, total: 100 },
      { key: 'availabilityTravel', weights: { professionalFit: 25, availability: 35, workload: 10, geography: 20, experience: 10 }, total: 100 },
      { key: 'workload', weights: { professionalFit: 25, availability: 20, workload: 30, geography: 15, experience: 10 }, total: 100 },
    ]);
    expect(DEFAULT_SMART_ASSIGNMENT_WEIGHTS).toEqual(SMART_ASSIGNMENT_WEIGHT_PRESETS[0].weights);
  });

  it('accepts manual decimal weights when every value is valid and the total is 100', () => {
    expect(getSmartAssignmentWeightsError({
      professionalFit: 33.33,
      availability: 26.67,
      workload: 15,
      geography: 15,
      experience: 10,
    })).toBeNull();
  });

  it('rejects out-of-range, over-precise and non-100 manual weights', () => {
    expect(getSmartAssignmentWeightsError({ ...DEFAULT_SMART_ASSIGNMENT_WEIGHTS, geography: -1 }))
      .toContain('בין 0 ל־100');
    expect(getSmartAssignmentWeightsError({ ...DEFAULT_SMART_ASSIGNMENT_WEIGHTS, geography: 15.123 }))
      .toContain('עד שתי ספרות');
    expect(getSmartAssignmentWeightsError({ ...DEFAULT_SMART_ASSIGNMENT_WEIGHTS, geography: 14 }))
      .toContain('סכום המשקלים חייב להיות 100%');
  });
});
