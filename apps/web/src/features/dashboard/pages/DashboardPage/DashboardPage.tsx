import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { isLocalDataMode } from '@/config/appConfig';
import { useEmployees } from '@features/employees/hooks/useEmployees';
import { useProjects } from '@features/projects/hooks/useProjects';
import { useReports } from '@features/reports/hooks/useReports';
import { useAllWorkPlans } from '@features/workplan/hooks/useWorkPlanData';
import './DashboardPage.css';

interface DashboardStat {
  label: string;
  value: number;
}

const ACTIVE_PROJECT_STATUSES = new Set([
  'open',
  'planned',
  'design',
  'wiring',
  'execution',
  'פתוח',
  'בתכנון',
  'מתוכנן',
  'תוכניות',
  'השחלה',
  'ביצוע',
  'בביצוע',
]);

const OPEN_TASK_STATUSES = new Set([
  'open',
  'planned',
  'execution',
  'blocked',
  'פתוח',
  'בתכנון',
  'מתוכנן',
  'ביצוע',
  'בביצוע',
  'תקוע',
]);

function normalizeStatus(status?: string | null): string {
  return String(status ?? '').trim().toLowerCase();
}

function isReportFromCurrentWeek(reportDate?: string | null): boolean {
  if (!reportDate) return false;

  const date = new Date(reportDate);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  return date >= weekStart && date < weekEnd;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'טעינת נתוני לוח הבקרה נכשלה.';
}

export function DashboardPage() {
  const projectsQuery = useProjects();
  const reportsQuery = useReports();
  const employeesQuery = useEmployees();
  const workPlansQuery = useAllWorkPlans();

  const isLoading =
    projectsQuery.isLoading ||
    reportsQuery.isLoading ||
    employeesQuery.isLoading ||
    workPlansQuery.isLoading;

  const error =
    projectsQuery.error ||
    reportsQuery.error ||
    employeesQuery.error ||
    workPlansQuery.error;

  const stats: DashboardStat[] = [
    {
      label: 'פרויקטים פעילים',
      value: (projectsQuery.data ?? []).filter((project) =>
        ACTIVE_PROJECT_STATUSES.has(normalizeStatus(project.status)),
      ).length,
    },
    {
      label: 'משימות פתוחות / בביצוע',
      value: (workPlansQuery.data ?? []).reduce(
        (count, workPlan) =>
          count +
          workPlan.tasks.filter((task) =>
            OPEN_TASK_STATUSES.has(normalizeStatus(task.status)),
          ).length,
        0,
      ),
    },
    {
      label: 'דיווחים השבוע',
      value: (reportsQuery.data ?? []).filter((report) =>
        isReportFromCurrentWeek(report.reportDate),
      ).length,
    },
    {
      label: 'עובדים פעילים',
      value: (employeesQuery.data ?? []).filter((employee) => employee.isActive).length,
    },
  ];

  return (
    <PageShell title="לוח בקרה">
      {isLocalDataMode && (
        <p className="dashboardPage__hint">
          נתוני לוח הבקרה נטענים מממשקי הפרויקטים, הדיווחים, העובדים ותוכנית העבודה.
        </p>
      )}

      {isLoading && <PageSpinner />}

      {!isLoading && error && (
        <ErrorState
          message={getErrorMessage(error)}
          onRetry={() => {
            void projectsQuery.refetch();
            void reportsQuery.refetch();
            void employeesQuery.refetch();
            void workPlansQuery.refetch();
          }}
        />
      )}

      {!isLoading && !error && (
        <div className="dashboardPage__grid">
          {stats.map((stat) => (
            <article key={stat.label} className="dashboardPage__card">
              <span className="dashboardPage__value">{stat.value}</span>
              <span className="dashboardPage__label">{stat.label}</span>
            </article>
          ))}
        </div>
      )}
    </PageShell>
  );
}
