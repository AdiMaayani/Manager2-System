import type { DraftRecommendationCandidate, RecommendationFactor } from '../types';

const WEIGHTED_FACTOR_KEYS = new Set([
  'professional',
  'availability',
  'workload',
  'geographic',
  'experience',
]);

const RECOMMENDATION_CODE_LABELS: Record<string, string> = {
  InactiveEmployee: 'העובד אינו פעיל.',
  NonAssignableEmployee: 'העובד אינו מוגדר לשיבוץ משימות.',
  MissingCriticalSkill: 'לא נמצאה התאמה לכישור קריטי שנדרש למשימה.',
  RequiredRoleMismatch: 'לא נמצאה התאמה מלאה למקצועות הנדרשים.',
  LeaveConflict: 'קיימת חופשה החופפת לזמן המשימה.',
  SickConflict: 'קיימת מחלה החופפת לזמן המשימה.',
  BusyConflict: 'קיימת חסימת זמינות בזמן המשימה.',
  TrainingConflict: 'קיימת הדרכה החופפת לזמן המשימה.',
  ScheduleNotCovered: 'לוח העבודה אינו מכסה את מלוא חלון המשימה.',
  MissingAvailabilityRejected: 'נתוני הזמינות אינם מלאים.',
  AvailabilityDataMissing: 'נתוני הזמינות אינם מלאים.',
  TaskScheduleMissing: 'חלון הזמן של המשימה חסר.',
  SiteAddressMissing: 'לא הוגדרה כתובת אתר תקפה למשימה.',
  RouteDataMissing: 'זמן הנסיעה לא זמין.',
  WorkloadDataMissing: 'נתוני עומס העבודה אינם מלאים.',
  ExperienceDataMissing: 'נתוני הניסיון אינם מלאים.',
  MissingRequiredSkillInput: 'לא הוגדרו דרישות כישורים למשימה.',
};

export const EMPTY_EXPANDED_RECOMMENDATION: number | null = null;

export function toggleExpandedRecommendation(
  currentEmployeeId: number | null,
  employeeId: number,
): number | null {
  return currentEmployeeId === employeeId ? null : employeeId;
}

export function rankRecommendationCandidates(
  candidates: readonly DraftRecommendationCandidate[],
): DraftRecommendationCandidate[] {
  return candidates
    .map((candidate, index) => ({ candidate, index }))
    .sort((left, right) => {
      const leftRank = left.candidate.rankOrder;
      const rightRank = right.candidate.rankOrder;
      if (leftRank != null && rightRank != null && leftRank !== rightRank) return leftRank - rightRank;
      if (leftRank != null && rightRank == null) return -1;
      if (leftRank == null && rightRank != null) return 1;
      const scoreDifference = Number(right.candidate.totalScore ?? -1) - Number(left.candidate.totalScore ?? -1);
      return scoreDifference || left.index - right.index;
    })
    .map(({ candidate }) => candidate);
}

export function getRecommendationCandidateLabel(index: number, total: number): string {
  if (total <= 1) return 'מועמד יחיד';
  if (index === 0) return 'מתאים יותר';
  if (index === total - 1) return 'מתאים פחות';
  return `דירוג ${index + 1} מתוך ${total}`;
}

export function canSelectRecommendationCandidate(candidate: DraftRecommendationCandidate): boolean {
  void candidate;
  return true;
}

export function getRecommendationCodeLabel(code: string): string {
  return RECOMMENDATION_CODE_LABELS[code] ?? 'קיים נתון נוסף שכדאי לבדוק לפני השיבוץ.';
}

/**
 * Returns structured candidate-level facts only. Missing-input codes already explained by a
 * factor are omitted so the same reason is never rendered both below the factor and as a notice.
 * Legacy free-text warnings are intentionally not rendered because they cannot be deduplicated
 * reliably. Decision details that must be shown are carried by structured factor source values.
 */
export function getCandidateNotices(candidate: DraftRecommendationCandidate): string[] {
  const factorCodes = new Set(
    candidate.factors.flatMap((factor) => factor.missingInputCodes ?? []),
  );
  if (candidate.factors.some((factor) => factor.key === 'professional')) {
    factorCodes.add('MissingCriticalSkill');
    factorCodes.add('RequiredRoleMismatch');
    factorCodes.add('MissingRequiredSkillInput');
  }
  if (candidate.factors.some((factor) => factor.key === 'availability')) {
    factorCodes.add('LeaveConflict');
    factorCodes.add('SickConflict');
    factorCodes.add('BusyConflict');
    factorCodes.add('TrainingConflict');
    factorCodes.add('ScheduleNotCovered');
    factorCodes.add('MissingAvailabilityRejected');
    factorCodes.add('AvailabilityDataMissing');
    factorCodes.add('TaskScheduleMissing');
  }
  if (candidate.factors.some((factor) => factor.key === 'workload')) {
    factorCodes.add('WorkloadDataMissing');
  }
  if (candidate.factors.some((factor) => factor.key === 'geographic')) {
    factorCodes.add('SiteAddressMissing');
    factorCodes.add('RouteDataMissing');
  }
  if (candidate.factors.some((factor) => factor.key === 'experience')) {
    factorCodes.add('ExperienceDataMissing');
  }
  const uniqueCandidateCodes = Array.from(new Set([
    ...candidate.rejectionReasonCodes,
    ...candidate.missingInputCodes,
  ])).filter((code) => !factorCodes.has(code));

  return uniqueCandidateCodes.map(getRecommendationCodeLabel);
}

export function getMainRecommendationContributions(
  factors: readonly RecommendationFactor[],
  limit = 3,
): RecommendationFactor[] {
  return factors
    .map((factor, index) => ({ factor, index }))
    .filter(({ factor }) => Number.isFinite(factor.weightedContribution))
    .sort((left, right) => {
      const contributionDifference =
        Number(right.factor.weightedContribution) - Number(left.factor.weightedContribution);
      return contributionDifference || left.index - right.index;
    })
    .slice(0, limit)
    .map(({ factor }) => factor);
}

export function getWeightedRecommendationFactors(
  factors: readonly RecommendationFactor[],
): RecommendationFactor[] {
  return factors.filter((factor) => WEIGHTED_FACTOR_KEYS.has(factor.key));
}

export function getProfessionMatchSummary(candidate: DraftRecommendationCandidate): string {
  const requiredCount = candidate.requiredRoles?.length ?? 0;
  if (requiredCount === 0) return 'התאמת מקצוע: לא הוגדרו מקצועות נדרשים';
  const matchedCount = Math.min(candidate.matchedRoles?.length ?? 0, requiredCount);
  return `התאמת מקצוע: ${matchedCount}/${requiredCount}`;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function getFiniteNumber(value: unknown): number | null {
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function getSourceString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export interface RecommendationRouteEndpoints {
  originFormattedAddress: string | null;
  destinationFormattedAddress: string | null;
}

export function getRecommendationRouteEndpoints(
  factor: RecommendationFactor,
): RecommendationRouteEndpoints | null {
  if (factor.key !== 'geographic') return null;

  const originFormattedAddress = getSourceString(
    factor.sourceValues?.originFormattedAddress,
  );
  const destinationFormattedAddress = getSourceString(
    factor.sourceValues?.destinationFormattedAddress,
  );

  return originFormattedAddress || destinationFormattedAddress
    ? { originFormattedAddress, destinationFormattedAddress }
    : null;
}

export function hasGeoapifyTravelData(candidate: DraftRecommendationCandidate): boolean {
  if (candidate.travelMinutes == null || !Number.isFinite(candidate.travelMinutes)) return false;
  const geographyFactor = candidate.factors.find((factor) => factor.key === 'geographic');
  const provider = geographyFactor?.sourceValues?.routingProvider
    ?? geographyFactor?.sourceValues?.provider;
  return typeof provider === 'string' && provider.toLowerCase() === 'geoapify';
}

export function getRecommendationFactorExplanation(
  candidate: DraftRecommendationCandidate,
  factor: RecommendationFactor,
): string {
  if (factor.key === 'professional') {
    const details: string[] = [];
    if ((candidate.requiredRoles?.length ?? 0) > 0) {
      details.push(getProfessionMatchSummary(candidate));
      if ((candidate.matchedRoles?.length ?? 0) > 0) {
        details.push(`תואמים: ${candidate.matchedRoles!.join(', ')}`);
      }
      if ((candidate.missingRoles?.length ?? 0) > 0) {
        details.push(`חסרים: ${candidate.missingRoles!.join(', ')}`);
      }
    }

    const requiredSkillsCount = getFiniteNumber(factor.sourceValues?.requiredSkillsCount);
    const matchedSkillsCount = getFiniteNumber(factor.sourceValues?.matchedSkillsCount);
    if (requiredSkillsCount != null && requiredSkillsCount > 0 && matchedSkillsCount != null) {
      details.push(`התאמת כישורים: ${matchedSkillsCount}/${requiredSkillsCount}`);
    }
    const missingSkillNames = getStringArray(factor.sourceValues?.missingSkillNames);
    if (missingSkillNames.length > 0) {
      details.push(`כישורים חסרים: ${missingSkillNames.join(', ')}`);
    }

    return details.length > 0
      ? details.join(' · ')
      : factor.explanation || 'לא הוגדרו דרישות מקצוע או כישורים למשימה.';
  }

  if (factor.key === 'availability') {
    const conflictLabels = Array.from(new Set(
      getStringArray(factor.sourceValues?.conflictCodes).map(getRecommendationCodeLabel),
    ));
    return conflictLabels.length > 0
      ? conflictLabels.join(' · ')
      : factor.explanation || 'אין פירוט נוסף זמין לגורם זה.';
  }

  if (factor.key === 'geographic') {
    if (factor.missingInputCodes?.includes('SiteAddressMissing')) {
      return 'לא הוגדרה כתובת אתר תקפה למשימה. לא בוצע חישוב מסלול והוחל ציון נסיעה ניטרלי 50.';
    }
    if (!hasGeoapifyTravelData(candidate)) return 'זמן הנסיעה לא זמין.';
    return [
      `זמן נסיעה משוער: ${Math.round(Number(candidate.travelMinutes))} דקות`,
      candidate.distanceKm != null && Number.isFinite(candidate.distanceKm)
        ? `מרחק: ${new Intl.NumberFormat('he-IL', { maximumFractionDigits: 1 }).format(candidate.distanceKm)} ק״מ`
        : null,
      'מקור מסלול: Geoapify',
    ].filter((detail): detail is string => Boolean(detail)).join(' · ');
  }

  return factor.explanation || 'אין פירוט נוסף זמין לגורם זה.';
}
