import { describe, expect, it } from 'vitest';
import {
  canCancelServiceCall,
  canReopenServiceCall,
  isServiceCallCancelled,
  SERVICE_CALL_EDIT_STATUS_OPTIONS,
} from './serviceCallLifecycle';

describe('serviceCallLifecycle', () => {
  it('treats Cancelled as the cancellation status', () => {
    expect(isServiceCallCancelled('Cancelled')).toBe(true);
    expect(isServiceCallCancelled('Open')).toBe(false);
  });

  it('includes Planned in edit status options with Hebrew label', () => {
    expect(SERVICE_CALL_EDIT_STATUS_OPTIONS).toContainEqual({
      value: 'Planned',
      label: 'מתוכננת',
    });
  });

  it('excludes Cancelled from generic edit status options', () => {
    expect(SERVICE_CALL_EDIT_STATUS_OPTIONS.map((option) => option.value)).not.toContain(
      'Cancelled',
    );
  });

  it.each(['Planned', 'Open', 'InProgress'] as const)(
    'allows cancel from active status %s',
    (status) => {
      expect(canCancelServiceCall(status, null)).toBe(true);
    },
  );

  it('rejects cancel from Done', () => {
    expect(canCancelServiceCall('Done', null)).toBe(false);
  });

  it('rejects cancel from Cancelled', () => {
    expect(canCancelServiceCall('Cancelled', '2026-07-19T11:13:00Z')).toBe(false);
  });

  it('allows reopen from Cancelled', () => {
    expect(canReopenServiceCall('Cancelled', '2026-07-19T11:13:00Z')).toBe(true);
  });

  it('allows reopen repair from Open + ClosedAt', () => {
    expect(canReopenServiceCall('Open', '2026-07-19T11:13:00Z')).toBe(true);
  });

  it.each(['Done', 'InProgress', 'Planned'] as const)(
    'rejects reopen from %s even with ClosedAt',
    (status) => {
      expect(canReopenServiceCall(status, '2026-07-19T11:13:00Z')).toBe(false);
    },
  );
});
