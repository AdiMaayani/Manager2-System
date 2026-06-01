import { PageShell } from '@shared/components/PageShell';
import { Input } from '@shared/components/Input';
import { Button } from '@shared/components/Button';

export function SettingsPage() {
  return (
    <PageShell title="הגדרות">
      <form className="settingsPage__form" onSubmit={(e) => e.preventDefault()}>
        <Input label="שם חברה" defaultValue="ManageR²" />
        <Input label="אימייל מערכת" type="email" defaultValue="admin@manager2.co.il" />
        <Button type="submit">שמור</Button>
      </form>
    </PageShell>
  );
}
