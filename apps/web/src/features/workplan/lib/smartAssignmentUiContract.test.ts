import { describe, expect, it } from 'vitest';
import newTaskModalSource from '../components/NewTaskModal/NewTaskModal.tsx?raw';
import ratingDialogSource from '../components/DraftRecommendationRatingDialog/DraftRecommendationRatingDialog.tsx?raw';
import feedbackPanelSource from '../components/RecommendationFeedbackPanel/RecommendationFeedbackPanel.tsx?raw';
import taskPanelSource from '../components/WorkPlanTaskPanel/WorkPlanTaskPanel.tsx?raw';
import editTaskDrawerSource from '../components/EditTaskDrawer/EditTaskDrawer.tsx?raw';
import workplanTypesSource from '../types.ts?raw';
import apiClientSource from '../api/workplanApiClient.ts?raw';
import employeeDrawerSource from '../../employees/components/EmployeeDrawer/EmployeeDrawer.tsx?raw';
import serviceCallDrawerSource from '../../serviceCalls/components/ServiceCallDrawer/ServiceCallDrawer.tsx?raw';

describe('smart assignment UI source contract', () => {
  it('keeps accordion expansion accessible and separate from candidate selection', () => {
    expect(newTaskModalSource).toContain('aria-expanded={isExpanded}');
    expect(newTaskModalSource).toContain('aria-controls={panelId}');
    expect(newTaskModalSource).toContain('hidden={!isExpanded}');
    expect(newTaskModalSource).toContain(
      'toggleExpandedRecommendation(current, candidate.employeeId)',
    );
    expect(newTaskModalSource).toContain(
      'onClick={() => handleAcceptRecommendation(candidate)}',
    );
    expect(newTaskModalSource).not.toContain('disabled={!isSelectable}');
  });

  it('uses one relative ranked list and allows every returned candidate to be selected', () => {
    expect(newTaskModalSource).toContain('<h5 id="rankedCandidatesTitle">דירוג העובדים</h5>');
    expect(newTaskModalSource).toContain('getRecommendationCandidateLabel(index, total)');
    expect(newTaskModalSource).not.toContain('לא מתאימים כרגע');
    expect(newTaskModalSource).not.toContain('לא ניתן לבחור');
    expect(newTaskModalSource).not.toContain('recommendationGroups.eligible');
    expect(newTaskModalSource).not.toContain('recommendationGroups.ineligible');
  });

  it('shows every active employee in the manual selector regardless of IsAssignable', () => {
    expect(newTaskModalSource).toContain(
      'employees.filter((employee) => employee.isActive && employee.employeeId > 0)',
    );
    expect(newTaskModalSource).not.toContain('employee.isAssignable !== false');
  });

  it('makes repeated required-profession selection explicit and accessible', () => {
    expect(newTaskModalSource).toContain('ChevronDown, Flag, MapPin, Plus');
    expect(newTaskModalSource).toContain('className="newTaskModal__professionAddPrompt"');
    expect(newTaskModalSource).toContain('role="status"');
    expect(newTaskModalSource).toContain('aria-live="polite"');
    expect(newTaskModalSource).toContain('ניתן להוסיף מספר מקצועות');
    expect(newTaskModalSource).toContain('הוסף מקצוע נוסף');
  });

  it('preserves stale-response protection and invalidates expanded recommendation state', () => {
    expect(newTaskModalSource).toContain('new AbortController()');
    expect(newTaskModalSource).toContain(
      'requestId !== recommendationRequestIdRef.current',
    );
    expect(newTaskModalSource).toContain(
      'setExpandedCandidateId(null)',
    );
    expect(newTaskModalSource).toContain('clearRecommendationState()');
  });

  it('sends per-run weights, renders one factual explanation and keeps one smart-run CTA', () => {
    expect(newTaskModalSource).toContain('weights: smartWeights');
    expect(newTaskModalSource).toContain('<SmartAssignmentWeightSelector');
    expect(newTaskModalSource).toContain('getRecommendationFactorExplanation(candidate, factor)');
    expect(newTaskModalSource).toContain('פירוט חמשת גורמי החישוב');
    expect(newTaskModalSource).not.toContain('newTaskModal__professionMatch');
    expect(newTaskModalSource).not.toContain('newTaskModal__routeMeta');
    expect(newTaskModalSource).not.toContain('candidate.recommendationSummary');
    expect(newTaskModalSource).not.toContain('candidate.exclusionReason');
    expect(newTaskModalSource.match(/onClick=\{handleRunSmartRecommendation\}/g)).toHaveLength(1);
  });

  it('shows the real route origin and destination as one labelled geographic block', () => {
    expect(newTaskModalSource).toContain('getRecommendationRouteEndpoints(factor)');
    expect(newTaskModalSource).toContain('aria-label="מוצא ויעד לחישוב הנסיעה"');
    expect(newTaskModalSource).toContain('מוצא העובד');
    expect(newTaskModalSource).toContain('יעד המשימה');
    expect(newTaskModalSource.match(/newTaskModal__routeEndpoints/g)).toHaveLength(1);
  });

  it('announces recommendation loading and never displays raw recommendation API errors', () => {
    expect(newTaskModalSource).toContain('aria-live="polite"');
    expect(newTaskModalSource).toContain('aria-busy={isSmartLoading}');
    expect(newTaskModalSource).toContain('לא הצלחנו להריץ את השיבוץ החכם. נסו שוב בעוד כמה רגעים.');
    expect(newTaskModalSource).not.toContain("setError(err instanceof Error ? err.message : 'הרצת שיבוץ חכם נכשלה')");
  });

  it('shows one employee-assignment section with all direct assignments', () => {
    expect(taskPanelSource).toContain('שיבוץ עובדים');
    expect(taskPanelSource).toContain('const directAssignments = assignments.filter');
    expect(taskPanelSource).toContain("assignment.assignmentSource === 'Task'");
    expect(taskPanelSource).toContain('displayedAssignments.map');
    expect(taskPanelSource).not.toContain('<dt>מבצע</dt>');
    expect(feedbackPanelSource).not.toContain('דירוג המלצת השיבוץ');
    expect(feedbackPanelSource).not.toContain('הדירוג נשמר לצורך צפייה וניתוח עתידי');
  });

  it('loads only exact smart-assignment feedback and exposes its persisted recommendation', () => {
    expect(feedbackPanelSource).toContain('useQuery({');
    expect(feedbackPanelSource).toContain('getSmartAssignmentAssignmentFeedbackAsync');
    expect(feedbackPanelSource).toContain('smartAssignmentFeedbackQueryKey(taskId, assignedEmployeeId ?? 0)');
    expect(feedbackPanelSource).toContain('enabled: isSmartAssignment');
    expect(feedbackPanelSource).toContain('שיבוץ חכם');
    expect(feedbackPanelSource).toContain('שיבוץ ידני');
    expect(feedbackPanelSource).toContain('צפה בהמלצה');
    expect(feedbackPanelSource).toContain('aria-expanded={isRecommendationOpen}');
    expect(feedbackPanelSource).toContain('aria-controls={detailsId}');
    expect(feedbackPanelSource).toContain('פירוט חמשת גורמי החישוב');
    expect(feedbackPanelSource).toContain('רציפות כשובר שוויון');
    expect(feedbackPanelSource).toContain('נסיעה לפי Geoapify');
    expect(feedbackPanelSource).toContain('המלצה זו לא דורגה.');
    expect(feedbackPanelSource).toContain('ערוך דירוג');
    expect(feedbackPanelSource).toContain('הוסף דירוג');
    expect(feedbackPanelSource).not.toContain('getSmartAssignmentRecommendationsAsync');
    expect(apiClientSource).toContain('/assignment-feedback?${params.toString()}');
  });

  it('never synthesizes feedback context and keeps manual assignments recommendation-free', () => {
    expect(feedbackPanelSource).toContain('const context = getAssignmentFeedbackContext(feedbackQuery.data)');
    expect(feedbackPanelSource).toContain('Missing persisted recommendation metadata.');
    expect(feedbackPanelSource).toContain('אין המלצה חכמה לצפייה או לדירוג');
    expect(feedbackPanelSource).not.toContain('saveRun: true');
    expect(feedbackPanelSource).not.toContain('workItemIds: [taskId]');
    expect(feedbackPanelSource).toContain('queryClient.invalidateQueries({ queryKey })');
    expect(apiClientSource).toContain("'/SmartAssignment/feedback'");
  });

  it('offers employee replacement only inside task editing and sends no role field', () => {
    expect(taskPanelSource).toContain('assignment.workEmployeeAssignmentId');
    expect(taskPanelSource).toContain('isReadOnly={isReadOnly || task.isLocked}');
    expect(taskPanelSource).toContain('assignments={directAssignments}');
    expect(taskPanelSource).not.toContain('AssignmentEditDialog');
    expect(taskPanelSource).not.toContain('setEditingAssignment');
    expect(feedbackPanelSource).not.toContain('החלף עובד');
    expect(feedbackPanelSource).not.toContain('onEdit');
    expect(editTaskDrawerSource).toContain('employee.isActive');
    expect(editTaskDrawerSource).toContain('employee.employeeId > 0');
    expect(editTaskDrawerSource).toContain('employee.employeeId !== assignment.employeeId');
    expect(editTaskDrawerSource).toContain('עובד משובץ כעת');
    expect(editTaskDrawerSource).toContain(
      'const [isReplacementOpen, setIsReplacementOpen] = useState(false);',
    );
    expect(editTaskDrawerSource).toContain('החלף עובד');
    expect(editTaskDrawerSource).toContain('{isReplacementOpen && (');
    expect(editTaskDrawerSource).toContain('{selectedEmployee && (');
    expect(editTaskDrawerSource).toContain('עובד מחליף: {selectedEmployee.fullName}');
    expect(editTaskDrawerSource).toContain('בטל החלפה');
    expect(editTaskDrawerSource).not.toContain('עובד נבחר');
    expect(editTaskDrawerSource).not.toContain('טרם נבחר עובד חלופי');
    expect(editTaskDrawerSource.match(/מקצועות:/g)).toHaveLength(2);
    expect(editTaskDrawerSource).toContain('const employeeReplacements = replacements.map');
    expect(editTaskDrawerSource).toContain(
      'workEmployeeAssignmentId: replacement.assignmentId',
    );
    expect(editTaskDrawerSource).toContain('employeeReplacements,');
    expect(editTaskDrawerSource).not.toContain('replaceEmployeeAssignmentAsync(');
    expect(editTaskDrawerSource).not.toContain('Promise.all(replacements');
    expect(editTaskDrawerSource).not.toContain('תפקיד בשיוך');
    expect(workplanTypesSource).toContain(
      'export interface ReplaceEmployeeAssignmentRequest {\n  employeeId: number;\n}',
    );
    expect(workplanTypesSource).toContain(
      'employeeReplacements?: EmployeeAssignmentReplacementRequest[];',
    );
    expect(apiClientSource).toContain(
      '`/WorkItems/${workItemId}/employee-assignments/${assignmentId}`',
    );
    expect(apiClientSource).toContain("method: 'PUT'");
    expect(editTaskDrawerSource).toContain('replacementEmployeeIds');
    expect(editTaskDrawerSource).toContain('לעדכון הנתונים לחץ שמור.');
    expect(editTaskDrawerSource).not.toContain('החלפת עובד זמינה כאן בלבד');
    expect(editTaskDrawerSource).not.toContain('שמור החלפת עובד');
  });

  it('updates a task through the dedicated endpoint that preserves an omitted status', () => {
    expect(apiClientSource).toContain('`/WorkItems/task/${workItemId}`');
    expect(apiClientSource).toContain('body: JSON.stringify(request)');
  });

  it('offers an optional per-candidate recommendation rating dialog and defers persistence', () => {
    expect(newTaskModalSource).toContain('דירוג המלצה');
    expect(newTaskModalSource).toContain('setRatingCandidateId(candidate.employeeId)');
    expect(newTaskModalSource).toContain('<DraftRecommendationRatingDialog');
    expect(newTaskModalSource).toContain('saveRun: true');
    expect(newTaskModalSource).toContain('saveSmartAssignmentFeedbackAsync');
    expect(newTaskModalSource).toContain('דורג {recommendationRatings[candidate.employeeId].rating}/10');
    expect(ratingDialogSource).toContain('הדירוג אופציונלי');
    expect(ratingDialogSource).toContain('1–10');
    expect(ratingDialogSource).toContain('maxLength={1000}');
    expect(ratingDialogSource).toContain('isValidRecommendationRating(rating)');
    expect(newTaskModalSource).toContain('selectedFromSmartRecommendation');
    expect(newTaskModalSource).toContain('ratings.length === 0 && !shouldPersistSmartContext');
    expect(newTaskModalSource).toContain('...(recommendationRunId != null ? { recommendationRunId } : {})');
    expect(newTaskModalSource.indexOf('persistDraftRecommendationContext('))
      .toBeLessThan(newTaskModalSource.indexOf('assignEmployeeToWorkItemAsync(workItemId'));
  });

  it('prevents a duplicate create after a post-save assignment or feedback warning', () => {
    expect(newTaskModalSource).toContain('if (!taskWasSaved) mutation.mutate()');
    expect(newTaskModalSource).toContain('setTaskWasSaved(true)');
    expect(newTaskModalSource).toContain('postSaveWarning && <InlineAlert variant="warning"');
    expect(newTaskModalSource).toContain('>סגור</Button>');
  });

  it('sends all employee professions while preserving the primary-role contract', () => {
    expect(employeeDrawerSource).toContain('professions: selectedProfessions');
    expect(employeeDrawerSource).toContain(
      'buildEmployeeProfessions(form.primaryRole, form.professions)',
    );
    expect(employeeDrawerSource).toContain('isRequiredProfessionSelected');
    expect(employeeDrawerSource).toContain('aria-label="מקצועות העובד"');
  });

  it('keeps service-call multi-role edits additive and legacy compatible', () => {
    expect(serviceCallDrawerSource).toContain(
      'const requiredRole = legacyRequiredRole(form.requiredRoles)',
    );
    expect(serviceCallDrawerSource).toContain('requiredRoles: form.requiredRoles');
    expect(serviceCallDrawerSource).toContain('onChange={addRequiredRole}');
    expect(serviceCallDrawerSource).toContain('aria-label="מקצועות נדרשים"');
  });
});
