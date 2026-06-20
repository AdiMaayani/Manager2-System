import { useId, type InputHTMLAttributes } from 'react';
import './Checkbox.css';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export function Checkbox({ label, id, className = '', ...props }: CheckboxProps) {
  const generatedId = useId();
  const checkboxId = id ?? props.name ?? generatedId;
  return (
    <label className={`checkbox ${className}`.trim()} htmlFor={checkboxId}>
      <input id={checkboxId} type="checkbox" className="checkbox__input" {...props} />
      <span className="checkbox__label">{label}</span>
    </label>
  );
}
