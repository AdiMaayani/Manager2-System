import { describe, expect, it } from 'vitest';
import {
  REPORT_TYPES,
  REPORT_WORKFLOW_STATUSES,
} from '@shared/constants/reportWorkflow';
import { validateWorkReportRequest } from './workReportValidation';

describe('validateWorkReportRequest', () => {
  it('accepts an incomplete but dated draft', () => {
    expect(
      validateWorkReportRequest({
        reportType: REPORT_TYPES.Regular,
        date: '2026-06-19',
        status: REPORT_WORKFLOW_STATUSES.Draft,
      }),
    ).toBeNull();
  });

  it('allows a draft to omit its target', () => {
    expect(
      validateWorkReportRequest({
        reportType: REPORT_TYPES.Project,
        date: '2026-06-19',
        status: REPORT_WORKFLOW_STATUSES.Draft,
        workItemId: null,
        projectId: null,
      }),
    ).toBeNull();
  });

  it('requires a valid target for submitted reports', () => {
    expect(
      validateWorkReportRequest({
        reportType: REPORT_TYPES.Regular,
        date: '2026-06-19',
        status: REPORT_WORKFLOW_STATUSES.Submitted,
        reporterId: 1,
        start: '08:00',
        end: '12:00',
        summary: 'סיכום',
      }),
    ).toContain('משימה או קריאת שירות');
  });

  it('requires reporter for submitted reports', () => {
    expect(
      validateWorkReportRequest({
        reportType: REPORT_TYPES.Regular,
        date: '2026-06-19',
        status: REPORT_WORKFLOW_STATUSES.Submitted,
        workItemId: 10,
        start: '08:00',
        end: '12:00',
        summary: 'סיכום',
      }),
    ).toContain('מדווח');
  });

  it('requires start and end for submitted reports', () => {
    expect(
      validateWorkReportRequest({
        reportType: REPORT_TYPES.Regular,
        date: '2026-06-19',
        status: REPORT_WORKFLOW_STATUSES.Submitted,
        workItemId: 10,
        reporterId: 1,
        summary: 'סיכום',
      }),
    ).toContain('שעות עבודה');
  });

  it('rejects a reversed time range for submitted reports', () => {
    expect(
      validateWorkReportRequest({
        reportType: REPORT_TYPES.Regular,
        date: '2026-06-19',
        status: REPORT_WORKFLOW_STATUSES.Submitted,
        workItemId: 10,
        reporterId: 1,
        start: '16:00',
        end: '08:00',
        summary: 'סיכום',
      }),
    ).toContain('שעת הסיום');
  });

  it('requires summary for submitted reports', () => {
    expect(
      validateWorkReportRequest({
        reportType: REPORT_TYPES.Regular,
        date: '2026-06-19',
        status: REPORT_WORKFLOW_STATUSES.Submitted,
        workItemId: 10,
        reporterId: 1,
        start: '08:00',
        end: '12:00',
        summary: '   ',
      }),
    ).toContain('סיכום');
  });

  it('rejects invalid status, type, and date', () => {
    expect(
      validateWorkReportRequest({
        reportType: REPORT_TYPES.Regular,
        date: '2026-06-19',
        status: 'bad',
      }),
    ).toContain('סטטוס');
    expect(
      validateWorkReportRequest({
        reportType: 'bad',
        date: '2026-06-19',
        status: REPORT_WORKFLOW_STATUSES.Draft,
      }),
    ).toContain('סוג הדיווח');
    expect(
      validateWorkReportRequest({
        reportType: REPORT_TYPES.Regular,
        date: 'not-a-date',
        status: REPORT_WORKFLOW_STATUSES.Draft,
      }),
    ).toContain('תאריך');
  });

  it('keeps an existing valid draft valid', () => {
    expect(
      validateWorkReportRequest({
        reportType: REPORT_TYPES.Regular,
        date: '2026-06-19',
        status: REPORT_WORKFLOW_STATUSES.Draft,
        workItemId: 42,
        reporterId: 7,
        start: '08:00',
        end: '12:00',
        summary: 'טיוטה חלקית',
      }),
    ).toBeNull();
  });

  it('keeps an existing valid submitted report valid', () => {
    expect(
      validateWorkReportRequest({
        reportType: REPORT_TYPES.Regular,
        date: '2026-06-19',
        status: REPORT_WORKFLOW_STATUSES.Submitted,
        workItemId: 42,
        reporterId: 7,
        start: '08:00',
        end: '12:00',
        summary: 'עבודה הושלמה',
      }),
    ).toBeNull();
  });
});
