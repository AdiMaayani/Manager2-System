import { describe, expect, it } from 'vitest';
import {
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
});
