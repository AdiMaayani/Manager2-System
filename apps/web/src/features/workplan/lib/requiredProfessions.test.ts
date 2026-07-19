import { describe, expect, it } from 'vitest';
import {
  addRequiredProfession,
  buildEmployeeProfessions,
  isRequiredProfessionSelected,
  legacyRequiredRole,
  normalizeRequiredProfessions,
  removeRequiredProfession,
} from './requiredProfessions';

describe('required professions', () => {
  it('trims values and removes case-insensitive duplicates while preserving order', () => {
    expect(normalizeRequiredProfessions(['  Electrician ', 'Welder', 'electrician', ''])).toEqual([
      'Electrician',
      'Welder',
    ]);
  });

  it('does not add an already selected profession with different casing', () => {
    const current = ['Electrician'];

    expect(addRequiredProfession(current, ' electrician ')).toEqual(current);
    expect(isRequiredProfessionSelected(current, 'ELECTRICIAN')).toBe(true);
  });

  it('removes a profession case-insensitively and keeps the legacy first value', () => {
    const remaining = removeRequiredProfession(['Electrician', 'Welder'], 'ELECTRICIAN');

    expect(remaining).toEqual(['Welder']);
    expect(legacyRequiredRole(remaining)).toBe('Welder');
    expect(legacyRequiredRole([])).toBeNull();
  });

  it('always includes the compatibility primary role first in an employee collection', () => {
    expect(buildEmployeeProfessions(' Electrician ', ['Welder', 'electrician'])).toEqual([
      'Electrician',
      'Welder',
    ]);
  });
});
