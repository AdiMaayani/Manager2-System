import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Spinner } from '../Spinner';
import './Button.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
  size?: 'sm' | 'md';
  isLoading?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  iconStart,
  iconEnd,
  className = '',
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`button button--${variant} button--${size} ${
        isLoading ? 'button--loading' : ''
      } ${className}`.trim()}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Spinner size="sm" label="טוען..." />}
      {!isLoading && iconStart && (
        <span className="button__icon" aria-hidden="true">
          {iconStart}
        </span>
      )}
      <span className="button__label">{children}</span>
      {!isLoading && iconEnd && (
        <span className="button__icon" aria-hidden="true">
          {iconEnd}
        </span>
      )}
    </button>
  );
}
