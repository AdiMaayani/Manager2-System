import type { InputHTMLAttributes } from 'react';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, id, className = '', ...props }: InputProps) {
  const inputId = id ?? props.name;
  return (
    <div className="inputField">
      {label && (
        <label className="inputField__label" htmlFor={inputId}>
          {label}
        </label>
      )}
      <input id={inputId} className={`inputField__input ${className}`.trim()} {...props} />
    </div>
  );
}
