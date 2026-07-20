import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const drawerSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../components/CustomerDrawer/CustomerDrawer.tsx'),
  'utf8',
);

describe('CustomerDrawer sites authorization contract (GAP-001)', () => {
  it('keeps customer edit on manageCustomers and sites on manageSites', () => {
    expect(drawerSource).toContain("can('manageCustomers')");
    expect(drawerSource).toContain("can('manageSites')");
    expect(drawerSource).toContain('canManageSites={canManageSites}');
  });

  it('does not pass manageCustomers into CustomerSitesSection', () => {
    expect(drawerSource).not.toContain(
      '<CustomerSitesSection customerId={customer.customerId} canManage={canManage} />',
    );
    expect(drawerSource).toContain(
      '<CustomerSitesSection customerId={customer.customerId} canManage={canManageSites} />',
    );
  });
});
