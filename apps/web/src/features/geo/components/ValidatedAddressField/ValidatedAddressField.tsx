import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@api/client';
import { FormField } from '@shared/components/FormField';
import { autocompleteAddressAsync, validateAddressAsync } from '../../api/geoApiClient';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  applyValidatedResponse,
  clearValidationState,
  hasValidatedSelection,
} from '../../lib/addressProfileState';
import {
  AUTOCOMPLETE_DEBOUNCE_MS,
  MIN_AUTOCOMPLETE_LENGTH,
  type GeoAutocompleteSuggestion,
  type ValidatedAddressFieldState,
} from '../../types';
import './ValidatedAddressField.css';

interface ValidatedAddressFieldProps {
  label?: string;
  value: ValidatedAddressFieldState;
  onChange: (next: ValidatedAddressFieldState) => void;
  disabled?: boolean;
  error?: string;
  helpText?: string;
  required?: boolean;
}

export function ValidatedAddressField({
  label = 'כתובת',
  value,
  onChange,
  disabled = false,
  error,
  helpText,
  required = false,
}: ValidatedAddressFieldProps) {
  const inputId = useId();
  const listboxId = `${inputId}-listbox`;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isValidating, setIsValidating] = useState(false);
  const [validateProviderError, setValidateProviderError] = useState<string | null>(null);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const validateAbortRef = useRef<AbortController | null>(null);
  const requestVersionRef = useRef(0);

  const debouncedQuery = useDebouncedValue(value.inputAddress, AUTOCOMPLETE_DEBOUNCE_MS);
  const trimmedQuery = debouncedQuery.trim();
  const canAutocomplete = trimmedQuery.length >= MIN_AUTOCOMPLETE_LENGTH;

  const suggestionsQuery = useQuery({
    queryKey: ['geo', 'autocomplete', trimmedQuery],
    queryFn: ({ signal }) => autocompleteAddressAsync(trimmedQuery, signal),
    enabled: canAutocomplete,
    staleTime: 30_000,
    retry: false,
  });

  const suggestions = canAutocomplete ? (suggestionsQuery.data ?? []) : [];

  const autocompleteProviderError =
    canAutocomplete && suggestionsQuery.error instanceof ApiError && suggestionsQuery.error.status === 503
      ? 'שירות האימות אינו זמין כרגע. נסו שוב מאוחר יותר.'
      : canAutocomplete && suggestionsQuery.error
        ? 'אירעה שגיאה בטעינת הצעות הכתובת.'
        : null;

  const providerError = validateProviderError ?? autocompleteProviderError;

  const updateMenuPosition = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    setMenuStyle({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition, suggestions.length]);

  async function handleSelectSuggestion(suggestion: GeoAutocompleteSuggestion) {
    const selectedText = suggestion.formattedAddress;
    onChange(clearValidationState(value, selectedText));
    setIsOpen(false);
    setIsValidating(true);
    setValidateProviderError(null);

    validateAbortRef.current?.abort();
    const controller = new AbortController();
    validateAbortRef.current = controller;
    const requestVersion = ++requestVersionRef.current;

    try {
      const validated = await validateAddressAsync(selectedText, controller.signal);
      if (requestVersion !== requestVersionRef.current) return;
      onChange(applyValidatedResponse(selectedText, validated));
    } catch (err) {
      if (controller.signal.aborted) return;
      if (requestVersion !== requestVersionRef.current) return;
      if (err instanceof ApiError && err.status === 503) {
        setValidateProviderError('שירות האימות אינו זמין כרגע. הכתובת לא נשמרה כמאומתת.');
      } else {
        setValidateProviderError('אימות הכתובת נכשל.');
      }
      onChange({
        ...clearValidationState(value, selectedText),
        validationStatus: null,
      });
    } finally {
      if (requestVersion === requestVersionRef.current) {
        setIsValidating(false);
      }
    }
  }

  function handleInputChange(nextValue: string) {
    setValidateProviderError(null);
    onChange(clearValidationState(value, nextValue));
    setIsOpen(nextValue.trim().length >= MIN_AUTOCOMPLETE_LENGTH);
    setActiveIndex(0);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      void handleSelectSuggestion(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  }

  const statusMessage = isValidating
    ? 'מאמת כתובת...'
    : hasValidatedSelection(value)
      ? `כתובת מאומתת: ${value.formattedAddress}`
      : providerError
        ? providerError
        : suggestionsQuery.isFetching
          ? 'טוען הצעות...'
          : canAutocomplete && suggestions.length === 0 && !suggestionsQuery.isFetching
            ? 'לא נמצאו תוצאות'
            : undefined;

  return (
    <div className="validatedAddressField" ref={containerRef}>
      <FormField
        label={label}
        htmlFor={inputId}
        required={required}
        error={error}
        helpText={helpText}
      >
        <input
          ref={inputRef}
          id={inputId}
          className={`formControl validatedAddressField__input ${error ? 'formControl--error' : ''}`.trim()}
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
          value={value.inputAddress}
          disabled={disabled || isValidating}
          onChange={(event) => handleInputChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) {
              setIsOpen(true);
              updateMenuPosition();
            }
          }}
          autoComplete="off"
        />
      </FormField>

      {statusMessage && (
        <p
          className={`validatedAddressField__status ${
            providerError ? 'validatedAddressField__status--error' : ''
          } ${hasValidatedSelection(value) ? 'validatedAddressField__status--success' : ''}`.trim()}
          role="status"
        >
          {statusMessage}
        </p>
      )}

      {isOpen && menuStyle && suggestions.length > 0 && createPortal(
        <ul
          id={listboxId}
          className="validatedAddressField__menu"
          role="listbox"
          style={{
            top: menuStyle.top,
            left: menuStyle.left,
            width: menuStyle.width,
          }}
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.placeId ?? suggestion.formattedAddress}-${index}`}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`validatedAddressField__option ${
                index === activeIndex ? 'validatedAddressField__option--active' : ''
              }`.trim()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => void handleSelectSuggestion(suggestion)}
            >
              {suggestion.formattedAddress}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
