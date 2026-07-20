import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));

const reportsPageSource = readFileSync(
  join(here, '../pages/ReportsPage/ReportsPage.tsx'),
  'utf8',
);

const dashboardPageSource = readFileSync(
  join(here, '../../dashboard/pages/DashboardPage/DashboardPage.tsx'),
  'utf8',
);

describe('report detail deep-link contract (GAP-005)', () => {
  it('ReportsPage opens and clears detail from the shared reportId URL helpers', () => {
    expect(reportsPageSource).toContain("from '@shared/lib/reportDeepLink'");
    expect(reportsPageSource).toContain('parseReportIdParam');
    expect(reportsPageSource).toContain('buildReportDetailSearchParams');
    expect(reportsPageSource).toContain("searchParams.get('reportId')");
  });

  it('Dashboard recommendations resolve WorkReport action routes through the shared helper', () => {
    expect(dashboardPageSource).toContain('resolveDashboardActionRoute');
  });
});
