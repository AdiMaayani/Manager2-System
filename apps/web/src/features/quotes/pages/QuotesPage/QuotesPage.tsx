import { PageShell } from '@shared/components/PageShell';
import { ComingSoonPanel } from '@shared/components/ComingSoonPanel';

export function QuotesPage() {
  return (
    <PageShell title="הצעות מחיר">
      <ComingSoonPanel
        title="מודול הצעות מחיר"
        description="המסך נשמר בניווט כדי להציג את כיוון המוצר, אך אין עדיין API, טבלאות DB או תהליך עסקי מאושר להצעות מחיר."
        plannedScope={[
          'רשימת הצעות מחיר לפי לקוח או פרויקט',
          'עריכת שורות תמחור וסיכומי מע״מ',
          'סטטוסים, הדפסה וייצוא לאחר אפיון',
        ]}
        note="עד למימוש מלא לא מוצגים נתוני mock במסך זה."
      />
    </PageShell>
  );
}
