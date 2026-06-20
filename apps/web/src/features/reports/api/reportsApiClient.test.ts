import { describe, expect, it } from 'vitest';
import {
  buildReportTargetListOption,
  formatReportTargetDescription,
} from './reportsApiClient';
import type { WorkItemReportTarget } from '../types';

describe('report target list options', () => {
  it('builds searchable options with title and secondary context for each category', () => {
    const regular: WorkItemReportTarget = {
      workItemId: 1,
      title: 'משימה כללית',
      taskCategory: 'Regular',
      plannedStart: '2026-06-19T08:00:00Z',
      assigneeName: 'דני',
    };
    const project: WorkItemReportTarget = {
      workItemId: 2,
      title: 'התקנת מצלמות',
      taskCategory: 'Project',
      projectTitle: 'פרויקט אלפא',
    };
    const serviceCall: WorkItemReportTarget = {
      workItemId: 3,
      title: 'קריאה דחופה',
      taskCategory: 'ServiceCall',
      customerName: 'לקוח א',
      siteName: 'סניף תל אביב',
    };

    expect(buildReportTargetListOption(regular)).toEqual({
      value: '1',
      label: 'משימה כללית',
      description: '2026-06-19 · דני',
      searchText: 'משימה כללית · 2026-06-19 · דני',
    });
    expect(formatReportTargetDescription(project)).toBe('פרויקט אלפא');
    expect(buildReportTargetListOption(serviceCall).description).toBe('לקוח א · סניף תל אביב');
  });
});
