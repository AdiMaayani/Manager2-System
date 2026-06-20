import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { FormField } from '../FormField';
import './ListSelect.css';

export interface ListSelectOption {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
  disabled?: boolean;
}

type MenuWidthMode = 'trigger' | 'wide';

interface ListSelectProps {
  label?: string;
  error?: string;
  helpText?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: ListSelectOption[];
  id?: string;
  className?: string;
  'aria-label'?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  menuWidthMode?: MenuWidthMode;
  menuMinWidth?: number;
  menuMaxWidth?: number;
  wrapOptions?: boolean;
  triggerMultiline?: boolean;
  showDescriptionInTrigger?: boolean;
}

const MENU_MAX_HEIGHT = 240;
const MENU_GAP = 4;
const VIEWPORT_PADDING = 12;
const DEFAULT_WIDE_MIN_WIDTH = 300;

function isDocumentRtl(): boolean {
  return document.documentElement.dir === 'rtl'
    || getComputedStyle(document.documentElement).direction === 'rtl';
}

function optionMatchesQuery(option: ListSelectOption, query: string): boolean {
  const haystack = [option.label, option.description, option.searchText]
    .filter(Boolean)
    .join(' ')
   .toLowerCase();
  return haystack.includes(query);
}

function resolveActiveOptionIndex(activeIndex: number, optionCount: number): number {
  if (optionCount === 0) return -1;
  if (activeIndex < 0 || activeIndex >= optionCount) return 0;
  return activeIndex;
}

function OptionContent({
  option,
  showDescription,
}: {
  option: ListSelectOption;
  showDescription: boolean;
}) {
  if (!showDescription || !option.description) {
    return <span className="listSelect__optionLabel">{option.label}</span>;
  }

  return (
    <span className="listSelect__optionContent">
      <span className="listSelect__optionLabel">{option.label}</span>
      <span className="listSelect__optionDescription">{option.description}</span>
    </span>
  );
}

export function ListSelect({
  label,
  error,
  helpText,
  required,
  disabled = false,
  placeholder = 'בחר…',
  value,
  onChange,
  options,
  id,
  className,
  'aria-label': ariaLabel,
  searchable = false,
  searchPlaceholder = 'חיפוש…',
  emptyMessage = 'לא נמצאו תוצאות.',
  menuWidthMode = 'trigger',
  menuMinWidth = DEFAULT_WIDE_MIN_WIDTH,
  menuMaxWidth,
  wrapOptions = false,
  triggerMultiline = false,
  showDescriptionInTrigger = false,
}: ListSelectProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listboxId = `${triggerId}-listbox`;
  const searchInputId = `${triggerId}-search`;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((option) => option.value === value) ?? null;

  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => optionMatchesQuery(option, query));
  }, [options, searchQuery]);

  const enabledOptions = useMemo(
    () => filteredOptions.filter((option) => !option.disabled),
    [filteredOptions],
  );

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
    setSearchQuery('');
    setMenuStyle(null);
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    setIsOpen(true);
    const selectedIndex = enabledOptions.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
  }, [disabled, enabledOptions, value]);

  const selectOption = useCallback(
    (nextValue: string) => {
      onChange(nextValue);
      closeMenu();
      triggerRef.current?.focus();
    },
    [closeMenu, onChange],
  );

  const resolveMenuWidth = useCallback(
    (triggerWidth: number) => {
      const maxWidth = menuMaxWidth ?? window.innerWidth - VIEWPORT_PADDING * 2;
      if (menuWidthMode === 'wide') {
        return Math.min(maxWidth, Math.max(menuMinWidth, triggerWidth));
      }
      return Math.min(maxWidth, triggerWidth);
    },
    [menuMaxWidth, menuMinWidth, menuWidthMode],
  );

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const menuWidth = resolveMenuWidth(rect.width);
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - MENU_GAP;
    const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(MENU_MAX_HEIGHT, openUpward ? spaceAbove : spaceBelow);
    const estimatedHeight = Math.min(
      maxHeight,
      Math.max(enabledOptions.length, 1) * (wrapOptions ? 52 : 40) + (searchable ? 48 : 8),
    );
    const top = openUpward ? rect.top - MENU_GAP - estimatedHeight : rect.bottom + MENU_GAP;

    const rtl = isDocumentRtl();
    let left = rtl ? rect.right - menuWidth : rect.left;
    left = Math.max(
      VIEWPORT_PADDING,
      Math.min(left, window.innerWidth - menuWidth - VIEWPORT_PADDING),
    );

    setMenuStyle({
      top: Math.max(VIEWPORT_PADDING, top),
      left,
      width: menuWidth,
    });
  }, [enabledOptions.length, resolveMenuWidth, searchable, wrapOptions]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
  }, [isOpen, options.length, filteredOptions.length, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;
    if (searchable) {
      searchInputRef.current?.focus();
    }
  }, [isOpen, searchable]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      closeMenu();
    }

    function handleScroll() {
      updateMenuPosition();
    }

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [closeMenu, isOpen, updateMenuPosition]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        if (!isOpen) {
          openMenu();
          return;
        }
        setActiveIndex((current) => {
          if (enabledOptions.length === 0) return -1;
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          const next = current < 0 ? 0 : (current + delta + enabledOptions.length) % enabledOptions.length;
          return next;
        });
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isOpen) {
          openMenu();
          return;
        }
        if (activeIndex >= 0) {
          const index = resolveActiveOptionIndex(activeIndex, enabledOptions.length);
          if (enabledOptions[index]) {
            selectOption(enabledOptions[index].value);
          }
        }
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu();
        break;
      default:
        if (searchable && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          openMenu();
          setSearchQuery((current) => current + event.key);
        }
        break;
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((current) => {
          if (enabledOptions.length === 0) return -1;
          const delta = event.key === 'ArrowDown' ? 1 : -1;
          return (current + delta + enabledOptions.length) % enabledOptions.length;
        });
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (activeIndex >= 0) {
          const index = resolveActiveOptionIndex(activeIndex, enabledOptions.length);
          if (enabledOptions[index]) {
            selectOption(enabledOptions[index].value);
          }
        }
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu();
        triggerRef.current?.focus();
        break;
      case 'Tab':
        closeMenu();
        break;
      default:
        break;
    }
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (enabledOptions.length > 0) setActiveIndex(0);
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (enabledOptions.length > 0) setActiveIndex(enabledOptions.length - 1);
        break;
      case 'Enter':
        event.preventDefault();
        if (activeIndex >= 0) {
          const index = resolveActiveOptionIndex(activeIndex, enabledOptions.length);
          if (enabledOptions[index]) {
            selectOption(enabledOptions[index].value);
          }
        } else if (enabledOptions.length === 1) {
          selectOption(enabledOptions[0].value);
        }
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu();
        triggerRef.current?.focus();
        break;
      default:
        break;
    }
  }

  useEffect(() => {
    if (!isOpen || activeIndex < 0 || !menuRef.current) return;
    const highlightedIndex = resolveActiveOptionIndex(activeIndex, enabledOptions.length);
    if (highlightedIndex < 0) return;
    const activeItem = menuRef.current.querySelector<HTMLElement>(
      `[data-option-index="${highlightedIndex}"]`,
    );
    activeItem?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, enabledOptions.length, isOpen]);

  const highlightedIndex = resolveActiveOptionIndex(activeIndex, enabledOptions.length);

  const triggerLabel = selectedOption?.label || placeholder;
  const triggerDescription =
    showDescriptionInTrigger && selectedOption?.description ? selectedOption.description : null;

  const menu =
    isOpen && menuStyle
      ? createPortal(
          <ul
            ref={menuRef}
            id={listboxId}
            role="listbox"
            className={[
              'listSelect__menu',
              wrapOptions ? 'listSelect__menu--wrap' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{
              top: menuStyle.top,
              left: menuStyle.left,
              width: menuStyle.width,
              maxHeight: MENU_MAX_HEIGHT,
            }}
            onKeyDown={handleMenuKeyDown}
            aria-labelledby={label ? triggerId : undefined}
            aria-label={!label ? ariaLabel : undefined}
          >
            {searchable && (
              <li className="listSelect__searchWrap" role="presentation">
                <input
                  ref={searchInputRef}
                  id={searchInputId}
                  type="search"
                  className="listSelect__searchInput formControl"
                  value={searchQuery}
                  placeholder={searchPlaceholder}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  aria-controls={listboxId}
                  autoComplete="off"
                />
              </li>
            )}
            {filteredOptions.length === 0 ? (
              <li className="listSelect__empty" role="presentation">
                {emptyMessage}
              </li>
            ) : (
              filteredOptions.map((option) => {
                const enabledIndex = enabledOptions.findIndex((row) => row.value === option.value);
                const isActive = enabledIndex === highlightedIndex;
                const isSelected = option.value === value;
                return (
                  <li
                    key={option.value || '__empty__'}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled || undefined}
                    data-option-index={enabledIndex}
                    className={[
                      'listSelect__option',
                      wrapOptions ? 'listSelect__option--wrap' : '',
                      isActive ? 'listSelect__option--active' : '',
                      isSelected ? 'listSelect__option--selected' : '',
                      option.disabled ? 'listSelect__option--disabled' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onMouseEnter={() => {
                      if (!option.disabled && enabledIndex >= 0) setActiveIndex(enabledIndex);
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      if (!option.disabled) selectOption(option.value);
                    }}
                  >
                    <OptionContent option={option} showDescription={Boolean(option.description)} />
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <FormField
      label={label}
      htmlFor={triggerId}
      required={required}
      error={error}
      helpText={helpText}
    >
      <div className={['listSelect', className].filter(Boolean).join(' ')}>
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          className={[
            'listSelect__trigger',
            'formControl',
            triggerMultiline ? 'listSelect__trigger--multiline' : '',
            error ? 'listSelect__trigger--error formControl--error' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listboxId : undefined}
          aria-label={!label ? ariaLabel : undefined}
          disabled={disabled}
          onClick={() => {
            if (isOpen) closeMenu();
            else openMenu();
          }}
          onKeyDown={handleTriggerKeyDown}
        >
          <span
            className={[
              'listSelect__triggerText',
              !selectedOption?.label ? 'listSelect__triggerText--placeholder' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span
              className={[
                'listSelect__triggerLabel',
                triggerMultiline ? 'listSelect__triggerLabel--multiline' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {triggerLabel}
            </span>
            {triggerDescription && (
              <span className="listSelect__triggerDescription">{triggerDescription}</span>
            )}
          </span>
          <ChevronDown size={16} className="listSelect__chevron" aria-hidden />
        </button>
        {menu}
      </div>
    </FormField>
  );
}
