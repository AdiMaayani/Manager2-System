import type { ReactNode } from 'react';
import { DetailsSection } from '../DetailsSection';
import { SectionLoader } from '../SectionLoader';
import './RelatedSection.css';

interface RelatedSectionProps {
  title: string;
  /** Number of related records, or null while the data has not loaded yet. */
  count: number | null;
  isLoading: boolean;
  isError: boolean;
  /** Data only available against a live server (mock-mode notice). */
  isUnavailable?: boolean;
  emptyText: string;
  unavailableText?: string;
  errorText?: string;
  loadingText?: string;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Shared "related records" block used inside entity drawers (customer, contact,
 * employee). Standardises the title-with-count + loading/empty/error hints that
 * were previously copy-pasted into every drawer.
 */
export function RelatedSection({
  title,
  count,
  isLoading,
  isError,
  isUnavailable = false,
  emptyText,
  unavailableText = 'נתונים מקושרים זמינים בחיבור לשרת בלבד.',
  errorText = 'טעינת הנתונים המקושרים נכשלה.',
  loadingText = 'טוען נתונים מקושרים…',
  footer,
  children,
}: RelatedSectionProps) {
  const sectionTitle = count != null ? `${title} (${count})` : title;

  let body: ReactNode;
  if (isUnavailable) {
    body = <p className="relatedSection__hint">{unavailableText}</p>;
  } else if (isLoading) {
    body = <SectionLoader label={loadingText} />;
  } else if (isError) {
    body = <p className="relatedSection__hint relatedSection__hint--error">{errorText}</p>;
  } else if (count === 0) {
    body = <p className="relatedSection__hint">{emptyText}</p>;
  } else {
    body = (
      <>
        {children}
        {footer}
      </>
    );
  }

  return <DetailsSection title={sectionTitle}>{body}</DetailsSection>;
}
