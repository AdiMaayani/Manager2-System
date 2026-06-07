import { useNavigate, Link } from 'react-router-dom';
import {
  Archive,
  BriefcaseBusiness,
  CalendarClock,
  ClipboardList,
  FileText,
  FolderKanban,
  History,
  TriangleAlert,
  Users,
  Wrench,
} from 'lucide-react';
import { PageShell } from '@shared/components/PageShell';
import { PageSpinner } from '@shared/components/PageSpinner';
import { ErrorState } from '@shared/components/ErrorState';
import { Badge } from '@shared/components/Badge';
import {
  formatProjectDate,
  getProjectNumber,
  getProjectStatusMeta,
} from '@features/projects/utils/projectDisplayUtils';
import { QuoteStatusBadge, formatCurrency, formatDate } from '@features/quotes';
import { KpiCard } from '../../components/KpiCard';
import { DashboardPanel } from '../../components/DashboardPanel';
import { DashboardCustomizer } from '../../components/DashboardCustomizer';
import { useDashboardData, type DashboardTask } from '../../hooks/useDashboardData';
import { useDashboardPreferences } from '../../hooks/useDashboardPreferences';
import './DashboardPage.css';

type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const SERVICE_CALL_STATUS_LABELS: Record<string, string> = {
  Open: 'פתוחה',
  InProgress: 'בטיפול',
  Done: 'בוצעה',
  Cancelled: 'בוטלה',
};

const SERVICE_CALL_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  Open: 'warning',
  InProgress: 'primary',
  Done: 'success',
  Cancelled: 'danger',
};

const TASK_STATUS_LABELS: Record<string, string> = {
  Open: 'פתוח',
  Planned: 'מתוכנן',
  Execution: 'בביצוע',
  Blocked: 'תקוע',
  Done: 'בוצע',
  Closed: 'סגור',
};

const TASK_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  Open: 'neutral',
  Planned: 'primary',
  Execution: 'warning',
  Blocked: 'danger',
  Done: 'success',
  Closed: 'success',
};

const DONE_TASK_STATUSES = new Set(['done', 'closed', 'cancelled', 'בוצע', 'סגור', 'מבוטל']);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'טעינת נתוני לוח הבקרה נכשלה.';
}

function getServiceCallStatusLabel(status?: string | null): string {
  if (!status) return '-';
  return SERVICE_CALL_STATUS_LABELS[status] ?? status;
}

function getTaskStatusLabel(status?: string | null): string {
  if (!status) return '-';
  return TASK_STATUS_LABELS[status] ?? status;
}

function isTaskOverdue(task: DashboardTask): boolean {
  if (!task.plannedEnd) return false;
  if (DONE_TASK_STATUSES.has(String(task.status).trim().toLowerCase())) return false;
  const end = new Date(task.plannedEnd);
  if (Number.isNaN(end.getTime())) return false;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return end.getTime() < startOfToday.getTime();
}

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    isLoading,
    error,
    refetchCore,
    isManagementView,
    kpis,
    activeProjects,
    attentionTasks,
    dailyTasks,
    alerts,
    recentActivity,
    recentReports,
    serviceCalls,
    quotes,
    lowStock,
  } = useDashboardData();
  const { visibility, isVisible, toggleSection, resetSections, hiddenCount } =
    useDashboardPreferences();

  const openProject = (projectId: number) => {
    navigate(`/projects?projectId=${projectId}`);
  };

  if (isLoading) {
    return (
      <PageShell title="לוח בקרה" wide>
        <PageSpinner />
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="לוח בקרה" wide>
        <ErrorState message={getErrorMessage(error)} onRetry={refetchCore} />
      </PageShell>
    );
  }

  const attentionTitle = isManagementView ? 'משימות פתוחות — כלל העובדים' : 'המשימות שלי';
  const dailyTitle = isManagementView ? 'משימות להיום — כלל העובדים' : 'המשימות שלי להיום';

  const renderTaskItem = (task: DashboardTask, showAssignee: boolean) => {
    const overdue = isTaskOverdue(task);
    return (
      <li key={task.taskId} className="dashboardList__item">
        <div className="dashboardList__main">
          <span className="dashboardList__title">{task.title}</span>
          <span className="dashboardList__sub">
            {[task.projectTitle, showAssignee ? task.assigneeNames.join(', ') : null]
              .filter(Boolean)
              .join(' · ') || '—'}
          </span>
        </div>
        <div className="dashboardList__trailing">
          {overdue && <Badge variant="danger">באיחור</Badge>}
          <Badge variant={TASK_STATUS_VARIANTS[task.status] ?? 'neutral'}>
            {getTaskStatusLabel(task.status)}
          </Badge>
        </div>
      </li>
    );
  };

  return (
    <PageShell title="לוח בקרה" wide>
      <div className="dashboardPage">
        <div className="dashboardPage__toolbar">
          <p className="dashboardPage__lead">
            {isManagementView
              ? 'תצוגת ניהול — סקירה תפעולית לכלל הצוות.'
              : 'סקירה תפעולית אישית של העבודה והמעקב שלך.'}
          </p>
          <DashboardCustomizer
            visibility={visibility}
            hiddenCount={hiddenCount}
            onToggle={toggleSection}
            onReset={resetSections}
          />
        </div>

        {isVisible('kpis') && (
          <section className="dashboardPage__section">
            <div className="dashboardPage__kpiGrid">
              <KpiCard
                label="פרויקטים פעילים"
                value={kpis.activeProjects}
                icon={<FolderKanban />}
                context="בתכנון, ביצוע או מעקב"
                tone="primary"
              />
              <KpiCard
                label={isManagementView ? 'משימות פתוחות' : 'המשימות הפתוחות שלי'}
                value={isManagementView ? kpis.openTasks : kpis.myOpenTasks}
                icon={<ClipboardList />}
                context={isManagementView ? 'מכלל תוכניות העבודה' : 'משויכות אליך'}
                tone="warning"
              />
              <KpiCard
                label="משימות באיחור"
                value={kpis.overdueTasks}
                icon={<TriangleAlert />}
                context="חרגו מתאריך היעד"
                tone={kpis.overdueTasks > 0 ? 'warning' : 'success'}
              />
              <KpiCard
                label="דיווחים השבוע"
                value={kpis.reportsThisWeek}
                icon={<FileText />}
                context="דיווחי ביצוע בשבוע הנוכחי"
                tone="primary"
              />
              <KpiCard
                label="עובדים פעילים"
                value={kpis.activeEmployees}
                icon={<Users />}
                context="זמינים במאגר העובדים"
                tone="success"
              />
            </div>
          </section>
        )}

        {(isVisible('attentionTasks') || isVisible('dailyTasks')) && (
          <section className="dashboardPage__section dashboardPage__grid2">
            {isVisible('attentionTasks') && (
              <DashboardPanel
                title={attentionTitle}
                icon={<ClipboardList />}
                actionLabel="לתוכנית העבודה"
                actionTo="/workplan"
                isEmpty={attentionTasks.length === 0}
                emptyText={
                  isManagementView
                    ? 'אין משימות פתוחות הדורשות טיפול.'
                    : 'אין משימות פתוחות המשויכות אליך.'
                }
              >
                <ul className="dashboardList">
                  {attentionTasks.map((task) => renderTaskItem(task, isManagementView))}
                </ul>
              </DashboardPanel>
            )}

            {isVisible('dailyTasks') && (
              <DashboardPanel
                title={dailyTitle}
                icon={<CalendarClock />}
                actionLabel="לתוכנית העבודה"
                actionTo="/workplan"
                isEmpty={dailyTasks.length === 0}
                emptyText="אין משימות מתוכננות להיום."
              >
                <ul className="dashboardList">
                  {dailyTasks.map((task) => (
                    <li key={task.taskId} className="dashboardList__item">
                      <div className="dashboardList__main">
                        <span className="dashboardList__title">{task.title}</span>
                        <span className="dashboardList__sub">
                          {[
                            task.projectTitle,
                            task.plannedStart
                              ? formatProjectDate(task.plannedStart, { includeTime: true })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </span>
                      </div>
                      <Badge variant={TASK_STATUS_VARIANTS[task.status] ?? 'neutral'}>
                        {getTaskStatusLabel(task.status)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </DashboardPanel>
            )}
          </section>
        )}

        {isVisible('alerts') && (
          <section className="dashboardPage__section">
            <DashboardPanel
              title="התראות ניהוליות"
              icon={<TriangleAlert />}
              isEmpty={alerts.length === 0}
              emptyText="אין התראות פתוחות — הכול מתנהל כשורה."
            >
              <ul className="dashboardAlerts">
                {alerts.map((alert) => (
                  <li key={alert.id} className="dashboardAlerts__item">
                    <Link to={alert.to} className="dashboardAlerts__link">
                      <span className={`dashboardAlerts__count dashboardAlerts__count--${alert.tone}`}>
                        {alert.count}
                      </span>
                      <span className="dashboardAlerts__body">
                        <span className="dashboardAlerts__label">{alert.label}</span>
                        <span className="dashboardAlerts__text">{alert.text}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </DashboardPanel>
          </section>
        )}

        {isVisible('activeProjects') && (
          <section className="dashboardPage__section">
            <DashboardPanel
              title="פרויקטים פעילים"
              icon={<FolderKanban />}
              actionLabel="לכל הפרויקטים"
              actionTo="/projects"
              isEmpty={activeProjects.length === 0}
              emptyText="אין פרויקטים פעילים כרגע."
            >
              <div className="dashboardPage__tableWrap">
                <table className="dashboardPage__table">
                  <thead>
                    <tr>
                      <th>מספר</th>
                      <th>שם הפרויקט</th>
                      <th>לקוח</th>
                      <th>מנהל</th>
                      <th>סטטוס</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeProjects.map((project) => {
                      const statusMeta = getProjectStatusMeta(project.status);
                      return (
                        <tr
                          key={project.workItemId}
                          role="button"
                          tabIndex={0}
                          className="dashboardPage__row"
                          onClick={() => openProject(project.workItemId)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openProject(project.workItemId);
                            }
                          }}
                        >
                          <td>{project.projectNumber || getProjectNumber(project.workItemId)}</td>
                          <td>{project.title}</td>
                          <td>{project.customerName}</td>
                          <td>{project.projectManagerName}</td>
                          <td>
                            <Badge variant={statusMeta.badgeVariant}>{statusMeta.display}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </DashboardPanel>
          </section>
        )}

        {(isVisible('serviceCalls') || isVisible('quotes')) && (
          <section className="dashboardPage__section dashboardPage__grid2">
            {isVisible('serviceCalls') && (
              <DashboardPanel
                title="קריאות שירות פתוחות"
                icon={<Wrench />}
                actionLabel="לקריאות השירות"
                actionTo="/service-calls"
                isLoading={serviceCalls.isLoading}
                error={serviceCalls.error ? getErrorMessage(serviceCalls.error) : null}
                onRetry={serviceCalls.refetch}
                isEmpty={serviceCalls.items.length === 0}
                emptyText="אין קריאות שירות פתוחות."
              >
                <ul className="dashboardList">
                  {serviceCalls.items.map((call) => (
                    <li key={call.workItemId} className="dashboardList__item">
                      <div className="dashboardList__main">
                        <span className="dashboardList__title">{call.title}</span>
                        <span className="dashboardList__sub">{call.customerName || '-'}</span>
                      </div>
                      <Badge variant={SERVICE_CALL_STATUS_VARIANTS[call.status] ?? 'neutral'}>
                        {getServiceCallStatusLabel(call.status)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </DashboardPanel>
            )}

            {isVisible('quotes') && (
              <DashboardPanel
                title="הצעות מחיר אחרונות"
                icon={<BriefcaseBusiness />}
                actionLabel="להצעות המחיר"
                actionTo="/quotes"
                isLoading={quotes.isLoading}
                error={quotes.error ? getErrorMessage(quotes.error) : null}
                onRetry={quotes.refetch}
                isEmpty={quotes.items.length === 0}
                emptyText="לא קיימות הצעות מחיר אחרונות."
              >
                <ul className="dashboardList">
                  {quotes.items.map((quote) => (
                    <li key={quote.quoteId} className="dashboardList__item">
                      <div className="dashboardList__main">
                        <span className="dashboardList__title">
                          {quote.quoteNumber}
                          {quote.customerName ? ` · ${quote.customerName}` : ''}
                        </span>
                        <span className="dashboardList__sub">{formatDate(quote.quoteDate)}</span>
                      </div>
                      <div className="dashboardList__trailing">
                        <span className="dashboardList__amount">{formatCurrency(quote.total)}</span>
                        <QuoteStatusBadge status={quote.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              </DashboardPanel>
            )}
          </section>
        )}

        {(isVisible('recentReports') || isVisible('recentActivity')) && (
          <section className="dashboardPage__section dashboardPage__grid2">
            {isVisible('recentReports') && (
              <DashboardPanel
                title="דיווחים אחרונים"
                icon={<FileText />}
                actionLabel="לכל הדיווחים"
                actionTo="/reports"
                isEmpty={recentReports.length === 0}
                emptyText="לא קיימים דיווחים אחרונים."
              >
                <ul className="dashboardList">
                  {recentReports.map((report) => (
                    <li key={report.reportId} className="dashboardList__item">
                      <div className="dashboardList__main">
                        <span className="dashboardList__title">
                          {report.projectTitle || report.customerName || 'דיווח'}
                        </span>
                        <span className="dashboardList__sub">
                          {[report.reportedByName, formatProjectDate(report.reportDate)]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                      {report.status && (
                        <Badge variant={report.status === 'הוגש' ? 'primary' : 'neutral'}>
                          {report.status}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </DashboardPanel>
            )}

            {isVisible('recentActivity') && (
              <DashboardPanel
                title="פעילות אחרונה"
                icon={<History />}
                isEmpty={recentActivity.length === 0}
                emptyText="אין פעילות אחרונה להצגה."
              >
                <ul className="dashboardList">
                  {recentActivity.map((item) => (
                    <li key={item.id} className="dashboardList__item">
                      <div className="dashboardList__main">
                        <span className="dashboardList__title">
                          <Link to={item.to} className="dashboardList__link">
                            {item.title}
                          </Link>
                        </span>
                        <span className="dashboardList__sub">
                          {[item.typeLabel, item.sub].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                      <span className="dashboardList__meta">{formatProjectDate(item.date)}</span>
                    </li>
                  ))}
                </ul>
              </DashboardPanel>
            )}
          </section>
        )}

        {isVisible('lowStock') && (
          <section className="dashboardPage__section">
            <DashboardPanel
              title="מלאי במחסור"
              icon={<Archive />}
              actionLabel="למסך המלאי"
              actionTo="/inventory"
              isLoading={lowStock.isLoading}
              error={lowStock.error ? getErrorMessage(lowStock.error) : null}
              onRetry={lowStock.refetch}
              isEmpty={lowStock.items.length === 0}
              emptyText="אין פריטים מתחת לרף המלאי."
            >
              <div className="dashboardPage__tableWrap">
                <table className="dashboardPage__table">
                  <thead>
                    <tr>
                      <th>מק״ט</th>
                      <th>שם פריט</th>
                      <th>במלאי</th>
                      <th>מינימום</th>
                      <th>יחידה</th>
                      <th>מיקום</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.items.map((item) => (
                      <tr key={item.inventoryItemId}>
                        <td>{item.skuCode}</td>
                        <td>{item.itemName}</td>
                        <td>
                          <span className="dashboardPage__lowStock">{item.quantityOnHand}</span>
                        </td>
                        <td>{item.minimumQuantity ?? '-'}</td>
                        <td>{item.unit}</td>
                        <td>{item.locationName || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DashboardPanel>
          </section>
        )}
      </div>
    </PageShell>
  );
}
