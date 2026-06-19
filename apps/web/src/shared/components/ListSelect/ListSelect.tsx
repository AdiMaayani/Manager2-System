import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
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
  disabled?: boolean;
}

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
  'aria-label'?: string;
}

const MENU_MAX_HEIGHT = 240;
const MENU_GAP = 4;

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
  'aria-label': ariaLabel,
}: ListSelectProps) {
  const generatedId = useId();
  const triggerId = id ?? generatedId;
  const listboxId = `${triggerId}-listbox`;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);

  const selectedOption = options.find((option) => option.value === value) ?? null;
  const enabledOptions = options.filter((option) => !option.disabled);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setActiveIndex(-1);
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

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP;
    const spaceAbove = rect.top - MENU_GAP;
    const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(MENU_MAX_HEIGHT, openUpward ? spaceAbove : spaceBelow);
    const estimatedHeight = Math.min(
      maxHeight,
      Math.max(enabledOptions.length, 1) * 40 + 8,
    );
    const top = openUpward ? rect.top - MENU_GAP - estimatedHeight : rect.bottom + MENU_GAP;

    setMenuStyle({
      top: Math.max(8, top),
      left: rect.left,
      width: rect.width,
    });
  }, [enabledOptions.length]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updateMenuPosition();
  }, [isOpen, options.length, updateMenuPosition]);

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
        if (activeIndex >= 0 && enabledOptions[activeIndex]) {
          selectOption(enabledOptions[activeIndex].value);
        }
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu();
        break;
      default:
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
        if (activeIndex >= 0 && enabledOptions[activeIndex]) {
          selectOption(enabledOptions[activeIndex].value);
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

  useEffect(() => {
    if (!isOpen || activeIndex < 0 || !menuRef.current) return;
    const activeItem = menuRef.current.querySelector<HTMLElement>(
      `[data-option-index="${activeIndex}"]`,
    );
    activeItem?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  const menu =
    isOpen && menuStyle
      ? createPortal(
          <ul
            ref={menuRef}
            id={listboxId}
            role="listbox"
            className="listSelect__menu"
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
            {options.map((option) => {
              const enabledIndex = enabledOptions.findIndex((row) => row.value === option.value);
              const isActive = enabledIndex === activeIndex;
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
                  {option.label}
                </li>
              );
            })}
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
      <div className="listSelect">
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          className={[
            'listSelect__trigger',
            'formControl',
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
              'listSelect__triggerLabel',
              !selectedOption?.label ? 'listSelect__triggerLabel--placeholder' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown size={16} className="listSelect__chevron" aria-hidden />
        </button>
        {menu}
      </div>
    </FormField>
  );
}
