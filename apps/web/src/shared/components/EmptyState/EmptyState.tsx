import './EmptyState.css';

interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="emptyState">
      <p className="emptyState__title">{title}</p>
      {description && <p className="emptyState__desc">{description}</p>}
    </div>
  );
}
