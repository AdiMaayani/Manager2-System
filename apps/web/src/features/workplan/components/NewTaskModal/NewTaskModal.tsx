import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Flag, MapPin, Plus } from 'lucide-react';
import { Drawer } from '@shared/components/Drawer';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { ListSelect } from '@shared/components/ListSelect';
import { Textarea } from '@shared/components/Textarea';
import { InlineAlert } from '@shared/components/InlineAlert';
import { SegmentedControl } from '@shared/components/SegmentedControl';
import { PageSpinner } from '@shared/components/PageSpinner';
import {
  TASK_CATEGORIES,
  TASK_CATEGORY_HELP,
  TASK_CATEGORY_LABELS,
  type TaskCategory,
} from '@shared/constants/taskCategories';
import { formatDurationMinutes } from '@shared/utils/utcDateTime';
import {
  buildPlannedUtcRangeFromParts,
  deriveDurationFromParts,
  type PlannedScheduleParts,
} from '../../lib/taskScheduleUtils';
import {
  assignEmployeeToWorkItemAsync,
  createWorkItemAsync,
  getDraftRecommendationsAsync,
  getSmartAssignmentRecommendationsAsync,
  saveSmartAssignmentFeedbackAsync,
} from '../../api/workplanApiClient';
import { useEmployeePrimaryRoles } from '@features/employees/hooks/useEmployeePrimaryRoles';
import { invalidateWorkPlanQueries } from '../../hooks/useWorkPlanData';
import { MilestoneSelector } from '../MilestoneSelector';
import { WORKPLAN_PRIORITY_OPTIONS } from '../../constants';
import {
  assignEmployeeToServiceCallAsync,
  createServiceCallAsync,
  getServiceCallCustomersAsync,
  getServiceCallSitesAsync,
} from '@features/serviceCalls/api/serviceCallsApiClient';
import {
  canSelectRecommendationCandidate,
  getCandidateNotices,
  getRecommendationCandidateLabel,
  getRecommendationFactorExplanation,
  getRecommendationRouteEndpoints,
  getWeightedRecommendationFactors,
  rankRecommendationCandidates,
  toggleExpandedRecommendation,
} from '../../lib/smartAssignmentRecommendationPresentation';
import {
  DEFAULT_SMART_ASSIGNMENT_WEIGHTS,
  cloneSmartAssignmentWeights,
  getSmartAssignmentWeightsError,
  type SmartAssignmentWeightPresetKey,
} from '../../lib/smartAssignmentWeights';
import {
  addRequiredProfession,
  isRequiredProfessionSelected,
  legacyRequiredRole,
  removeRequiredProfession,
} from '../../lib/requiredProfessions';
import type {
  DraftRecommendationCandidate,
  SmartAssignmentWeights,
  WorkPlanEmployee,
  WorkPlanProjectFilter,
} from '../../types';
import { SmartAssignmentWeightSelector } from '../SmartAssignmentWeightSelector';
import {
  DraftRecommendationRatingDialog,
  type DraftRecommendationRatingValue,
} from '../DraftRecommendationRatingDialog';
import { buildSmartAssignmentFeedbackRequest } from '../../lib/smartAssignmentFeedback';
import './NewTaskModal.css';

const TASK_CATEGORY_OPTIONS: Array<{ id: TaskCategory; label: string }> = [
  { id: TASK_CATEGORIES.Regular, label: TASK_CATEGORY_LABELS.Regular },
  { id: TASK_CATEGORIES.Project, label: TASK_CATEGORY_LABELS.Project },
  { id: TASK_CATEGORIES.ServiceCall, label: TASK_CATEGORY_LABELS.ServiceCall },
];

interface ProjectOption {
  id: number;
  title: string;
}

interface NewTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectFilter: WorkPlanProjectFilter;
  defaultProjectId?: number | null;
  projectOptions: ProjectOption[];
  employees: WorkPlanEmployee[];
}

type WizardStep = 'category' | 'context' | 'schedule' | 'assignment';

function getStepsForCategory(category: TaskCategory): Array<{ id: WizardStep; label: string }> {
  switch (category) {
    case TASK_CATEGORIES.Project:
      return [
        { id: 'category', label: 'סוג, פרטים והקשר' },
        { id: 'schedule', label: 'תזמון' },
        { id: 'assignment', label: 'שיוך עובד' },
      ];
    case TASK_CATEGORIES.ServiceCall:
      return [
        { id: 'category', label: 'סוג ופרטים' },
        { id: 'context', label: 'הקשר' },
        { id: 'schedule', label: 'תזמון' },
        { id: 'assignment', label: 'שיוך עובד' },
      ];
    case TASK_CATEGORIES.Regular:
    default:
      return [
        { id: 'category', label: 'סוג ופרטים' },
        { id: 'schedule', label: 'תזמון' },
        { id: 'assignment', label: 'שיוך עובד' },
      ];
  }
}

function formatRecommendationScore(score?: number | null): string {
  if (score == null || Number.isNaN(Number(score))) return '—';
  return `${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 }).format(Number(score))}%`;
}

function formatRecommendationContribution(contribution?: number | null): string {
  if (contribution == null || Number.isNaN(Number(contribution))) return '—';
  return `${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(Number(contribution))} נק׳`;
}

export function NewTaskModal({
  isOpen,
  onClose,
  projectFilter,
  defaultProjectId,
  projectOptions,
  employees,
}: NewTaskModalProps) {
  const queryClient = useQueryClient();
  const [isMaximized, setIsMaximized] = useState(false);
  const [step, setStep] = useState<WizardStep>('category');
  const [taskCategory, setTaskCategory] = useState<TaskCategory>(TASK_CATEGORIES.Project);
  const [selectedProjectId, setSelectedProjectId] = useState(() => {
    const projectId = typeof projectFilter === 'number' ? projectFilter : defaultProjectId;
    return projectId ? String(projectId) : '';
  });
  const [milestoneId, setMilestoneId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [siteId, setSiteId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [plannedStartDate, setPlannedStartDate] = useState('');
  const [plannedStartTime, setPlannedStartTime] = useState('');
  const [plannedEndDate, setPlannedEndDate] = useState('');
  const [plannedEndTime, setPlannedEndTime] = useState('');
  const [priority, setPriority] = useState<string>(WORKPLAN_PRIORITY_OPTIONS[1].code);
  const [requiredRoles, setRequiredRoles] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState('');
  const [draftCandidates, setDraftCandidates] = useState<DraftRecommendationCandidate[] | null>(
    null,
  );
  const [smartWeights, setSmartWeights] = useState<SmartAssignmentWeights>(() =>
    cloneSmartAssignmentWeights(DEFAULT_SMART_ASSIGNMENT_WEIGHTS));
  const [smartWeightPreset, setSmartWeightPreset] =
    useState<SmartAssignmentWeightPresetKey>('balanced');
  const [acceptedRecommendation, setAcceptedRecommendation] = useState<{
    employeeId: number;
    employeeName: string;
  } | null>(null);
  const [recommendationRatings, setRecommendationRatings] = useState<
    Record<number, DraftRecommendationRatingValue>
  >({});
  const [ratingCandidateId, setRatingCandidateId] = useState<number | null>(null);
  const [postSaveWarning, setPostSaveWarning] = useState<string | null>(null);
  const [taskWasSaved, setTaskWasSaved] = useState(false);
  const [isSmartLoading, setIsSmartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recommendationRequestIdRef = useRef(0);
  const recommendationAbortControllerRef = useRef<AbortController | null>(null);
  const recommendationAccordionId = useId();
  const [expandedCandidateId, setExpandedCandidateId] = useState<number | null>(null);

  const customersQuery = useQuery({
    queryKey: ['serviceCallCustomers'],
    queryFn: getServiceCallCustomersAsync,
    enabled: isOpen && taskCategory === TASK_CATEGORIES.ServiceCall,
  });

  const sitesQuery = useQuery({
    queryKey: ['serviceCallSites'],
    queryFn: getServiceCallSitesAsync,
    enabled: isOpen && taskCategory === TASK_CATEGORIES.ServiceCall,
  });

  const primaryRolesQuery = useEmployeePrimaryRoles(isOpen);

  const wizardSteps = useMemo(() => getStepsForCategory(taskCategory), [taskCategory]);

  const parsedProjectId = useMemo(() => {
    const parsed = Number(selectedProjectId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [selectedProjectId]);

  const scheduleParts = useMemo(
    (): PlannedScheduleParts => ({
      startDate: plannedStartDate,
      startTime: plannedStartTime,
      endDate: plannedEndDate,
      endTime: plannedEndTime,
    }),
    [plannedStartDate, plannedStartTime, plannedEndDate, plannedEndTime],
  );

  const derivedDurationMinutes = useMemo(
    () => deriveDurationFromParts(scheduleParts),
    [scheduleParts],
  );

  const activeEmployees = useMemo(
    () =>
      employees.filter((employee) => employee.isActive && employee.employeeId > 0),
    [employees],
  );

  const filteredSites = useMemo(() => {
    const sites = sitesQuery.data ?? [];
    if (!customerId) return sites;
    return sites.filter((s) => String(s.customerId) === customerId);
  }, [sitesQuery.data, customerId]);

  const availablePrimaryRoles = useMemo(
    () =>
      (primaryRolesQuery.data ?? []).filter(
        (role) => !isRequiredProfessionSelected(requiredRoles, role),
      ),
    [primaryRolesQuery.data, requiredRoles],
  );
  const rankedCandidates = useMemo(
    () => rankRecommendationCandidates(draftCandidates ?? []),
    [draftCandidates],
  );
  const ratingCandidate = useMemo(
    () => rankedCandidates.find((candidate) => candidate.employeeId === ratingCandidateId) ?? null,
    [rankedCandidates, ratingCandidateId],
  );
  const smartWeightsError = useMemo(
    () => getSmartAssignmentWeightsError(smartWeights),
    [smartWeights],
  );

  useEffect(
    () => () => recommendationAbortControllerRef.current?.abort(),
    [],
  );

  function resetForm() {
    recommendationRequestIdRef.current += 1;
    setIsMaximized(false);
    setStep('category');
    setTaskCategory(TASK_CATEGORIES.Project);
    setSelectedProjectId('');
    setMilestoneId('');
    setCustomerId('');
    setSiteId('');
    setTitle('');
    setDescription('');
    setPlannedStartDate('');
    setPlannedStartTime('');
    setPlannedEndDate('');
    setPlannedEndTime('');
    setPriority(WORKPLAN_PRIORITY_OPTIONS[1].code);
    setRequiredRoles([]);
    setEmployeeId('');
    setDraftCandidates(null);
    setSmartWeights(cloneSmartAssignmentWeights(DEFAULT_SMART_ASSIGNMENT_WEIGHTS));
    setSmartWeightPreset('balanced');
    setAcceptedRecommendation(null);
    setRecommendationRatings({});
    setRatingCandidateId(null);
    setPostSaveWarning(null);
    setTaskWasSaved(false);
    setIsSmartLoading(false);
    setError(null);
    setExpandedCandidateId(null);
    recommendationAbortControllerRef.current?.abort();
    recommendationAbortControllerRef.current = null;
  }

  function clearRecommendationState() {
    recommendationAbortControllerRef.current?.abort();
    recommendationAbortControllerRef.current = null;
    recommendationRequestIdRef.current += 1;
    setDraftCandidates(null);
    setAcceptedRecommendation(null);
    setRecommendationRatings({});
    setRatingCandidateId(null);
    setIsSmartLoading(false);
    setExpandedCandidateId(null);
  }

  function buildPlannedUtcRange(): { plannedStart: string; plannedEnd: string } {
    return buildPlannedUtcRangeFromParts(scheduleParts);
  }

  function validateDetailsStep() {
    if (!title.trim()) throw new Error('יש להזין כותרת משימה');
    if (taskCategory === TASK_CATEGORIES.Project && !parsedProjectId) {
      throw new Error('יש לבחור פרויקט');
    }
  }

  function validateContextStep() {
    if (taskCategory !== TASK_CATEGORIES.ServiceCall) return;
    if (!customerId) throw new Error('יש לבחור לקוח');
    if (!siteId) throw new Error('יש לבחור אתר');
  }

  function validateScheduleStep() {
    validateDetailsStep();
    validateContextStep();
    buildPlannedUtcRange();
  }

  function validateCurrentStep() {
    switch (step) {
      case 'category':
        validateDetailsStep();
        break;
      case 'context':
        validateContextStep();
        break;
      case 'schedule':
        validateScheduleStep();
        break;
      default:
        break;
    }
  }

  function validateAssignmentStep() {
    validateScheduleStep();
    if (!employeeId) throw new Error('יש לבחור עובד לשיוך');
  }

  async function handleRunSmartRecommendation() {
    let plannedStart: string;
    let plannedEnd: string;

    try {
      validateScheduleStep();
      if (smartWeightsError) throw new Error(smartWeightsError);
      ({ plannedStart, plannedEnd } = buildPlannedUtcRange());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'יש להשלים את נתוני המשימה לפני ההרצה.');
      return;
    }

    recommendationAbortControllerRef.current?.abort();
    const abortController = new AbortController();
    recommendationAbortControllerRef.current = abortController;
    const requestId = recommendationRequestIdRef.current + 1;
    recommendationRequestIdRef.current = requestId;
    setIsSmartLoading(true);
    setError(null);
    setExpandedCandidateId(null);

    try {
      const requiredRole = legacyRequiredRole(requiredRoles);

      const result = await getDraftRecommendationsAsync({
        taskCategory,
        projectId: parsedProjectId,
        customerId: customerId ? Number(customerId) : null,
        siteId: siteId ? Number(siteId) : null,
        plannedStart,
        plannedEnd,
        priority: priority || null,
        requiredRole,
        requiredRoles,
        weights: smartWeights,
      }, abortController.signal);

      if (requestId !== recommendationRequestIdRef.current) return;

      setDraftCandidates(result.candidates);
      setRecommendationRatings({});
      setRatingCandidateId(null);
      if (result.candidates.length === 0) {
        setError('לא נמצאו עובדים זמינים להצגה. ניתן לבחור עובד ידנית ולשמור.');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (requestId === recommendationRequestIdRef.current) {
        setError('לא הצלחנו להריץ את השיבוץ החכם. נסו שוב בעוד כמה רגעים.');
      }
    } finally {
      if (requestId === recommendationRequestIdRef.current) {
        setIsSmartLoading(false);
      }
      if (recommendationAbortControllerRef.current === abortController) {
        recommendationAbortControllerRef.current = null;
      }
    }
  }

  function handleAcceptRecommendation(candidate: DraftRecommendationCandidate) {
    if (!canSelectRecommendationCandidate(candidate)) return;
    setEmployeeId(String(candidate.employeeId));
    setAcceptedRecommendation({
      employeeId: candidate.employeeId,
      employeeName: candidate.fullName ?? `עובד #${candidate.employeeId}`,
    });
    setError(null);
  }

  async function persistDraftRecommendationContext(
    workItemId: number,
    ratings: ReadonlyArray<readonly [number, DraftRecommendationRatingValue]>,
    shouldPersistSmartContext: boolean,
  ): Promise<{ recommendationRunId: number | null; warning: string | null }> {
    if (ratings.length === 0 && !shouldPersistSmartContext) {
      return { recommendationRunId: null, warning: null };
    }

    let run;
    try {
      run = await getSmartAssignmentRecommendationsAsync({
        workItemIds: [workItemId],
        includeLockedTasks: true,
        saveRun: true,
        weights: smartWeights,
      });
    } catch {
      return {
        recommendationRunId: null,
        warning: shouldPersistSmartContext
          ? 'המשימה נשמרה, אך לא הצלחנו לשמור את הקשר לשיבוץ החכם. שיוך העובד יישמר כשיבוץ ידני ודירוגי ההמלצה לא יישמרו.'
          : 'המשימה נשמרה ושויכה, אך לא הצלחנו לשמור את דירוגי ההמלצה.',
      };
    }

    const recommendationRunId = run.recommendationRunId;
    if (recommendationRunId == null || recommendationRunId <= 0) {
      return {
        recommendationRunId: null,
        warning: shouldPersistSmartContext
          ? 'המשימה נשמרה, אך לא התקבל מזהה תקין לריצת השיבוץ החכם. שיוך העובד יישמר כשיבוץ ידני ודירוגי ההמלצה לא יישמרו.'
          : 'המשימה נשמרה ושויכה, אך לא הצלחנו לשמור את דירוגי ההמלצה.',
      };
    }

    if (ratings.length === 0) {
      return { recommendationRunId, warning: null };
    }

    const taskResult = run.taskResults.find((result) => result.workItemId === workItemId);
    if (
      !taskResult?.policyProfileKey
      || taskResult.policyVersion == null
      || taskResult.policyVersion <= 0
    ) {
      return {
        recommendationRunId,
        warning: 'המשימה וריצת השיבוץ נשמרו, אך חסרו פרטי מדיניות ולכן דירוגי ההמלצה לא נשמרו.',
      };
    }

    try {
      await Promise.all(ratings.map(([recommendedEmployeeId, value]) =>
        saveSmartAssignmentFeedbackAsync(buildSmartAssignmentFeedbackRequest({
          recommendationRunId,
          workItemId,
          recommendedEmployeeId,
          policyProfileKey: taskResult.policyProfileKey!,
          policyVersion: taskResult.policyVersion!,
        }, value.rating, value.comment))));

      return { recommendationRunId, warning: null };
    } catch {
      return {
        recommendationRunId,
        warning: 'המשימה וריצת השיבוץ נשמרו, אך לא הצלחנו לשמור את דירוגי ההמלצה.',
      };
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      validateAssignmentStep();
      const parsedEmployeeId = Number(employeeId);
      if (!Number.isInteger(parsedEmployeeId) || parsedEmployeeId <= 0) {
        throw new Error('יש לבחור עובד תקין לשיוך');
      }

      const { plannedStart, plannedEnd } = buildPlannedUtcRange();
      const requiredRole = legacyRequiredRole(requiredRoles);
      const ratingEntries = Object.entries(recommendationRatings).map(
        ([candidateEmployeeId, value]) => [Number(candidateEmployeeId), value] as const,
      );
      const selectedFromSmartRecommendation =
        acceptedRecommendation?.employeeId === parsedEmployeeId;
      let workItemId: number;

      if (taskCategory === TASK_CATEGORIES.ServiceCall) {
        const created = await createServiceCallAsync({
          title: title.trim(),
          description: description.trim() || null,
          billingType: 'Hourly',
          customerId: Number(customerId),
          siteId: Number(siteId),
          priority,
          plannedStart,
          plannedEnd,
          requiredRole,
          requiredRoles,
          isLocked: false,
        });
        workItemId = created.workItemId;
      } else {
        const created = await createWorkItemAsync({
          title: title.trim(),
          description: description.trim() || undefined,
          billingType: taskCategory === TASK_CATEGORIES.Regular ? 'Internal' : 'Hourly',
          taskCategory,
          parentWorkItemId: taskCategory === TASK_CATEGORIES.Project ? parsedProjectId : null,
          milestoneId: milestoneId ? Number(milestoneId) : null,
          plannedStart,
          plannedEnd,
          priority,
          requiredRole,
          requiredRoles,
        });
        workItemId = created.workItemId ?? 0;
        if (!workItemId) throw new Error('השרת לא החזיר מזהה משימה תקין');
      }

      // Persist a recommendation run before assigning the selected employee. Assignment changes workload
      // and continuity inputs, and a smart source is recorded only when this context was persisted.
      const recommendationPersistence = await persistDraftRecommendationContext(
        workItemId,
        ratingEntries,
        selectedFromSmartRecommendation,
      );
      const recommendationRunId = selectedFromSmartRecommendation
        ? recommendationPersistence.recommendationRunId
        : null;

      let assignmentWarning: string | null = null;
      try {
        if (taskCategory === TASK_CATEGORIES.ServiceCall) {
          await assignEmployeeToServiceCallAsync(workItemId, {
            employeeId: parsedEmployeeId,
            assignmentRole: requiredRole || 'Executor',
            ...(recommendationRunId != null ? { recommendationRunId } : {}),
          });
        } else {
          await assignEmployeeToWorkItemAsync(workItemId, {
            employeeId: parsedEmployeeId,
            assignmentRole: requiredRole || 'Executor',
            ...(recommendationRunId != null ? { recommendationRunId } : {}),
          });
        }
      } catch {
        assignmentWarning = 'המשימה נשמרה, אך שיוך העובד נכשל. ניתן לשייך עובד מתוך המשימה שנוצרה.';
      }

      const postSaveWarning = [assignmentWarning, recommendationPersistence.warning]
        .filter(Boolean)
        .join(' ');

      return {
        workItemId,
        projectId: parsedProjectId,
        isServiceCall: taskCategory === TASK_CATEGORIES.ServiceCall,
        postSaveWarning: postSaveWarning || null,
      };
    },
    onSuccess: async (result) => {
      await invalidateWorkPlanQueries(queryClient, result.projectId);
      if (result.isServiceCall) {
        await queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });
      }
      if (result.postSaveWarning) {
        setTaskWasSaved(true);
        setPostSaveWarning(result.postSaveWarning);
        setError(null);
        return;
      }
      resetForm();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'יצירת המשימה נכשלה');
    },
  });

  function handleClose() {
    if (mutation.isPending) return;
    resetForm();
    onClose();
  }

  function handleDrawerClose() {
    if (ratingCandidate) return;
    handleClose();
  }

  function handleCategoryChange(next: TaskCategory) {
    setTaskCategory(next);
    clearRecommendationState();
    setMilestoneId('');
    setCustomerId('');
    setSiteId('');
    setError(null);
    const nextSteps = getStepsForCategory(next);
    setStep((currentStep) =>
      nextSteps.some((item) => item.id === currentStep) ? currentStep : nextSteps[0].id,
    );
  }

  const currentStepIndex = wizardSteps.findIndex((item) => item.id === step);
  const currentStepLabel = wizardSteps[currentStepIndex]?.label ?? '';
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === wizardSteps.length - 1;

  function handleGoBack() {
    const prev = wizardSteps[currentStepIndex - 1]?.id;
    if (prev) setStep(prev);
  }

  function handleGoNext() {
    try {
      validateCurrentStep();
      const next = wizardSteps[currentStepIndex + 1]?.id;
      if (next) setStep(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    }
  }

  function addProfession(value: string) {
    const next = addRequiredProfession(requiredRoles, value);
    if (next.length === requiredRoles.length) return;
    setRequiredRoles(next);
    clearRecommendationState();
  }

  function removeProfession(value: string) {
    setRequiredRoles((current) => removeRequiredProfession(current, value));
    clearRecommendationState();
  }

  function renderRequiredProfessionsField() {
    if (primaryRolesQuery.isLoading) {
      return (
        <ListSelect
          label="מקצועות נדרשים"
          value=""
          disabled
          onChange={() => undefined}
          options={[{ value: '', label: 'טוען מקצועות...' }]}
        />
      );
    }

    if (primaryRolesQuery.isError) {
      return (
        <div className="newTaskModal__field">
          <InlineAlert variant="danger">
            טעינת רשימת המקצועות נכשלה.
          </InlineAlert>
          <Button type="button" variant="secondary" onClick={() => primaryRolesQuery.refetch()}>
            נסה שוב
          </Button>
        </div>
      );
    }

    return (
      <div className="newTaskModal__professionsField">
        <div
          className="newTaskModal__professionAddPrompt"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="newTaskModal__professionAddIcon" aria-hidden="true">
            <Plus size={18} />
          </span>
          <span>
            {requiredRoles.length === 0
              ? 'ניתן להוסיף מספר מקצועות — בחרו מקצוע מהרשימה.'
              : requiredRoles.length === 1
                ? 'נבחר מקצוע אחד. ניתן להוסיף מקצוע נוסף.'
                : `נבחרו ${requiredRoles.length} מקצועות. ניתן להוסיף מקצוע נוסף.`}
          </span>
        </div>
        <ListSelect
          label="מקצועות נדרשים"
          value=""
          onChange={addProfession}
          placeholder={requiredRoles.length === 0 ? 'הוסף מקצוע נדרש' : 'הוסף מקצוע נוסף'}
          searchable
          searchPlaceholder="חיפוש מקצוע..."
          emptyMessage="אין מקצועות נוספים לבחירה."
          options={
            availablePrimaryRoles.length === 0
              ? [{ value: '__none__', label: 'אין מקצועות נוספים לבחירה', disabled: true }]
              : availablePrimaryRoles.map((role) => ({ value: role, label: role }))
          }
        />
        {requiredRoles.length > 0 ? (
          <ul className="newTaskModal__professionChips" aria-label="מקצועות שנבחרו">
            {requiredRoles.map((role) => (
              <li key={role} className="newTaskModal__professionChip">
                <span>{role}</span>
                <button
                  type="button"
                  className="newTaskModal__professionRemove"
                  onClick={() => removeProfession(role)}
                  aria-label={`הסר את המקצוע ${role}`}
                >
                  הסר
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="newTaskModal__fieldHint">לא נבחרו מקצועות חובה.</p>
        )}
      </div>
    );
  }

  function renderRecommendationCandidate(
    candidate: DraftRecommendationCandidate,
    index: number,
    total: number,
  ) {
    const isExpanded = expandedCandidateId === candidate.employeeId;
    const notices = getCandidateNotices(candidate);
    const displayedFactors = getWeightedRecommendationFactors(candidate.factors);
    const triggerId = `${recommendationAccordionId}-${candidate.employeeId}-trigger`;
    const panelId = `${recommendationAccordionId}-${candidate.employeeId}-panel`;

    return (
      <article className="newTaskModal__recommendation" key={candidate.employeeId}>
        <div className="newTaskModal__candidateRow">
          <button
            id={triggerId}
            type="button"
            className="newTaskModal__candidateToggle"
            aria-expanded={isExpanded}
            aria-controls={panelId}
            onClick={() => setExpandedCandidateId((current) =>
              toggleExpandedRecommendation(current, candidate.employeeId))}
          >
            <span className="newTaskModal__candidateIdentity">
              <strong className="newTaskModal__recommendationName">
                {candidate.fullName ?? `עובד #${candidate.employeeId}`}
              </strong>
              <span className="newTaskModal__relativeRank">
                {getRecommendationCandidateLabel(index, total)}
              </span>
            </span>
            <span className="newTaskModal__candidateSummary">
              {candidate.totalScore != null && (
                <span className="newTaskModal__score" dir="ltr">
                  {formatRecommendationScore(candidate.totalScore)}
                </span>
              )}
              <ChevronDown
                size={18}
                className="newTaskModal__candidateChevron"
                aria-hidden="true"
              />
            </span>
          </button>
          <Button
            type="button"
            size="sm"
            variant={
              acceptedRecommendation?.employeeId === candidate.employeeId
                ? 'secondary'
                : 'primary'
            }
            onClick={() => handleAcceptRecommendation(candidate)}
            disabled={mutation.isPending}
          >
            {acceptedRecommendation?.employeeId === candidate.employeeId ? 'נבחר' : 'בחר עובד'}
          </Button>
        </div>

        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          hidden={!isExpanded}
          className="newTaskModal__candidateDetails"
        >
          {notices.length > 0 && (
            <ul className="newTaskModal__reasons">
              {notices.map((notice, index) => (
                <li key={`${notice}-${index}`} className="newTaskModal__warning">
                  {notice}
                </li>
              ))}
            </ul>
          )}
          {displayedFactors.length > 0 && (
            <div>
              <h5 className="newTaskModal__contributionsTitle">פירוט חמשת גורמי החישוב</h5>
              <ul className="newTaskModal__factors">
                {displayedFactors.map((factor) => {
                  const routeEndpoints = getRecommendationRouteEndpoints(factor);
                  return (
                    <li className="newTaskModal__factor" key={factor.key}>
                      <div className="newTaskModal__factorHead">
                        <span className="newTaskModal__factorLabel">{factor.label}</span>
                        <span className="newTaskModal__factorMetrics">
                          <span>ציון <b dir="ltr">{formatRecommendationScore(factor.score)}</b></span>
                          <span>משקל <b dir="ltr">{formatRecommendationScore(factor.weightPercent)}</b></span>
                          <span>תרומה <b dir="ltr">{formatRecommendationContribution(factor.weightedContribution)}</b></span>
                        </span>
                      </div>
                      {routeEndpoints && (
                        <div
                          className="newTaskModal__routeEndpoints"
                          role="group"
                          aria-label="מוצא ויעד לחישוב הנסיעה"
                        >
                          <div className="newTaskModal__routeEndpoint">
                            <MapPin size={18} aria-hidden="true" />
                            <span>
                              <span className="newTaskModal__routeEndpointLabel">מוצא העובד</span>
                              <strong>
                                {routeEndpoints.originFormattedAddress ?? 'כתובת מוצא לא זמינה'}
                              </strong>
                            </span>
                          </div>
                          <div className="newTaskModal__routeEndpoint">
                            <Flag size={18} aria-hidden="true" />
                            <span>
                              <span className="newTaskModal__routeEndpointLabel">יעד המשימה</span>
                              <strong>
                                {routeEndpoints.destinationFormattedAddress ?? 'כתובת יעד לא זמינה'}
                              </strong>
                            </span>
                          </div>
                        </div>
                      )}
                      <span className="newTaskModal__factorExplain">
                        {getRecommendationFactorExplanation(candidate, factor)}
                        {factor.isDefaulted ? ' · נעשה שימוש בערך ברירת מחדל' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          <div className="newTaskModal__ratingAction">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setRatingCandidateId(candidate.employeeId)}
              disabled={mutation.isPending}
            >
              דירוג המלצה
            </Button>
            {recommendationRatings[candidate.employeeId] && (
              <span className="newTaskModal__ratingStatus" aria-live="polite">
                דורג {recommendationRatings[candidate.employeeId].rating}/10
              </span>
            )}
          </div>
        </div>
      </article>
    );
  }

  return (
    <>
      <Drawer
        isOpen={isOpen}
        onClose={handleDrawerClose}
        title="משימה חדשה"
        isMaximized={isMaximized}
        onToggleMaximize={() => setIsMaximized((v) => !v)}
      >
        <form
          className="newTaskModal"
          onSubmit={(e) => {
            e.preventDefault();
            if (!taskWasSaved) mutation.mutate();
          }}
        >
        <ol className="newTaskModal__steps" aria-label="שלבי יצירת משימה">
          {wizardSteps.map((item, index) => (
            <li
              key={item.id}
              className={`newTaskModal__step ${step === item.id ? 'newTaskModal__step--active' : ''} ${
                index < currentStepIndex ? 'newTaskModal__step--complete' : ''
              }`}
              aria-current={step === item.id ? 'step' : undefined}
            >
              <span className="newTaskModal__stepIndex">{index + 1}</span>
              <span className="newTaskModal__stepLabel">{item.label}</span>
            </li>
          ))}
        </ol>

        <div
          className="newTaskModal__body"
          aria-busy={mutation.isPending}
          inert={mutation.isPending ? true : undefined}
        >
          {step === 'category' && (
            <section className="newTaskModal__section">
              <h3 className="newTaskModal__sectionTitle">{currentStepLabel}</h3>
              <SegmentedControl
                ariaLabel="סוג משימה"
                items={TASK_CATEGORY_OPTIONS}
                value={taskCategory}
                onChange={handleCategoryChange}
              />
              {taskCategory === TASK_CATEGORIES.Regular && TASK_CATEGORY_HELP.Regular && (
                <p className="newTaskModal__hint">{TASK_CATEGORY_HELP.Regular}</p>
              )}
              <Input label="כותרת" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <Textarea
                label="תיאור"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              <div className="newTaskModal__grid">
                <Select label="דחיפות" value={priority} onChange={(e) => {
                  setPriority(e.target.value);
                  clearRecommendationState();
                }}>
                  {WORKPLAN_PRIORITY_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>{o.display}</option>
                  ))}
                </Select>
                {renderRequiredProfessionsField()}
              </div>
              {taskCategory === TASK_CATEGORIES.Project && (
                <>
                  <Select
                    label="פרויקט"
                    required
                    value={selectedProjectId}
                    onChange={(e) => {
                      setSelectedProjectId(e.target.value);
                      setMilestoneId('');
                      clearRecommendationState();
                    }}
                  >
                    <option value="">בחר פרויקט</option>
                    {projectOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </Select>
                  <MilestoneSelector
                    projectId={parsedProjectId}
                    value={milestoneId}
                    onChange={(v) => {
                      setMilestoneId(v);
                      clearRecommendationState();
                    }}
                  />
                </>
              )}
            </section>
          )}

          {step === 'context' && taskCategory === TASK_CATEGORIES.ServiceCall && (
            <section className="newTaskModal__section">
              <h3 className="newTaskModal__sectionTitle">{currentStepLabel}</h3>
              <Select
                label="לקוח"
                required
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setSiteId('');
                  clearRecommendationState();
                }}
              >
                <option value="">בחר לקוח</option>
                {(customersQuery.data ?? []).map((c) => (
                  <option key={c.customerId} value={c.customerId}>{c.customerName}</option>
                ))}
              </Select>
              <Select
                label="אתר"
                required
                value={siteId}
                onChange={(e) => {
                  setSiteId(e.target.value);
                  clearRecommendationState();
                }}
              >
                <option value="">בחר אתר</option>
                {filteredSites.map((s) => (
                  <option key={s.siteId} value={s.siteId}>{s.siteName}</option>
                ))}
              </Select>
            </section>
          )}

          {step === 'schedule' && (
            <section className="newTaskModal__section">
              <h3 className="newTaskModal__sectionTitle">{currentStepLabel}</h3>
              <div className="newTaskModal__grid">
                <Input label="תאריך התחלה" type="date" value={plannedStartDate} onChange={(e) => {
                  setPlannedStartDate(e.target.value);
                  clearRecommendationState();
                }} required />
                <Input label="שעת התחלה" type="time" value={plannedStartTime} onChange={(e) => {
                  setPlannedStartTime(e.target.value);
                  clearRecommendationState();
                }} required />
                <Input label="תאריך סיום" type="date" value={plannedEndDate} onChange={(e) => {
                  setPlannedEndDate(e.target.value);
                  clearRecommendationState();
                }} required />
                <Input label="שעת סיום" type="time" value={plannedEndTime} onChange={(e) => {
                  setPlannedEndTime(e.target.value);
                  clearRecommendationState();
                }} required />
              </div>
              <Input
                label="סה״כ זמן (מחושב)"
                value={formatDurationMinutes(derivedDurationMinutes)}
                readOnly
              />
            </section>
          )}

          {step === 'assignment' && (
            <section className="newTaskModal__section">
              <h3 className="newTaskModal__sectionTitle">{currentStepLabel}</h3>
              <Select
                label="עובד משויך"
                value={employeeId}
                onChange={(e) => {
                  setEmployeeId(e.target.value);
                  if (acceptedRecommendation?.employeeId !== Number(e.target.value)) {
                    setAcceptedRecommendation(null);
                  }
                }}
              >
                <option value="">בחר עובד</option>
                {activeEmployees.map((e) => (
                  <option key={e.employeeId} value={e.employeeId}>
                    {e.fullName}
                    {(e.professions?.length ?? 0) > 0
                      ? ` · ${e.professions!.join(', ')}`
                      : e.primaryRole
                        ? ` · ${e.primaryRole}`
                        : ''}
                  </option>
                ))}
              </Select>
              {acceptedRecommendation && (
                <p className="newTaskModal__assignedNote">
                  נבחר מהמלצה: {acceptedRecommendation.employeeName}
                </p>
              )}

              <div className="newTaskModal__smartHead">
                <h4 className="newTaskModal__sectionTitle">שיבוץ חכם</h4>
                <p className="newTaskModal__hint">
                  ניתן להריץ שיבוץ חכם ללא בחירת עובד מראש. הבחירה הסופית נשארת בידיכם.
                </p>
              </div>

              <SmartAssignmentWeightSelector
                value={smartWeights}
                preset={smartWeightPreset}
                onPresetChange={setSmartWeightPreset}
                onChange={(weights) => {
                  setSmartWeights(weights);
                  clearRecommendationState();
                  setError(null);
                }}
                disabled={isSmartLoading || mutation.isPending}
              />

              <div className="newTaskModal__smartRun">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRunSmartRecommendation}
                  disabled={isSmartLoading || mutation.isPending || Boolean(smartWeightsError)}
                >
                  {draftCandidates ? 'הרץ שיבוץ חכם מחדש' : 'הרץ שיבוץ חכם'}
                </Button>
              </div>

              <div
                className="newTaskModal__smartResults"
                aria-live="polite"
                aria-busy={isSmartLoading}
              >
                {isSmartLoading && (
                  <div className="newTaskModal__smartLoading">
                    <PageSpinner />
                  </div>
                )}

                {!isSmartLoading && rankedCandidates.length > 0 && (
                  <section className="newTaskModal__candidateGroup" aria-labelledby="rankedCandidatesTitle">
                    <div className="newTaskModal__candidateGroupHead">
                      <h5 id="rankedCandidatesTitle">דירוג העובדים</h5>
                      <span>{rankedCandidates.length}</span>
                    </div>
                    <p className="newTaskModal__hint">
                      הציון הוא כלי תומך החלטה. ניתן לבחור כל עובד ברשימה, גם כשהציון נמוך.
                    </p>
                    {rankedCandidates.map((candidate, index) =>
                      renderRecommendationCandidate(candidate, index, rankedCandidates.length))}
                  </section>
                )}
              </div>
            </section>
          )}
        </div>

          <div className="newTaskModal__footer">
            {error && <InlineAlert variant="danger">{error}</InlineAlert>}
            {postSaveWarning && <InlineAlert variant="warning">{postSaveWarning}</InlineAlert>}
            <div className="newTaskModal__actions">
              {taskWasSaved ? (
                <Button type="button" onClick={handleClose}>סגור</Button>
              ) : (
                <>
                  {!isFirstStep && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleGoBack}
                      disabled={mutation.isPending}
                    >
                      חזור
                    </Button>
                  )}
                  {!isLastStep && (
                    <Button type="button" onClick={handleGoNext} disabled={mutation.isPending}>
                      המשך
                    </Button>
                  )}
                  {isLastStep && (
                    <Button type="submit" isLoading={mutation.isPending}>
                      שמור משימה
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleClose}
                    disabled={mutation.isPending}
                  >
                    ביטול
                  </Button>
                </>
              )}
            </div>
          </div>
        </form>
      </Drawer>
      <DraftRecommendationRatingDialog
        isOpen={ratingCandidate != null}
        candidate={ratingCandidate}
        value={ratingCandidate ? recommendationRatings[ratingCandidate.employeeId] : null}
        onClose={() => setRatingCandidateId(null)}
        onSave={(value) => {
          if (!ratingCandidate) return;
          setRecommendationRatings((current) => ({
            ...current,
            [ratingCandidate.employeeId]: value,
          }));
          setRatingCandidateId(null);
        }}
      />
    </>
  );
}
