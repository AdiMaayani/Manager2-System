import { describe, expect, it } from 'vitest';
import { resolveDashboardActionRoute } from './resolveDashboardActionRoute';

describe('resolveDashboardActionRoute', () => {
  it('deep-links WorkReport recommendations that only point at /reports', () => {
    expect(
      resolveDashboardActionRoute({
        actionRoute: '/reports',
        entityType: 'WorkReport',
        entityId: 88,
      }),
    ).toBe('/reports?reportId=88');
  });

  it('deep-links WorkReport items when actionRoute is missing', () => {
    expect(
      resolveDashboardActionRoute({
        actionRoute: null,
        entityType: 'WorkReport',
        entityId: 12,
      }),
    ).toBe('/reports?reportId=12');
  });

  it('preserves an already-specific report deep link from the server', () => {
    expect(
      resolveDashboardActionRoute({
        actionRoute: '/reports?reportId=9&status=טיוטה',
        entityType: 'WorkReport',
        entityId: 9,
      }),
    ).toBe('/reports?reportId=9&status=טיוטה');
  });

  it('does not rewrite non-report entity routes', () => {
    expect(
      resolveDashboardActionRoute({
        actionRoute: '/customers?customerId=3',
        entityType: 'Customer',
        entityId: 3,
      }),
    ).toBe('/customers?customerId=3');

    expect(
      resolveDashboardActionRoute({
        actionRoute: '/inventory',
        entityType: 'InventoryItem',
        entityId: 4,
      }),
    ).toBe('/inventory');
  });

  it('ignores invalid WorkReport entity ids', () => {
    expect(
      resolveDashboardActionRoute({
        actionRoute: '/reports',
        entityType: 'WorkReport',
        entityId: 0,
      }),
    ).toBe('/reports');
  });
});
