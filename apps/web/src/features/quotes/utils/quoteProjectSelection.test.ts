import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { QuoteProjectOption } from '../types';
import {
  applyQuoteCustomerChange,
  filterQuoteProjectsByCustomerId,
} from './quoteProjectSelection';

function buildProject(
  workItemId: number,
  customerId: number,
  title = `פרויקט ${workItemId}`,
  customerName = 'לקוח',
): QuoteProjectOption {
  return { workItemId, title, customerId, customerName };
}

describe('filterQuoteProjectsByCustomerId', () => {
  it('returns only projects for the selected customer id', () => {
    const projects = [
      buildProject(1, 10, 'א', 'שם זהה'),
      buildProject(2, 11, 'ב', 'שם זהה'),
      buildProject(3, 10, 'ג', 'שם זהה'),
    ];

    expect(filterQuoteProjectsByCustomerId(projects, 10)).toEqual([
      buildProject(1, 10, 'א', 'שם זהה'),
      buildProject(3, 10, 'ג', 'שם זהה'),
    ]);
  });

  it('ignores duplicate customer names when filtering', () => {
    const projects = [buildProject(1, 1, 'שלי', 'כפיל'), buildProject(2, 2, 'שלו', 'כפיל')];
    expect(filterQuoteProjectsByCustomerId(projects, 1).map((p) => p.workItemId)).toEqual([1]);
  });

  it('returns no projects until a customer is selected', () => {
    expect(filterQuoteProjectsByCustomerId([buildProject(1, 10)], 0)).toEqual([]);
  });
});

describe('applyQuoteCustomerChange', () => {
  const projects = [buildProject(50, 3), buildProject(60, 7)];

  it('clears an incompatible selected project when the customer changes', () => {
    const next = applyQuoteCustomerChange(
      { customerId: '3', projectId: '50', status: 'Draft' },
      '7',
      projects,
    );

    expect(next.customerId).toBe('7');
    expect(next.projectId).toBe('');
    expect(next.status).toBe('Draft');
  });

  it('keeps a compatible project selected when the customer still owns it', () => {
    const next = applyQuoteCustomerChange(
      { customerId: '3', projectId: '50' },
      '3',
      projects,
    );

    expect(next.customerId).toBe('3');
    expect(next.projectId).toBe('50');
  });

  it('keeps an empty project selection stable', () => {
    const next = applyQuoteCustomerChange(
      { customerId: '3', projectId: '' },
      '7',
      projects,
    );

    expect(next.projectId).toBe('');
    expect(next.customerId).toBe('7');
  });
});

describe('QuoteDrawer project ownership contract', () => {
  const drawerSource = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '../components/QuoteDrawer/QuoteDrawer.tsx',
    ),
    'utf8',
  );

  it('filters project options by CustomerId and clears incompatible selections', () => {
    expect(drawerSource).toContain('filterQuoteProjectsByCustomerId');
    expect(drawerSource).toContain('applyQuoteCustomerChange');
    expect(drawerSource).toContain('customerProjectOptions');
  });
});

describe('QuoteProjectOption CustomerId contract', () => {
  const typesSource = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../types.ts'),
    'utf8',
  );

  it('carries customerId for ownership filtering while keeping customerName for labels', () => {
    expect(typesSource).toContain('export interface QuoteProjectOption');
    expect(typesSource).toMatch(/customerId\??:\s*number\s*\|\s*null/);
    expect(typesSource).toContain('customerName?: string | null');
  });
});
