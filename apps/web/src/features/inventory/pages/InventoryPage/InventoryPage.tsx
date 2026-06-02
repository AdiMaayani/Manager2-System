import { PageShell } from '@shared/components/PageShell';
import { ComingSoonPanel } from '@shared/components/ComingSoonPanel';

export function InventoryPage() {
  return (
    <PageShell title="מלאי">
      <ComingSoonPanel
        title="ניהול מלאי"
        description="מודול המלאי עדיין לא נתמך ב-API או במסד הנתונים. המסך מוצג כיכולת מתוכננת בלבד כדי למנוע עבודה על נתוני דמו."
        plannedScope={[
          'קטלוג פריטים ומק״טים',
          'כמויות, מיקומים וספי מינימום',
          'חיבור עתידי להזמנות ולפרויקטים',
        ]}
        note="השלמת המודול דורשת אפיון DB ותהליכי מלאי מלאים."
      />
    </PageShell>
  );
}
