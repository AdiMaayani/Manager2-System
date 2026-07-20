using System.Collections.Concurrent;
using ManageR2.Infrastructure.Features.Geo.Models;

namespace ManageR2.Infrastructure.Features.Geo.Services;

public interface IGeoRouteLookupCache
{
    Task<GeoRouteResultModel?> GetOrCreateAsync(
        GeoRouteCacheKey key,
        Func<CancellationToken, Task<GeoRouteResultModel?>> factory,
        CancellationToken cancellationToken);
}

/// <summary>
/// Process-local bounded route cache. A fixed set of striped async locks prevents
/// duplicate provider calls without retaining one synchronization object per route.
/// Null results are cached briefly to dampen provider outages and no-route responses.
/// </summary>
public sealed class InMemoryGeoRouteLookupCache : IGeoRouteLookupCache
{
    private const int DefaultMaximumEntries = 4096;
    private const int LockStripeCount = 64;

    private readonly ConcurrentDictionary<GeoRouteCacheKey, CacheEntry> _entries = new();
    private readonly SemaphoreSlim[] _lockStripes;
    private readonly TimeProvider _timeProvider;
    private readonly TimeSpan _successTtl;
    private readonly TimeSpan _negativeTtl;
    private readonly int _maximumEntries;

    public InMemoryGeoRouteLookupCache(
        TimeProvider? timeProvider = null,
        TimeSpan? successTtl = null,
        TimeSpan? negativeTtl = null,
        int maximumEntries = DefaultMaximumEntries)
    {
        if (maximumEntries <= 0)
        {
            throw new ArgumentOutOfRangeException(nameof(maximumEntries));
        }

        _timeProvider = timeProvider ?? TimeProvider.System;
        _successTtl = successTtl ?? TimeSpan.FromHours(6);
        _negativeTtl = negativeTtl ?? TimeSpan.FromMinutes(1);
        _maximumEntries = maximumEntries;
        _lockStripes = Enumerable.Range(0, LockStripeCount)
            .Select(_ => new SemaphoreSlim(1, 1))
            .ToArray();
    }

    public async Task<GeoRouteResultModel?> GetOrCreateAsync(
        GeoRouteCacheKey key,
        Func<CancellationToken, Task<GeoRouteResultModel?>> factory,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(factory);

        if (TryGetFresh(key, out var cached))
        {
            return cached;
        }

        var stripe = GetStripe(key);
        await stripe.WaitAsync(cancellationToken);
        try
        {
            if (TryGetFresh(key, out cached))
            {
                return cached;
            }

            var value = await factory(cancellationToken);
            var ttl = value is null ? _negativeTtl : _successTtl;
            _entries[key] = new CacheEntry(value, _timeProvider.GetUtcNow().Add(ttl));
            TrimIfNeeded();
            return value;
        }
        finally
        {
            stripe.Release();
        }
    }

    private bool TryGetFresh(GeoRouteCacheKey key, out GeoRouteResultModel? value)
    {
        value = null;
        if (!_entries.TryGetValue(key, out var entry))
        {
            return false;
        }

        if (entry.ExpiresAt > _timeProvider.GetUtcNow())
        {
            value = entry.Value;
            return true;
        }

        _entries.TryRemove(key, out _);
        return false;
    }

    private SemaphoreSlim GetStripe(GeoRouteCacheKey key)
    {
        var hash = key.GetHashCode() & int.MaxValue;
        return _lockStripes[hash % _lockStripes.Length];
    }

    private void TrimIfNeeded()
    {
        if (_entries.Count <= _maximumEntries)
        {
            return;
        }

        var now = _timeProvider.GetUtcNow();
        foreach (var pair in _entries)
        {
            if (pair.Value.ExpiresAt <= now)
            {
                _entries.TryRemove(pair.Key, out _);
            }
        }

        var overflow = _entries.Count - _maximumEntries;
        if (overflow <= 0)
        {
            return;
        }

        foreach (var pair in _entries
                     .OrderBy(item => item.Value.ExpiresAt)
                     .Take(overflow))
        {
            _entries.TryRemove(pair.Key, out _);
        }
    }

    private sealed record CacheEntry(GeoRouteResultModel? Value, DateTimeOffset ExpiresAt);
}
