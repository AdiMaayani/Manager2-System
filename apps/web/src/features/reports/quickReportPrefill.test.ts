import { describe, expect, it } from 'vitest';
import {
  enrichQuickReportPrefill,
  readQuickReportPrefill,
  taskCategoryToReportTargetType,
} from './quickReportPrefill';

describe('quickReportPrefill', () => {
  it('maps task categories to report target types', () => {
    expect(taskCategoryToReportTargetType('Regular')).toBe('regular');
    expect(taskCategoryToReportTargetType('Project')).toBe('project');
    expect(taskCategoryToReportTargetType('ServiceCall')).toBe('service_call');
  });

  it('reads a valid quick-report payload', () => {
    const payload = readQuickReportPrefill(
      JSON.stringify({
        workItemId: 42,
        taskCategory: 'Project',
        title: 'Task A',
        projectId: 7,
      }),
    );

    expect(payload).toEqual({
      workItemId: 42,
      taskCategory: 'Project',
      title: 'Task A',
      projectId: 7,
      projectTitle: undefined,
      date: undefined,
      start: undefined,
      end: undefined,
      reporterId: null,
      reporterName: undefined,
      reporterRole: undefined,
      relatedWorkerIds: [],
      customerName: undefined,
      site: undefined,
    });
  });

  it('rejects legacy payloads that omit workItemId', () => {
    expect(
      readQuickReportPrefill(JSON.stringify({ projectId: 7, taskCategory: 'Project' })),
    ).toBeNull();
  });

  it('accepts quick-report payloads for each task category', () => {
    for (const [taskCategory, workItemId] of [
      ['Regular', 101],
      ['Project', 202],
      ['ServiceCall', 303],
    ] as const) {
      const payload = readQuickReportPrefill(
        JSON.stringify({ workItemId, taskCategory, title: `Task ${workItemId}` }),
      );
      expect(payload?.workItemId).toBe(workItemId);
      expect(taskCategoryToReportTargetType(taskCategory)).toBeTruthy();
    }
  });

  it('fills task and project context without replacing explicit prefill values', () => {
    const prefill = enrichQuickReportPrefill(
      {
        workItemId: 42,
        taskCategory: 'Regular',
        date: '2026-07-12',
        start: '09:00',
        end: '11:00',
        customerName: 'Stored customer',
        site: 'Stored site',
        reporterId: 8,
        reporterRole: 'Stored role',
      },
      {
        workItemId: 42,
        title: 'Project task',
        taskCategory: 'Project',
        projectId: 7,
        projectTitle: 'Project A',
        customerName: 'API customer',
        siteName: 'API site',
        plannedStart: '2026-07-13T08:00:00Z',
        plannedEnd: '2026-07-13T12:00:00Z',
        requiredRole: 'API role',
      },
    );

    expect(prefill).toMatchObject({
      workItemId: 42,
      taskCategory: 'Project',
      title: 'Project task',
      projectId: 7,
      projectTitle: 'Project A',
      date: '2026-07-12',
      start: '09:00',
      end: '11:00',
      customerName: 'Stored customer',
      site: 'Stored site',
      reporterId: 8,
      reporterRole: 'Stored role',
    });
  });

  it('uses report-target context when storage contains only the task identity', () => {
    const prefill = enrichQuickReportPrefill(
      { workItemId: 42, taskCategory: 'Regular' },
      {
        workItemId: 42,
        title: 'Project task',
        taskCategory: 'Project',
        projectId: 7,
        projectTitle: 'Project A',
        customerName: 'Customer A',
        siteName: 'Site A',
        requiredRole: 'Electrician',
      },
    );

    expect(prefill).toMatchObject({
      taskCategory: 'Project',
      title: 'Project task',
      projectId: 7,
      projectTitle: 'Project A',
      customerName: 'Customer A',
      site: 'Site A',
      reporterRole: 'Electrician',
    });
  });

  it('uses route fallback assignment context for reporter and related workers', () => {
    const prefill = enrichQuickReportPrefill(
      { workItemId: 42, taskCategory: 'Project' },
      {
        workItemId: 42,
        title: 'Project task',
        taskCategory: 'Project',
        assignments: [
          {
            employeeId: 8,
            employeeName: 'Worker A',
            assignmentRole: 'Electrician',
            isManualAssignment: true,
            assignmentSource: 'Task',
            isActive: true,
            isAssignable: true,
          },
          {
            employeeId: 9,
            employeeName: 'Worker B',
            assignmentRole: 'Installer',
            isManualAssignment: false,
            assignmentSource: 'Task',
            isActive: true,
            isAssignable: true,
          },
        ],
      },
    );

    expect(prefill).toMatchObject({
      reporterId: 8,
      reporterName: 'Worker A',
      reporterRole: 'Electrician',
      relatedWorkerIds: [9],
    });
  });

  it('preserves a valid stored primary reporter when assignment context arrives later', () => {
    const prefill = enrichQuickReportPrefill(
      {
        workItemId: 42,
        taskCategory: 'Project',
        reporterId: 9,
      },
      {
        workItemId: 42,
        title: 'Project task',
        taskCategory: 'Project',
        assignments: [
          {
            employeeId: 8,
            employeeName: 'Worker A',
            isManualAssignment: true,
            assignmentSource: 'Task',
            isActive: true,
            isAssignable: true,
          },
          {
            employeeId: 9,
            employeeName: 'Worker B',
            isManualAssignment: false,
            assignmentSource: 'Task',
            isActive: true,
            isAssignable: true,
          },
        ],
      },
    );

    expect(prefill.reporterId).toBe(9);
    expect(prefill.relatedWorkerIds).toEqual([8]);
  });
});
