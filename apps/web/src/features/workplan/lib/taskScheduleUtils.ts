import {
  durationMinutesBetweenUtc,
  localPartsToUtcIso,
  utcToLocalParts,
} from '@shared/utils/utcDateTime';

export interface PlannedScheduleParts {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

export function hydratePlannedScheduleFromUtc(
  plannedStart?: string | null,
  plannedEnd?: string | null,
): PlannedScheduleParts {
  const start = plannedStart ? utcToLocalParts(plannedStart) : { date: '', time: '' };
  const end = plannedEnd ? utcToLocalParts(plannedEnd) : { date: '', time: '' };

  return {
    startDate: start.date,
    startTime: start.time,
    endDate: end.date || start.date,
    endTime: end.time,
  };
}

export function deriveDurationFromParts(parts: PlannedScheduleParts): number | null {
  try {
    const range = buildPlannedUtcRangeFromParts(parts);
    return durationMinutesBetweenUtc(range.plannedStart, range.plannedEnd);
  } catch {
    return null;
  }
}

export function buildPlannedUtcRangeFromParts(parts: PlannedScheduleParts): {
  plannedStart: string;
  plannedEnd: string;
} {
  const { startDate, startTime, endDate, endTime } = parts;

  if (!startDate || !startTime || !endDate || !endTime) {
    throw new Error('יש להזין תאריך ושעה להתחלה ולסיום');
  }

  const plannedStart = localPartsToUtcIso(startDate, startTime);
  const plannedEnd = localPartsToUtcIso(endDate, endTime);
  const minutes = durationMinutesBetweenUtc(plannedStart, plannedEnd);

  if (minutes == null || minutes <= 0) {
    throw new Error('מועד הסיום חייב להיות אחרי מועד ההתחלה');
  }

  return { plannedStart, plannedEnd };
}
