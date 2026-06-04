import { apiRequest } from '@api/client';
import type {
  CreateMilestoneRequest,
  CreateProjectBoqItemRequest,
  CreateProjectEquipmentItemRequest,
  CreateProjectRequest,
  CreateSiteRequest,
  ProjectEmployeeOption,
  ProjectBoqItem,
  ProjectEquipmentItem,
  ProjectLifecycle,
  ProjectListItem,
  ProjectMilestone,
  ReorderProjectBoqRequest,
  ReorderProjectEquipmentRequest,
  SyncProjectEmployeeAssignmentsRequest,
  Site,
  UpdateMilestoneRequest,
  UpdateProjectBoqItemRequest,
  UpdateProjectEquipmentItemRequest,
  UpdateProjectRequest,
} from '../types';

interface RawEmployeeResponse {
  employeeId?: number;
  fullName?: string;
  primaryRole?: string;
  isActive?: boolean;
}

interface RawProjectEquipmentItemResponse {
  projectEquipmentItemId: number;
  projectId: number;
  equipmentName: string;
  status: string;
  location?: string | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string | null;
}

interface RawProjectBoqItemResponse {
  projectBoqItemId: number;
  projectId: number;
  systemName?: string | null;
  itemDescription: string;
  quantity: number;
  unit: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string | null;
}

function mapProjectBoqItem(boqItem: RawProjectBoqItemResponse): ProjectBoqItem {
  return {
    projectBoqItemId: boqItem.projectBoqItemId,
    projectId: boqItem.projectId,
    systemName: boqItem.systemName ?? undefined,
    itemDescription: boqItem.itemDescription,
    quantity: boqItem.quantity,
    unit: boqItem.unit,
    sortOrder: boqItem.sortOrder,
    createdAt: boqItem.createdAt,
    updatedAt: boqItem.updatedAt ?? undefined,
  };
}

function mapProjectEquipmentItem(
  equipmentItem: RawProjectEquipmentItemResponse,
): ProjectEquipmentItem {
  return {
    projectEquipmentItemId: equipmentItem.projectEquipmentItemId,
    projectId: equipmentItem.projectId,
    name: equipmentItem.equipmentName,
    status: equipmentItem.status,
    location: equipmentItem.location ?? '',
    sortOrder: equipmentItem.sortOrder,
    createdAt: equipmentItem.createdAt,
    updatedAt: equipmentItem.updatedAt ?? undefined,
  };
}

export function getProjectsListAsync(): Promise<ProjectListItem[]> {
  return apiRequest<ProjectListItem[]>('/WorkItems/projects-list');
}

export function getProjectLifecycleAsync(projectId: number): Promise<ProjectLifecycle> {
  return apiRequest<ProjectLifecycle>(`/Projects/${projectId}/lifecycle`);
}

export function getProjectMilestonesAsync(projectId: number): Promise<ProjectMilestone[]> {
  return apiRequest<ProjectMilestone[]>(`/WorkItems/${projectId}/milestones`);
}

export function getProjectEquipmentAsync(projectId: number): Promise<ProjectEquipmentItem[]> {
  return apiRequest<RawProjectEquipmentItemResponse[]>(
    `/Projects/${projectId}/equipment`,
  ).then((equipmentItems) => equipmentItems.map(mapProjectEquipmentItem));
}

export function getProjectBoqAsync(projectId: number): Promise<ProjectBoqItem[]> {
  return apiRequest<RawProjectBoqItemResponse[]>(`/Projects/${projectId}/boq`).then(
    (boqItems) => boqItems.map(mapProjectBoqItem),
  );
}

export function createProjectAsync(body: CreateProjectRequest): Promise<{ workItemId: number }> {
  return apiRequest<{ workItemId: number; message: string }>('/WorkItems/project', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateProjectAsync(
  projectId: number,
  body: UpdateProjectRequest,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/WorkItems/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function createMilestoneAsync(
  projectId: number,
  body: CreateMilestoneRequest,
): Promise<{ workItemId: number }> {
  return apiRequest<{ workItemId: number; message: string }>(
    `/WorkItems/${projectId}/milestones`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export function updateMilestoneAsync(
  milestoneId: number,
  body: UpdateMilestoneRequest,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/WorkItems/milestones/${milestoneId}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function cancelMilestoneAsync(milestoneId: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/WorkItems/milestones/${milestoneId}/cancel`, {
    method: 'PUT',
  });
}

export function createProjectEquipmentAsync(
  projectId: number,
  body: CreateProjectEquipmentItemRequest,
): Promise<ProjectEquipmentItem> {
  return apiRequest<RawProjectEquipmentItemResponse>(`/Projects/${projectId}/equipment`, {
    method: 'POST',
    body: JSON.stringify(body),
  }).then(mapProjectEquipmentItem);
}

export function createProjectBoqItemAsync(
  projectId: number,
  body: CreateProjectBoqItemRequest,
): Promise<ProjectBoqItem> {
  return apiRequest<RawProjectBoqItemResponse>(`/Projects/${projectId}/boq`, {
    method: 'POST',
    body: JSON.stringify(body),
  }).then(mapProjectBoqItem);
}

export function updateProjectBoqItemAsync(
  projectId: number,
  boqItemId: number,
  body: UpdateProjectBoqItemRequest,
): Promise<ProjectBoqItem> {
  return apiRequest<RawProjectBoqItemResponse>(
    `/Projects/${projectId}/boq/${boqItemId}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  ).then(mapProjectBoqItem);
}

export function deleteProjectBoqItemAsync(
  projectId: number,
  boqItemId: number,
): Promise<void> {
  return apiRequest<void>(`/Projects/${projectId}/boq/${boqItemId}`, {
    method: 'DELETE',
  });
}

export function reorderProjectBoqAsync(
  projectId: number,
  body: ReorderProjectBoqRequest,
): Promise<void> {
  return apiRequest<void>(`/Projects/${projectId}/boq/order`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function updateProjectEquipmentAsync(
  projectId: number,
  equipmentItemId: number,
  body: UpdateProjectEquipmentItemRequest,
): Promise<ProjectEquipmentItem> {
  return apiRequest<RawProjectEquipmentItemResponse>(
    `/Projects/${projectId}/equipment/${equipmentItemId}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  ).then(mapProjectEquipmentItem);
}

export function deleteProjectEquipmentAsync(
  projectId: number,
  equipmentItemId: number,
): Promise<void> {
  return apiRequest<void>(`/Projects/${projectId}/equipment/${equipmentItemId}`, {
    method: 'DELETE',
  });
}

export function reorderProjectEquipmentAsync(
  projectId: number,
  body: ReorderProjectEquipmentRequest,
): Promise<void> {
  return apiRequest<void>(`/Projects/${projectId}/equipment/order`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function getSitesAsync(): Promise<Site[]> {
  return apiRequest<Site[]>('/Sites');
}

export function createSiteAsync(body: CreateSiteRequest): Promise<Site> {
  return apiRequest<Site>('/Sites', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getProjectEmployeesAsync(): Promise<ProjectEmployeeOption[]> {
  return apiRequest<RawEmployeeResponse[]>('/Employees').then((employees) =>
    employees
      .filter((employee) => employee.employeeId != null && employee.fullName)
      .map((employee) => ({
        employeeId: employee.employeeId!,
        fullName: employee.fullName!,
        primaryRole: employee.primaryRole,
        isActive: employee.isActive,
      })),
  );
}

export function assignEmployeeToProjectAsync(
  projectId: number,
  employeeId: number,
  assignmentRole: string,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/WorkItems/${projectId}/assign-employee`, {
    method: 'POST',
    body: JSON.stringify({ employeeId, assignmentRole }),
  });
}

export function syncProjectEmployeeAssignmentsAsync(
  projectId: number,
  body: SyncProjectEmployeeAssignmentsRequest,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/WorkItems/${projectId}/employee-assignments`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}
