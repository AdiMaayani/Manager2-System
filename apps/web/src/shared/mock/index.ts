import type { Contact } from '@features/contacts/types';
import type { Customer } from '@features/customers/types';
import type { Employee } from '@features/employees/types';
import type {
  ProjectLifecycle,
  ProjectListItem,
  ProjectMilestone,
  Site,
} from '@features/projects/types';
import type { WorkReportListItem } from '@features/reports/types';
import type { ServiceCallListItem } from '@features/serviceCalls/types';

export const mockContacts: Contact[] = [
  {
    contactId: 1,
    fullName: 'יוסי כהן',
    jobTitle: 'מנהל IT',
    contactCategory: 'לקוחות',
    customerId: 1,
    companyName: 'חברת ABC בע״מ',
    phone: '03-1234567',
    email: 'yossi.cohen@abc.co.il',
    preferredChannel: 'מייל',
    city: 'תל אביב',
    status: 'פעיל',
    isActive: true,
  },
  {
    contactId: 2,
    fullName: 'דוד כהן',
    jobTitle: 'בעלים',
    contactCategory: 'לקוחות',
    customerId: 2,
    companyName: 'וילה רמת אביב',
    phone: '050-9876543',
    email: 'david.cohen@villa.co.il',
    preferredChannel: 'טלפון',
    city: 'רמת אביב',
    status: 'פעיל',
    isActive: true,
  },
  {
    contactId: 3,
    fullName: 'שרה לוי',
    jobTitle: 'מנהלת תחזוקה',
    contactCategory: 'לקוחות',
    customerId: 3,
    companyName: 'מלון דן תל אביב',
    phone: '03-5202520',
    email: 'contact@danhotels.com',
    preferredChannel: 'מייל',
    city: 'תל אביב',
    status: 'פעיל',
    isActive: true,
  },
];

export const mockCustomers: Customer[] = [
  {
    customerId: 1,
    customerName: 'חברת ABC בע״מ',
    customerType: 'עסקי',
    primaryPhone: '03-1234567',
    primaryEmail: 'info@abc.co.il',
    city: 'תל אביב',
    status: 'פעיל',
    isActive: true,
  },
  {
    customerId: 2,
    customerName: 'וילה רמת אביב',
    customerType: 'פרטי',
    primaryPhone: '050-9876543',
    primaryEmail: 'villa@example.com',
    city: 'רמת אביב',
    status: 'פעיל',
    isActive: true,
  },
];

export const mockEmployees: Employee[] = [
  {
    employeeId: 1,
    fullName: 'רביב מעיני',
    primaryRole: 'מנכ״ל',
    email: 'raviv@manager2.co.il',
    phone: '050-0000001',
    isActive: true,
    isAssignable: true,
  },
  {
    employeeId: 2,
    fullName: 'שרה לוי',
    primaryRole: 'מנהלת פרויקטים',
    email: 'sara@manager2.co.il',
    phone: '050-0000002',
    isActive: true,
    isAssignable: true,
  },
];

export const mockProjects: ProjectListItem[] = [
  {
    workItemId: 1,
    projectNumber: 'P-1',
    title: 'פרויקט חשמל חכם - וילה רמת אביב',
    customerName: 'וילה רמת אביב',
    projectManagerName: 'שרה לוי',
    status: 'Execution',
    siteName: 'רמת אביב',
    billingType: 'Fixed',
    createdAt: '2025-01-10',
    dealCloseDate: '2025-01-05',
    financeProjectNumber: 'FIN-001',
    invoiceNumber: 'INV-001',
  },
  {
    workItemId: 2,
    projectNumber: 'P-2',
    title: 'שדרוג לוח חשמל - מלון דן',
    customerName: 'מלון דן תל אביב',
    projectManagerName: 'רביב מעיני',
    status: 'Planned',
    siteName: 'תל אביב',
    billingType: 'Hourly',
    createdAt: '2025-02-01',
  },
];

export const mockSites: Site[] = [
  {
    siteId: 1,
    customerId: 2,
    siteName: 'רמת אביב',
    city: 'תל אביב',
    isPrimary: true,
    createdAt: '2025-01-01',
  },
  {
    siteId: 2,
    customerId: 1,
    siteName: 'מרכז תל אביב',
    city: 'תל אביב',
    isPrimary: true,
    createdAt: '2025-01-01',
  },
];

export function mockProjectLifecycle(projectId: number): ProjectLifecycle {
  const project = mockProjects.find((item) => item.workItemId === projectId) ?? mockProjects[0];

  return {
    project: {
      workItemId: project.workItemId,
      title: project.title,
      description: 'תיאור פרויקט לדוגמה',
      status: project.status,
      billingType: project.billingType,
      customerId: project.workItemId === 1 ? 2 : 1,
      customerName: project.customerName,
      siteId: project.workItemId === 1 ? 1 : 2,
      siteName: project.siteName,
      createdAt: project.createdAt,
      dealCloseDate: project.dealCloseDate,
      financeProjectNumber: project.financeProjectNumber,
      invoiceNumber: project.invoiceNumber,
    },
    milestones: [
      {
        workItemId: 101,
        title: 'תכנון ראשוני',
        description: 'הכנת תוכניות',
        status: 'Closed',
        billingType: 'Internal',
        createdAt: '2025-01-11',
        plannedStart: '2025-01-11T08:00:00',
        plannedEnd: '2025-01-12T16:00:00',
        estimatedHours: 8,
        priority: 'High',
        requiredRole: 'מנהל פרויקט',
        isLocked: false,
      },
      {
        workItemId: 102,
        title: 'השחלת כבלים',
        description: 'עבודות השחלה',
        status: 'Execution',
        billingType: 'Fixed',
        createdAt: '2025-01-15',
        plannedStart: '2025-01-20T08:00:00',
        plannedEnd: '2025-01-25T16:00:00',
        estimatedHours: 24,
        priority: 'Medium',
        requiredRole: 'חשמלאי',
        isLocked: false,
      },
    ],
    assignments: [
      {
        workItemId: project.workItemId,
        employeeId: 2,
        assignmentType: 'employee',
        assignmentRole: 'project manager',
        assignedHours: 8,
        isManualAssignment: true,
        employeeName: 'שרה לוי',
      },
      {
        workItemId: project.workItemId,
        employeeId: 1,
        assignmentType: 'employee',
        assignmentRole: 'מבצע',
        assignedHours: 16,
        isManualAssignment: false,
        employeeName: 'רביב מעיני',
      },
    ],
    reports: [
      {
        workReportId: 1,
        workItemId: project.workItemId,
        reportType: 'Daily',
        reportDate: '2025-01-18',
        summary: 'עבודות השחלה התקדמו',
        reporterName: 'רביב מעיני',
        status: 'Approved',
        followUpRequired: false,
      },
    ],
    summary: {
      totalMilestones: 2,
      openMilestones: 1,
      closedMilestones: 1,
      lockedMilestones: 0,
      cancelledMilestones: 0,
      delayedMilestones: 0,
      invalidScheduleMilestones: 0,
      upcomingMilestones: 1,
      riskLevel: 'Low',
      healthStatus: 'Good',
      riskReason: '',
      progressPercent: 45,
      totalReports: 1,
      hasFollowUps: false,
    },
  };
}

export function mockProjectMilestones(projectId: number): ProjectMilestone[] {
  const lifecycle = mockProjectLifecycle(projectId);

  return lifecycle.milestones.map((milestone, index) => ({
    workItemId: milestone.workItemId,
    title: milestone.title,
    description: milestone.description,
    workType: 'Task',
    status: milestone.status,
    billingType: milestone.billingType,
    customerId: lifecycle.project.customerId,
    siteId: lifecycle.project.siteId,
    createdAt: milestone.createdAt,
    plannedStart: milestone.plannedStart,
    plannedEnd: milestone.plannedEnd,
    closedAt: milestone.closedAt,
    priority: milestone.priority,
    requiredRole: milestone.requiredRole,
    estimatedHours: milestone.estimatedHours,
    actualStart: index === 0 ? milestone.plannedStart : undefined,
    actualEnd: index === 0 ? milestone.plannedEnd : undefined,
    actualHours: index === 0 ? milestone.estimatedHours : undefined,
    isLocked: milestone.isLocked,
    employees: index === 1
      ? [{ employeeId: 1, employeeName: 'רביב מעיני', assignmentRole: 'מבצע' }]
      : [{ employeeId: 2, employeeName: 'שרה לוי', assignmentRole: 'מנהל פרויקט' }],
    contractors: [],
  }));
}

export const mockReports: WorkReportListItem[] = [
  {
    reportId: 1,
    workItemId: 1,
    projectTitle: 'פרויקט חשמל חכם',
    reportDate: '2025-01-18',
    status: 'מאושר',
    reportedByName: 'רביב מעיני',
  },
  {
    reportId: 2,
    workItemId: 2,
    projectTitle: 'שדרוג לוח חשמל',
    reportDate: '2025-01-20',
    status: 'טיוטה',
    reportedByName: 'שרה לוי',
  },
];

export const mockWorkPlanTasks = [
  {
    id: 'task-1',
    name: 'השחלת כבלים - קומה 1',
    start: '2025-01-20',
    end: '2025-01-25',
    progress: 60,
  },
  {
    id: 'task-2',
    name: 'התקנת לוח חשמל',
    start: '2025-01-26',
    end: '2025-02-02',
    progress: 20,
  },
];

export const mockWorkPlanEmployees = [
  {
    employeeId: 1,
    fullName: 'רביב מעיני',
    primaryRole: 'חשמלאי בכיר',
    dailyCapacityHours: 8,
    isAssignable: true,
    isActive: true,
  },
  {
    employeeId: 2,
    fullName: 'שרה לוי',
    primaryRole: 'מנהלת פרויקטים',
    dailyCapacityHours: 8,
    isAssignable: true,
    isActive: true,
  },
  {
    employeeId: 3,
    fullName: 'דני כהן',
    primaryRole: 'חשמלאי',
    dailyCapacityHours: 8,
    isAssignable: true,
    isActive: true,
  },
];

export const mockAllWorkPlans = [
  {
    project: { workItemId: 1, title: 'פרויקט חשמל חכם - וילה רמת אביב', status: 'ביצוע' },
    tasks: [
      {
        workItemId: 101,
        title: 'השחלת כבלים - קומה 1',
        status: 'בביצוע',
        estimatedHours: 6,
        priority: 'גבוה',
        plannedStart: '2025-01-20T08:00:00',
        plannedEnd: '2025-01-20T14:00:00',
        requiredRole: 'חשמלאי',
        isLocked: false,
        parentWorkItemId: 1,
      },
      {
        workItemId: 102,
        title: 'התקנת לוח חשמל',
        status: 'מתוכנן',
        estimatedHours: 4,
        priority: 'רגיל',
        plannedStart: '2025-01-21T09:00:00',
        plannedEnd: '2025-01-21T13:00:00',
        requiredRole: 'חשמלאי בכיר',
        isLocked: false,
        parentWorkItemId: 1,
      },
      {
        workItemId: 103,
        title: 'בדיקות סיום',
        status: 'מתוכנן',
        estimatedHours: 3,
        isLocked: true,
        parentWorkItemId: 1,
      },
    ],
    assignments: [
      {
        workItemId: 101,
        employeeId: 1,
        assignmentType: 'employee',
        assignmentRole: 'מבצע',
        assignedHours: 6,
        isManualAssignment: true,
        employeeName: 'רביב מעיני',
      },
      {
        workItemId: 102,
        employeeId: 3,
        assignmentType: 'employee',
        assignmentRole: 'מבצע',
        assignedHours: 4,
        isManualAssignment: false,
        employeeName: 'דני כהן',
      },
    ],
  },
  {
    project: { workItemId: 2, title: 'שדרוג לוח חשמל - מלון דן', status: 'תכנון' },
    tasks: [
      {
        workItemId: 201,
        title: 'סקר אתר',
        status: 'בביצוע',
        estimatedHours: 2,
        parentWorkItemId: 2,
        isLocked: false,
      },
      {
        workItemId: 202,
        title: 'הכנת הצעת מחיר',
        status: 'מתוכנן',
        estimatedHours: 3,
        parentWorkItemId: 2,
        isLocked: false,
      },
    ],
    assignments: [
      {
        workItemId: 201,
        employeeId: 2,
        assignmentType: 'employee',
        assignmentRole: 'מנהל פרויקט',
        assignedHours: 2,
        isManualAssignment: true,
        employeeName: 'שרה לוי',
      },
    ],
  },
];

export const mockSmartAssignmentResponse = {
  summary: {
    totalTasks: 5,
    tasksWithRecommendations: 3,
    violationsCount: 1,
    warningsCount: 2,
    message: 'נמצאו המלצות שיבוץ ל-3 משימות',
  },
  taskResults: [
    {
      workItemId: 103,
      taskTitle: 'בדיקות סיום',
      currentEmployeeId: null,
      currentEmployeeName: null,
      recommendedEmployeeId: 1,
      recommendedEmployeeName: 'רביב מעיני',
      score: 0.82,
      violations: [],
      warnings: ['משימה נעולה'],
      reasons: ['זמינות גבוהה', 'התאמת תפקיד'],
    },
  ],
  employeeLoad: [
    {
      employeeId: 1,
      employeeName: 'רביב מעיני',
      assignedHours: 6,
      capacityHours: 8,
      loadPercentage: 75,
    },
    {
      employeeId: 3,
      employeeName: 'דני כהן',
      assignedHours: 4,
      capacityHours: 8,
      loadPercentage: 50,
    },
  ],
};

export const mockQuotes = [
  { id: 'Q-001', customer: 'חברת ABC בע״מ', amount: 45000, status: 'ממתין' },
  { id: 'Q-002', customer: 'מלון דן', amount: 120000, status: 'אושר' },
];

export const mockInventory = [
  { id: 'INV-001', name: 'לוח חשמל 24 מודול', qty: 12, location: 'מחסן מרכז' },
  { id: 'INV-002', name: 'כבל 3x2.5', qty: 500, location: 'מחסן צפון' },
];

export const mockServiceCalls: ServiceCallListItem[] = [
  {
    workItemId: 2455,
    title: 'תקלה במערכת חשמל חכם',
    description: 'בדיקת תקלה בבית הלקוח',
    workType: 'ServiceCall',
    customerId: 2,
    customerName: 'וילה רמת אביב',
    siteId: 1,
    siteName: 'רמת אביב',
    status: 'Open',
    billingType: 'Hourly',
    priority: 'High',
    plannedStart: '2026-06-02T09:00:00',
    plannedEnd: '2026-06-02T12:00:00',
    estimatedHours: 3,
    requiredRole: 'טכנאי',
    isLocked: false,
    createdAt: '2026-06-01T10:00:00',
    closedAt: null,
  },
  {
    workItemId: 2456,
    title: 'החלפת בקר תקשורת',
    workType: 'ServiceCall',
    customerId: 1,
    customerName: 'חברת ABC בע״מ',
    siteId: 2,
    siteName: 'מרכז תל אביב',
    status: 'InProgress',
    billingType: 'Warranty',
    priority: 'Medium',
    plannedStart: '2026-06-03T10:00:00',
    plannedEnd: '2026-06-03T13:00:00',
    estimatedHours: 2,
    requiredRole: 'מתקין',
    isLocked: false,
    createdAt: '2026-06-01T14:00:00',
    closedAt: null,
  },
];

export const mockCashflowItems = [
  { month: 'ינואר 2025', income: 180000, expenses: 95000 },
  { month: 'פברואר 2025', income: 210000, expenses: 110000 },
];

export function delayMock<T>(data: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}
