/** Related-project lists must join by CustomerId — customer names are not unique. */
export function filterRelatedProjectsByCustomerId<T extends { customerId?: number | null }>(
  projects: T[],
  customerId: number,
): T[] {
  if (!customerId || customerId <= 0) {
    return [];
  }

  return projects.filter((project) => project.customerId === customerId);
}
