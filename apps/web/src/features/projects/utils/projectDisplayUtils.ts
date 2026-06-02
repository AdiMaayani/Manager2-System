import type {
  ProjectBoqRow,
  ProjectDrawing,
  ProjectEquipmentItem,
  ProjectLifecycle,
  ProjectLifecycleAssignment,
  ProjectMilestoneForm,
  ProjectOverviewForm,
  ProjectTeamForm,
} from '../types';

export interface StatusOption {
  code: string;
  display: string;
  badgeVariant: 'neutral' | 'primary' | 'success' | 'warning' | 'danger';
}

export const PROJECT_STATUS_OPTIONS: StatusOption[] = [
  { code: 'Open', display: 'פתוח', badgeVariant: 'neutral' },
  { code: 'Planned', display: 'בתכנון', badgeVariant: 'primary' },
  { code: 'Design', display: 'תוכניות', badgeVariant: 'primary' },
  { code: 'Wiring', display: 'השחלה', badgeVariant: 'warning' },
  { code: 'Execution', display: 'ביצוע', badgeVariant: 'warning' },
  { code: 'Closed', display: 'סיום', badgeVariant: 'success' },
  { code: 'Cancelled', display: 'מבוטל', badgeVariant: 'neutral' },
];

export const BILLING_TYPE_OPTIONS = [
  { code: 'Fixed', display: 'קבוע' },
  { code: 'Internal', display: 'פנימי' },
  { code: 'Hourly', display: 'שעתי' },
];

export const MILESTONE_STATUS_OPTIONS = [
  { code: 'Planned', display: 'מתוכנן' },
  { code: 'Execution', display: 'בביצוע' },
  { code: 'Closed', display: 'סגור' },
  { code: 'Cancelled', display: 'מבוטל' },
];

export const MILESTONE_PRIORITY_OPTIONS = [
  { code: 'Low', display: 'נמוכה' },
  { code: 'Medium', display: 'בינונית' },
  { code: 'High', display: 'גבוהה' },
];

export const STAGE_FILTER_OPTIONS = [
  { code: '', display: 'הכל' },
  { code: 'Planned', display: 'בתכנון' },
  { code: 'Design', display: 'תוכניות' },
  { code: 'Wiring', display: 'השחלה' },
  { code: 'Execution', display: 'ביצוע' },
  { code: 'Closed', display: 'סיום' },
];

export const EQUIPMENT_STATUS_OPTIONS = [
  { code: 'installed', display: 'מותקן' },
  { code: 'installing', display: 'בהתקנה' },
  { code: 'ordered', display: 'בהזמנה' },
  { code: 'waiting', display: 'ממתין' },
];

export const BOQ_UNIT_OPTIONS = ['יח׳', 'מ׳', 'מ״ר', 'סט'];

export const PROJECT_ASSIGNMENT_ROLE_OPTIONS = [
  'Project Manager',
  'מתקין',
  'מנהל פרויקט',
  'טכנאי',
];

export const PROJECT_MANAGER_ROLE = 'Project Manager';

export interface AggregatedProjectTeam {
  managerNames: string[];
  teamMemberNames: string[];
}

export function aggregateProjectTeamFromLifecycle(
  lifecycle: ProjectLifecycle | null,
): AggregatedProjectTeam {
  if (!lifecycle) {
    return { managerNames: [], teamMemberNames: [] };
  }

  const projectId = lifecycle.project.workItemId;

  const managerNames: string[] = [];
  const teamMemberNames = new Set<string>();

  lifecycle.assignments.forEach((assignment) => {
    if (
      assignment.assignmentType !== 'Employee' ||
      !assignment.employeeName ||
      assignment.workItemId !== projectId
    ) {
      return;
    }

    const role = (assignment.assignmentRole ?? '').trim().toLowerCase();
    const employeeName = assignment.employeeName.trim();

    if (!employeeName) return;

    if (role === 'project manager' || role === 'מנהל פרויקט' || role === 'team leader') {
      if (!managerNames.includes(employeeName)) {
        managerNames.push(employeeName);
      }
      return;
    }

    teamMemberNames.add(employeeName);
  });

  return {
    managerNames,
    teamMemberNames: Array.from(teamMemberNames),
  };
}

export function teamFormFromProjectAssignments(
  lifecycle: ProjectLifecycle | null,
): ProjectTeamForm {
  if (!lifecycle) {
    return { projectManagerEmployeeId: null, teamEmployeeIds: [] };
  }

  const projectId = lifecycle.project.workItemId;
  const projectAssignments = lifecycle.assignments.filter(
    (assignment) =>
      assignment.workItemId === projectId &&
      assignment.assignmentType === 'Employee' &&
      assignment.employeeId != null,
  );

  const projectManager = projectAssignments.find((assignment) =>
    isProjectManagerAssignment(assignment),
  );

  const teamEmployeeIds = projectAssignments
    .filter((assignment) => !isProjectManagerAssignment(assignment))
    .map((assignment) => assignment.employeeId!)
    .filter((employeeId, index, items) => items.indexOf(employeeId) === index);

  return {
    projectManagerEmployeeId: projectManager?.employeeId ?? null,
    teamEmployeeIds,
  };
}

function isProjectManagerAssignment(assignment: ProjectLifecycleAssignment): boolean {
  const role = (assignment.assignmentRole ?? '').trim().toLowerCase();
  return role === 'project manager' || role === 'מנהל פרויקט' || role === 'team leader';
}

export function createEmptyMilestoneForm(): ProjectMilestoneForm {
  return {
    title: '',
    description: '',
    status: 'Planned',
    billingType: 'Internal',
    plannedStart: '',
    plannedEnd: '',
    estimatedHours: '',
    actualStart: '',
    actualEnd: '',
    actualHours: '',
    priority: 'Medium',
    requiredRole: '',
    isLocked: false,
    employees: [],
    contractors: [],
  };
}

export function getProjectStatusMeta(statusCode?: string | null): StatusOption {
  if (!statusCode) {
    return { code: '', display: '-', badgeVariant: 'neutral' };
  }

  const match = PROJECT_STATUS_OPTIONS.find(
    (option) => option.code === String(statusCode).trim(),
  );

  if (!match) {
    return {
      code: String(statusCode).trim(),
      display: String(statusCode).trim(),
      badgeVariant: 'neutral',
    };
  }

  return match;
}

export function getBillingTypeDisplay(billingTypeCode?: string | null): string {
  if (!billingTypeCode) return '-';

  const match = BILLING_TYPE_OPTIONS.find(
    (option) => option.code === String(billingTypeCode).trim(),
  );

  return match?.display ?? String(billingTypeCode).trim();
}

export function formatProjectDate(
  dateValue?: string | null,
  options: { includeTime?: boolean; emptyValue?: string } = {},
): string {
  const { includeTime = false, emptyValue = '-' } = options;

  if (!dateValue) return emptyValue;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return emptyValue;

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  if (!includeTime) return `${day}/${month}/${year}`;

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function toDateInputValue(dateValue?: string | null): string {
  if (!dateValue) return '';

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toDateTimeLocalValue(dateValue?: string | null): string {
  if (!dateValue) return '';

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return '';

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export const MILESTONE_ESTIMATED_HOURS_MAX = 999.99;

export function parseOptionalMilestoneEstimatedHours(value: string): {
  value: number | undefined;
  error?: string;
} {
  const trimmed = value.trim();
  if (!trimmed) {
    return { value: undefined };
  }

  const numeric = Number(trimmed);
  if (Number.isNaN(numeric)) {
    return { value: undefined, error: 'הערכת שעות חייבת להיות מספר.' };
  }

  if (numeric <= 0 || numeric > MILESTONE_ESTIMATED_HOURS_MAX) {
    return {
      value: undefined,
      error: 'הערכת שעות חייבת להיות גדולה מ-0 ועד 999.99.',
    };
  }

  return { value: Number(numeric.toFixed(2)) };
}

export function calculateHoursBetween(
  startValue?: string,
  endValue?: string,
): { value: number | null; display: string } {
  if (!startValue || !endValue) {
    return { value: null, display: '' };
  }

  const start = new Date(startValue);
  const end = new Date(endValue);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { value: null, display: '' };
  }

  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return { value: null, display: '' };

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hoursDecimal = totalMinutes / 60;
  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const mm = String(totalMinutes % 60).padStart(2, '0');

  return {
    value: Number(hoursDecimal.toFixed(2)),
    display: `${hh}:${mm}`,
  };
}

export function formatDecimalHoursToTime(decimalHours?: number | null): string {
  if (decimalHours == null) return '-';

  const numeric = Number(decimalHours);
  if (Number.isNaN(numeric) || numeric < 0) return '-';

  const totalMinutes = Math.round(numeric * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function getProjectNumber(workItemId: number): string {
  return `P-${workItemId}`;
}

export function createEmptyOverviewForm(): ProjectOverviewForm {
  return {
    title: '',
    description: '',
    status: 'Open',
    billingType: 'Fixed',
    customerId: 0,
    siteId: 0,
    dealCloseDate: '',
    financeProjectNumber: '',
    invoiceNumber: '',
  };
}

export function overviewFormFromLifecycle(
  lifecycle: ProjectLifecycle | null,
): ProjectOverviewForm {
  if (!lifecycle) {
    return createEmptyOverviewForm();
  }

  const { project } = lifecycle;
  return {
    title: project.title,
    description: project.description ?? '',
    status: project.status,
    billingType: project.billingType ?? 'Fixed',
    customerId: project.customerId,
    siteId: project.siteId ?? 0,
    dealCloseDate: toDateInputValue(project.dealCloseDate),
    financeProjectNumber: project.financeProjectNumber ?? '',
    invoiceNumber: project.invoiceNumber ?? '',
  };
}

export const DEFAULT_BOQ_ROWS: ProjectBoqRow[] = [
  { id: 'boq-1', system: 'חשמל', item: 'לוח חשמל 24 מודול', quantity: '1', unit: 'יח׳' },
  { id: 'boq-2', system: 'חשמל', item: 'כבל 3x2.5', quantity: '120', unit: 'מ׳' },
  { id: 'boq-3', item: 'שקעים כפולים', quantity: '24', unit: 'יח׳' },
];

export const DEFAULT_DRAWINGS: ProjectDrawing[] = [
  {
    id: 'drawing-1',
    name: 'תוכנית חשמל - קומה 1',
    type: 'PDF',
    date: '2025-01-15',
    note: 'גרסה 1.0',
  },
  {
    id: 'drawing-2',
    name: 'תוכנית לוחות',
    type: 'DWG',
    date: '2025-01-20',
  },
];

export const DEFAULT_EQUIPMENT: ProjectEquipmentItem[] = [
  {
    projectEquipmentItemId: -1,
    projectId: 0,
    name: 'לוח חשמל ראשי',
    status: 'installing',
    location: 'חדר חשמל',
    sortOrder: 1,
  },
  {
    projectEquipmentItemId: -2,
    projectId: 0,
    name: 'מפסקים',
    status: 'ordered',
    location: 'לוח 1',
    sortOrder: 2,
  },
  {
    projectEquipmentItemId: -3,
    projectId: 0,
    name: 'גלאי עשן',
    status: 'waiting',
    location: 'מסדרון',
    sortOrder: 3,
  },
];
