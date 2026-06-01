import { Button } from '@shared/components/Button';
import './ProjectQuoteTab.css';

export function ProjectQuoteTab() {
  return (
    <div className="projectQuoteTab">
      <div className="projectQuoteTab__card">
        <h3>הצעת מחיר</h3>
        <p className="projectQuoteTab__summary">סכום משוער: ₪250,000</p>
        <p className="projectQuoteTab__hint">תוכן זה הוא placeholder — כמו בממשק הישן.</p>
        <Button type="button" variant="secondary" disabled>
          צפייה בהצעת מחיר
        </Button>
      </div>
    </div>
  );
}
