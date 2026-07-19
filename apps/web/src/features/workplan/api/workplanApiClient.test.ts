import { describe, expect, it } from 'vitest';
import { mapDraftRecommendationResponse } from './workplanApiClient';

describe('mapDraftRecommendationResponse', () => {
  it('maps structured rejection reasons returned by the API to stable codes', () => {
    const response = mapDraftRecommendationResponse({
      generatedAt: '2026-07-18T09:00:00Z',
      message: 'generated',
      candidates: [
        {
          employeeId: 7,
          isEligible: false,
          rejectionReasons: [
            { code: 'MissingCriticalSkill', explanation: 'missing skill' },
            { code: 'BusyConflict', explanation: 'busy' },
          ],
          missingInputCodes: ['RouteDataMissing'],
          factors: [],
        },
      ],
    });

    expect(response.candidates[0].rejectionReasonCodes).toEqual([
      'MissingCriticalSkill',
      'BusyConflict',
    ]);
    expect(response.candidates[0].missingInputCodes).toEqual(['RouteDataMissing']);
  });

  it('keeps the legacy flat rejection-code fallback additive', () => {
    const response = mapDraftRecommendationResponse({
      candidates: [
        {
          employeeId: 8,
          isEligible: false,
          rejectionReasonCodes: ['ScheduleNotCovered'],
          factors: [],
        },
      ],
    });

    expect(response.candidates[0].rejectionReasonCodes).toEqual(['ScheduleNotCovered']);
  });

  it('maps multi-profession and route metadata without dropping factor source values', () => {
    const response = mapDraftRecommendationResponse({
      candidates: [
        {
          employeeId: 9,
          isEligible: true,
          professions: ['Electrician', 'Welder'],
          requiredRoles: ['Electrician', 'Inspector'],
          matchedRoles: ['Electrician'],
          missingRoles: ['Inspector'],
          originTypeUsed: 'LastKnownLocation',
          travelMinutes: 18.4,
          distanceKm: 12.7,
          factors: [
            {
              key: 'route',
              sourceValues: {
                provider: 'Geoapify',
                cacheHit: true,
                originFormattedAddress: 'Employee home',
                destinationFormattedAddress: 'Task site',
              },
            },
          ],
        },
      ],
    });

    expect(response.candidates[0]).toMatchObject({
      professions: ['Electrician', 'Welder'],
      requiredRoles: ['Electrician', 'Inspector'],
      matchedRoles: ['Electrician'],
      missingRoles: ['Inspector'],
      originTypeUsed: 'LastKnownLocation',
      travelMinutes: 18.4,
      distanceKm: 12.7,
    });
    expect(response.candidates[0].factors[0].sourceValues).toEqual({
      provider: 'Geoapify',
      cacheHit: true,
      originFormattedAddress: 'Employee home',
      destinationFormattedAddress: 'Task site',
    });
  });
});
