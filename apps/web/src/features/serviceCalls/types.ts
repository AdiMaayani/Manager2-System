export interface ServiceCallListItem {
  workItemId: number;
  title: string;
  description?: string | null;
  workType: string;
  status: string;
  billingType?: string | null;
  customerId: number;
  customerName?: string | null;
  siteId: number;
  siteName?: string | null;
  priority?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  estimatedHours?: number | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  actualHours?: number | null;
  requiredRole?: string | null;
  isLocked: boolean;
  createdAt: string;
  closedAt?: string | null;
}

export type ServiceCallDetails = ServiceCallListItem;

export interface UpsertServiceCallRequest {
  title: string;
  description?: string | null;
  status: string;
  billingType: string;
  customerId: number;
  siteId: number;
  priority?: string | null;
  plannedStart?: string | null;
  plannedEnd?: string | null;
  estimatedHours?: number | null;
  actualStart?: string | null;
  actualEnd?: string | null;
  actualHours?: number | null;
  requiredRole?: string | null;
  isLocked: boolean;
}

export interface AssignServiceCallEmployeeRequest {
  employeeId: number;
  assignmentRole: string;
}

export interface ServiceCallCustomerOption {
  customerId: number;
  customerName: string;
  isActive?: boolean;
}

export interface ServiceCallSiteOption {
  siteId: number;
  customerId: number;
  siteName: string;
  city?: string | null;
  isPrimary?: boolean;
}

export interface ServiceCallEmployeeOption {
  employeeId: number;
  fullName: string;
  primaryRole?: string | null;
  isActive?: boolean;
  isAssignable?: boolean;
}
