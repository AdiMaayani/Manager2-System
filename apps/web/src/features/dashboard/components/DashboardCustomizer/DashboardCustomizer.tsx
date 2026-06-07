import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import {
  DASHBOARD_SECTIONS,
  type DashboardSectionId,
} from '../../hooks/useDashboardPreferences';
import './DashboardCustomizer.css';

interface DashboardCustomizerProps {
  visibility: Record<DashboardSectionId, boolean>;
  hiddenCount: number;
  onToggle: (sectionId: DashboardSectionId) => void;
  onReset: () => void;
}

export function DashboardCustomizer({
  visibility,
  hiddenCount,
  onToggle,
  onReset,
}: DashboardCustomizerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="dashboardCustomizer" ref={containerRef}>
      <button
        type="button"
        className="dashboardCustomizer__trigger"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>התאמה אישית</span>
        {hiddenCount > 0 && (
          <span className="dashboardCustomizer__badge">{hiddenCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="dashboardCustomizer__panel" role="menu">
          <div className="dashboardCustomizer__panelHead">
            <span>בחר מה להציג בלוח</span>
            <button
              type="button"
              className="dashboardCustomizer__reset"
              onClick={onReset}
            >
              איפוס
            </button>
          </div>
          <ul className="dashboardCustomizer__list">
            {DASHBOARD_SECTIONS.map((section) => (
              <li key={section.id} className="dashboardCustomizer__item">
                <label className="dashboardCustomizer__option">
                  <input
                    type="checkbox"
                    checked={visibility[section.id] ?? true}
                    onChange={() => onToggle(section.id)}
                  />
                  <span>{section.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
