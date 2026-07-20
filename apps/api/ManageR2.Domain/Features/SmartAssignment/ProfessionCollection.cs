namespace ManageR2.Domain.Features.SmartAssignment;

/// <summary>
/// Canonical role/profession handling shared by API mappings, persistence models, and scoring.
/// Collections are case-insensitively de-duplicated and sorted so input or database row order
/// cannot affect eligibility or ranking.
/// </summary>
public static class ProfessionCollection
{
    public static IReadOnlyList<string> Normalize(IEnumerable<string?>? values)
    {
        if (values is null)
        {
            return Array.Empty<string>();
        }

        return values
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value!.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
            .ThenBy(value => value, StringComparer.Ordinal)
            .ToArray();
    }

    /// <summary>
    /// The additive collection is authoritative whenever it is present. The legacy scalar is
    /// consulted only for clients/databases that do not yet send the collection.
    /// </summary>
    public static IReadOnlyList<string> Resolve(
        IEnumerable<string?>? collection,
        string? legacyValue)
    {
        return collection is null
            ? Normalize(new[] { legacyValue })
            : Normalize(collection);
    }

    public static IReadOnlyList<string> ResolveEmployeeProfessions(
        IEnumerable<string?>? professions,
        string? primaryRole)
    {
        var supplied = professions is null
            ? Array.Empty<string?>()
            : professions.ToArray();

        // Put the scalar primary role first so it supplies the canonical casing when a
        // case-insensitive duplicate also appears in the additive collection.
        return Normalize(new[] { primaryRole }.Concat(supplied));
    }

    /// <summary>
    /// Preserves an additive collection when an older full-update client knows only the scalar.
    /// A supplied collection remains authoritative (including an explicitly empty collection).
    /// </summary>
    public static IReadOnlyList<string> ResolveForUpdate(
        IEnumerable<string?>? collection,
        string? legacyValue,
        IEnumerable<string?>? existingCollection,
        string? existingLegacyValue,
        bool legacyValueWasProvided = false)
    {
        if (collection is not null)
        {
            return Resolve(collection, legacyValue);
        }

        var existing = Normalize(existingCollection);
        if (existing.Count == 0)
        {
            existing = Resolve(null, existingLegacyValue);
        }

        if (string.IsNullOrWhiteSpace(legacyValue))
        {
            return legacyValueWasProvided ? Array.Empty<string>() : existing;
        }

        return Normalize(existing
            .Where(value => !string.Equals(
                value,
                existingLegacyValue?.Trim(),
                StringComparison.OrdinalIgnoreCase))
            .Append(legacyValue));
    }
}
