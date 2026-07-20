import { useId, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@shared/components/Button';
import { InlineAlert } from '@shared/components/InlineAlert';
import { PageSpinner } from '@shared/components/PageSpinner';
import {
  getSmartAssignmentRecommendationsAsync,
  saveSmartAssignmentFeedbackAsync,
} from '../../api/workplanApiClient';
import {
  dedupeCandidatesByEmployeeId,
  rankRecommendationCandidates,
  toDraftRecommendationCandidate,
  toggleExpandedRecommendation,
} from '../../lib/smartAssignmentRecommendationPresentation';
import {
  DEFAULT_SMART_ASSIGNMENT_WEIGHTS,
  cloneSmartAssignmentWeights,
  getSmartAssignmentWeightsError,
  type SmartAssignmentWeightPresetKey,
} from '../../lib/smartAssignmentWeights';
import { buildSmartAssignmentFeedbackRequest } from '../../lib/smartAssignmentFeedback';
import { buildSavedTaskRecommendationRequest } from '../../lib/smartRerunAssignment';
import { SmartAssignmentWeightSelector } from '../SmartAssignmentWeightSelector';
import { RecommendationCandidateCard } from '../RecommendationCandidateCard';
import {
  DraftRecommendationRatingDialog,
  type DraftRecommendationRatingValue,
} from '../DraftRecommendationRatingDialog';
import type {
  DraftRecommendationCandidate,
  SmartAssignmentWeights,
  WorkPlanTaskSelection,
} from '../../types';
import './SmartRerunPanel.css';

export interface StagedSmartRerunSelection {
  employeeId: number;
  employeeName: string;
  recommendationRunId: number;
}

interface SmartRerunPanelProps {
  task: WorkPlanTaskSelection;
  /** When true, recommendation generation is blocked until persisted task fields are saved. */
  isRecommendationInputDirty: boolean;
  stagedSelection: StagedSmartRerunSelection | null;
  onStageSelection: (selection: StagedSmartRerunSelection | null) => void;
  disabled?: boolean;
}

interface ActiveRun {
  recommendationRunId: number;
  candidates: DraftRecommendationCandidate[];
  policyProfileKey: string | null;
  policyVersion: number | null;
}

/**
 * Edit-drawer Smart Assignment rerun UI. Generating recommendations and selecting a candidate only
 * stage a replacement; the assignment changes when EditTaskDrawer Save runs.
 */
export function SmartRerunPanel({
  task,
  isRecommendationInputDirty,
  stagedSelection,
  onStageSelection,
  disabled = false,
}: SmartRerunPanelProps) {
  const accordionId = useId();
  const [smartWeights, setSmartWeights] = useState<SmartAssignmentWeights>(() =>
    cloneSmartAssignmentWeights(DEFAULT_SMART_ASSIGNMENT_WEIGHTS));
  const [smartWeightPreset, setSmartWeightPreset] =
    useState<SmartAssignmentWeightPresetKey>('balanced');
  const [run, setRun] = useState<ActiveRun | null>(null);
  const [expandedCandidateId, setExpandedCandidateId] = useState<number | null>(null);
  const [ratingCandidateId, setRatingCandidateId] = useState<number | null>(null);
  const [recommendationRatings, setRecommendationRatings] = useState<
    Record<number, DraftRecommendationRatingValue>
  >({});
  const [error, setError] = useState<string | null>(null);
  const runRequestIdRef = useRef(0);

  const smartWeightsError = useMemo(
    () => getSmartAssignmentWeightsError(smartWeights),
    [smartWeights],
  );

  const isBusy = disabled;
  const canRun =
    !isBusy
    && !isRecommendationInputDirty
    && !smartWeightsError;

  const runMutation = useMutation({
    mutationFn: async () =>
      getSmartAssignmentRecommendationsAsync(
        buildSavedTaskRecommendationRequest(task.taskId, smartWeights),
      ),
    onSuccess: (response) => {
      const requestId = runRequestIdRef.current;
      const taskResult = response.taskResults.find(
        (result) => result.workItemId === task.taskId,
      );
      const recommendationRunId = response.recommendationRunId;
      const candidates = dedupeCandidatesByEmployeeId(
        rankRecommendationCandidates(
          (taskResult?.candidates ?? []).map(toDraftRecommendationCandidate),
        ),
      );

      if (recommendationRunId == null || recommendationRunId <= 0) {
        setRun(null);
        setError('לא התקבל מזהה תקין לריצת השיבוץ החכם. נסו שוב בעוד כמה רגעים.');
        return;
      }

      // Ignore a stale response if the panel was reset meanwhile.
      if (requestId !== runRequestIdRef.current) return;

      setRun({
        recommendationRunId,
        candidates,
        policyProfileKey: taskResult?.policyProfileKey ?? null,
        policyVersion: taskResult?.policyVersion ?? null,
      });
      setExpandedCandidateId(null);
      setRecommendationRatings({});
      onStageSelection(null);
      setError(candidates.length === 0 ? 'לא נמצאו עובדים זמינים להצגה עבור משימה זו.' : null);
    },
    onError: () => {
      setRun(null);
      setError('לא הצלחנו להריץ את השיבוץ החכם. נסו שוב בעוד כמה רגעים.');
    },
  });

  const feedbackMutation = useMutation({
    mutationFn: async ({
      employeeId,
      value,
    }: {
      employeeId: number;
      value: DraftRecommendationRatingValue;
    }) => {
      if (!run || run.recommendationRunId <= 0 || !run.policyProfileKey || run.policyVersion == null) {
        throw new Error('missing recommendation context');
      }
      return saveSmartAssignmentFeedbackAsync(
        buildSmartAssignmentFeedbackRequest(
          {
            recommendationRunId: run.recommendationRunId,
            workItemId: task.taskId,
            recommendedEmployeeId: employeeId,
            policyProfileKey: run.policyProfileKey,
            policyVersion: run.policyVersion,
          },
          value.rating,
          value.comment,
        ),
      );
    },
    onSuccess: (_data, variables) => {
      setRecommendationRatings((current) => ({
        ...current,
        [variables.employeeId]: {
          rating: variables.value.rating,
          comment: variables.value.comment,
        },
      }));
      setRatingCandidateId(null);
    },
  });

  const ratingCandidate = run?.candidates.find(
    (candidate) => candidate.employeeId === ratingCandidateId,
  ) ?? null;

  const canRate = Boolean(run?.policyProfileKey) && (run?.policyVersion ?? 0) > 0;

  function handleRun() {
    if (isRecommendationInputDirty) {
      setError('יש לשמור את שינויי המשימה לפני הרצת שיבוץ חכם מחדש.');
      return;
    }
    if (smartWeightsError) {
      setError(smartWeightsError);
      return;
    }
    runRequestIdRef.current += 1;
    setError(null);
    runMutation.mutate();
  }

  function handleSelectCandidate(candidate: DraftRecommendationCandidate) {
    if (!run || run.recommendationRunId <= 0 || isBusy || runMutation.isPending) return;

    onStageSelection({
      employeeId: candidate.employeeId,
      employeeName: candidate.fullName ?? `עובד #${candidate.employeeId}`,
      recommendationRunId: run.recommendationRunId,
    });
    setError(null);
  }

  return (
    <section className="smartRerunPanel" aria-labelledby={`${accordionId}-title`}>
      <div className="smartRerunPanel__head">
        <h4 id={`${accordionId}-title`} className="smartRerunPanel__title">
          שיבוץ חכם
        </h4>
        <p className="smartRerunPanel__hint">
          הרצת שיבוץ חכם על סמך נתוני המשימה השמורים. בחירת עובד רק מכינה החלפה — השיבוץ יתעדכן רק בלחיצה על שמור.
        </p>
      </div>

      {isRecommendationInputDirty && (
        <InlineAlert variant="warning">
          יש שינויים שלא נשמרו בשדות שמשפיעים על ההמלצה. שמרו את המשימה לפני הרצת שיבוץ חכם מחדש.
        </InlineAlert>
      )}

      <SmartAssignmentWeightSelector
        value={smartWeights}
        preset={smartWeightPreset}
        onPresetChange={setSmartWeightPreset}
        onChange={(weights) => {
          setSmartWeights(weights);
          setError(null);
        }}
        disabled={isBusy || runMutation.isPending || isRecommendationInputDirty}
      />

      <div className="smartRerunPanel__runAction">
        <Button
          type="button"
          variant="secondary"
          onClick={handleRun}
          disabled={!canRun || runMutation.isPending}
        >
          הרץ שיבוץ חכם מחדש
        </Button>
      </div>

      {error && <InlineAlert variant="danger">{error}</InlineAlert>}

      {stagedSelection && (
        <InlineAlert variant="success">
          נבחר {stagedSelection.employeeName} לשיבוץ חכם. לחצו שמור כדי להחיל את ההחלפה.
        </InlineAlert>
      )}

      <div
        className="smartRerunPanel__results"
        aria-live="polite"
        aria-busy={runMutation.isPending}
      >
        {runMutation.isPending && (
          <div className="smartRerunPanel__loading">
            <PageSpinner />
          </div>
        )}

        {!runMutation.isPending && run && run.candidates.length > 0 && (
          <div className="smartRerunPanel__candidateGroup">
            <div className="smartRerunPanel__candidateGroupHead">
              <h5>דירוג העובדים</h5>
              <span>{run.candidates.length}</span>
            </div>
            <p className="smartRerunPanel__hint">
              הציון הוא כלי תומך החלטה. ניתן לבחור כל עובד ברשימה, גם כשהציון נמוך. השיבוץ יוחל רק בשמירה.
            </p>
            {run.candidates.map((candidate, index) => (
              <RecommendationCandidateCard
                key={candidate.employeeId}
                candidate={candidate}
                index={index}
                total={run.candidates.length}
                accordionId={accordionId}
                isExpanded={expandedCandidateId === candidate.employeeId}
                onToggleExpand={(employeeId) =>
                  setExpandedCandidateId((current) =>
                    toggleExpandedRecommendation(current, employeeId))}
                isSelected={stagedSelection?.employeeId === candidate.employeeId}
                onSelect={handleSelectCandidate}
                selectLabel="בחר להחלפה"
                selectedLabel="נבחר"
                selectDisabled={isBusy || runMutation.isPending}
                showRating={canRate}
                ratingValue={recommendationRatings[candidate.employeeId] ?? null}
                onOpenRating={(employeeId) => setRatingCandidateId(employeeId)}
                ratingDisabled={isBusy || runMutation.isPending}
              />
            ))}
          </div>
        )}

        {!runMutation.isPending && run && run.candidates.length === 0 && (
          <InlineAlert variant="info">לא נמצאו עובדים זמינים להצגה עבור משימה זו.</InlineAlert>
        )}
      </div>

      <DraftRecommendationRatingDialog
        isOpen={ratingCandidate != null}
        candidate={ratingCandidate
          ? { employeeId: ratingCandidate.employeeId, fullName: ratingCandidate.fullName }
          : null}
        value={ratingCandidate ? recommendationRatings[ratingCandidate.employeeId] ?? null : null}
        isSaving={feedbackMutation.isPending}
        error={feedbackMutation.error
          ? 'לא הצלחנו לשמור את דירוג ההמלצה. נסו שוב בעוד כמה רגעים.'
          : null}
        onClose={() => {
          if (!feedbackMutation.isPending) setRatingCandidateId(null);
        }}
        onSave={(value) => {
          if (!ratingCandidate) return;
          feedbackMutation.mutate({ employeeId: ratingCandidate.employeeId, value });
        }}
      />
    </section>
  );
}
