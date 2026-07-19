function professionKey(value: string): string {
  return value.trim().normalize('NFKC').toLocaleLowerCase('he-IL');
}

export function normalizeRequiredProfessions(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  values.forEach((value) => {
    const trimmed = value.trim();
    const key = professionKey(trimmed);
    if (!key || seen.has(key)) return;
    seen.add(key);
    normalized.push(trimmed);
  });

  return normalized;
}

export function addRequiredProfession(
  current: readonly string[],
  profession: string,
): string[] {
  return normalizeRequiredProfessions([...current, profession]);
}

export function removeRequiredProfession(
  current: readonly string[],
  profession: string,
): string[] {
  const removedKey = professionKey(profession);
  return current.filter((value) => professionKey(value) !== removedKey);
}

export function isRequiredProfessionSelected(
  selected: readonly string[],
  profession: string,
): boolean {
  const candidateKey = professionKey(profession);
  return selected.some((value) => professionKey(value) === candidateKey);
}

export function legacyRequiredRole(requiredRoles: readonly string[]): string | null {
  return normalizeRequiredProfessions(requiredRoles)[0] ?? null;
}

export function buildEmployeeProfessions(
  primaryRole: string,
  professions: readonly string[],
): string[] {
  return normalizeRequiredProfessions([primaryRole, ...professions]);
}
