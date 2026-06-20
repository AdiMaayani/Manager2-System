import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from '@shared/components/Drawer';
import { Tabs } from '@shared/components/Tabs';
import type { TabItem } from '@shared/components/Tabs';
import { Button } from '@shared/components/Button';
import { ErrorState } from '@shared/components/ErrorState';
import { InlineAlert } from '@shared/components/InlineAlert';
import { PageSpinner } from '@shared/components/PageSpinner';
import {
  useAssignProjectTeam,
  useCreateProject,
  useMilestoneMutations,
  useProjectLifecycle,
  useProjectLookups,
  teamFormFromProjectAssignments,
  useUpdateProject,
  buildProjectTeamAssignments,
} from '../../hooks/useProjectLifecycle';
import {
  buildProjectEquipmentReorderRequest,
  useProjectEquipment,
  useProjectEquipmentMutations,
} from '../../hooks/useProjectEquipment';
import {
  buildProjectBoqReorderRequest,
  useProjectBoq,
  useProjectBoqMutations,
} from '../../hooks/useProjectBoq';
import {
  useProjectDrawingMutations,
  useProjectDrawings,
} from '../../hooks/useProjectDrawings';
import type {
  CreateProjectBoqItemRequest,
  CreateProjectDrawingRequest,
  CreateProjectEquipmentItemRequest,
  ProjectBoqItem,
  ProjectDrawerMode,
  ProjectDrawerTabId,
  ProjectEquipmentItem,
  ProjectOverviewForm,
  ProjectTeamForm,
  UpdateProjectBoqItemRequest,
  UpdateProjectDrawingRequest,
  UpdateProjectEquipmentItemRequest,
  UploadProjectDrawingRequest,
} from '../../types';
import {
  deactivateSiteAsync,
  syncProjectEmployeeAssignmentsAsync,
} from '../../api/projectsApiClient';
import {
  createSiteWithAddressProfileAsync,
  updateSiteWithAddressProfileAsync,
  type UpsertAddressProfileRequest,
} from '@features/geo';
import {
  createEmptyOverviewForm,
  overviewFormFromLifecycle,
} from '../../utils/projectDisplayUtils';
import { ProjectBoqTab } from './components/ProjectBoqTab';
import { ProjectDrawingsTab } from './components/ProjectDrawingsTab';
import { ProjectEquipmentTab } from './components/ProjectEquipmentTab';
import { ProjectMilestonesTab } from './components/ProjectMilestonesTab';
import { ProjectOverviewTab } from './components/ProjectOverviewTab';
import { ProjectQuoteTab } from './components/ProjectQuoteTab';
import { ProjectSummaryCard } from './components/ProjectSummaryCard';
import './ProjectDrawer.css';

const DRAWER_TABS: TabItem[] = [
  { id: 'overview', label: 'סקירה' },
  { id: 'milestones', label: 'אבני דרך' },
  { id: 'quote', label: 'הצעת מחיר' },
  { id: 'boq', label: 'כתב כמויות' },
  { id: 'drawings', label: 'שרטוטים' },
  { id: 'equipment', label: 'ציוד' },
];

function normalizeProjectTeamForm(teamForm: ProjectTeamForm): ProjectTeamForm {
  const teamEmployeeIds = teamForm.teamEmployeeIds.filter(
    (employeeId, index, employeeIds) =>
      employeeId !== teamForm.projectManagerEmployeeId &&
      employeeIds.indexOf(employeeId) === index,
  );

  return {
    projectManagerEmployeeId: teamForm.projectManagerEmployeeId,
    teamEmployeeIds,
  };
}

interface ProjectDrawerProps {
  projectId: number | null;
  mode: ProjectDrawerMode;
  initialTab?: ProjectDrawerTabId;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (projectId: number) => void;
  onActiveTabChange?: (tabId: ProjectDrawerTabId) => void;
}

export function ProjectDrawer({
  projectId,
  mode,
  initialTab = 'overview',
  isOpen,
  onClose,
  onSaved,
  onActiveTabChange,
}: ProjectDrawerProps) {
  const isCreateMode = mode === 'create';
  const [activeTab, setActiveTab] = useState<ProjectDrawerTabId>(initialTab);
  const [isEditMode, setIsEditMode] = useState(isCreateMode);
  const [isMaximized, setIsMaximized] = useState(false);
  const [overviewForm, setOverviewForm] = useState<ProjectOverviewForm>(
    createEmptyOverviewForm(),
  );
  const [teamForm, setTeamForm] = useState<ProjectTeamForm>({
    projectManagerEmployeeId: null,
    teamEmployeeIds: [],
  });
  const [initialTeamForm, setInitialTeamForm] = useState<ProjectTeamForm>({
    projectManagerEmployeeId: null,
    teamEmployeeIds: [],
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const isEditModeRef = useRef(isEditMode);
  const lastResetKeyRef = useRef<string | null>(null);

  const lifecycleQuery = useProjectLifecycle(
    isCreateMode ? null : projectId,
    !isEditMode,
  );
  const lookups = useProjectLookups();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const milestoneMutations = useMilestoneMutations(projectId);
  const assignProjectTeam = useAssignProjectTeam(projectId);
  const createMilestoneAsync = milestoneMutations.createMutation.mutateAsync;
  const updateMilestoneAsync = milestoneMutations.updateMutation.mutateAsync;
  const deactivateMilestoneAsync = milestoneMutations.deactivateMutation.mutateAsync;
  const boqQuery = useProjectBoq(isCreateMode ? null : projectId, isOpen);
  const boqMutations = useProjectBoqMutations(projectId);
  const drawingsQuery = useProjectDrawings(isCreateMode ? null : projectId, isOpen);
  const drawingMutations = useProjectDrawingMutations(projectId);
  const equipmentQuery = useProjectEquipment(isCreateMode ? null : projectId, isOpen);
  const equipmentMutations = useProjectEquipmentMutations(projectId);
  const refetchLookups = lookups.refetch;

  useEffect(() => {
    isEditModeRef.current = isEditMode;
  }, [isEditMode]);

  useEffect(() => {
    if (!isOpen) {
      lastResetKeyRef.current = null;
      return;
    }

    const resetKey = `${isCreateMode ? 'create' : 'view'}:${projectId ?? 'new'}`;
    if (lastResetKeyRef.current === resetKey) return;
    lastResetKeyRef.current = resetKey;

    let isCancelled = false;

    const nextTab = DRAWER_TABS.some((tab) => tab.id === initialTab)
      ? initialTab
      : 'overview';

    queueMicrotask(() => {
      if (isCancelled) return;

      setActiveTab(nextTab);
      setIsEditMode(isCreateMode);
      setIsMaximized(false);
      setSaveError(null);

      if (isCreateMode) {
        setOverviewForm(createEmptyOverviewForm());
        const emptyTeam = { projectManagerEmployeeId: null, teamEmployeeIds: [] };
        setTeamForm(emptyTeam);
        setInitialTeamForm(emptyTeam);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [isOpen, isCreateMode, initialTab, projectId]);

  useEffect(() => {
    if (!isOpen) return;
    if (!DRAWER_TABS.some((tab) => tab.id === initialTab)) return;
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (lifecycleQuery.data && !isCreateMode && !isEditModeRef.current) {
      let isCancelled = false;
      const nextOverviewForm = overviewFormFromLifecycle(lifecycleQuery.data);
      const nextTeamForm = teamFormFromProjectAssignments(lifecycleQuery.data);

      queueMicrotask(() => {
        if (isCancelled || isEditModeRef.current) return;

        setOverviewForm(nextOverviewForm);
        setTeamForm(nextTeamForm);
        setInitialTeamForm(nextTeamForm);
      });

      return () => {
        isCancelled = true;
      };
    }

    return undefined;
  }, [lifecycleQuery.data, isCreateMode]);

  const lifecycle = lifecycleQuery.data ?? null;
  const title =
    isCreateMode ? 'פרויקט חדש' : lifecycle?.project.title ?? 'פרטי פרויקט';

  const handleCancelEdit = useCallback(() => {
    if (isCreateMode) {
      onClose();
      return;
    }

    setOverviewForm(overviewFormFromLifecycle(lifecycle));
    setTeamForm(initialTeamForm);
    setIsEditMode(false);
    setSaveError(null);
  }, [initialTeamForm, isCreateMode, lifecycle, onClose]);

  const handleCreateProjectSite = useCallback(
    async (payload: {
      customerId: number;
      siteName: string;
      notes?: string;
      isPrimary?: boolean;
      addressProfile?: UpsertAddressProfileRequest;
    }) => {
      const saved = await createSiteWithAddressProfileAsync({
        customerId: payload.customerId,
        siteName: payload.siteName,
        isPrimary: payload.isPrimary ?? false,
        notes: payload.notes,
        addressProfile: payload.addressProfile,
      });
      setOverviewForm((current) => ({ ...current, siteId: saved.siteId }));
      await refetchLookups();
    },
    [refetchLookups],
  );

  const handleUpdateProjectSite = useCallback(
    async (
      siteId: number,
      payload: {
        customerId: number;
        siteName: string;
        notes?: string;
        isPrimary?: boolean;
        addressProfile?: UpsertAddressProfileRequest;
      },
    ) => {
      await updateSiteWithAddressProfileAsync(siteId, {
        siteId,
        customerId: payload.customerId,
        siteName: payload.siteName,
        isPrimary: payload.isPrimary ?? false,
        notes: payload.notes,
        addressProfile: payload.addressProfile,
      });
      await refetchLookups();
    },
    [refetchLookups],
  );

  const handleDeactivateProjectSite = useCallback(
    async (siteId: number) => {
      await deactivateSiteAsync(siteId);
      if (overviewForm.siteId === siteId) {
        setOverviewForm((current) => ({ ...current, siteId: 0 }));
      }
      await refetchLookups();
    },
    [overviewForm.siteId, refetchLookups],
  );

  const handleCreateMilestone = useCallback(
    async (body: Parameters<typeof createMilestoneAsync>[0]) => {
      await createMilestoneAsync(body);
    },
    [createMilestoneAsync],
  );

  const handleUpdateMilestone = useCallback(
    async (
      milestoneId: number,
      body: Parameters<typeof updateMilestoneAsync>[0]['body'],
    ) => {
      await updateMilestoneAsync({ milestoneId, body });
    },
    [updateMilestoneAsync],
  );

  const handleCancelMilestone = useCallback(
    async (milestoneId: number) => {
      await deactivateMilestoneAsync(milestoneId);
    },
    [deactivateMilestoneAsync],
  );

  const handleReorderMilestones = useCallback(
    async (items: { projectMilestoneId: number; sortOrder: number }[]) => {
      await milestoneMutations.reorderMutation.mutateAsync(items);
    },
    [milestoneMutations.reorderMutation],
  );

  const handleCreateBoqItem = useCallback(
    async (body: CreateProjectBoqItemRequest) => {
      await boqMutations.createMutation.mutateAsync(body);
    },
    [boqMutations.createMutation],
  );

  const handleUpdateBoqItem = useCallback(
    async (boqItemId: number, body: UpdateProjectBoqItemRequest) => {
      await boqMutations.updateMutation.mutateAsync({
        boqItemId,
        body,
      });
    },
    [boqMutations.updateMutation],
  );

  const handleDeleteBoqItem = useCallback(
    async (boqItemId: number) => {
      await boqMutations.deleteMutation.mutateAsync(boqItemId);
    },
    [boqMutations.deleteMutation],
  );

  const handleReorderBoqItems = useCallback(
    async (boqItems: ProjectBoqItem[]) => {
      await boqMutations.reorderMutation.mutateAsync(
        buildProjectBoqReorderRequest(boqItems),
      );
    },
    [boqMutations.reorderMutation],
  );

  const handleCreateDrawing = useCallback(
    async (body: CreateProjectDrawingRequest) => {
      await drawingMutations.createMutation.mutateAsync(body);
    },
    [drawingMutations.createMutation],
  );

  const handleUploadDrawing = useCallback(
    async (body: UploadProjectDrawingRequest) => {
      await drawingMutations.uploadMutation.mutateAsync(body);
    },
    [drawingMutations.uploadMutation],
  );

  const handleUpdateDrawing = useCallback(
    async (projectDrawingId: number, body: UpdateProjectDrawingRequest) => {
      await drawingMutations.updateMutation.mutateAsync({
        projectDrawingId,
        body,
      });
    },
    [drawingMutations.updateMutation],
  );

  const handleDeleteDrawing = useCallback(
    async (projectDrawingId: number) => {
      await drawingMutations.deleteMutation.mutateAsync(projectDrawingId);
    },
    [drawingMutations.deleteMutation],
  );

  const handleCreateEquipment = useCallback(
    async (body: CreateProjectEquipmentItemRequest) => {
      await equipmentMutations.createMutation.mutateAsync(body);
    },
    [equipmentMutations.createMutation],
  );

  const handleUpdateEquipment = useCallback(
    async (equipmentItemId: number, body: UpdateProjectEquipmentItemRequest) => {
      await equipmentMutations.updateMutation.mutateAsync({
        equipmentItemId,
        body,
      });
    },
    [equipmentMutations.updateMutation],
  );

  const handleDeleteEquipment = useCallback(
    async (equipmentItemId: number) => {
      await equipmentMutations.deleteMutation.mutateAsync(equipmentItemId);
    },
    [equipmentMutations.deleteMutation],
  );

  const handleReorderEquipment = useCallback(
    async (equipmentItems: ProjectEquipmentItem[]) => {
      await equipmentMutations.reorderMutation.mutateAsync(
        buildProjectEquipmentReorderRequest(equipmentItems),
      );
    },
    [equipmentMutations.reorderMutation],
  );

  const handleSaveProject = useCallback(async () => {
    setSaveError(null);

    if (!overviewForm.title.trim()) {
      setSaveError('שם הפרויקט הוא שדה חובה.');
      return;
    }

    if (!overviewForm.customerId || !overviewForm.siteId) {
      setSaveError('יש לבחור לקוח ואתר.');
      return;
    }

    try {
      if (isCreateMode) {
        const normalizedTeamForm = normalizeProjectTeamForm(teamForm);
        const result = await createProject.mutateAsync({
          title: overviewForm.title.trim(),
          description: overviewForm.description.trim() || undefined,
          status: overviewForm.status,
          billingType: overviewForm.billingType,
          customerId: overviewForm.customerId,
          siteId: overviewForm.siteId,
          dealCloseDate: overviewForm.dealCloseDate || undefined,
          financeProjectNumber: overviewForm.financeProjectNumber.trim() || undefined,
          invoiceNumber: overviewForm.invoiceNumber.trim() || undefined,
        });

        const newProjectId = result.workItemId;
        await syncProjectEmployeeAssignmentsAsync(
          newProjectId,
          buildProjectTeamAssignments(normalizedTeamForm),
        );

        setIsEditMode(false);
        onSaved(newProjectId);
        return;
      }

      if (projectId == null || !lifecycle) return;

      await updateProject.mutateAsync({
        projectId,
        body: {
          workItemId: projectId,
          title: overviewForm.title.trim(),
          description: overviewForm.description.trim() || undefined,
          workType: 'Project',
          billingType: overviewForm.billingType,
          status: overviewForm.status,
          customerId: overviewForm.customerId,
          siteId: overviewForm.siteId,
          createdAt: overviewForm.createdAt || lifecycle.project.createdAt,
          closedAt: lifecycle.project.closedAt ?? null,
          parentWorkItemId: null,
          dealCloseDate: overviewForm.dealCloseDate || null,
          financeProjectNumber: overviewForm.financeProjectNumber.trim() || undefined,
          invoiceNumber: overviewForm.invoiceNumber.trim() || undefined,
        },
      });

      const normalizedTeamForm = normalizeProjectTeamForm(teamForm);
      await assignProjectTeam.mutateAsync(normalizedTeamForm);

      setIsEditMode(false);
      setTeamForm(normalizedTeamForm);
      setInitialTeamForm(normalizedTeamForm);
      onSaved(projectId);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'שמירת הפרויקט נכשלה.');
    }
  }, [
    assignProjectTeam,
    createProject,
    isCreateMode,
    lifecycle,
    onSaved,
    overviewForm,
    projectId,
    teamForm,
    updateProject,
  ]);

  const isSavingProject =
    createProject.isPending || updateProject.isPending || assignProjectTeam.isPending;

  const headerActions = useMemo(() => (
    <div className="projectDrawer__headerActions">
      {isCreateMode && (
        <span className="projectDrawer__editIndicator">מצב יצירה</span>
      )}
      {isEditMode && !isCreateMode && (
        <span className="projectDrawer__editIndicator">מצב עריכה</span>
      )}
      {!isEditMode && !isCreateMode && (
        <Button type="button" variant="secondary" onClick={() => setIsEditMode(true)}>
          ערוך פרטים
        </Button>
      )}
    </div>
  ), [isCreateMode, isEditMode]);

  const footerActions = useMemo(() => {
    if (!isEditMode) return null;

    return (
      <>
        <span className="projectDrawer__footerHint">
          {isCreateMode
            ? 'מלא את פרטי הפרויקט ולחץ שמירה ליצירתו.'
            : 'שינויים בפרטי הפרויקט יישמרו בלחיצה על שמירה.'}
        </span>
        <div className="projectDrawer__footerButtons">
          <Button type="button" variant="ghost" onClick={handleCancelEdit}>
            ביטול
          </Button>
          <Button type="button" onClick={handleSaveProject} disabled={isSavingProject}>
            {isSavingProject ? 'שומר…' : isCreateMode ? 'צור פרויקט' : 'שמור שינויים'}
          </Button>
        </div>
      </>
    );
  }, [handleCancelEdit, handleSaveProject, isCreateMode, isEditMode, isSavingProject]);

  const renderTabContent = () => {
    if (!isCreateMode && lifecycleQuery.isLoading) {
      return <PageSpinner />;
    }

    if (!isCreateMode && lifecycleQuery.error) {
      return (
        <ErrorState
          message={lifecycleQuery.error.message}
          onRetry={() => lifecycleQuery.refetch()}
        />
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <>
            {!isCreateMode && lifecycle?.summary && (
              <ProjectSummaryCard summary={lifecycle.summary} />
            )}
            {saveError && <InlineAlert variant="danger">{saveError}</InlineAlert>}
            <ProjectOverviewTab
              lifecycle={lifecycle}
              form={overviewForm}
              teamForm={teamForm}
              isEditMode={isEditMode}
              isCreateMode={isCreateMode}
              customers={lookups.customers}
              sites={lookups.sites}
              employees={lookups.employees}
              onChange={setOverviewForm}
              onTeamChange={setTeamForm}
              onCustomerCreated={async (customerId) => {
                await refetchLookups();
                setOverviewForm((current) => ({
                  ...current,
                  customerId,
                  siteId: 0,
                }));
              }}
              onCreateSite={handleCreateProjectSite}
              onUpdateSite={handleUpdateProjectSite}
              onDeactivateSite={handleDeactivateProjectSite}
            />
          </>
        );
      case 'milestones':
        if (isCreateMode) {
          return <p className="projectDrawer__hint">שמור את הפרויקט לפני הוספת אבני דרך.</p>;
        }
        return (
          <ProjectMilestonesTab
            projectId={projectId}
            lifecycle={lifecycle}
            employees={lookups.employees}
            onCreateMilestone={handleCreateMilestone}
            onUpdateMilestone={handleUpdateMilestone}
            onCancelMilestone={handleCancelMilestone}
            onReorderMilestones={handleReorderMilestones}
            isSaving={
              milestoneMutations.createMutation.isPending ||
              milestoneMutations.updateMutation.isPending ||
              milestoneMutations.deactivateMutation.isPending
            }
            isReordering={milestoneMutations.reorderMutation.isPending}
          />
        );
      case 'quote':
        if (isCreateMode || projectId == null) {
          return <p className="projectDrawer__hint">שמור את הפרויקט לפני ניהול הצעות מחיר.</p>;
        }
        return <ProjectQuoteTab projectId={projectId} />;
      case 'boq':
        if (isCreateMode) {
          return <p className="projectDrawer__hint">שמור את הפרויקט לפני הוספת כתב כמויות.</p>;
        }

        if (boqQuery.isLoading) {
          return <PageSpinner />;
        }

        if (boqQuery.error) {
          return (
            <ErrorState
              message={boqQuery.error.message}
              onRetry={() => boqQuery.refetch()}
            />
          );
        }

        return (
          <ProjectBoqTab
            items={boqQuery.data ?? []}
            isEditMode={isEditMode}
            isSaving={
              boqMutations.createMutation.isPending ||
              boqMutations.updateMutation.isPending ||
              boqMutations.deleteMutation.isPending ||
              boqMutations.reorderMutation.isPending
            }
            onCreate={handleCreateBoqItem}
            onUpdate={handleUpdateBoqItem}
            onDelete={handleDeleteBoqItem}
            onReorder={handleReorderBoqItems}
          />
        );
      case 'drawings':
        if (isCreateMode) {
          return <p className="projectDrawer__hint">שמור את הפרויקט לפני הוספת שרטוטים.</p>;
        }

        if (drawingsQuery.isLoading) {
          return <PageSpinner />;
        }

        if (drawingsQuery.error) {
          return (
            <ErrorState
              message={drawingsQuery.error.message}
              onRetry={() => drawingsQuery.refetch()}
            />
          );
        }

        return (
          <ProjectDrawingsTab
            drawings={drawingsQuery.data ?? []}
            isEditMode={isEditMode}
            isSaving={
              drawingMutations.createMutation.isPending ||
              drawingMutations.uploadMutation.isPending ||
              drawingMutations.updateMutation.isPending ||
              drawingMutations.deleteMutation.isPending
            }
            onCreate={handleCreateDrawing}
            onUpload={handleUploadDrawing}
            onUpdate={handleUpdateDrawing}
            onDelete={handleDeleteDrawing}
          />
        );
      case 'equipment':
        if (isCreateMode) {
          return <p className="projectDrawer__hint">שמור את הפרויקט לפני הוספת ציוד.</p>;
        }

        if (equipmentQuery.isLoading) {
          return <PageSpinner />;
        }

        if (equipmentQuery.error) {
          return (
            <ErrorState
              message={equipmentQuery.error.message}
              onRetry={() => equipmentQuery.refetch()}
            />
          );
        }

        return (
          <ProjectEquipmentTab
            items={equipmentQuery.data ?? []}
            isEditMode={isEditMode}
            isSaving={
              equipmentMutations.createMutation.isPending ||
              equipmentMutations.updateMutation.isPending ||
              equipmentMutations.deleteMutation.isPending ||
              equipmentMutations.reorderMutation.isPending
            }
            onCreate={handleCreateEquipment}
            onUpdate={handleUpdateEquipment}
            onDelete={handleDeleteEquipment}
            onReorder={handleReorderEquipment}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      headerActions={headerActions}
      footer={footerActions}
      isMaximized={isMaximized}
      onToggleMaximize={() => setIsMaximized((value) => !value)}
    >
      <Tabs
        tabs={DRAWER_TABS}
        activeTabId={activeTab}
        onTabChange={(tabId) => {
          const nextTabId = tabId as ProjectDrawerTabId;
          setActiveTab(nextTabId);
          onActiveTabChange?.(nextTabId);
        }}
      >
        {renderTabContent()}
      </Tabs>
    </Drawer>
  );
}
