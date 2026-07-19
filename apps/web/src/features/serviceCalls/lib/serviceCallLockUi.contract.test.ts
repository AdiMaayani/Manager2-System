import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const featureLibDir = dirname(fileURLToPath(import.meta.url));

const drawerSource = readFileSync(
  join(featureLibDir, '../components/ServiceCallDrawer/ServiceCallDrawer.tsx'),
  'utf8',
);

const upsertRequestSource = readFileSync(
  join(featureLibDir, './serviceCallUpsertRequest.ts'),
  'utf8',
);

describe('ServiceCallDrawer lock UI contract', () => {
  it('no longer exposes Service Call operational lock controls', () => {
    expect(drawerSource).not.toContain('נעול לעריכה תפעולית');
    expect(drawerSource).not.toContain('נעילה תפעולית');
    expect(drawerSource).not.toContain("label=\"נעילה תפעולית\"");
    expect(drawerSource).not.toContain("? 'נעולה' : 'לא נעולה'");
  });

  it('still sends isLocked from form state in the upsert request', () => {
    expect(upsertRequestSource).toContain('isLocked: form.isLocked');
    expect(drawerSource).toContain('buildServiceCallUpsertRequest');
  });
});
