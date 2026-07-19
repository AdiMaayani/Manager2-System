import { useId, useState } from 'react';
import { Modal } from '@shared/components/Modal';
import { Button } from '@shared/components/Button';
import { InlineAlert } from '@shared/components/InlineAlert';
import { Textarea } from '@shared/components/Textarea';
import { isValidRecommendationRating } from '../../lib/smartAssignmentFeedback';
import './DraftRecommendationRatingDialog.css';

const RATING_VALUES = Array.from({ length: 10 }, (_, index) => index + 1);

export interface DraftRecommendationRatingValue {
  rating: number;
  comment: string;
}

export interface RecommendationRatingSubject {
  employeeId: number;
  fullName?: string | null;
}

interface DraftRecommendationRatingDialogProps {
  isOpen: boolean;
  candidate: RecommendationRatingSubject | null;
  value?: DraftRecommendationRatingValue | null;
  helpText?: string;
  isSaving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (value: DraftRecommendationRatingValue) => void;
}

export function DraftRecommendationRatingDialog({
  isOpen,
  candidate,
  value,
  helpText,
  isSaving = false,
  error,
  onClose,
  onSave,
}: DraftRecommendationRatingDialogProps) {
  if (!isOpen || !candidate) return null;

  return (
    <DraftRecommendationRatingDialogContent
      key={candidate.employeeId}
      candidate={candidate}
      value={value}
      helpText={helpText}
      isSaving={isSaving}
      error={error}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function DraftRecommendationRatingDialogContent({
  candidate,
  value,
  helpText,
  isSaving = false,
  error,
  onClose,
  onSave,
}: Omit<DraftRecommendationRatingDialogProps, 'isOpen'> & {
  candidate: RecommendationRatingSubject;
}) {
  const ratingName = useId();
  const [rating, setRating] = useState<number | null>(value?.rating ?? null);
  const [comment, setComment] = useState(value?.comment ?? '');

  return (
    <Modal
      isOpen
      onClose={() => {
        if (!isSaving) onClose();
      }}
      title={`דירוג המלצה · ${candidate.fullName ?? `עובד #${candidate.employeeId}`}`}
    >
      <form
        className="draftRecommendationRating"
        onSubmit={(event) => {
          event.preventDefault();
          if (!isValidRecommendationRating(rating)) return;
          onSave({ rating, comment: comment.trim() });
        }}
      >
        <p className="draftRecommendationRating__help">
          {helpText
            ?? 'הדירוג אופציונלי, אינו משנה את הציון או את השיבוץ, ויישמר לאחר שמירת המשימה.'}
        </p>

        <fieldset disabled={isSaving}>
          <legend>עד כמה ההמלצה טובה? (1–10)</legend>
          <div className="draftRecommendationRating__scale" dir="ltr">
            {RATING_VALUES.map((ratingValue) => (
              <label
                key={ratingValue}
                className={`draftRecommendationRating__option ${rating === ratingValue ? 'draftRecommendationRating__option--selected' : ''}`.trim()}
              >
                <input
                  type="radio"
                  name={ratingName}
                  value={ratingValue}
                  checked={rating === ratingValue}
                  onChange={() => setRating(ratingValue)}
                  required
                />
                <span>{ratingValue}</span>
              </label>
            ))}
          </div>
          <div className="draftRecommendationRating__labels" dir="ltr">
            <span dir="rtl">1 · לא טובה</span>
            <span dir="rtl">10 · מצוינת</span>
          </div>
        </fieldset>

        <Textarea
          label="הערה (אופציונלי)"
          value={comment}
          maxLength={1000}
          rows={3}
          helpText="עד 1,000 תווים."
          onChange={(event) => setComment(event.target.value)}
          disabled={isSaving}
        />

        {error && <InlineAlert variant="danger">{error}</InlineAlert>}

        <div className="draftRecommendationRating__actions">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>ביטול</Button>
          <Button
            type="submit"
            disabled={!isValidRecommendationRating(rating)}
            isLoading={isSaving}
          >
            שמור דירוג
          </Button>
        </div>
      </form>
    </Modal>
  );
}
