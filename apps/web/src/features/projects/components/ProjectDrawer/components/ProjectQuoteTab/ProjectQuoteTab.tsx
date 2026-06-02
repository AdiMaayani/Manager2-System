import { ComingSoonPanel } from '@shared/components/ComingSoonPanel';
import './ProjectQuoteTab.css';

export function ProjectQuoteTab() {
  return (
    <div className="projectQuoteTab">
      <ComingSoonPanel
        title="הצעות מחיר לפרויקט"
        description="מודול הצעות המחיר עדיין לא מחובר למסד הנתונים או ל-API, ולכן הוא מוסתר כיכולת מתוכננת במקום להציג סכומים מדומים."
        plannedScope={[
          'ניהול הצעת מחיר ראשית לפי פרויקט',
          'שורות תמחור, מע״מ וסיכומים',
          'תצוגת הדפסה או ייצוא לאחר אישור אפיון',
        ]}
        note="המשך העבודה דורש החלטת מוצר ועיצוב DB ייעודי."
      />
    </div>
  );
}
