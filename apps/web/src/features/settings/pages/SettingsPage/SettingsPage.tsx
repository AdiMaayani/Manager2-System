import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { EmptyState } from '@shared/components/EmptyState';
import { Badge } from '@shared/components/Badge';
import { getCurrentUser, getRoleDisplayLabel } from '@api/auth';
import { apiBaseUrl, appDataMode, appEnvironment, isMockDataMode } from '@/config/appConfig';
import {
  WORKPLAN_PRIORITY_OPTIONS,
  WORKPLAN_STATUS_OPTIONS,
} from '@features/workplan/constants';
import {
  MILESTONE_PRIORITY_OPTIONS,
  MILESTONE_STATUS_OPTIONS,
  PROJECT_STATUS_OPTIONS,
} from '@features/projects/utils/projectDisplayUtils';
import { Link } from 'react-router-dom';
import { SettingsSection } from '../../components/SettingsSection';
import { useSettingsLookups } from '../../hooks/useSettingsLookups';
import './SettingsPage.css';

const COMPANY_DETAILS = [
  { label: 'שם חברה', value: 'ManageR²' },
  { label: 'אימייל מערכת', value: 'לא מוגדר' },
  { label: 'טלפון ראשי', value: 'לא מוגדר' },
  { label: 'כתובת', value: 'לא מוגדר' },
  { label: 'מספר עוסק / חברה', value: 'לא מוגדר' },
];

const INTEGRATIONS = [
  'Email',
  'WhatsApp',
  'Calendar',
  'Printing',
  'Documents',
  'External Project Management',
];

function renderValue(value?: string | number | null) {
  return value || 'לא זמין';
}

export function SettingsPage() {
  const currentUser = getCurrentUser();
  const isAdmin = currentUser?.roles.includes('Admin') ?? false;
  const { rolesQuery, departmentsQuery } = useSettingsLookups(isAdmin);

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
              <strong>{appEnvironment}</strong>
            </div>
            <div className="settingsPage__infoTile">
              <span>מצב נתונים</span>
              <strong>{appDataMode === 'mock' ? 'mock - נתוני דמו' : 'local - API אמיתי'}</strong>
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
          description="אין כרגע API או טבלת הגדרות לשמירת פרטי חברה. השדות מוצגים לקריאה בלבד עד שתתווסף יכולת שמירה אמיתית."
        >
          <div className="settingsPage__readonlyGrid">
            {COMPANY_DETAILS.map((field) => (
              <div key={field.label} className="settingsPage__readonlyField">
                <span>{field.label}</span>
                <strong>{field.value}</strong>
              </div>
            ))}
          </div>
          <p className="settingsPage__note">
            שמירת פרטי חברה דורשת endpoint ייעודי ומודל נתונים בצד השרת. לא נוסף כפתור שמירה כדי לא ליצור מצג
            שווא של הגדרה שנשמרת.
          </p>
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
                <Link className="settingsPage__linkButton" to="/users">
                  פתח ניהול משתמשים
                </Link>
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
          description="רשימת יכולות מתוכננות. לא נבנו חיבורים חיצוניים בענף הזה."
        >
          <div className="settingsPage__integrationGrid">
            {INTEGRATIONS.map((integration) => (
              <div key={integration} className="settingsPage__integrationCard">
                <strong>{integration}</strong>
                <Badge variant="warning">מתוכנן / לא מוגדר</Badge>
              </div>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection
          title="מוכנות לפרודקשן"
          description="בדיקות תפעוליות מהירות למנהל מערכת."
        >
          <div className="settingsPage__warningList">
            {isMockDataMode && (
              <div className="settingsPage__warning settingsPage__warning--danger">
                מצב mock פעיל. זה מתאים לעבודת UI מקומית בלבד ואינו מוכן לפרודקשן.
              </div>
            )}
            <div className="settingsPage__warning">
              חיבור API, מחרוזת חיבור למסד נתונים ומפתח JWT מוגדרים לפי סביבת הרצה ולא מתוך מסך זה.
            </div>
            <div className="settingsPage__warning">
              הגדרות חברה ואינטגרציות עדיין אינן נשמרות משום שאין עבורן API/מודל נתונים ייעודי.
            </div>
          </div>
        </SettingsSection>
      </div>
    </PageShell>
  );
}
