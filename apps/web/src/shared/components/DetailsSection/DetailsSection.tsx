import type { ReactNode } from 'react';
import './DetailsSection.css';

interface DetailsSectionProps {
  title: string;
  /** Optional subtitle shown under the title, e.g. a short hint about the section. */
  description?: string;
  children: ReactNode;
}

/**
 * Card-style section for drawer review (read-only) mode, matching the
 * Project Drawer sectioned layout: white card, bordered header, calm spacing.
 */
export function DetailsSection({ title, description, children }: DetailsSectionProps) {
  return (
    <section className="detailsSection">
      <header className="detailsSection__header">
        <h3 className="detailsSection__title">{title}</h3>
        {description && <p className="detailsSection__description">{description}</p>}
      </header>
      <div className="detailsSection__body">{children}</div>
    </section>
  );
}
