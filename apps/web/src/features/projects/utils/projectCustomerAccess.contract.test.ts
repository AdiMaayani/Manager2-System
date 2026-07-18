import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const overviewTabSource = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '../components/ProjectDrawer/components/ProjectOverviewTab/ProjectOverviewTab.tsx',
  ),
  'utf8',
);

describe('ProjectOverviewTab Customer access contract', () => {
  it('exposes פתח תיק לקוח and retains ניהול אתרי הלקוח', () => {
    expect(overviewTabSource).toContain('פתח תיק לקוח');
    expect(overviewTabSource).toContain('ניהול אתרי הלקוח');
  });

  it('does not navigate away or open a new tab for Customer access', () => {
    expect(overviewTabSource).not.toContain('/customers?customerId=');
    expect(overviewTabSource).not.toContain('window.open');
    expect(overviewTabSource).not.toContain('target="_blank"');
    expect(overviewTabSource).not.toContain("target='_blank'");
  });

  it('loads canonical Customer detail on demand via getCustomerByIdAsync', () => {
    expect(overviewTabSource).toContain('getCustomerByIdAsync');
    expect(overviewTabSource).toContain("['customers', 'detail', detailCustomerId]");
  });
});
