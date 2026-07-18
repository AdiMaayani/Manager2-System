import { describe, expect, it } from 'vitest';
import { resolveProjectDrawerState } from './projectDrawerUrlState';

describe('resolveProjectDrawerState', () => {
  it('returns null when no drawer parameters are present', () => {
    expect(resolveProjectDrawerState(new URLSearchParams(''))).toBeNull();
  });

  it('opens create mode from mode=create', () => {
    expect(resolveProjectDrawerState(new URLSearchParams('mode=create'))).toEqual({
      projectId: null,
      mode: 'create',
      initialTab: undefined,
    });
  });

  it('carries the requested tab into create mode', () => {
    expect(resolveProjectDrawerState(new URLSearchParams('mode=create&tab=boq'))).toEqual({
      projectId: null,
      mode: 'create',
      initialTab: 'boq',
    });
  });

  it('opens view mode for a valid project id', () => {
    expect(resolveProjectDrawerState(new URLSearchParams('projectId=5'))).toEqual({
      projectId: 5,
      mode: 'view',
      initialTab: undefined,
    });
  });

  it('carries the requested tab into view mode', () => {
    expect(resolveProjectDrawerState(new URLSearchParams('projectId=5&tab=quote'))).toEqual({
      projectId: 5,
      mode: 'view',
      initialTab: 'quote',
    });
  });

  it('prefers create mode over a project id when both are present', () => {
    const state = resolveProjectDrawerState(new URLSearchParams('mode=create&projectId=5'));
    expect(state?.mode).toBe('create');
    expect(state?.projectId).toBeNull();
  });

  it('fails safe (closed) for invalid project ids', () => {
    expect(resolveProjectDrawerState(new URLSearchParams('projectId=abc'))).toBeNull();
    expect(resolveProjectDrawerState(new URLSearchParams('projectId=0'))).toBeNull();
    expect(resolveProjectDrawerState(new URLSearchParams('projectId=-4'))).toBeNull();
  });
});
