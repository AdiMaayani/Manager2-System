import { apiBlobRequest, apiRequest } from '@api/client';
import type {
  CreateMilestoneRequest,
  CreateProjectBoqItemRequest,
  CreateProjectDrawingRequest,
  CreateProjectEquipmentItemRequest,
  CreateProjectRequest,
  CreateSiteRequest,
  ProjectEmployeeOption,
  ProjectBoqItem,
  ProjectDrawing,
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
  UpdateProjectDrawingRequest,
  UpdateProjectEquipmentItemRequest,
  UpdateProjectRequest,
  UpdateSiteRequest,
  UploadProjectDrawingRequest,
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
  inventoryItemId?: number | null;
  inventorySkuCode?: string | null;
  inventoryItemName?: string | null;
  inventoryCategory?: string | null;
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
  inventoryItemId?: number | null;
  inventorySkuCode?: string | null;
  inventoryItemName?: string | null;
  inventoryCategory?: string | null;
  itemDescription: string;
  quantity: number;
  unit: string;
  unitPrice?: number | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string | null;
}

interface RawProjectDrawingResponse {
  projectDrawingId: number;
  projectId: number;
  name: string;
  type: 'PDF' | 'DWG';
  drawingDate: string;
  note?: string | null;
  originalFileName?: string | null;
  storedFileName?: string | null;
  filePath?: string | null;
  contentType?: string | null;
  fileSizeBytes?: number | null;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string | null;
}

function mapProjectBoqItem(boqItem: RawProjectBoqItemResponse): ProjectBoqItem {
  return {
    projectBoqItemId: boqItem.projectBoqItemId,
    projectId: boqItem.projectId,
    systemName: boqItem.systemName ?? undefined,
    inventoryItemId: boqItem.inventoryItemId ?? undefined,
    inventorySkuCode: boqItem.inventorySkuCode ?? undefined,
    inventoryItemName: boqItem.inventoryItemName ?? undefined,
    inventoryCategory: boqItem.inventoryCategory ?? undefined,
    itemDescription: boqItem.itemDescription,
    quantity: boqItem.quantity,
    unit: boqItem.unit,
    unitPrice: boqItem.unitPrice ?? undefined,
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
    inventoryItemId: equipmentItem.inventoryItemId ?? undefined,
    inventorySkuCode: equipmentItem.inventorySkuCode ?? undefined,
    inventoryItemName: equipmentItem.inventoryItemName ?? undefined,
    inventoryCategory: equipmentItem.inventoryCategory ?? undefined,
    name: equipmentItem.equipmentName,
    status: equipmentItem.status,
    location: equipmentItem.location ?? '',
    sortOrder: equipmentItem.sortOrder,
    createdAt: equipmentItem.createdAt,
    updatedAt: equipmentItem.updatedAt ?? undefined,
  };
}

function mapProjectDrawing(drawing: RawProjectDrawingResponse): ProjectDrawing {
  return {
    projectDrawingId: drawing.projectDrawingId,
    projectId: drawing.projectId,
    name: drawing.name,
    type: drawing.type,
    date: drawing.drawingDate,
    note: drawing.note ?? undefined,
    originalFileName: drawing.originalFileName ?? undefined,
    storedFileName: drawing.storedFileName ?? undefined,
    filePath: drawing.filePath ?? undefined,
    contentType: drawing.contentType ?? undefined,
    fileSizeBytes: drawing.fileSizeBytes ?? undefined,
    sortOrder: drawing.sortOrder,
    createdAt: drawing.createdAt,
    updatedAt: drawing.updatedAt ?? undefined,
  };
}

export function getProjectsListAsync(): Promise<ProjectListItem[]> {
  return apiRequest<ProjectListItem[]>('/WorkItems/projects-list');
}

export function getProjectLifecycleAsync(projectId: number): Promise<ProjectLifecycle> {
  return apiRequest<ProjectLifecycle>(`/Projects/${projectId}/lifecycle`);
}

export function getProjectMilestonesAsync(projectId: number): Promise<ProjectMilestone[]> {
  return apiRequest<ProjectMilestone[]>(`/Projects/${projectId}/milestones`).then((milestones) =>
    milestones.map((milestone) => ({
      ...milestone,
      milestoneId:
        milestone.milestoneId ??
        milestone.projectMilestoneId ??
        milestone.workItemId ??
        0,
      projectMilestoneId:
        milestone.projectMilestoneId ??
        milestone.milestoneId ??
        milestone.workItemId ??
        0,
    })),
  );
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

export function getProjectDrawingsAsync(projectId: number): Promise<ProjectDrawing[]> {
  return apiRequest<RawProjectDrawingResponse[]>(`/Projects/${projectId}/drawings`).then(
    (drawings) => drawings.map(mapProjectDrawing),
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

function mapCreateMilestoneBody(body: CreateMilestoneRequest) {
  return {
    title: body.title,
    description: body.description,
    status: body.status,
    managerEmployeeId: body.managerEmployeeId,
    plannedStart: body.plannedStart,
    plannedEnd: body.plannedEnd,
    sortOrder: body.sortOrder,
  };
}

function mapUpdateMilestoneBody(body: UpdateMilestoneRequest) {
  return {
    title: body.title,
    description: body.description,
    status: body.status,
    managerEmployeeId: body.managerEmployeeId,
    plannedStart: body.plannedStart,
    plannedEnd: body.plannedEnd,
    actualStart: body.actualStart,
    actualEnd: body.actualEnd,
    progressPercent: body.progressPercent,
    sortOrder: body.sortOrder,
  };
}

export function createMilestoneAsync(
  projectId: number,
  body: CreateMilestoneRequest,
): Promise<{ milestoneId: number }> {
  return apiRequest<{ milestoneId: number; message: string }>(
    `/Projects/${projectId}/milestones`,
    {
      method: 'POST',
      body: JSON.stringify(mapCreateMilestoneBody(body)),
    },
  );
}

export function updateMilestoneAsync(
  projectId: number,
  milestoneId: number,
  body: UpdateMilestoneRequest,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(
    `/Projects/${projectId}/milestones/${milestoneId}`,
    {
      method: 'PUT',
      body: JSON.stringify(mapUpdateMilestoneBody(body)),
    },
  );
}

export function deactivateMilestoneAsync(
  projectId: number,
  milestoneId: number,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(
    `/Projects/${projectId}/milestones/${milestoneId}/deactivate`,
    { method: 'PUT' },
  );
}

export function reorderProjectMilestonesAsync(
  projectId: number,
  items: { projectMilestoneId: number; sortOrder: number }[],
): Promise<void> {
  return apiRequest<void>(`/Projects/${projectId}/milestones/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ items }),
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

export function createProjectDrawingAsync(
  projectId: number,
  body: CreateProjectDrawingRequest,
): Promise<ProjectDrawing> {
  return apiRequest<RawProjectDrawingResponse>(`/Projects/${projectId}/drawings`, {
    method: 'POST',
    body: JSON.stringify(body),
  }).then(mapProjectDrawing);
}

export function uploadProjectDrawingAsync(
  projectId: number,
  body: UploadProjectDrawingRequest,
): Promise<ProjectDrawing> {
  const formData = new FormData();
  formData.append('name', body.name);
  formData.append('type', body.type);
  formData.append('drawingDate', body.drawingDate);
  formData.append('sortOrder', String(body.sortOrder ?? 0));
  if (body.note) {
    formData.append('note', body.note);
  }
  formData.append('file', body.file);

  return apiRequest<RawProjectDrawingResponse>(`/Projects/${projectId}/drawings/upload`, {
    method: 'POST',
    body: formData,
  }).then(mapProjectDrawing);
}

export function downloadProjectDrawingFileAsync(
  projectId: number,
  projectDrawingId: number,
): Promise<Blob> {
  return apiBlobRequest(`/Projects/${projectId}/drawings/${projectDrawingId}/file`);
}

export function updateProjectDrawingAsync(
  projectId: number,
  projectDrawingId: number,
  body: UpdateProjectDrawingRequest,
): Promise<ProjectDrawing> {
  return apiRequest<RawProjectDrawingResponse>(
    `/Projects/${projectId}/drawings/${projectDrawingId}`,
    {
      method: 'PUT',
      body: JSON.stringify(body),
    },
  ).then(mapProjectDrawing);
}

export function deleteProjectDrawingAsync(
  projectId: number,
  projectDrawingId: number,
): Promise<void> {
  return apiRequest<void>(`/Projects/${projectId}/drawings/${projectDrawingId}`, {
    method: 'DELETE',
  });
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

export function updateSiteAsync(siteId: number, body: UpdateSiteRequest): Promise<Site> {
  return apiRequest<Site>(`/Sites/${siteId}`, {
    method: 'PUT',
    body: JSON.stringify({ ...body, siteId }),
  });
}

export function deactivateSiteAsync(siteId: number): Promise<void> {
  return apiRequest<void>(`/Sites/${siteId}`, {
    method: 'DELETE',
  });
}

export function getProjectEmployeesAsync(): Promise<ProjectEmployeeOption[]> {
  return apiRequest<RawEmployeeResponse[]>('/Employees/lookup').then((employees) =>
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
