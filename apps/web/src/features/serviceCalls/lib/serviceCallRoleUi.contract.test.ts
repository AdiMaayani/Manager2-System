import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const drawerSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../components/ServiceCallDrawer/ServiceCallDrawer.tsx',
  ),
  'utf8',
);

describe('ServiceCallDrawer role UX contract', () => {
  it('uses clarified professional-requirement and assignment labels', () => {
    expect(drawerSource).toContain('דרישה מקצועית');
    expect(drawerSource).toContain('התמחות נדרשת לקריאה');
    expect(drawerSource).toContain('שיבוץ עובד');
    expect(drawerSource).toContain('תפקיד העובד בקריאה');
  });

  it('no longer uses the ambiguous assignment-role label', () => {
    expect(drawerSource).not.toContain('תפקיד בשיוך');
  });

  it('restricts employee assignment UI to an existing Service Call', () => {
    expect(drawerSource).toContain('{isExistingServiceCall && (');
    expect(drawerSource).toContain('title="שיבוץ עובד"');
  });

  it('defaults a blank assignment role when an employee is selected', () => {
    expect(drawerSource).toContain('resolveDefaultAssignmentRole');
    expect(drawerSource).toContain('employeePrimaryRole: selectedEmployee?.primaryRole');
    expect(drawerSource).toContain('requiredRole: form.requiredRole');
  });
});
