import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Customer } from '../types';
import {
  buildCreateCustomerRequest,
  buildOrdinaryUpdateCustomerRequest,
  buildRestoreCustomerRequest,
  type CustomerEditableFields,
} from './customerRequestMapping';

const form: CustomerEditableFields = {
  customerName: '  לקוח בדיקה  ',
  customerType: 'עסקי',
  primaryPhone: ' 050-1234567 ',
  primaryEmail: ' test@example.com ',
  city: ' תל אביב ',
  region: ' מרכז ',
  address: ' רחוב 1 ',
  notes: ' הערה ',
};

const activeCustomer: Customer = {
  customerId: 10,
  customerName: 'לקוח קיים',
  customerType: 'פרטי',
  primaryPhone: '050-0000000',
  primaryEmail: 'old@example.com',
  city: 'חיפה',
  region: 'צפון',
  address: 'רחוב ישן',
  status: 'פעיל',
  notes: 'ישן',
  isActive: true,
};

const inactiveCustomer: Customer = {
  ...activeCustomer,
  customerId: 11,
  status: 'לא פעיל',
  isActive: false,
};

describe('buildCreateCustomerRequest', () => {
  it('defaults new customers to active with status פעיל', () => {
    const request = buildCreateCustomerRequest(form);

    expect(request.isActive).toBe(true);
    expect(request.status).toBe('פעיל');
  });

  it('maps descriptive and contact fields from the form', () => {
    expect(buildCreateCustomerRequest(form)).toEqual({
      customerName: 'לקוח בדיקה',
      customerType: 'עסקי',
      primaryPhone: '050-1234567',
      primaryEmail: 'test@example.com',
      city: 'תל אביב',
      region: 'מרכז',
      address: 'רחוב 1',
      notes: 'הערה',
      status: 'פעיל',
      isActive: true,
    });
  });
});

describe('buildOrdinaryUpdateCustomerRequest', () => {
  it('preserves isActive=true for an active customer', () => {
    const request = buildOrdinaryUpdateCustomerRequest(form, activeCustomer);
    expect(request.isActive).toBe(true);
  });

  it('preserves isActive=false for an inactive customer', () => {
    const request = buildOrdinaryUpdateCustomerRequest(form, inactiveCustomer);
    expect(request.isActive).toBe(false);
  });

  it('cannot reactivate an inactive customer through form-only state', () => {
    // Form has no activation field; even with edited details the lifecycle stays inactive.
    const request = buildOrdinaryUpdateCustomerRequest(form, inactiveCustomer);
    expect(request.isActive).toBe(false);
    expect(request).not.toMatchObject({ isActive: true });
  });

  it('cannot deactivate an active customer through form-only state', () => {
    const request = buildOrdinaryUpdateCustomerRequest(form, activeCustomer);
    expect(request.isActive).toBe(true);
    expect(request).not.toMatchObject({ isActive: false });
  });

  it('preserves an existing meaningful customer.status during ordinary detail updates', () => {
    const customerWithCustomStatus: Customer = {
      ...activeCustomer,
      status: 'לקוח VIP',
    };
    const request = buildOrdinaryUpdateCustomerRequest(form, customerWithCustomStatus);
    expect(request.status).toBe('לקוח VIP');
    expect(request.isActive).toBe(true);
  });

  it('derives missing status fallback only from persisted customer.isActive', () => {
    const activeWithoutStatus: Customer = { ...activeCustomer, status: undefined };
    const inactiveWithoutStatus: Customer = {
      ...inactiveCustomer,
      status: '   ',
    };

    expect(buildOrdinaryUpdateCustomerRequest(form, activeWithoutStatus).status).toBe('פעיל');
    expect(buildOrdinaryUpdateCustomerRequest(form, inactiveWithoutStatus).status).toBe(
      'לא פעיל',
    );
  });

  it('maps descriptive and contact fields from the form', () => {
    const request = buildOrdinaryUpdateCustomerRequest(form, inactiveCustomer);
    expect(request).toMatchObject({
      customerName: 'לקוח בדיקה',
      customerType: 'עסקי',
      primaryPhone: '050-1234567',
      primaryEmail: 'test@example.com',
      city: 'תל אביב',
      region: 'מרכז',
      address: 'רחוב 1',
      notes: 'הערה',
      isActive: false,
      status: 'לא פעיל',
    });
  });
});

describe('buildRestoreCustomerRequest', () => {
  it('sets isActive=true and status פעיל', () => {
    const request = buildRestoreCustomerRequest(inactiveCustomer);
    expect(request.isActive).toBe(true);
    expect(request.status).toBe('פעיל');
  });

  it('maps descriptive fields from the persisted customer', () => {
    expect(buildRestoreCustomerRequest(inactiveCustomer)).toEqual({
      customerName: inactiveCustomer.customerName,
      customerType: inactiveCustomer.customerType,
      primaryPhone: inactiveCustomer.primaryPhone,
      primaryEmail: inactiveCustomer.primaryEmail,
      city: inactiveCustomer.city,
      region: inactiveCustomer.region,
      address: inactiveCustomer.address,
      notes: inactiveCustomer.notes,
      status: 'פעיל',
      isActive: true,
    });
  });
});

describe('CustomerEditableFields shape', () => {
  it('does not include an activation field in the editable form model', () => {
    expect(Object.keys(form)).not.toContain('isActive');
    expect(Object.keys(form)).not.toContain('status');
  });
});

describe('CustomerDrawer lifecycle action labels', () => {
  it('uses השבת/שחזר labels and no longer exposes the active checkbox or בטל פעילות', () => {
    const drawerSource = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../components/CustomerDrawer/CustomerDrawer.tsx'),
      'utf8',
    );

    expect(drawerSource).not.toContain('label="לקוח פעיל"');
    expect(drawerSource).not.toContain('triggerLabel="בטל פעילות"');
    expect(drawerSource).toContain('triggerLabel="השבת לקוח"');
    expect(drawerSource).toContain('triggerLabel="שחזר לקוח"');
  });
});
