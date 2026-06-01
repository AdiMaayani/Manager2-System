import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Drawer } from '@shared/components/Drawer';
import { Button } from '@shared/components/Button';
import { Input } from '@shared/components/Input';
import { PageSpinner } from '@shared/components/PageSpinner';
import { isLocalDataMode } from '@/config/appConfig';
import { assignEmployeeToWorkItemAsync, createWorkItemAsync } from '../../api/workplanApiClient';
import { fetchSmartAssignmentAsync } from '../../hooks/useWorkPlanData';
import { WORKPLAN_PRIORITY_OPTIONS, WORKPLAN_STATUS_OPTIONS } from '../../constants';
import type { SmartAssignmentResponse, WorkPlanEmployee, WorkPlanProjectFilter } from '../../types';
import './NewTaskModal.css';

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

type NewTaskStep = 'details' | 'assignment' | 'recommendation';

interface AcceptedRecommendation {
  employeeId: number;
  employeeName: string;
  score?: number | null;
  reasons: string[];
  warnings: string[];
}

const STEPS: Array<{ id: NewTaskStep; label: string }> = [
  { id: 'details', label: 'פרטי משימה' },
  { id: 'assignment', label: 'שיוך עובד' },
  { id: 'recommendation', label: 'המלצת שיבוץ' },
];

const ROLE_OPTIONS = ['מתקין', 'מנהל פרויקט', 'טכנאי'];

function combineDateAndTime(date: string, time: string): string | null {
  if (!date || !time) return null;
  return `${date}T${time}:00`;
}

function formatRecommendationScore(score?: number | null): string {
  if (score == null || Number.isNaN(Number(score))) return '—';
  const numericScore = Number(score);
  return `${Math.round(numericScore <= 1 ? numericScore * 100 : numericScore)}%`;
}

function resolveRecommendation(result: SmartAssignmentResponse): AcceptedRecommendation | null {
  const loadBasedEmployee = [...result.employeeLoad]
    .filter((employee) => employee.employeeId > 0)
    .sort((left, right) => left.loadPercentage - right.loadPercentage)[0];

  if (loadBasedEmployee) {
    return {
      employeeId: loadBasedEmployee.employeeId,
      employeeName: loadBasedEmployee.employeeName,
      score: null,
      reasons: ['נבחר לפי עומס העובדים הנמוך ביותר בפרויקט.'],
      warnings: [],
    };
  }

  const taskRecommendation = [...result.taskResults]
    .filter((row) => row.recommendedEmployeeId != null)
    .sort((left, right) => right.score - left.score)[0];

  if (!taskRecommendation?.recommendedEmployeeId) return null;

  return {
    employeeId: taskRecommendation.recommendedEmployeeId,
    employeeName: taskRecommendation.recommendedEmployeeName ?? `עובד #${taskRecommendation.recommendedEmployeeId}`,
    score: taskRecommendation.score,
    reasons: taskRecommendation.reasons,
    warnings: [...taskRecommendation.warnings, ...taskRecommendation.violations],
  };
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
  const [step, setStep] = useState<NewTaskStep>('details');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedEnd, setPlannedEnd] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [status, setStatus] = useState<string>(WORKPLAN_STATUS_OPTIONS[0].code);
  const [priority, setPriority] = useState<string>(WORKPLAN_PRIORITY_OPTIONS[1].code);
  const [requiredRole, setRequiredRole] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [smartResult, setSmartResult] = useState<SmartAssignmentResponse | null>(null);
  const [recommendation, setRecommendation] = useState<AcceptedRecommendation | null>(null);
  const [acceptedRecommendation, setAcceptedRecommendation] = useState<AcceptedRecommendation | null>(null);
  const [isSmartLoading, setIsSmartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parentId = useMemo(() => {
    const parsed = Number(selectedProjectId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [selectedProjectId]);

  const assignableEmployees = useMemo(
    () =>
      employees.filter((employee) => employee.isActive && employee.isAssignable && employee.employeeId > 0),
    [employees],
  );

  useEffect(() => {
    if (!isOpen) return;

    const projectId = typeof projectFilter === 'number' ? projectFilter : defaultProjectId;
    setSelectedProjectId(projectId ? String(projectId) : '');
    setStep('details');
    setError(null);
  }, [defaultProjectId, isOpen, projectFilter]);

  function resetForm() {
    setStep('details');
    setTitle('');
    setDescription('');
    setPlannedDate('');
    setPlannedStart('');
    setPlannedEnd('');
    setEstimatedHours('');
    setStatus(WORKPLAN_STATUS_OPTIONS[0].code);
    setPriority(WORKPLAN_PRIORITY_OPTIONS[1].code);
    setRequiredRole('');
    setEmployeeId('');
    setSmartResult(null);
    setRecommendation(null);
    setAcceptedRecommendation(null);
    setIsSmartLoading(false);
    setError(null);
  }

  function validateDetails() {
    if (!parentId) throw new Error('יש לבחור פרויקט לפני יצירת משימה');
    if (!title.trim()) throw new Error('יש להזין כותרת משימה');
    if (!plannedDate || !plannedStart || !plannedEnd) {
      throw new Error('יש להזין תאריך ושעות עבודה מתוכננות');
    }
    if (plannedEnd <= plannedStart) {
      throw new Error('שעת סיום חייבת להיות אחרי שעת התחלה');
    }
  }

  function validateAssignment() {
    validateDetails();
    if (!employeeId) throw new Error('יש לבחור עובד לשיוך');
  }

  async function handleRunSmartRecommendation() {
    try {
      validateDetails();
      setIsSmartLoading(true);
      setError(null);
      const result = await fetchSmartAssignmentAsync(parentId);
      const resolvedRecommendation = resolveRecommendation(result);
      setSmartResult(result);
      setRecommendation(resolvedRecommendation);
      setAcceptedRecommendation(null);
      if (!resolvedRecommendation) {
        setError('לא נמצאה המלצת שיבוץ לפרויקט. ניתן לבחור עובד ידנית ולשמור.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'הרצת שיבוץ חכם נכשלה');
    } finally {
      setIsSmartLoading(false);
    }
  }

  function handleAcceptRecommendation() {
    if (!recommendation) return;
    setEmployeeId(String(recommendation.employeeId));
    setAcceptedRecommendation(recommendation);
    setError(null);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      validateAssignment();
      if (!isLocalDataMode) {
        throw new Error('יצירת משימות זמינה רק בחיבור לשרת אמיתי');
      }

      const parsedEmployeeId = Number(employeeId);
      if (!Number.isInteger(parsedEmployeeId) || parsedEmployeeId <= 0) {
        throw new Error('יש לבחור עובד תקין לשיוך');
      }

      if (recommendation) {
        if (!acceptedRecommendation || acceptedRecommendation.employeeId !== parsedEmployeeId) {
          throw new Error('יש לאשר את המלצת השיבוץ לפני שמירת המשימה');
        }
      }

      const created = await createWorkItemAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        billingType: 'Hourly',
        parentWorkItemId: parentId,
        plannedStart: combineDateAndTime(plannedDate, plannedStart),
        plannedEnd: combineDateAndTime(plannedDate, plannedEnd),
        estimatedHours: estimatedHours ? Number(estimatedHours) : null,
        priority,
        requiredRole: requiredRole || null,
      });

      const workItemId = created?.workItemId;
      if (!workItemId || workItemId <= 0) {
        throw new Error('השרת לא החזיר מזהה משימה תקין');
      }

      await assignEmployeeToWorkItemAsync(workItemId, {
        employeeId: parsedEmployeeId,
        assignmentRole: requiredRole || 'Executor',
      });

      return created;
    },
    onSuccess: async () => {
      resetForm();
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'יצירת המשימה נכשלה');
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workplan'] });
    },
  });

  function handleClose() {
    resetForm();
    onClose();
  }

  function handleContinueFromDetails() {
    try {
      validateDetails();
      setError(null);
      setStep('assignment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'המעבר לשלב הבא נכשל');
    }
  }

  async function handleContinueFromAssignment() {
    try {
      validateDetails();
      setError(null);
      setStep('recommendation');
      await handleRunSmartRecommendation();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'המעבר לשלב הבא נכשל');
    }
  }

  return (
    <Drawer isOpen={isOpen} onClose={handleClose} title="משימה חדשה">
      <form
        className="newTaskModal"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="newTaskModal__steps" aria-label="שלבי יצירת משימה">
          {STEPS.map((item) => (
            <span
              key={item.id}
              className={`newTaskModal__step ${step === item.id ? 'newTaskModal__step--active' : ''}`}
              aria-current={step === item.id ? 'step' : undefined}
            >
              {item.label}
            </span>
          ))}
        </div>

        {step === 'details' && (
          <section className="newTaskModal__section">
            <h3 className="newTaskModal__sectionTitle">פרטי משימה</h3>
            <label className="newTaskModal__field">
              <span>פרויקט</span>
              <select
                className="newTaskModal__select"
                value={selectedProjectId}
                onChange={(event) => {
                  setSelectedProjectId(event.target.value);
                  setSmartResult(null);
                  setRecommendation(null);
                  setAcceptedRecommendation(null);
                }}
                required
              >
                <option value="">בחר פרויקט</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.title}
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="כותרת משימה"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <label className="newTaskModal__field">
              <span>תיאור</span>
              <textarea
                className="newTaskModal__textarea"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
              />
            </label>

            <div className="newTaskModal__grid">
              <Input
                label="תאריך מתוכנן"
                type="date"
                value={plannedDate}
                onChange={(event) => setPlannedDate(event.target.value)}
                required
              />
              <Input
                label="שעת התחלה"
                type="time"
                value={plannedStart}
                onChange={(event) => setPlannedStart(event.target.value)}
                required
              />
              <Input
                label="שעת סיום"
                type="time"
                value={plannedEnd}
                onChange={(event) => setPlannedEnd(event.target.value)}
                required
              />
              <Input
                label="הערכת שעות"
                type="number"
                min="0"
                step="0.5"
                value={estimatedHours}
                onChange={(event) => setEstimatedHours(event.target.value)}
              />
            </div>

            <div className="newTaskModal__grid">
              <label className="newTaskModal__field">
                <span>סטטוס</span>
                <select
                  className="newTaskModal__select"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  {WORKPLAN_STATUS_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.display}
                    </option>
                  ))}
                </select>
              </label>
              <label className="newTaskModal__field">
                <span>דחיפות</span>
                <select
                  className="newTaskModal__select"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                >
                  {WORKPLAN_PRIORITY_OPTIONS.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.display}
                    </option>
                  ))}
                </select>
              </label>
              <label className="newTaskModal__field">
                <span>תפקיד נדרש</span>
                <select
                  className="newTaskModal__select"
                  value={requiredRole}
                  onChange={(event) => setRequiredRole(event.target.value)}
                >
                  <option value="">בחר תפקיד</option>
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        )}

        {step === 'assignment' && (
          <section className="newTaskModal__section">
            <h3 className="newTaskModal__sectionTitle">שיוך עובד</h3>
            <label className="newTaskModal__field">
              <span>עובד משויך</span>
              <select
                className="newTaskModal__select"
                value={employeeId}
                onChange={(event) => {
                  setEmployeeId(event.target.value);
                  if (acceptedRecommendation?.employeeId !== Number(event.target.value)) {
                    setAcceptedRecommendation(null);
                  }
                }}
              >
                <option value="">בחר עובד</option>
                {assignableEmployees.map((employee) => (
                  <option key={employee.employeeId} value={employee.employeeId}>
                    {employee.fullName} {employee.primaryRole ? `· ${employee.primaryRole}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <p className="newTaskModal__hint">
              ניתן לבחור עובד ידנית או להמשיך לשלב ההמלצה כדי לקבל שיבוץ חכם.
            </p>
          </section>
        )}

        {step === 'recommendation' && (
          <section className="newTaskModal__section">
            <h3 className="newTaskModal__sectionTitle">המלצת שיבוץ חכם</h3>
            {!smartResult && !isSmartLoading && (
              <p className="newTaskModal__hint">
                ההמלצה תיבנה לפי משימות הפרויקט, עומסי העובדים והכללים הקיימים.
              </p>
            )}

            {isSmartLoading && <PageSpinner />}

            {smartResult && (
              <div className="newTaskModal__smartSummary">
                <strong>{smartResult.summary.message}</strong>
                <span>משימות: {smartResult.summary.totalTasks}</span>
                <span>המלצות: {smartResult.summary.tasksWithRecommendations}</span>
                <span>אזהרות: {smartResult.summary.warningsCount}</span>
              </div>
            )}

            {recommendation && (
              <div className="newTaskModal__recommendation">
                <div>
                  <span className="newTaskModal__recommendationLabel">עובד מומלץ</span>
                  <strong>{recommendation.employeeName}</strong>
                  <span>ציון: {formatRecommendationScore(recommendation.score)}</span>
                </div>

                {recommendation.reasons.length > 0 && (
                  <ul>
                    {recommendation.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}

                {recommendation.warnings.length > 0 && (
                  <p className="newTaskModal__hint">{recommendation.warnings.join(' · ')}</p>
                )}

                <Button
                  type="button"
                  variant={acceptedRecommendation ? 'secondary' : 'primary'}
                  onClick={handleAcceptRecommendation}
                >
                  {acceptedRecommendation ? 'ההמלצה התקבלה' : 'קבל המלצה'}
                </Button>
              </div>
            )}

            <Button type="button" variant="secondary" onClick={handleRunSmartRecommendation} disabled={isSmartLoading}>
              {smartResult ? 'הרץ המלצה מחדש' : 'הרץ שיבוץ חכם'}
            </Button>
          </section>
        )}

        {error && <p className="newTaskModal__error">{error}</p>}

        <div className="newTaskModal__actions">
          {step !== 'details' && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStep(step === 'recommendation' ? 'assignment' : 'details')}
            >
              חזור
            </Button>
          )}
          {step === 'details' && (
            <Button type="button" onClick={handleContinueFromDetails}>
              המשך
            </Button>
          )}
          {step === 'assignment' && (
            <Button type="button" onClick={handleContinueFromAssignment} disabled={isSmartLoading}>
              {isSmartLoading ? 'מריץ שיבוץ...' : 'המשך'}
            </Button>
          )}
          {step === 'recommendation' && (
            <Button type="submit" disabled={mutation.isPending || isSmartLoading}>
              {mutation.isPending ? 'שומר...' : 'שמור משימה'}
            </Button>
          )}
          <Button type="button" variant="secondary" onClick={handleClose}>
            ביטול
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
