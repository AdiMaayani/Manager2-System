import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const featureLibDir = dirname(fileURLToPath(import.meta.url));

const drawerSource = readFileSync(
  join(featureLibDir, '../components/ServiceCallDrawer/ServiceCallDrawer.tsx'),
  'utf8',
);

describe('ServiceCallDrawer lifecycle UX contract', () => {
  it('labels cancellation as ביטול קריאה', () => {
    expect(drawerSource).toContain('ביטול קריאה');
    expect(drawerSource).not.toContain('סגירת קריאה');
  });

  it('offers פתיחה מחדש for cancelled calls', () => {
    expect(drawerSource).toContain('פתיחה מחדש');
    expect(drawerSource).toContain('canReopenServiceCall');
  });

  it('displays lifecycle metadata separately from actual work times', () => {
    expect(drawerSource).toContain('title="מחזור חיים"');
    expect(drawerSource).toContain('נוצרה בתאריך');
    expect(drawerSource).toContain('בוטלה בתאריך');
    expect(drawerSource).toContain('label="התחלה בפועל"');
    expect(drawerSource).toContain('label="סיום בפועל"');
    expect(drawerSource).not.toContain('נסגרה בתאריך');
  });

  it('keeps cancellation out of the generic status selector path', () => {
    expect(drawerSource).toContain('SERVICE_CALL_EDIT_STATUS_OPTIONS');
    expect(drawerSource).toContain('isServiceCallCancelled(form.status)');
    expect(drawerSource).toContain('cancelMutation');
    expect(drawerSource).not.toContain('closeMutation');
  });
});
