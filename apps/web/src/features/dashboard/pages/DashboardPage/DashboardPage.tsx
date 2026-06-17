import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive,
  CalendarClock,
  ClipboardList,
  FileText,
  FolderKanban,
  History,
  Info,
  Lightbulb,
  ShieldAlert,
  TriangleAlert,
  Users,
  UserPlus,
  Wrench,
} from 'lucide-react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { Badge } from '@shared/components/Badge';
import { KpiCard } from '../../components/KpiCard';
import { DashboardPanel } from '../../components/DashboardPanel';
import { useDashboard } from '../../hooks/useDashboard';
import type {
  DashboardActivity,
  DashboardKpi,
  DashboardRecommendation,
  DashboardSeverity,
  DashboardTask,
  DashboardWarning,
} from '../../api/dashboardApiClient';
import './DashboardPage.css';

type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const SEVERITY_BADGE: Record<DashboardSeverity, BadgeVariant> = {
  critical: 'danger',
  attention: 'warning',
  info: 'neutral',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  Open: 'פתוח',
  Planned: 'מתוכנן',
  Execution: 'בביצוע',
  Blocked: 'תקוע',
  Done: 'בוצע',
  Closed: 'סגור',
};

const KPI_ICONS: Record<string, ReactNode> = {
  myTasksToday: <CalendarClock />,
  myOverdue: <TriangleAlert />,
  myServiceCalls: <Wrench />,
  urgentCalls: <Wrench />,
  projectsAttention: <FolderKanban />,
  quotesFollowUp: <FileText />,
  customersMissing: <Users />,
  lowStock: <Archive />,
  draftReports: <ClipboardList />,
};

const RECOMMENDATION_ICONS: Record<string, ReactNode> = {
  serviceCallUnassigned: <UserPlus />,
  serviceCallMine: <Wrench />,
  projectNoManager: <UserPlus />,
  quoteFollowUp: <FileText />,
  customerMissingContact: <Users />,
  reportDraft: <ClipboardList />,
  lowStock: <Archive />,
};

const WARNING_GROUPS: { key: DashboardSeverity; title: string; icon: ReactNode }[] = [
  { key: 'critical', title: 'קריטי', icon: <ShieldAlert /> },
  { key: 'attention', title: 'דורש תשומת לב', icon: <TriangleAlert /> },
  { key: 'info', title: 'מידע', icon: <Info /> },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'בוקר טוב';
  if (hour < 18) return 'צהריים טובים';
  return 'ערב טוב';
}

function getTodayLabel(): string {
  try {
    return new Date().toLocaleDateString('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    const now = new Date();
    return `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  }
}

function formatDate(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
}

function formatTime(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  if (hours === '00' && minutes === '00') return '';
  return `${hours}:${minutes}`;
}

function formatDateTime(value?: string | null): string {
  const date = formatDate(value);
  const time = formatTime(value);
  return [date, time].filter(Boolean).join(' · ');
}

function getTaskStatusLabel(status?: string | null): string {
  if (!status) return '';
  return TASK_STATUS_LABELS[status] ?? status;
}

function joinContext(...parts: (string | null | undefined)[]): string {
  return parts.filter((part) => part && part.trim().length > 0).join(' · ');
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useDashboard();

  if (isLoading) {
    return (
      <PageShell title="לוח בקרה" wide>
        <PageSpinner />
      </PageShell>
    );
  }

  if (isError || !data) {
    return (
      <PageShell title="לוח בקרה" wide>
        <ErrorState message="טעינת לוח הבקרה נכשלה." onRetry={() => void refetch()} />
      </PageShell>
    );
  }

  const { user, kpis, personalTasksToday, recommendations, earlyWarnings, recentActivity } = data;

  const renderRecommendation = (item: DashboardRecommendation) => {
    const icon = RECOMMENDATION_ICONS[item.type] ?? <Lightbulb />;
    return (
      <li key={item.id} className={`recoItem recoItem--${item.severity}`}>
        <span className="recoItem__icon" aria-hidden="true">
          {icon}
        </span>
        <div className="recoItem__body">
          <div className="recoItem__headline">
            <span className="recoItem__title">{item.title}</span>
            <Badge variant={SEVERITY_BADGE[item.severity]}>{severityLabel(item.severity)}</Badge>
          </div>
          <p className="recoItem__desc">{item.description}</p>
          <div className="recoItem__meta">
            {joinContext(item.context) && <span>{item.context}</span>}
            {formatDate(item.relevantDate) && <span>{formatDate(item.relevantDate)}</span>}
          </div>
        </div>
        {item.actionRoute && (
          <Link className="recoItem__action" to={item.actionRoute}>
            {item.actionLabel}
          </Link>
        )}
      </li>
    );
  };

  const renderTask = (task: DashboardTask) => {
    const context = joinContext(task.projectTitle, task.customerName, task.siteName);
    const time = formatTime(task.plannedStart);
    const open = () => {
      if (task.actionRoute) navigate(task.actionRoute);
    };
    return (
      <li
        key={task.workItemId}
        className="taskItem"
        role={task.actionRoute ? 'button' : undefined}
        tabIndex={task.actionRoute ? 0 : undefined}
        onClick={task.actionRoute ? open : undefined}
        onKeyDown={
          task.actionRoute
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  open();
                }
              }
            : undefined
        }
      >
        <div className="taskItem__time">{time || '—'}</div>
        <div className="taskItem__body">
          <span className="taskItem__title">{task.title}</span>
          {context && <span className="taskItem__context">{context}</span>}
        </div>
        {task.status && (
          <Badge variant="primary">{getTaskStatusLabel(task.status)}</Badge>
        )}
      </li>
    );
  };

  const renderWarning = (warning: DashboardWarning) => (
    <li key={warning.id} className="warnItem">
      <div className="warnItem__body">
        <span className="warnItem__title">{warning.title}</span>
        <p className="warnItem__desc">{warning.description}</p>
        <div className="warnItem__meta">
          {joinContext(warning.context) && <span>{warning.context}</span>}
          {formatDate(warning.relevantDate) && <span>{formatDate(warning.relevantDate)}</span>}
        </div>
      </div>
      {warning.actionRoute && warning.actionLabel && (
        <Link className="warnItem__action" to={warning.actionRoute}>
          {warning.actionLabel}
        </Link>
      )}
    </li>
  );

  const renderActivity = (activity: DashboardActivity) => {
    const meta = joinContext(activity.actorName, formatDateTime(activity.occurredAtUtc));
    const inner = (
      <>
        <span className={`activityItem__dot activityItem__dot--${activity.severity}`} aria-hidden="true" />
        <div className="activityItem__body">
          <span className="activityItem__title">{activity.title}</span>
          {meta && <span className="activityItem__meta">{meta}</span>}
        </div>
      </>
    );
    return (
      <li key={activity.id} className="activityItem">
        {activity.actionRoute ? (
          <Link className="activityItem__link" to={activity.actionRoute}>
            {inner}
          </Link>
        ) : (
          <div className="activityItem__link activityItem__link--static">{inner}</div>
        )}
      </li>
    );
  };

  return (
    <PageShell title="לוח בקרה" wide>
      <div className="commandCenter">
        <header className="commandCenter__header">
          <div>
            <h1 className="commandCenter__greeting">
              {getGreeting()}, {user.displayName}
            </h1>
            <p className="commandCenter__summary">{user.stateSummary}</p>
            {user.roleLabels.length > 0 && (
              <div className="commandCenter__roles">
                {user.roleLabels.map((label) => (
                  <span key={label} className="commandCenter__role">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="commandCenter__date">{getTodayLabel()}</div>
        </header>

        {kpis.length > 0 && (
          <section className="commandCenter__kpis">
            {kpis.map((kpi: DashboardKpi) => (
              <KpiCard
                key={kpi.id}
                label={kpi.label}
                value={kpi.value}
                icon={KPI_ICONS[kpi.id] ?? <ClipboardList />}
                context={kpi.context ?? undefined}
                tone={kpi.tone}
                to={kpi.actionRoute ?? undefined}
              />
            ))}
          </section>
        )}

        <section className="commandCenter__main">
          <div className="commandCenter__primary">
            <DashboardPanel
              title="המלצות לביצוע"
              icon={<Lightbulb />}
              isEmpty={recommendations.length === 0}
              emptyText="אין כרגע המלצות הדורשות פעולה."
            >
              <ul className="recoList">{recommendations.map(renderRecommendation)}</ul>
            </DashboardPanel>
          </div>

          <div className="commandCenter__secondary">
            <DashboardPanel
              title="המשימות שלי להיום"
              icon={<CalendarClock />}
              actionLabel="לתוכנית העבודה"
              actionTo="/workplan?scope=personal"
              isEmpty={personalTasksToday.length === 0}
              emptyText="אין משימות מתוכננות להיום."
            >
              <ul className="taskList">{personalTasksToday.map(renderTask)}</ul>
            </DashboardPanel>
          </div>
        </section>

        <section className="commandCenter__section">
          <DashboardPanel
            title="התראות מוקדמות"
            icon={<TriangleAlert />}
            isEmpty={earlyWarnings.length === 0}
            emptyText="אין התראות פתוחות — הכול מתנהל כשורה."
          >
            <div className="warnGroups">
              {WARNING_GROUPS.map((group) => {
                const items = earlyWarnings.filter((warning) => warning.severity === group.key);
                if (items.length === 0) return null;
                return (
                  <div key={group.key} className={`warnGroup warnGroup--${group.key}`}>
                    <h4 className="warnGroup__title">
                      <span className="warnGroup__icon" aria-hidden="true">
                        {group.icon}
                      </span>
                      {group.title}
                      <span className="warnGroup__count">{items.length}</span>
                    </h4>
                    <ul className="warnList">{items.map(renderWarning)}</ul>
                  </div>
                );
              })}
            </div>
          </DashboardPanel>
        </section>

        <section className="commandCenter__section">
          <DashboardPanel
            title="פעילות אחרונה במערכת"
            icon={<History />}
            isEmpty={recentActivity.length === 0}
            emptyText="אין פעילות אחרונה להצגה."
          >
            <ul className="activityList">{recentActivity.map(renderActivity)}</ul>
          </DashboardPanel>
        </section>
      </div>
    </PageShell>
  );
}

function severityLabel(severity: DashboardSeverity): string {
  switch (severity) {
    case 'critical':
      return 'קריטי';
    case 'attention':
      return 'דורש טיפול';
    default:
      return 'מידע';
  }
}
