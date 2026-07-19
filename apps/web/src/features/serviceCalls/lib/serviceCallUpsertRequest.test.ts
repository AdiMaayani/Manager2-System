import { describe, expect, it } from 'vitest';
import type { ServiceCallFormState } from './serviceCallFormState';
import { buildServiceCallUpsertRequest } from './serviceCallUpsertRequest';

const baseForm: ServiceCallFormState = {
  title: 'תקלת רשת',
  description: 'אין חיבור',
  status: 'Open',
  billingType: 'Hourly',
  customerId: '7',
  siteId: '13',
  priority: 'High',
  plannedStart: '2026-07-19T09:30',
  plannedEnd: '2026-07-19T11:00',
  estimatedHours: '1.5',
  actualStart: '2026-07-19T09:45',
  actualEnd: '2026-07-19T11:15',
  actualHours: '1.5',
  requiredRole: 'טכנאי רשת',
  isLocked: true,
};

describe('buildServiceCallUpsertRequest', () => {
  it('sends plannedStart and plannedEnd with Z', () => {
    const request = buildServiceCallUpsertRequest(baseForm);
    expect(request.plannedStart).toBe('2026-07-19T06:30:00.000Z');
    expect(request.plannedEnd).toBe('2026-07-19T08:00:00.000Z');
  });

  it('sends actualStart and actualEnd with Z', () => {
    const request = buildServiceCallUpsertRequest(baseForm);
    expect(request.actualStart).toBe('2026-07-19T06:45:00.000Z');
    expect(request.actualEnd).toBe('2026-07-19T08:15:00.000Z');
  });

  it('sends empty date values as null', () => {
    const request = buildServiceCallUpsertRequest({
      ...baseForm,
      plannedStart: '',
      plannedEnd: '   ',
      actualStart: '',
      actualEnd: '',
    });
    expect(request.plannedStart).toBeNull();
    expect(request.plannedEnd).toBeNull();
    expect(request.actualStart).toBeNull();
    expect(request.actualEnd).toBeNull();
  });

  it('preserves isLocked from form state', () => {
    expect(buildServiceCallUpsertRequest(baseForm).isLocked).toBe(true);
    expect(
      buildServiceCallUpsertRequest({ ...baseForm, isLocked: false }).isLocked,
    ).toBe(false);
  });

  it('preserves all non-date request fields', () => {
    const request = buildServiceCallUpsertRequest(baseForm);
    expect(request).toMatchObject({
      title: 'תקלת רשת',
      description: 'אין חיבור',
      status: 'Open',
      billingType: 'Hourly',
      customerId: 7,
      siteId: 13,
      priority: 'High',
      estimatedHours: 1.5,
      actualHours: 1.5,
      requiredRole: 'טכנאי רשת',
      isLocked: true,
    });
  });
});
