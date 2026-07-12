export function validateProjectMilestoneDateRange(
  start: string,
  end: string,
  allowSameDay: boolean,
): string | undefined {
  if (!start && !end) return undefined;
  if (!start || !end) {
    return 'יש להזין גם תאריך התחלה וגם תאריך סיום.';
  }

  if (allowSameDay ? end < start : end <= start) {
    return allowSameDay
      ? 'תאריך הסיום חייב להיות אחרי או שווה לתאריך ההתחלה.'
      : 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה.';
  }

  return undefined;
}
