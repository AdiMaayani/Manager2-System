import { useId, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@shared/components/Button';
import { InlineAlert } from '@shared/components/InlineAlert';
import {
  getSmartAssignmentAssignmentFeedbackAsync,
  saveSmartAssignmentFeedbackAsync,
} from '../../api/workplanApiClient';
import {
  buildSmartAssignmentFeedbackRequest,
  canQueryAssignmentFeedback,
  getAssignmentFeedbackContext,
  smartAssignmentFeedbackQueryKey,
} from '../../lib/smartAssignmentFeedback';
import type {
  SmartAssignmentAssignmentRecommendation,
  SmartAssignmentAssignmentRecommendationFactor,
  WorkPlanScheduleAssignment,
} from '../../types';
import {
  DraftRecommendationRatingDialog,
  type DraftRecommendationRatingValue,
} from '../DraftRecommendationRatingDialog';
import './RecommendationFeedbackPanel.css';

interface RecommendationFeedbackPanelProps {
  taskId: number;
  assignment: WorkPlanScheduleAssignment;
  canEdit: boolean;
  isReadOnly?: boolean;
}

const scoreFormatter = new Intl.NumberFormat('he-IL', {
  maximumFractionDigits: 1,
});

function formatNumber(value?: number | null): string | null {
  return value == null || !Number.isFinite(value) ? null : scoreFormatter.format(value);
}

function formatUpdatedAt(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('he-IL');
}

function RecommendationFactorRow({
  factor,
}: {
  factor: SmartAssignmentAssignmentRecommendationFactor;
}) {
  return (
    <li className="recommendationFeedback__factor">
      <div className="recommendationFeedback__factorHead">
        <strong>{factor.label || factor.key}</strong>
        {factor.isTieBreaker && (
          <span className="recommendationFeedback__tieBreaker">שובר שוויון</span>
        )}
      </div>
      <dl className="recommendationFeedback__factorValues">
        <div>
          <dt>ציון</dt>
          <dd dir="ltr">
            {formatNumber(factor.score) != null ? `${formatNumber(factor.score)}%` : '—'}
          </dd>
        </div>
        {!factor.isTieBreaker && (
          <>
            <div>
              <dt>משקל</dt>
              <dd dir="ltr">
                {formatNumber(factor.weightPercent) != null
                  ? `${formatNumber(factor.weightPercent)}%`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>תרומה לציון</dt>
              <dd>
                {formatNumber(factor.weightedContribution) != null
                  ? `${formatNumber(factor.weightedContribution)} נק׳`
                  : '—'}
              </dd>
            </div>
          </>
        )}
      </dl>
    </li>
  );
}

function RecommendationDetails({
  recommendation,
}: {
  recommendation: SmartAssignmentAssignmentRecommendation;
}) {
  const weightedFactors = recommendation.factors.filter((factor) => !factor.isTieBreaker);
  const tieBreakers = recommendation.factors.filter((factor) => factor.isTieBreaker);
  const totalScore = formatNumber(recommendation.totalScore);
  const travelMinutes = formatNumber(recommendation.travelMinutes);
  const distanceKm = formatNumber(recommendation.distanceKm);

  return (
    <div className="recommendationFeedback__detailsContent">
      <dl className="recommendationFeedback__summary">
        <div>
          <dt>ציון כולל</dt>
          <dd dir="ltr">{totalScore != null ? `${totalScore}%` : '—'}</dd>
        </div>
        <div>
          <dt>מיקום בדירוג</dt>
          <dd>{recommendation.rankOrder > 0 ? `מקום ${recommendation.rankOrder}` : '—'}</dd>
        </div>
        {(recommendation.policyDisplayName || (recommendation.policyVersion ?? 0) > 0) && (
          <div>
            <dt>מדיניות חישוב</dt>
            <dd>
              {recommendation.policyDisplayName || 'מדיניות שיבוץ'}
              {(recommendation.policyVersion ?? 0) > 0
                ? ` · גרסה ${recommendation.policyVersion}`
                : ''}
            </dd>
          </div>
        )}
        {(travelMinutes != null || distanceKm != null) && (
          <div>
            <dt>זמן נסיעה משוער</dt>
            <dd>
              {travelMinutes != null ? `${travelMinutes} דקות` : ''}
              {travelMinutes != null && distanceKm != null ? ' · ' : ''}
              {distanceKm != null ? `${distanceKm} ק״מ` : ''}
            </dd>
          </div>
        )}
      </dl>

      {weightedFactors.length > 0 && (
        <div className="recommendationFeedback__factorGroup">
          <h5>פירוט חמשת גורמי החישוב</h5>
          <ul className="recommendationFeedback__factors">
            {weightedFactors.map((factor) => (
              <RecommendationFactorRow factor={factor} key={factor.key} />
            ))}
          </ul>
        </div>
      )}

      {tieBreakers.length > 0 && (
        <div className="recommendationFeedback__factorGroup">
          <h5>רציפות כשובר שוויון</h5>
          <ul className="recommendationFeedback__factors">
            {tieBreakers.map((factor) => (
              <RecommendationFactorRow factor={factor} key={factor.key} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function RecommendationFeedbackPanel({
  taskId,
  assignment,
  canEdit,
  isReadOnly = false,
}: RecommendationFeedbackPanelProps) {
  const queryClient = useQueryClient();
  const generatedId = useId().replace(/:/g, '');
  const [isRecommendationOpen, setIsRecommendationOpen] = useState(false);
  const [isRatingOpen, setIsRatingOpen] = useState(false);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const assignedEmployeeId = assignment.employeeId ?? null;
  const isDirectAssignment = assignment.workItemId === taskId
    && assignment.assignmentSource === 'Task';
  const isSmartAssignment = isDirectAssignment && assignment.isManualAssignment === false;
  const canLoadAssignmentFeedback = canQueryAssignmentFeedback({
    taskId,
    assignmentWorkItemId: assignment.workItemId,
    assignmentSource: assignment.assignmentSource,
    isManualAssignment: assignment.isManualAssignment,
    assignedEmployeeId,
  });

  const queryKey = useMemo(
    () => smartAssignmentFeedbackQueryKey(taskId, assignedEmployeeId ?? 0),
    [assignedEmployeeId, taskId],
  );

  const feedbackQuery = useQuery({
    queryKey,
    queryFn: () => getSmartAssignmentAssignmentFeedbackAsync(taskId, assignedEmployeeId!),
    enabled: canLoadAssignmentFeedback,
    retry: false,
  });

  const feedbackMutation = useMutation({
    mutationFn: (value: DraftRecommendationRatingValue) => {
      const context = getAssignmentFeedbackContext(feedbackQuery.data);
      if (!context) throw new Error('Missing persisted recommendation metadata.');
      return saveSmartAssignmentFeedbackAsync(
        buildSmartAssignmentFeedbackRequest(context, value.rating, value.comment),
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setIsRatingOpen(false);
      setSaveSucceeded(true);
    },
  });

  const summary = feedbackQuery.data;
  const recommendation = summary?.recommendation ?? null;
  const feedback = summary?.feedback ?? null;
  const feedbackContext = getAssignmentFeedbackContext(summary);
  const resolvedEmployeeName = summary?.assignedEmployeeName || assignment.employeeName;
  const updatedAt = formatUpdatedAt(feedback?.updatedAtUtc);
  const titleId = `assignment-${generatedId}-title`;
  const detailsId = `assignment-${generatedId}-recommendation`;

  const sourceLabel = !isDirectAssignment
    ? assignment.assignmentSource === 'Project'
      && (assignment.workEmployeeAssignmentId ?? 0) > 0
      ? 'שיוך מהפרויקט'
      : 'שיוך לתצוגה בלבד'
    : assignment.isManualAssignment
      ? 'שיבוץ ידני'
      : 'שיבוץ חכם';
  const sourceTone = !isDirectAssignment
    ? 'inherited'
    : assignment.isManualAssignment
      ? 'manual'
      : 'smart';

  function openRating() {
    setSaveSucceeded(false);
    feedbackMutation.reset();
    setIsRatingOpen(true);
  }

  return (
    <article className="recommendationFeedback" aria-labelledby={titleId}>
      <div className="recommendationFeedback__header">
        <div className="recommendationFeedback__identity">
          <h4 id={titleId}>
            {resolvedEmployeeName || (assignedEmployeeId ? `עובד #${assignedEmployeeId}` : 'עובד לא ידוע')}
          </h4>
          {assignment.assignmentRole?.trim() && (
            <span className="recommendationFeedback__role">{assignment.assignmentRole}</span>
          )}
        </div>
        <div className="recommendationFeedback__headerActions">
          <span
            className={`recommendationFeedback__source recommendationFeedback__source--${sourceTone}`}
          >
            {sourceLabel}
          </span>
        </div>
      </div>

      {!isDirectAssignment && (
        <InlineAlert variant="info">
          השיוך אינו שיוך ישיר למשימה ולכן ניתן לצפות בו בלבד.
        </InlineAlert>
      )}

      {isDirectAssignment && assignment.isManualAssignment && (
        <InlineAlert variant="info">
          זהו שיבוץ ידני, ולכן אין המלצה חכמה לצפייה או לדירוג.
        </InlineAlert>
      )}

      {isSmartAssignment && (
        <div className="recommendationFeedback__smart" aria-busy={feedbackQuery.isLoading}>
          <div className="recommendationFeedback__smartActions">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              iconEnd={isRecommendationOpen
                ? <ChevronUp size={16} />
                : <ChevronDown size={16} />}
              aria-expanded={isRecommendationOpen}
              aria-controls={detailsId}
              onClick={() => setIsRecommendationOpen((current) => !current)}
              disabled={feedbackQuery.isLoading || Boolean(feedbackQuery.error)}
            >
              {isRecommendationOpen ? 'הסתר המלצה' : 'צפה בהמלצה'}
            </Button>
          </div>

          {feedbackQuery.isLoading && (
            <p className="recommendationFeedback__loading" role="status" aria-live="polite">
              טוען את נתוני ההמלצה...
            </p>
          )}

          {feedbackQuery.error && (
            <div className="recommendationFeedback__queryError">
              <InlineAlert variant="danger">
                לא הצלחנו לטעון את נתוני ההמלצה. נסו שוב בעוד כמה רגעים.
              </InlineAlert>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => void feedbackQuery.refetch()}
              >
                נסה שוב
              </Button>
            </div>
          )}

          <div
            id={detailsId}
            role="region"
            aria-labelledby={titleId}
            hidden={!isRecommendationOpen}
            className="recommendationFeedback__details"
          >
            {recommendation ? (
              <RecommendationDetails recommendation={recommendation} />
            ) : (
              !feedbackQuery.isLoading && !feedbackQuery.error && (
                <InlineAlert variant="warning">פרטי ההמלצה השמורה אינם זמינים.</InlineAlert>
              )
            )}
          </div>

          {!feedbackQuery.isLoading && !feedbackQuery.error && feedback && (
            <div className="recommendationFeedback__saved">
              <div className="recommendationFeedback__savedHead">
                <span>דירוג ההמלצה</span>
                <strong dir="ltr">{feedback.rating}/10</strong>
              </div>
              {feedback.comment && (
                <p className="recommendationFeedback__comment">{feedback.comment}</p>
              )}
              {updatedAt && (
                <p className="recommendationFeedback__updated">עודכן: {updatedAt}</p>
              )}
              {canEdit && !isReadOnly && feedbackContext && (
                <Button type="button" variant="secondary" size="sm" onClick={openRating}>
                  ערוך דירוג
                </Button>
              )}
            </div>
          )}

          {!feedbackQuery.isLoading && !feedbackQuery.error && !feedback && (
            <div className="recommendationFeedback__empty">
              <p>המלצה זו לא דורגה.</p>
              {canEdit && !isReadOnly && feedbackContext && (
                <Button type="button" variant="secondary" size="sm" onClick={openRating}>
                  הוסף דירוג
                </Button>
              )}
            </div>
          )}

          {saveSucceeded && (
            <InlineAlert variant="success">דירוג ההמלצה נשמר בהצלחה.</InlineAlert>
          )}
        </div>
      )}

      {isSmartAssignment && (
        <DraftRecommendationRatingDialog
          isOpen={isRatingOpen}
          candidate={assignedEmployeeId != null && assignedEmployeeId > 0
            ? { employeeId: assignedEmployeeId, fullName: resolvedEmployeeName }
            : null}
          value={feedback
            ? { rating: feedback.rating, comment: feedback.comment ?? '' }
            : null}
          helpText="הדירוג אינו משנה את הציון או את השיבוץ הקיים."
          isSaving={feedbackMutation.isPending}
          error={feedbackMutation.error
            ? 'לא הצלחנו לשמור את דירוג ההמלצה. נסו שוב בעוד כמה רגעים.'
            : null}
          onClose={() => {
            if (!feedbackMutation.isPending) setIsRatingOpen(false);
          }}
          onSave={(value) => feedbackMutation.mutate(value)}
        />
      )}
    </article>
  );
}
