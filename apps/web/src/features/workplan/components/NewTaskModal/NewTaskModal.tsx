import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Drawer } from '@shared/components/Drawer';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { Select } from '@shared/components/Select';
import { Textarea } from '@shared/components/Textarea';
import { InlineAlert } from '@shared/components/InlineAlert';
import { SegmentedControl } from '@shared/components/SegmentedControl';
import { PageSpinner } from '@shared/components/PageSpinner';
import {
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  type TaskCategory,
} from '@shared/constants/taskCategories';
import {
  durationMinutesBetweenUtc,
  formatDurationMinutes,
  localPartsToUtcIso,
} from '@shared/utils/utcDateTime';
import {
  assignEmployeeToWorkItemAsync,
  createWorkItemAsync,
  getDraftRecommendationsAsync,
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
import type {
  DraftRecommendationCandidate,
  WorkPlanEmployee,
  WorkPlanProjectFilter,
} from '../../types';
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
  const numericScore = Number(score);
  return `${Math.round(numericScore <= 1 ? numericScore * 100 : numericScore)}%`;
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
  const [plannedDate, setPlannedDate] = useState('');
  const [plannedStartTime, setPlannedStartTime] = useState('');
  const [plannedEndTime, setPlannedEndTime] = useState('');
  const [priority, setPriority] = useState<string>(WORKPLAN_PRIORITY_OPTIONS[1].code);
  const [requiredRole, setRequiredRole] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [draftCandidates, setDraftCandidates] = useState<DraftRecommendationCandidate[] | null>(
    null,
  );
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [acceptedRecommendation, setAcceptedRecommendation] = useState<{
    employeeId: number;
    employeeName: string;
  } | null>(null);
  const [isSmartLoading, setIsSmartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const derivedDurationMinutes = useMemo(() => {
    if (!plannedDate || !plannedStartTime || !plannedEndTime) return null;
    try {
      const start = localPartsToUtcIso(plannedDate, plannedStartTime);
      const end = localPartsToUtcIso(plannedDate, plannedEndTime);
      return durationMinutesBetweenUtc(start, end);
    } catch {
      return null;
    }
  }, [plannedDate, plannedStartTime, plannedEndTime]);

  const assignableEmployees = useMemo(
    () =>
      employees.filter((e) => e.isActive && e.isAssignable && e.employeeId > 0),
    [employees],
  );

  const filteredSites = useMemo(() => {
    const sites = sitesQuery.data ?? [];
    if (!customerId) return sites;
    return sites.filter((s) => String(s.customerId) === customerId);
  }, [sitesQuery.data, customerId]);

  const primaryRoles = primaryRolesQuery.data ?? [];

  function resetForm() {
    setIsMaximized(false);
    setStep('category');
    setTaskCategory(TASK_CATEGORIES.Project);
    setSelectedProjectId('');
    setMilestoneId('');
    setCustomerId('');
    setSiteId('');
    setTitle('');
    setDescription('');
    setPlannedDate('');
    setPlannedStartTime('');
    setPlannedEndTime('');
    setPriority(WORKPLAN_PRIORITY_OPTIONS[1].code);
    setRequiredRole('');
    setEmployeeId('');
    setDraftCandidates(null);
    setDraftMessage(null);
    setAcceptedRecommendation(null);
    setIsSmartLoading(false);
    setError(null);
  }

  function clearRecommendationState() {
    setDraftCandidates(null);
    setDraftMessage(null);
    setAcceptedRecommendation(null);
  }

  function buildPlannedUtcRange(): { plannedStart: string; plannedEnd: string } {
    if (!plannedDate || !plannedStartTime || !plannedEndTime) {
      throw new Error('יש להזין תאריך, שעת התחלה ושעת סיום');
    }
    const plannedStart = localPartsToUtcIso(plannedDate, plannedStartTime);
    const plannedEnd = localPartsToUtcIso(plannedDate, plannedEndTime);
    const minutes = durationMinutesBetweenUtc(plannedStart, plannedEnd);
    if (minutes == null || minutes <= 0) {
      throw new Error('זמן הסיום חייב להיות אחרי זמן ההתחלה');
    }
    return { plannedStart, plannedEnd };
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
    try {
      validateScheduleStep();
      const { plannedStart, plannedEnd } = buildPlannedUtcRange();
      setIsSmartLoading(true);
      setError(null);

      const result = await getDraftRecommendationsAsync({
        taskCategory,
        projectId: parsedProjectId,
        customerId: customerId ? Number(customerId) : null,
        siteId: siteId ? Number(siteId) : null,
        plannedStart,
        plannedEnd,
        priority: priority || null,
        requiredRole: requiredRole || null,
      });

      setDraftCandidates(result.candidates);
      setDraftMessage(result.message);
      if (result.candidates.length === 0) {
        setError('לא נמצאו עובדים מתאימים. ניתן לבחור עובד ידנית ולשמור.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'הרצת שיבוץ חכם נכשלה');
    } finally {
      setIsSmartLoading(false);
    }
  }

  function handleAcceptRecommendation(candidate: DraftRecommendationCandidate) {
    setEmployeeId(String(candidate.employeeId));
    setAcceptedRecommendation({
      employeeId: candidate.employeeId,
      employeeName: candidate.fullName ?? `עובד #${candidate.employeeId}`,
    });
    setError(null);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      validateAssignmentStep();
      const parsedEmployeeId = Number(employeeId);
      if (!Number.isInteger(parsedEmployeeId) || parsedEmployeeId <= 0) {
        throw new Error('יש לבחור עובד תקין לשיוך');
      }

      const { plannedStart, plannedEnd } = buildPlannedUtcRange();
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
          requiredRole: requiredRole || null,
          isLocked: false,
        });
        workItemId = created.workItemId;
        await assignEmployeeToServiceCallAsync(workItemId, {
          employeeId: parsedEmployeeId,
          assignmentRole: requiredRole || 'Executor',
        });
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
          requiredRole: requiredRole || null,
        });
        workItemId = created.workItemId ?? 0;
        if (!workItemId) throw new Error('השרת לא החזיר מזהה משימה תקין');
        await assignEmployeeToWorkItemAsync(workItemId, {
          employeeId: parsedEmployeeId,
          assignmentRole: requiredRole || 'Executor',
        });
      }

      return { workItemId, projectId: parsedProjectId };
    },
    onSuccess: async (result) => {
      resetForm();
      onClose();
      await invalidateWorkPlanQueries(queryClient, result.projectId);
      if (taskCategory === TASK_CATEGORIES.ServiceCall) {
        await queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });
      }
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'יצירת המשימה נכשלה');
    },
  });

  function handleClose() {
    resetForm();
    onClose();
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

  function renderRequiredRoleSelect() {
    if (primaryRolesQuery.isLoading) {
      return (
        <Select label="תפקיד נדרש" value="" disabled>
          <option value="">טוען תפקידים...</option>
        </Select>
      );
    }

    if (primaryRolesQuery.isError) {
      return (
        <div className="newTaskModal__field">
          <InlineAlert variant="danger">
            טעינת תפקידים נכשלה. יש לפרוס את sp_Employees_GetDistinctPrimaryRoles בבסיס הנתונים.
          </InlineAlert>
          <Select
            label="תפקיד נדרש"
            value={requiredRole}
            onChange={(e) => {
              setRequiredRole(e.target.value);
              clearRecommendationState();
            }}
          >
            <option value="">בחר תפקיד</option>
          </Select>
        </div>
      );
    }

    return (
      <Select
        label="תפקיד נדרש"
        value={requiredRole}
        onChange={(e) => {
          setRequiredRole(e.target.value);
          clearRecommendationState();
        }}
      >
        <option value="">בחר תפקיד</option>
        {primaryRoles.length === 0 ? (
          <option value="" disabled>
            אין תפקידים זמינים
          </option>
        ) : (
          primaryRoles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))
        )}
      </Select>
    );
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title="משימה חדשה"
      isMaximized={isMaximized}
      onToggleMaximize={() => setIsMaximized((v) => !v)}
    >
      <form
        className="newTaskModal"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
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

        <div className="newTaskModal__body">
          {step === 'category' && (
            <section className="newTaskModal__section">
              <h3 className="newTaskModal__sectionTitle">{currentStepLabel}</h3>
              <SegmentedControl
                ariaLabel="סוג משימה"
                items={TASK_CATEGORY_OPTIONS}
                value={taskCategory}
                onChange={handleCategoryChange}
              />
              <Input label="כותרת" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <Textarea
                label="תיאור"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
              <div className="newTaskModal__grid">
                <Select label="דחיפות" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {WORKPLAN_PRIORITY_OPTIONS.map((o) => (
                    <option key={o.code} value={o.code}>{o.display}</option>
                  ))}
                </Select>
                {renderRequiredRoleSelect()}
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
                <Input label="תאריך" type="date" value={plannedDate} onChange={(e) => {
                  setPlannedDate(e.target.value);
                  clearRecommendationState();
                }} required />
                <Input label="שעת התחלה" type="time" value={plannedStartTime} onChange={(e) => {
                  setPlannedStartTime(e.target.value);
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
                {assignableEmployees.map((e) => (
                  <option key={e.employeeId} value={e.employeeId}>
                    {e.fullName}{e.primaryRole ? ` · ${e.primaryRole}` : ''}
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
                  ניתן להריץ שיבוץ חכם ללא בחירת עובד מראש. בחירת עובד מומלץ תתבצע רק בלחיצה מפורשת.
                </p>
              </div>

              {isSmartLoading && (
                <div className="newTaskModal__smartLoading">
                  <PageSpinner />
                </div>
              )}

              {!isSmartLoading && draftMessage && (
                <p className="newTaskModal__smartMessage">{draftMessage}</p>
              )}

              {!isSmartLoading &&
                draftCandidates?.map((candidate) => (
                  <div className="newTaskModal__recommendation" key={candidate.employeeId}>
                    <div className="newTaskModal__recommendationHead">
                      <div className="newTaskModal__recommendationWho">
                        <span className="newTaskModal__recommendationLabel">מומלץ</span>
                        <strong className="newTaskModal__recommendationName">
                          {candidate.fullName ?? `עובד #${candidate.employeeId}`}
                        </strong>
                      </div>
                      {candidate.totalScore != null && (
                        <span className="newTaskModal__score">
                          {formatRecommendationScore(candidate.totalScore)}
                        </span>
                      )}
                    </div>

                    {candidate.recommendationSummary && (
                      <p className="newTaskModal__hint">{candidate.recommendationSummary}</p>
                    )}

                    {candidate.warnings.length > 0 && (
                      <ul className="newTaskModal__reasons">
                        {candidate.warnings.map((warning) => (
                          <li key={warning} className="newTaskModal__warning">
                            {warning}
                          </li>
                        ))}
                      </ul>
                    )}

                    {candidate.factors.length > 0 && (
                      <ul className="newTaskModal__factors">
                        {candidate.factors.map((factor) => (
                          <li className="newTaskModal__factor" key={factor.key}>
                            <div className="newTaskModal__factorHead">
                              <span className="newTaskModal__factorLabel">{factor.label}</span>
                              <span className="newTaskModal__factorScore">
                                {formatRecommendationScore(factor.score)}
                              </span>
                            </div>
                            <span className="newTaskModal__factorExplain">{factor.explanation}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <Button
                      type="button"
                      variant={
                        acceptedRecommendation?.employeeId === candidate.employeeId
                          ? 'secondary'
                          : 'primary'
                      }
                      onClick={() => handleAcceptRecommendation(candidate)}
                      disabled={!candidate.isEligible}
                    >
                      {acceptedRecommendation?.employeeId === candidate.employeeId
                        ? 'נבחר'
                        : 'בחר עובד מומלץ'}
                    </Button>
                  </div>
                ))}

              <div className="newTaskModal__smartRun">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRunSmartRecommendation}
                  disabled={isSmartLoading}
                >
                  {draftCandidates ? 'הרץ שיבוץ חכם מחדש' : 'הרץ שיבוץ חכם'}
                </Button>
              </div>
            </section>
          )}
        </div>

        <div className="newTaskModal__footer">
          {error && <InlineAlert variant="danger">{error}</InlineAlert>}
          <div className="newTaskModal__actions">
            {!isFirstStep && (
              <Button type="button" variant="secondary" onClick={handleGoBack}>
                חזור
              </Button>
            )}
            {!isLastStep && (
              <Button type="button" onClick={handleGoNext}>
                המשך
              </Button>
            )}
            {isLastStep && (
              <>
                <Button type="submit" isLoading={mutation.isPending}>
                  שמור משימה
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleRunSmartRecommendation}
                  disabled={isSmartLoading}
                >
                  {draftCandidates ? 'הרץ שיבוץ חכם מחדש' : 'הרץ שיבוץ חכם'}
                </Button>
              </>
            )}
            <Button type="button" variant="secondary" onClick={handleClose}>ביטול</Button>
          </div>
        </div>
      </form>
    </Drawer>
  );
}
