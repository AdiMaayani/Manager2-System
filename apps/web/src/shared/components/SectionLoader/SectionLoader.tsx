import { Spinner } from '../Spinner';
import './SectionLoader.css';

interface SectionLoaderProps {
  label?: string;
}

/**
 * Compact inline loader for sections inside drawers, cards, and panels — use
 * instead of bespoke "טוען…" paragraphs so in-place loading looks consistent.
 */
export function SectionLoader({ label = 'טוען...' }: SectionLoaderProps) {
  return (
    <div className="sectionLoader">
      <Spinner size="sm" label={label} />
      <span className="sectionLoader__label">{label}</span>
    </div>
  );
}
