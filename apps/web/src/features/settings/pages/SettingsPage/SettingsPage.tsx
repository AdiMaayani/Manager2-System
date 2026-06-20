import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { ComingSoonPanel } from '@shared/components/ComingSoonPanel';
import { Badge } from '@shared/components/Badge';
import { InlineAlert } from '@shared/components/InlineAlert';
import { getCurrentUser, getRoleDisplayLabel } from '@api/auth';
import { apiBaseUrl } from '@/config/appConfig';
import {
  WORKPLAN_PRIORITY_OPTIONS,
  WORKPLAN_STATUS_OPTIONS,
} from '@features/workplan/constants';
import {
  MILESTONE_PRIORITY_OPTIONS,
  MILESTONE_STATUS_OPTIONS,
  PROJECT_STATUS_OPTIONS,
} from '@features/projects/utils/projectDisplayUtils';
import { useNavigate } from 'react-router-dom';
import { Button } from '@shared/components/Button';
import { CompanySettingsForm } from '../../components/CompanySettingsForm';
import { SettingsSection } from '../../components/SettingsSection';
import { useCompanySettings, useUpdateCompanySettings } from '../../hooks/useCompanySettings';
import { useSettingsLookups } from '../../hooks/useSettingsLookups';
import type { UpdateCompanySettingsRequest } from '../../types';
import './SettingsPage.css';

const INTEGRATIONS = [
  { label: 'אימייל', description: 'שליחה וקבלה של הודעות מערכת ודיווחים' },
  { label: 'וואטסאפ', description: 'עדכוני לקוחות או עובדים דרך ספק חיצוני' },
  { label: 'יומן', description: 'סנכרון משימות ותזמונים ליומנים חיצוניים' },
  { label: 'הדפסה', description: 'תצוגות הדפסה לדיווחים, פרויקטים והצעות מחיר' },
  { label: 'מסמכים', description: 'קבצים, שרטוטים וצרופות עם הרשאות ואחסון מאובטח' },
  { label: 'מערכת ניהול חיצונית', description: 'חיבור עתידי לכלי ניהול פרויקטים חיצוני' },
];

function renderValue(value?: string | number | null) {
  return value || 'לא זמין';
}

export function SettingsPage() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.roles.includes('Admin') ?? false;
  const companySettingsQuery = useCompanySettings();
  const updateCompanySettingsMutation = useUpdateCompanySettings();
  const { rolesQuery, departmentsQuery } = useSettingsLookups(isAdmin);

  async function handleSaveCompanySettings(request: UpdateCompanySettingsRequest) {
    await updateCompanySettingsMutation.mutateAsync(request);
  }

  return (
    <PageShell title="הגדרות וניהול מערכת" wide>
      <div className="settingsPage">
        <SettingsSection
          title="סקירת מערכת"
          description="מידע תפעולי על סביבת העבודה והמשתמש המחובר."
        >
          <div className="settingsPage__overviewGrid">
            <div className="settingsPage__infoTile">
              <span>שם מערכת</span>
              <strong>ManageR²</strong>
            </div>
            <div className="settingsPage__infoTile">
              <span>סביבה</span>
              <strong>{import.meta.env.MODE}</strong>
            </div>
            <div className="settingsPage__infoTile">
              <span>כתובת API</span>
              <strong>{apiBaseUrl}</strong>
            </div>
            <div className="settingsPage__infoTile">
              <span>משתמש מחובר</span>
              <strong>{renderValue(currentUser?.username)}</strong>
            </div>
            <div className="settingsPage__infoTile">
              <span>אימייל משתמש</span>
              <strong>{renderValue(currentUser?.email)}</strong>
            </div>
          </div>

          <div className="settingsPage__badgeRow">
            {(currentUser?.roles ?? []).length > 0 ? (
              currentUser!.roles.map((role) => (
                <Badge key={role} variant={role === 'Admin' ? 'primary' : 'neutral'}>
                  {getRoleDisplayLabel(role)}
                </Badge>
              ))
            ) : (
              <Badge>אין תפקידים זמינים</Badge>
            )}
          </div>
        </SettingsSection>

        <SettingsSection
          title="פרטי חברה"
          description="פרטי הארגון נשמרים במסד הנתונים ומשמשים כפרופיל חברה בסיסי. פרטי סביבה וסודות אינם נשמרים כאן."
        >
          {companySettingsQuery.isLoading ? (
            <PageSpinner />
          ) : companySettingsQuery.error ? (
            <ErrorState
              message={
                companySettingsQuery.error instanceof Error
                  ? companySettingsQuery.error.message
                  : 'טעינת פרטי החברה נכשלה'
              }
              onRetry={() => companySettingsQuery.refetch()}
            />
          ) : companySettingsQuery.data ? (
            <CompanySettingsForm
              key={companySettingsQuery.data.updatedAt}
              companySettings={companySettingsQuery.data}
              isAdmin={isAdmin}
              isSaving={updateCompanySettingsMutation.isPending}
              onSave={handleSaveCompanySettings}
            />
          ) : (
            <EmptyState title="פרטי החברה לא אותחלו" />
          )}
        </SettingsSection>

        <SettingsSection
          title="ניהול משתמשים"
          description="קיצור דרך למסך ניהול המשתמשים, התפקידים והמחלקות."
        >
          <div className="settingsPage__shortcut">
            {isAdmin ? (
              <>
                <div>
                  <strong>יש לך הרשאת Admin.</strong>
                  <p>ניתן לנהל משתמשים, שיוך תפקידים ושיוך מחלקות במסך הייעודי.</p>
                </div>
                <Button variant="primary" onClick={() => navigate('/users')}>
                  פתח ניהול משתמשים
                </Button>
              </>
            ) : (
              <p className="settingsPage__note">
                רק משתמשים עם תפקיד Admin יכולים לנהל משתמשים. הקישור מוסתר למשתמשים ללא הרשאה זו.
              </p>
            )}
          </div>
        </SettingsSection>

        <SettingsSection
          title="תפקידים ומחלקות"
          description="מבט קריאה בלבד מתוך ה-API הקיים. יצירה או עריכה של תפקידים ומחלקות אינה נתמכת כרגע."
        >
          {!isAdmin ? (
            <p className="settingsPage__note">
              רשימות תפקידים ומחלקות זמינות רק למשתמשים עם תפקיד Admin.
            </p>
          ) : rolesQuery.isLoading || departmentsQuery.isLoading ? (
            <PageSpinner />
          ) : rolesQuery.error || departmentsQuery.error ? (
            <ErrorState
              message={
                rolesQuery.error instanceof Error
                  ? rolesQuery.error.message
                  : departmentsQuery.error instanceof Error
                    ? departmentsQuery.error.message
                    : 'טעינת תפקידים ומחלקות נכשלה'
              }
              onRetry={() => {
                rolesQuery.refetch();
                departmentsQuery.refetch();
              }}
            />
          ) : (
            <div className="settingsPage__catalogGrid">
              <div className="settingsPage__catalog">
                <h3>תפקידים</h3>
                {(rolesQuery.data ?? []).length === 0 ? (
                  <EmptyState title="לא נמצאו תפקידים" />
                ) : (
                  <div className="settingsPage__badgeRow">
                    {rolesQuery.data!.map((role) => (
                      <Badge key={role} variant={role === 'Admin' ? 'primary' : 'neutral'}>
                        {getRoleDisplayLabel(role)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="settingsPage__catalog">
                <h3>מחלקות</h3>
                {(departmentsQuery.data ?? []).length === 0 ? (
                  <EmptyState title="לא נמצאו מחלקות" />
                ) : (
                  <div className="settingsPage__badgeRow">
                    {departmentsQuery.data!.map((department) => (
                      <Badge key={department}>{department}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </SettingsSection>

        <SettingsSection
          title="סטטוסים ועדיפויות"
          description="תיעוד קריאה בלבד של תוויות מערכת קיימות בפרויקטים ובתוכנית העבודה."
        >
          <div className="settingsPage__catalogGrid">
            <div className="settingsPage__catalog">
              <h3>סטטוס תוכנית עבודה</h3>
              {WORKPLAN_STATUS_OPTIONS.map((option) => (
                <div key={option.code} className="settingsPage__mappingRow">
                  <code>{option.code}</code>
                  <span>{option.display}</span>
                </div>
              ))}
            </div>
            <div className="settingsPage__catalog">
              <h3>עדיפות תוכנית עבודה</h3>
              {WORKPLAN_PRIORITY_OPTIONS.map((option) => (
                <div key={option.code} className="settingsPage__mappingRow">
                  <code>{option.code}</code>
                  <span>{option.display}</span>
                </div>
              ))}
            </div>
            <div className="settingsPage__catalog">
              <h3>סטטוס פרויקט</h3>
              {PROJECT_STATUS_OPTIONS.map((option) => (
                <div key={option.code} className="settingsPage__mappingRow">
                  <code>{option.code}</code>
                  <span>{option.display}</span>
                </div>
              ))}
            </div>
            <div className="settingsPage__catalog">
              <h3>סטטוס ואבני דרך</h3>
              {MILESTONE_STATUS_OPTIONS.map((option) => (
                <div key={option.code} className="settingsPage__mappingRow">
                  <code>{option.code}</code>
                  <span>{option.display}</span>
                </div>
              ))}
              <h3>עדיפות אבני דרך</h3>
              {MILESTONE_PRIORITY_OPTIONS.map((option) => (
                <div key={option.code} className="settingsPage__mappingRow">
                  <code>{option.code}</code>
                  <span>{option.display}</span>
                </div>
              ))}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection
          title="אינטגרציות"
          description="יכולות חיצוניות מתוכננות בלבד. אין כאן חיבור פעיל לספקים, מסמכים או מערכות צד שלישי."
        >
          <ComingSoonPanel
            title="חיבורים חיצוניים"
            description="האינטגרציות מוצגות כ-roadmap בלבד. לא נשמרים כאן סודות, כתובות ספקים או הגדרות פעילות."
            note="מימוש עתידי ידרוש החלטות אבטחה, הגדרות סביבה ו-DB מתאים לכל ספק."
          />
          <div className="settingsPage__integrationGrid">
            {INTEGRATIONS.map((integration) => (
              <div key={integration.label} className="settingsPage__integrationCard">
                <div>
                  <strong>{integration.label}</strong>
                  <p>{integration.description}</p>
                </div>
                <Badge variant="warning">בקרוב</Badge>
              </div>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title="מוכנות לפרודקשן"
          description="בדיקות תפעוליות מהירות למנהל מערכת."
        >
          <div className="settingsPage__warningList">
            <InlineAlert variant="info">
              חיבור API, מחרוזת חיבור למסד נתונים ומפתח JWT מוגדרים לפי סביבת הרצה ולא מתוך מסך זה.
            </InlineAlert>
            {!companySettingsQuery.data && (
              <InlineAlert variant="warning">
                פרטי חברה דורשים הרצת migration במסד הנתונים לפני טעינה ושמירה.
              </InlineAlert>
            )}
          </div>
        </SettingsSection>
      </div>
    </PageShell>
  );
}
