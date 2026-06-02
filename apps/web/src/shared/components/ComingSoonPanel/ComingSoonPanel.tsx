import { Badge } from '../Badge';
import './ComingSoonPanel.css';

interface ComingSoonPanelProps {
  title: string;
  description: string;
  plannedScope?: string[];
  note?: string;
}

export function ComingSoonPanel({
  title,
  description,
  plannedScope = [],
  note,
}: ComingSoonPanelProps) {
  return (
    <section className="comingSoonPanel" aria-label={title}>
      <div className="comingSoonPanel__header">
        <Badge variant="warning">בקרוב</Badge>
        <h2>{title}</h2>
      </div>
      <p className="comingSoonPanel__description">{description}</p>

      {plannedScope.length > 0 && (
        <ul className="comingSoonPanel__list">
          {plannedScope.map((scopeItem) => (
            <li key={scopeItem}>{scopeItem}</li>
          ))}
        </ul>
      )}

      {note && <p className="comingSoonPanel__note">{note}</p>}
    </section>
  );
}
