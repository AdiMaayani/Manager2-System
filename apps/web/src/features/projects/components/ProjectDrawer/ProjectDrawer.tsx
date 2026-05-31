import { useEffect, useState } from 'react';
import { Drawer } from '@shared/components/Drawer';
import { Tabs } from '@shared/components/Tabs';
import type { TabItem } from '@shared/components/Tabs';
import { Button } from '@shared/components/Button';
import { ErrorState } from '@shared/components/ErrorState';
import { PageSpinner } from '@shared/components/PageSpinner';
import {
  useAssignProjectTeam,
  useCreateProject,
  useCreateSite,
  useMilestoneMutations,
  useProjectLifecycle,
  useProjectLookups,
  teamFormFromProjectAssignments,
  useUpdateProject,
} from '../../hooks/useProjectLifecycle';
import type {
  ProjectBoqRow,
  ProjectDrawerMode,
  ProjectDrawerTabId,
  ProjectDrawing,
  ProjectEquipmentItem,
  ProjectOverviewForm,
  ProjectTeamForm,
} from '../../types';
import {
  DEFAULT_BOQ_ROWS,
  DEFAULT_DRAWINGS,
  DEFAULT_EQUIPMENT,
  createEmptyOverviewForm,
} from '../../utils/projectDisplayUtils';
import { ProjectBoqTab } from './components/ProjectBoqTab';
import { ProjectDrawingsTab } from './components/ProjectDrawingsTab';
import { ProjectEquipmentTab } from './components/ProjectEquipmentTab';
import { ProjectMilestonesTab } from './components/ProjectMilestonesTab';
import {
  ProjectOverviewTab,
  overviewFormFromLifecycle,
} from './components/ProjectOverviewTab';
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

interface ProjectDrawerProps {
  projectId: number | null;
  mode: ProjectDrawerMode;
  initialTab?: ProjectDrawerTabId;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (projectId: number) => void;
}

export function ProjectDrawer({
  projectId,
  mode,
  initialTab = 'overview',
  isOpen,
  onClose,
  onSaved,
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
  const [boqRows, setBoqRows] = useState<ProjectBoqRow[]>(DEFAULT_BOQ_ROWS);
  const [drawings, setDrawings] = useState<ProjectDrawing[]>(DEFAULT_DRAWINGS);
  const [equipment, setEquipment] = useState<ProjectEquipmentItem[]>(DEFAULT_EQUIPMENT);
  const [saveError, setSaveError] = useState<string | null>(null);

  const lifecycleQuery = useProjectLifecycle(isCreateMode ? null : projectId);
  const lookups = useProjectLookups();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const createSite = useCreateSite();
  const milestoneMutations = useMilestoneMutations(projectId);
  const assignProjectTeam = useAssignProjectTeam(projectId);

  useEffect(() => {
    if (!isOpen) return;

    const nextTab = DRAWER_TABS.some((tab) => tab.id === initialTab)
      ? initialTab
      : 'overview';
    setActiveTab(nextTab);
    setIsEditMode(isCreateMode);
    setIsMaximized(false);
    setSaveError(null);
    setBoqRows(DEFAULT_BOQ_ROWS.map((row) => ({ ...row })));
    setDrawings(DEFAULT_DRAWINGS.map((drawing) => ({ ...drawing })));
    setEquipment(DEFAULT_EQUIPMENT.map((item) => ({ ...item })));

    if (isCreateMode) {
      setOverviewForm(createEmptyOverviewForm());
      const emptyTeam = { projectManagerEmployeeId: null, teamEmployeeIds: [] };
      setTeamForm(emptyTeam);
      setInitialTeamForm(emptyTeam);
    }
  }, [isOpen, isCreateMode, initialTab, projectId]);

  useEffect(() => {
    if (lifecycleQuery.data && !isCreateMode) {
      setOverviewForm(overviewFormFromLifecycle(lifecycleQuery.data));
      const nextTeamForm = teamFormFromProjectAssignments(lifecycleQuery.data);
      setTeamForm(nextTeamForm);
      setInitialTeamForm(nextTeamForm);
    }
  }, [lifecycleQuery.data, isCreateMode]);

  const lifecycle = lifecycleQuery.data ?? null;
  const title =
    isCreateMode ? 'פרויקט חדש' : lifecycle?.project.title ?? 'פרטי פרויקט';

  const handleCancelEdit = () => {
    if (isCreateMode) {
      onClose();
      return;
    }

    setOverviewForm(overviewFormFromLifecycle(lifecycle));
    setTeamForm(initialTeamForm);
    setIsEditMode(false);
    setSaveError(null);
  };

  const handleSaveProject = async () => {
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

        setIsEditMode(false);
        onSaved(result.workItemId);
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
          createdAt: lifecycle.project.createdAt,
          closedAt: lifecycle.project.closedAt ?? null,
          parentWorkItemId: null,
          dealCloseDate: overviewForm.dealCloseDate || null,
          financeProjectNumber: overviewForm.financeProjectNumber.trim() || undefined,
          invoiceNumber: overviewForm.invoiceNumber.trim() || undefined,
        },
      });

      await assignProjectTeam.mutateAsync({
        teamForm,
        previousTeamForm: initialTeamForm,
      });

      setIsEditMode(false);
      onSaved(projectId);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'שמירת הפרויקט נכשלה.');
    }
  };

  const headerActions = (
    <div className="projectDrawer__headerActions">
      {isEditMode && (
        <span className="projectDrawer__editIndicator">מצב עריכה</span>
      )}
      {!isEditMode && !isCreateMode && (
        <Button type="button" variant="secondary" onClick={() => setIsEditMode(true)}>
          ערוך
        </Button>
      )}
      {isEditMode && (
        <>
          <Button
            type="button"
            onClick={handleSaveProject}
            disabled={createProject.isPending || updateProject.isPending || assignProjectTeam.isPending}
          >
            שמור
          </Button>
          <Button type="button" variant="ghost" onClick={handleCancelEdit}>
            ביטול
          </Button>
        </>
      )}
    </div>
  );

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
            {saveError && <div className="projectDrawer__error">{saveError}</div>}
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
              onCreateSite={async (payload) => {
                const site = await createSite.mutateAsync(payload);
                setOverviewForm((current) => ({ ...current, siteId: site.siteId }));
                await lookups.refetch();
              }}
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
            customerId={overviewForm.customerId || lifecycle?.project.customerId || 0}
            siteId={overviewForm.siteId || lifecycle?.project.siteId || 0}
            employees={lookups.employees}
            onCreateMilestone={async (body) => {
              await milestoneMutations.createMutation.mutateAsync(body);
            }}
            onUpdateMilestone={async (milestoneId, body) => {
              await milestoneMutations.updateMutation.mutateAsync({ milestoneId, body });
            }}
            onCancelMilestone={async (milestoneId) => {
              await milestoneMutations.cancelMutation.mutateAsync(milestoneId);
            }}
            isSaving={
              milestoneMutations.createMutation.isPending ||
              milestoneMutations.updateMutation.isPending ||
              milestoneMutations.cancelMutation.isPending
            }
          />
        );
      case 'quote':
        return <ProjectQuoteTab />;
      case 'boq':
        return (
          <ProjectBoqTab rows={boqRows} isEditMode={isEditMode} onChange={setBoqRows} />
        );
      case 'drawings':
        return (
          <ProjectDrawingsTab
            drawings={drawings}
            isEditMode={isEditMode}
            onChange={setDrawings}
          />
        );
      case 'equipment':
        return (
          <ProjectEquipmentTab
            items={equipment}
            isEditMode={isEditMode}
            onChange={setEquipment}
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
      isMaximized={isMaximized}
      onToggleMaximize={() => setIsMaximized((value) => !value)}
    >
      <Tabs
        tabs={DRAWER_TABS}
        activeTabId={activeTab}
        onTabChange={(tabId) => setActiveTab(tabId as ProjectDrawerTabId)}
      >
        {renderTabContent()}
      </Tabs>
    </Drawer>
  );
}
