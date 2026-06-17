import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './IconButton.css';

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required accessible name for the icon-only control. */
  label: string;
  icon: ReactNode;
  variant?: 'ghost' | 'subtle' | 'danger';
  size?: 'sm' | 'md';
}

export function IconButton({
  label,
  icon,
  variant = 'ghost',
  size = 'md',
  className = '',
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      className={`iconButton iconButton--${variant} iconButton--${size} ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      <span className="iconButton__glyph" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}
