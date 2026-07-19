import { describe, expect, it } from 'vitest';
import {
  buildSmartAssignmentPreviewRequest,
  buildSmartAssignmentUpdateRequest,
  calculateSmartAssignmentWeightTotal,
  createDefaultSmartAssignmentPolicy,
  editablePolicyFromProfile,
  getSmartAssignmentProfileLabel,
  getSmartAssignmentPolicyControlAccess,
  isSmartAssignmentPolicyDirty,
  validateSmartAssignmentPolicy,
} from './smartAssignmentPolicyForm';
import { SMART_ASSIGNMENT_PROFILE_KEYS } from '../types';

describe('smartAssignmentPolicyForm', () => {
  it('uses the approved application defaults and a 100 percent total', () => {
    const policy = createDefaultSmartAssignmentPolicy(SMART_ASSIGNMENT_PROFILE_KEYS.Default);

    expect(policy.weights).toEqual({
      professionalFit: 35,
      availability: 25,
      workload: 15,
      geography: 15,
      experience: 10,
    });
    expect(calculateSmartAssignmentWeightTotal(policy)).toBe(100);
    expect(validateSmartAssignmentPolicy(policy).isValid).toBe(true);
  });

  it('rejects invalid totals, negative scores and non-finite values', () => {
    const policy = createDefaultSmartAssignmentPolicy(SMART_ASSIGNMENT_PROFILE_KEYS.Default);
    policy.weights.experience = Number.NaN;
    policy.missingRouteScore = -1;

    const validation = validateSmartAssignmentPolicy(policy);
    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('כל משקל חייב להיות מספר בין 0 ל־100.');
    expect(validation.errors).toContain('כל ציון ברירת מחדל חייב להיות מספר בין 0 ל־100.');
  });

  it('rejects persisted policy values with more than two decimal places', () => {
    const policy = createDefaultSmartAssignmentPolicy(SMART_ASSIGNMENT_PROFILE_KEYS.Default);
    policy.weights.professionalFit = 35.001;
    policy.weights.availability = 24.999;
    policy.missingRouteScore = 50.001;

    const validation = validateSmartAssignmentPolicy(policy);

    expect(validation.isValid).toBe(false);
    expect(validation.errors).toContain('כל משקל יכול לכלול עד שתי ספרות אחרי הנקודה.');
    expect(validation.errors).toContain('כל ציון ברירת מחדל יכול לכלול עד שתי ספרות אחרי הנקודה.');
  });

  it('detects unsaved changes without treating an identical copy as dirty', () => {
    const baseline = createDefaultSmartAssignmentPolicy(SMART_ASSIGNMENT_PROFILE_KEYS.Project);
    expect(isSmartAssignmentPolicyDirty({ ...baseline, weights: { ...baseline.weights } }, baseline)).toBe(false);

    const changed = { ...baseline, weights: { ...baseline.weights, geography: 20 } };
    expect(isSmartAssignmentPolicyDirty(changed, baseline)).toBe(true);
  });

  it('maps a nullable API description to a safe editable string after reset', () => {
    const defaults = createDefaultSmartAssignmentPolicy(SMART_ASSIGNMENT_PROFILE_KEYS.Regular);
    const editable = editablePolicyFromProfile({
      ...defaults,
      description: null,
      profileKey: SMART_ASSIGNMENT_PROFILE_KEYS.Regular,
      version: 2,
      isPersisted: true,
    });

    expect(editable.description).toBe('');
  });

  it('gates every policy-management control behind manageSettings permission', () => {
    expect(getSmartAssignmentPolicyControlAccess(false)).toEqual({
      canEdit: false,
      canPreview: false,
      canSave: false,
      canReset: false,
    });
    expect(getSmartAssignmentPolicyControlAccess(true)).toEqual({
      canEdit: true,
      canPreview: true,
      canSave: true,
      canReset: true,
    });
  });

  it('maps profile labels, update payloads and unsaved preview payloads', () => {
    const policy = createDefaultSmartAssignmentPolicy(SMART_ASSIGNMENT_PROFILE_KEYS.ServiceCall);
    policy.displayName = '  שירות  ';

    expect(getSmartAssignmentProfileLabel(SMART_ASSIGNMENT_PROFILE_KEYS.ServiceCall)).toBe('קריאת שירות');
    expect(buildSmartAssignmentUpdateRequest(policy, 4, '  שינוי עומסים  ')).toMatchObject({
      displayName: 'שירות',
      expectedVersion: 4,
      changeReason: 'שינוי עומסים',
    });
    expect(
      buildSmartAssignmentPreviewRequest(
        SMART_ASSIGNMENT_PROFILE_KEYS.ServiceCall,
        policy,
        { professionalFit: 90, availability: 80, workload: 70, geography: 60, experience: 50 },
      ),
    ).toMatchObject({
      policy: { profileKey: 'ServiceCall', displayName: 'שירות' },
      sampleScores: { professionalFit: 90, experience: 50 },
    });
  });
});
