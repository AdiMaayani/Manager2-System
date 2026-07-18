import { describe, expect, it } from 'vitest';
import { resolveProjectDrawerTab } from './projectDrawerTabs';

describe('resolveProjectDrawerTab', () => {
  it('keeps a valid requested tab', () => {
    expect(resolveProjectDrawerTab('boq')).toBe('boq');
    expect(resolveProjectDrawerTab('overview')).toBe('overview');
  });

  it('honors a different requested tab (reopening on another tab)', () => {
    expect(resolveProjectDrawerTab('quote')).toBe('quote');
    expect(resolveProjectDrawerTab('equipment')).toBe('equipment');
  });

  it('falls back to overview when the tab is missing', () => {
    expect(resolveProjectDrawerTab(undefined)).toBe('overview');
    expect(resolveProjectDrawerTab(null)).toBe('overview');
  });

  it('falls back to overview for an unrecognized tab', () => {
    expect(resolveProjectDrawerTab('nonsense' as never)).toBe('overview');
  });
});
