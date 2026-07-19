import { describe, expect, it } from 'vitest';
import type { ServiceCallDetails } from '../types';
import { buildServiceCallFormState } from './serviceCallFormState';

const fullServiceCall: ServiceCallDetails = {
  workItemId: 42,
  title: 'תקלת רשת',
  description: 'אין חיבור בקומה 2',
  workType: 'ServiceCall',
  status: 'InProgress',
  billingType: 'Fixed',
  customerId: 7,
  customerName: 'לקוח בדיקה',
  siteId: 13,
  siteName: 'אתר ראשי',
  priority: 'High',
  plannedStart: '2026-07-01T09:30:00',
  plannedEnd: '2026-07-01T11:00:00',
  estimatedHours: 1.5,
  actualStart: '2026-07-01T09:45:00',
  actualEnd: '2026-07-01T11:15:00',
  actualHours: 1.5,
  requiredRole: 'טכנאי רשת',
  requiredRoles: ['טכנאי רשת', 'טכנאי תקשורת'],
  isLocked: true,
  createdAt: '2026-06-30T08:00:00',
  closedAt: null,
};

describe('buildServiceCallFormState', () => {
  it('mirrors an existing service call into editable string fields', () => {
    const form = buildServiceCallFormState(fullServiceCall);

    expect(form).toEqual({
      title: 'תקלת רשת',
      description: 'אין חיבור בקומה 2',
      status: 'InProgress',
      billingType: 'Fixed',
      customerId: '7',
      siteId: '13',
      priority: 'High',
      plannedStart: '2026-07-01T09:30',
      plannedEnd: '2026-07-01T11:00',
      estimatedHours: '1.5',
      actualStart: '2026-07-01T09:45',
      actualEnd: '2026-07-01T11:15',
      actualHours: '1.5',
      requiredRoles: ['טכנאי רשת', 'טכנאי תקשורת'],
      isLocked: true,
    });
  });

  it('truncates datetime values to the minute for datetime-local inputs', () => {
    const form = buildServiceCallFormState(fullServiceCall);
    expect(form.plannedStart).toBe('2026-07-01T09:30');
    expect(form.plannedStart).not.toContain(':00:00');
  });

  it('produces safe create-mode defaults when no service call is supplied', () => {
    const emptyForm = buildServiceCallFormState(null);

    expect(emptyForm).toEqual({
      title: '',
      description: '',
      status: 'Open',
      billingType: 'Hourly',
      customerId: '',
      siteId: '',
      priority: '',
      plannedStart: '',
      plannedEnd: '',
      estimatedHours: '',
      actualStart: '',
      actualEnd: '',
      actualHours: '',
      requiredRoles: [],
      isLocked: false,
    });
  });

  it('treats missing optional numeric and date fields as empty strings', () => {
    const partial: ServiceCallDetails = {
      ...fullServiceCall,
      description: null,
      priority: null,
      plannedStart: null,
      plannedEnd: null,
      estimatedHours: null,
      actualStart: null,
      actualEnd: null,
      actualHours: null,
      requiredRole: null,
      requiredRoles: null,
    };

    const form = buildServiceCallFormState(partial);
    expect(form.description).toBe('');
    expect(form.priority).toBe('');
    expect(form.plannedStart).toBe('');
    expect(form.estimatedHours).toBe('');
    expect(form.actualHours).toBe('');
    expect(form.requiredRoles).toEqual([]);
  });

  it('falls back to the legacy required role when the collection is absent', () => {
    const form = buildServiceCallFormState({
      ...fullServiceCall,
      requiredRoles: null,
      requiredRole: 'טכנאי רשת',
    });

    expect(form.requiredRoles).toEqual(['טכנאי רשת']);
  });
});
