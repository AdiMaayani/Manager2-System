import { PageShell } from '@shared/components/PageShell';
import { ComingSoonPanel } from '@shared/components/ComingSoonPanel';

export function CashflowPage() {
  return (
    <PageShell title="תזרים">
      <ComingSoonPanel
        title="תזרים ותחזית פיננסית"
        description="מסך התזרים עדיין אינו מחובר למודל פיננסי, API או טבלאות ייעודיות. בשלב זה מוצג מצב מתוכנן בלבד."
        plannedScope={[
          'תחזית הכנסות והוצאות לפי תקופה',
          'קישור עתידי לפרויקטים, חשבוניות והזמנות',
          'ייצוא דוחות לאחר הגדרת מודל כספי',
        ]}
        note="לא מוצגים נתונים פיננסיים מדומים כדי למנוע פרשנות שגויה."
      />
    </PageShell>
  );
}
