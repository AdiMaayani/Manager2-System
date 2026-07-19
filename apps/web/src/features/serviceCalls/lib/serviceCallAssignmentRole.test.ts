import { describe, expect, it } from 'vitest';
import { resolveDefaultAssignmentRole } from './serviceCallAssignmentRole';

describe('resolveDefaultAssignmentRole', () => {
  it('defaults a blank assignment role from requiredRole first', () => {
    expect(
      resolveDefaultAssignmentRole({
        currentAssignmentRole: '',
        requiredRole: 'חשמלאי',
        employeePrimaryRole: 'מתקין',
      }),
    ).toBe('חשמלאי');
  });

  it('falls back to employee primaryRole when requiredRole is blank', () => {
    expect(
      resolveDefaultAssignmentRole({
        currentAssignmentRole: '   ',
        requiredRole: '',
        employeePrimaryRole: 'טכנאי רשת',
      }),
    ).toBe('טכנאי רשת');
  });

  it('does not overwrite a nonblank assignment role', () => {
    expect(
      resolveDefaultAssignmentRole({
        currentAssignmentRole: 'טכנאי מוביל',
        requiredRole: 'חשמלאי',
        employeePrimaryRole: 'מתקין',
      }),
    ).toBe('טכנאי מוביל');
  });
});
