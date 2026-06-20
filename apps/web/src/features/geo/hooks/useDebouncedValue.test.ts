import { describe, expect, it, vi } from 'vitest';

function createDebouncedValue<T>(value: T, delayMs: number, onDebounced: (next: T) => void): () => void {
  const timeoutId = setTimeout(() => onDebounced(value), delayMs);
  return () => clearTimeout(timeoutId);
}

describe('debounced autocomplete input', () => {
  it('delays emitting the latest value until the debounce window passes', () => {
    vi.useFakeTimers();

    const emitted: string[] = [];
    let cancel = createDebouncedValue('abc', 300, (next) => emitted.push(next));

    vi.advanceTimersByTime(299);
    expect(emitted).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(emitted).toEqual(['abc']);

    cancel = createDebouncedValue('abcd', 300, (next) => emitted.push(next));
    cancel();
    vi.advanceTimersByTime(300);

    expect(emitted).toEqual(['abc']);
    vi.useRealTimers();
  });
});
