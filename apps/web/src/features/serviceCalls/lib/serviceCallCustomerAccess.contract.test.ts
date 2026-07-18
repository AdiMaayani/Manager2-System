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

describe('ServiceCallDrawer Customer access contract', () => {
  it('exposes both פתח תיק לקוח and ניהול אתרי הלקוח', () => {
    expect(drawerSource).toContain('פתח תיק לקוח');
    expect(drawerSource).toContain('ניהול אתרי הלקוח');
  });

  it('no longer navigates to /customers for Customer access', () => {
    expect(drawerSource).not.toContain('/customers?customerId=');
    expect(drawerSource).not.toContain("from 'react-router-dom'");
    expect(drawerSource).not.toContain('window.open');
    expect(drawerSource).not.toContain('target="_blank"');
    expect(drawerSource).not.toContain("target='_blank'");
  });

  it('uses one canonical Customer detail query for view and manage-sites', () => {
    expect(drawerSource).toContain('getCustomerByIdAsync');
    expect(drawerSource).toContain("['customers', 'detail', detailCustomerId]");
    expect(drawerSource).toContain("'view'");
    expect(drawerSource).toContain("'manageSites'");
  });
});
