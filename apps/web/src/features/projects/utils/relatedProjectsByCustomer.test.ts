import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ProjectListItem } from '../types';
import { filterRelatedProjectsByCustomerId } from './relatedProjectsByCustomer';

function buildProject(
  workItemId: number,
  customerId: number,
  customerName: string,
): ProjectListItem {
  return {
    workItemId,
    projectNumber: `P-${workItemId}`,
    title: `פרויקט ${workItemId}`,
    customerId,
    customerName,
    projectManagerName: '-',
    status: 'Open',
    createdAt: '2026-01-01',
    siteName: '-',
    billingType: 'Fixed',
  };
}

describe('filterRelatedProjectsByCustomerId', () => {
  it('returns only projects owned by the selected customer id', () => {
    const projects = [
      buildProject(1, 10, 'שם זהה'),
      buildProject(2, 11, 'שם זהה'),
      buildProject(3, 10, 'שם זהה'),
    ];

    expect(filterRelatedProjectsByCustomerId(projects, 10)).toEqual([
      buildProject(1, 10, 'שם זהה'),
      buildProject(3, 10, 'שם זהה'),
    ]);
  });

  it('does not mix projects when two customers share the same name', () => {
    const projects = [
      buildProject(101, 1, 'אלפא'),
      buildProject(102, 2, 'אלפא'),
    ];

    expect(filterRelatedProjectsByCustomerId(projects, 1).map((p) => p.workItemId)).toEqual([101]);
    expect(filterRelatedProjectsByCustomerId(projects, 2).map((p) => p.workItemId)).toEqual([102]);
  });

  it('returns no projects when customer id is missing', () => {
    expect(filterRelatedProjectsByCustomerId([buildProject(1, 10, 'א')], 0)).toEqual([]);
  });
});

describe('Project list CustomerId contract', () => {
  const typesSource = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../types.ts'),
    'utf8',
  );

  it('keeps customerId on ProjectListItem while retaining customerName for display', () => {
    expect(typesSource).toContain('export interface ProjectListItem');
    expect(typesSource).toMatch(/customerId\??:\s*number\s*\|\s*null/);
    expect(typesSource).toContain('customerName: string');
  });
});

describe('CustomerDrawer related-projects contract', () => {
  const drawerSource = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '../../customers/components/CustomerDrawer/CustomerDrawer.tsx',
    ),
    'utf8',
  );

  it('filters related projects by CustomerId helper, not by customer name', () => {
    expect(drawerSource).toContain('filterRelatedProjectsByCustomerId');
    expect(drawerSource).toContain('customer.customerId');
    expect(drawerSource).not.toContain("project.customerName?.trim() === customerName");
  });
});

describe('ContactDrawer related-projects contract', () => {
  const drawerSource = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '../../contacts/components/ContactDrawer/ContactDrawer.tsx',
    ),
    'utf8',
  );

  it('filters related projects by the contact CustomerId', () => {
    expect(drawerSource).toContain('filterRelatedProjectsByCustomerId');
    expect(drawerSource).toContain('contact.customerId ?? 0');
    expect(drawerSource).not.toContain('linkedCustomerName');
  });
});
