import { ChevronDown, Flag, MapPin } from 'lucide-react';
import { Button } from '@shared/components/Button';
import {
  getCandidateNotices,
  getRecommendationCandidateLabel,
  getRecommendationFactorExplanation,
  getRecommendationRouteEndpoints,
  getWeightedRecommendationFactors,
} from '../../lib/smartAssignmentRecommendationPresentation';
import type { DraftRecommendationCandidate } from '../../types';
import type { DraftRecommendationRatingValue } from '../DraftRecommendationRatingDialog';
import './RecommendationCandidateCard.css';

function formatRecommendationScore(score?: number | null): string {
  if (score == null || Number.isNaN(Number(score))) return '—';
  return `${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 }).format(Number(score))}%`;
}

function formatRecommendationContribution(contribution?: number | null): string {
  if (contribution == null || Number.isNaN(Number(contribution))) return '—';
  return `${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 2 }).format(Number(contribution))} נק׳`;
}

interface RecommendationCandidateCardProps {
  candidate: DraftRecommendationCandidate;
  index: number;
  total: number;
  accordionId: string;
  isExpanded: boolean;
  onToggleExpand: (employeeId: number) => void;
  isSelected: boolean;
  onSelect: (candidate: DraftRecommendationCandidate) => void;
  selectLabel?: string;
  selectedLabel?: string;
  selectDisabled?: boolean;
  showRating?: boolean;
  ratingValue?: DraftRecommendationRatingValue | null;
  onOpenRating?: (employeeId: number) => void;
  ratingDisabled?: boolean;
}

/**
 * Shared presentation for one ranked Smart Assignment candidate. Used by the New Task flow and the
 * saved-task rerun so the recommendation UI (rank, score, five factors, route, explanations, rating)
 * is defined once rather than duplicated.
 */
export function RecommendationCandidateCard({
  candidate,
  index,
  total,
  accordionId,
  isExpanded,
  onToggleExpand,
  isSelected,
  onSelect,
  selectLabel = 'בחר עובד',
  selectedLabel = 'נבחר',
  selectDisabled = false,
  showRating = true,
  ratingValue = null,
  onOpenRating,
  ratingDisabled = false,
}: RecommendationCandidateCardProps) {
  const notices = getCandidateNotices(candidate);
  const displayedFactors = getWeightedRecommendationFactors(candidate.factors);
  const triggerId = `${accordionId}-${candidate.employeeId}-trigger`;
  const panelId = `${accordionId}-${candidate.employeeId}-panel`;

  return (
    <article className="recommendationCandidateCard">
      <div className="recommendationCandidateCard__row">
        <button
          id={triggerId}
          type="button"
          className="recommendationCandidateCard__toggle"
          aria-expanded={isExpanded}
          aria-controls={panelId}
          onClick={() => onToggleExpand(candidate.employeeId)}
        >
          <span className="recommendationCandidateCard__identity">
            <strong className="recommendationCandidateCard__name">
              {candidate.fullName ?? `עובד #${candidate.employeeId}`}
            </strong>
            <span className="recommendationCandidateCard__rank">
              {getRecommendationCandidateLabel(index, total)}
            </span>
          </span>
          <span className="recommendationCandidateCard__summary">
            {candidate.totalScore != null && (
              <span className="recommendationCandidateCard__score" dir="ltr">
                {formatRecommendationScore(candidate.totalScore)}
              </span>
            )}
            <ChevronDown
              size={18}
              className="recommendationCandidateCard__chevron"
              aria-hidden="true"
            />
          </span>
        </button>
        <Button
          type="button"
          size="sm"
          variant={isSelected ? 'secondary' : 'primary'}
          onClick={() => onSelect(candidate)}
          disabled={selectDisabled}
        >
          {isSelected ? selectedLabel : selectLabel}
        </Button>
      </div>

      <div
        id={panelId}
        role="region"
        aria-labelledby={triggerId}
        hidden={!isExpanded}
        className="recommendationCandidateCard__details"
      >
        {notices.length > 0 && (
          <ul className="recommendationCandidateCard__reasons">
            {notices.map((notice, noticeIndex) => (
              <li key={`${notice}-${noticeIndex}`} className="recommendationCandidateCard__warning">
                {notice}
              </li>
            ))}
          </ul>
        )}
        {displayedFactors.length > 0 && (
          <div>
            <h5 className="recommendationCandidateCard__contributionsTitle">
              פירוט חמשת גורמי החישוב
            </h5>
            <ul className="recommendationCandidateCard__factors">
              {displayedFactors.map((factor) => {
                const routeEndpoints = getRecommendationRouteEndpoints(factor);
                return (
                  <li className="recommendationCandidateCard__factor" key={factor.key}>
                    <div className="recommendationCandidateCard__factorHead">
                      <span className="recommendationCandidateCard__factorLabel">{factor.label}</span>
                      <span className="recommendationCandidateCard__factorMetrics">
                        <span>ציון <b dir="ltr">{formatRecommendationScore(factor.score)}</b></span>
                        <span>משקל <b dir="ltr">{formatRecommendationScore(factor.weightPercent)}</b></span>
                        <span>תרומה <b dir="ltr">{formatRecommendationContribution(factor.weightedContribution)}</b></span>
                      </span>
                    </div>
                    {routeEndpoints && (
                      <div
                        className="recommendationCandidateCard__routeEndpoints"
                        role="group"
                        aria-label="מוצא ויעד לחישוב הנסיעה"
                      >
                        <div className="recommendationCandidateCard__routeEndpoint">
                          <MapPin size={18} aria-hidden="true" />
                          <span>
                            <span className="recommendationCandidateCard__routeEndpointLabel">מוצא העובד</span>
                            <strong>
                              {routeEndpoints.originFormattedAddress ?? 'כתובת מוצא לא זמינה'}
                            </strong>
                          </span>
                        </div>
                        <div className="recommendationCandidateCard__routeEndpoint">
                          <Flag size={18} aria-hidden="true" />
                          <span>
                            <span className="recommendationCandidateCard__routeEndpointLabel">יעד המשימה</span>
                            <strong>
                              {routeEndpoints.destinationFormattedAddress ?? 'כתובת יעד לא זמינה'}
                            </strong>
                          </span>
                        </div>
                      </div>
                    )}
                    <span className="recommendationCandidateCard__factorExplain">
                      {getRecommendationFactorExplanation(candidate, factor)}
                      {factor.isDefaulted ? ' · נעשה שימוש בערך ברירת מחדל' : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {showRating && onOpenRating && (
          <div className="recommendationCandidateCard__ratingAction">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onOpenRating(candidate.employeeId)}
              disabled={ratingDisabled}
            >
              דירוג המלצה
            </Button>
            {ratingValue && (
              <span className="recommendationCandidateCard__ratingStatus" aria-live="polite">
                דורג {ratingValue.rating}/10
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
