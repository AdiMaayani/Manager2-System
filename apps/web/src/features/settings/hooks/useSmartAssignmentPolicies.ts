import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getSmartAssignmentPoliciesAsync,
  previewSmartAssignmentPolicyAsync,
  resetSmartAssignmentPolicyAsync,
  updateSmartAssignmentPolicyAsync,
} from '../api/settingsApiClient';
import type {
  SmartAssignmentPolicyPreviewRequest,
  SmartAssignmentPolicyProfile,
  SmartAssignmentProfileKey,
  UpdateSmartAssignmentPolicyRequest,
} from '../types';

const SMART_ASSIGNMENT_POLICIES_QUERY_KEY = ['settings', 'smart-assignment'] as const;

function replacePolicy(
  policies: SmartAssignmentPolicyProfile[] | undefined,
  updatedPolicy: SmartAssignmentPolicyProfile,
): SmartAssignmentPolicyProfile[] {
  if (!policies) return [updatedPolicy];
  const exists = policies.some((policy) => policy.profileKey === updatedPolicy.profileKey);
  return exists
    ? policies.map((policy) =>
        policy.profileKey === updatedPolicy.profileKey ? updatedPolicy : policy,
      )
    : [...policies, updatedPolicy];
}

export function useSmartAssignmentPolicies() {
  return useQuery({
    queryKey: SMART_ASSIGNMENT_POLICIES_QUERY_KEY,
    queryFn: getSmartAssignmentPoliciesAsync,
  });
}

export function useUpdateSmartAssignmentPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      profileKey,
      request,
    }: {
      profileKey: SmartAssignmentProfileKey;
      request: UpdateSmartAssignmentPolicyRequest;
    }) => updateSmartAssignmentPolicyAsync(profileKey, request),
    onSuccess: (updatedPolicy) => {
      queryClient.setQueryData<SmartAssignmentPolicyProfile[]>(
        SMART_ASSIGNMENT_POLICIES_QUERY_KEY,
        (policies) => replacePolicy(policies, updatedPolicy),
      );
    },
  });
}

export function useResetSmartAssignmentPolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileKey: SmartAssignmentProfileKey) =>
      resetSmartAssignmentPolicyAsync(profileKey),
    onSuccess: (updatedPolicy) => {
      queryClient.setQueryData<SmartAssignmentPolicyProfile[]>(
        SMART_ASSIGNMENT_POLICIES_QUERY_KEY,
        (policies) => replacePolicy(policies, updatedPolicy),
      );
    },
  });
}

export function usePreviewSmartAssignmentPolicy() {
  return useMutation({
    mutationFn: (request: SmartAssignmentPolicyPreviewRequest) =>
      previewSmartAssignmentPolicyAsync(request),
  });
}
