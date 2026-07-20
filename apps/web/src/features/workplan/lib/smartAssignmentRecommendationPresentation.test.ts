import { describe, expect, it } from 'vitest';
import type { DraftRecommendationCandidate, RecommendationFactor } from '../types';
import {
  canSelectRecommendationCandidate,
  getCandidateNotices,
  getMainRecommendationContributions,
  getProfessionMatchSummary,
  getRecommendationCandidateLabel,
  getRecommendationFactorExplanation,
  getRecommendationRouteEndpoints,
  getWeightedRecommendationFactors,
  hasGeoapifyTravelData,
  rankRecommendationCandidates,
  toggleExpandedRecommendation,
} from './smartAssignmentRecommendationPresentation';

function candidate(
  employeeId: number,
  isEligible: boolean,
  overrides: Partial<DraftRecommendationCandidate> = {},
): DraftRecommendationCandidate {
  return {
    employeeId,
    isEligible,
    status: isEligible ? 'Eligible' : 'Ineligible',
    warnings: [],
    rejectionReasonCodes: [],
    missingInputCodes: [],
    factors: [],
    ...overrides,
  };
}

describe('smart assignment recommendation presentation', () => {
  it('returns one ranked list regardless of the legacy eligibility flag', () => {
    const ranked = rankRecommendationCandidates([
      candidate(1, true, { rankOrder: 2, totalScore: 80 }),
      candidate(2, false, { rankOrder: 1, totalScore: 85 }),
      candidate(3, true, { rankOrder: 3, totalScore: 70 }),
    ]);

    expect(ranked.map((item) => item.employeeId)).toEqual([2, 1, 3]);
  });

  it('allows every returned candidate to be selected and uses relative labels', () => {
    expect(canSelectRecommendationCandidate(candidate(7, false))).toBe(true);
    expect(getRecommendationCandidateLabel(0, 3)).toBe('מתאים יותר');
    expect(getRecommendationCandidateLabel(1, 3)).toBe('דירוג 2 מתוך 3');
    expect(getRecommendationCandidateLabel(2, 3)).toBe('מתאים פחות');
  });

  it('orders the main factors by weighted contribution and keeps stable ties', () => {
    const factors: RecommendationFactor[] = [
      { key: 'availability', label: 'זמינות', score: 80, weightPercent: 25, weightedContribution: 20, explanation: '', dataSource: '', hasData: true },
      { key: 'professional', label: 'מקצועיות', score: 60, weightPercent: 35, weightedContribution: 21, explanation: '', dataSource: '', hasData: true },
      { key: 'workload', label: 'עומס', score: 100, weightPercent: 15, weightedContribution: 15, explanation: '', dataSource: '', hasData: true },
    ];

    expect(getMainRecommendationContributions(factors, 2).map((factor) => factor.key)).toEqual([
      'professional',
      'availability',
    ]);
  });

  it('shows only the five weighted factors and leaves continuity as a tie-break detail', () => {
    const factors: RecommendationFactor[] = [
      { key: 'professional', label: '', score: 50, weightPercent: 35, explanation: '', dataSource: '', hasData: true },
      { key: 'availability', label: '', score: 50, weightPercent: 25, explanation: '', dataSource: '', hasData: true },
      { key: 'workload', label: '', score: 50, weightPercent: 15, explanation: '', dataSource: '', hasData: true },
      { key: 'geographic', label: '', score: 50, weightPercent: 15, explanation: '', dataSource: '', hasData: true },
      { key: 'experience', label: '', score: 50, weightPercent: 10, explanation: '', dataSource: '', hasData: true },
      { key: 'continuity', label: '', score: 100, weightPercent: 0, explanation: '', dataSource: '', hasData: true },
    ];

    expect(getWeightedRecommendationFactors(factors).map((factor) => factor.key)).toEqual([
      'professional',
      'availability',
      'workload',
      'geographic',
      'experience',
    ]);
  });

  it('deduplicates structured codes and omits notices already explained by a factor', () => {
    const notices = getCandidateNotices(candidate(5, false, {
      rejectionReasonCodes: ['MissingCriticalSkill'],
      missingInputCodes: ['MissingCriticalSkill', 'RouteDataMissing'],
      warnings: ['raw duplicate warning'],
      factors: [{
        key: 'geographic',
        label: 'זמן נסיעה',
        score: 50,
        weightPercent: 15,
        explanation: 'זמן הנסיעה לא זמין.',
        dataSource: '',
        hasData: false,
        missingInputCodes: ['RouteDataMissing'],
      }],
    }));

    expect(notices).toEqual(['לא נמצאה התאמה לכישור קריטי שנדרש למשימה.']);
  });

  it('keeps only one expanded candidate in the single ranked list', () => {
    expect(toggleExpandedRecommendation(null, 3)).toBe(3);
    expect(toggleExpandedRecommendation(3, 4)).toBe(4);
    expect(toggleExpandedRecommendation(4, 4)).toBeNull();
  });

  it('presents profession matching as a factual X/Y ratio', () => {
    const withPartialMatch = candidate(3, true, {
      requiredRoles: ['חשמלאי', 'טכנאי'],
      matchedRoles: ['חשמלאי'],
      missingRoles: ['טכנאי'],
    });
    expect(getProfessionMatchSummary(withPartialMatch)).toBe('התאמת מקצוע: 1/2');
    expect(getRecommendationFactorExplanation(withPartialMatch, {
      key: 'professional',
      label: 'מקצועיות',
      score: 50,
      weightPercent: 35,
      weightedContribution: 17.5,
      explanation: 'legacy duplicate text',
      dataSource: '',
      hasData: true,
      sourceValues: {
        requiredSkillsCount: 2,
        matchedSkillsCount: 1,
        missingSkillNames: ['תקשורת'],
      },
    })).toBe(
      'התאמת מקצוע: 1/2 · תואמים: חשמלאי · חסרים: טכנאי · התאמת כישורים: 1/2 · כישורים חסרים: תקשורת',
    );
  });

  it('shows a structured availability conflict once instead of a raw duplicate warning', () => {
    const withLeave = candidate(9, true, { warnings: ['קיימת חופשה החופפת לזמן המשימה.'] });
    const factor: RecommendationFactor = {
      key: 'availability',
      label: 'זמינות',
      score: 0,
      weightPercent: 25,
      explanation: 'קיימת חסימת זמינות מפורשת שחופפת למשימה.',
      dataSource: '',
      hasData: true,
      sourceValues: { conflictCodes: ['LeaveConflict', 'LeaveConflict'] },
    };

    expect(getRecommendationFactorExplanation(withLeave, factor))
      .toBe('קיימת חופשה החופפת לזמן המשימה.');
  });

  it('recognizes travel only when it is a real Geoapify route', () => {
    const withGeoapify = candidate(1, true, {
      travelMinutes: 18,
      originTypeUsed: 'HomeBase',
      factors: [{
        key: 'geographic',
        label: 'זמן נסיעה',
        score: 80,
        weightPercent: 15,
        explanation: '',
        dataSource: 'Geoapify travel-time routing',
        hasData: true,
        sourceValues: {
          routingProvider: 'Geoapify',
          originFormattedAddress: '  רחוב העובד 1, נתניה  ',
          destinationFormattedAddress: 'רחוב האתר 20, חיפה',
        },
      }],
    });
    expect(hasGeoapifyTravelData(withGeoapify)).toBe(true);
    expect(getRecommendationFactorExplanation(withGeoapify, withGeoapify.factors[0])).toBe(
      'זמן נסיעה משוער: 18 דקות · נתוני מסלול',
    );
    expect(getRecommendationRouteEndpoints(withGeoapify.factors[0])).toEqual({
      originFormattedAddress: 'רחוב העובד 1, נתניה',
      destinationFormattedAddress: 'רחוב האתר 20, חיפה',
    });
    expect(hasGeoapifyTravelData({ ...withGeoapify, travelMinutes: null })).toBe(false);
    const withoutGeoapify = {
      ...withGeoapify,
      factors: [{ ...withGeoapify.factors[0], sourceValues: { routingProvider: 'Other' } }],
    };
    expect(hasGeoapifyTravelData(withoutGeoapify)).toBe(false);
    expect(getRecommendationFactorExplanation(withoutGeoapify, withoutGeoapify.factors[0]))
      .toBe('זמן הנסיעה לא זמין.');
  });

  it('does not invent route endpoints when formatted addresses are absent', () => {
    const geographicFactor: RecommendationFactor = {
      key: 'geographic',
      label: 'זמן נסיעה',
      score: 50,
      weightPercent: 15,
      explanation: '',
      dataSource: '',
      hasData: false,
      sourceValues: {
        originFormattedAddress: '   ',
        destinationFormattedAddress: null,
      },
    };

    expect(getRecommendationRouteEndpoints(geographicFactor)).toBeNull();
    expect(getRecommendationRouteEndpoints({ ...geographicFactor, key: 'workload' })).toBeNull();
  });

  it('explains a missing task-site address as a neutral score without duplicating a notice', () => {
    const factor: RecommendationFactor = {
      key: 'geographic',
      label: 'זמן נסיעה',
      score: 50,
      weightPercent: 15,
      explanation: '',
      dataSource: 'Neutral fallback',
      hasData: false,
      isDefaulted: true,
      missingInputCodes: ['SiteAddressMissing'],
    };
    const withoutSiteAddress = candidate(4, true, {
      missingInputCodes: ['SiteAddressMissing'],
      travelMinutes: null,
      distanceKm: null,
      factors: [factor],
    });

    expect(hasGeoapifyTravelData(withoutSiteAddress)).toBe(false);
    expect(getRecommendationFactorExplanation(withoutSiteAddress, factor)).toBe(
      'לא הוגדרה כתובת אתר תקפה למשימה. לא בוצע חישוב מסלול והוחל ציון נסיעה ניטרלי 50.',
    );
    expect(getCandidateNotices(withoutSiteAddress)).toEqual([]);
  });
});
