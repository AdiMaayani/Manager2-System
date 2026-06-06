import { useNavigate } from 'react-router-dom';
import {
  Archive,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  FolderKanban,
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
import { useDashboardData } from '../../hooks/useDashboardData';
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

export function DashboardPage() {
  const navigate = useNavigate();
  const {
    isLoading,
    error,
    refetchCore,
    kpis,
    activeProjects,
    attentionTasks,
    recentReports,
    serviceCalls,
    quotes,
    lowStock,
  } = useDashboardData();

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

  return (
    <PageShell title="לוח בקרה" wide>
      <div className="dashboardPage">
        <section className="dashboardPage__section">
          <h2 className="dashboardPage__sectionTitle">סקירה תפעולית</h2>
          <div className="dashboardPage__kpiGrid">
            <KpiCard
              label="פרויקטים פעילים"
              value={kpis.activeProjects}
              icon={<FolderKanban />}
              context="נמצאים בתכנון, ביצוע או מעקב"
              tone="primary"
            />
            <KpiCard
              label="משימות פתוחות / בביצוע"
              value={kpis.openTasks}
              icon={<ClipboardList />}
              context="מתוך תוכניות העבודה המחוברות"
              tone="warning"
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

        <section className="dashboardPage__section dashboardPage__grid2">
          <DashboardPanel
            title="משימות הדורשות טיפול"
            icon={<ClipboardList />}
            actionLabel="לתוכנית העבודה"
            actionTo="/workplan"
            isEmpty={attentionTasks.length === 0}
            emptyText="אין משימות פתוחות הדורשות טיפול."
          >
            <ul className="dashboardList">
              {attentionTasks.map((task) => (
                <li key={task.taskId} className="dashboardList__item">
                  <div className="dashboardList__main">
                    <span className="dashboardList__title">{task.title}</span>
                    <span className="dashboardList__sub">{task.projectTitle}</span>
                  </div>
                  <Badge variant={TASK_STATUS_VARIANTS[task.status] ?? 'neutral'}>
                    {getTaskStatusLabel(task.status)}
                  </Badge>
                </li>
              ))}
            </ul>
          </DashboardPanel>

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
        </section>

        <section className="dashboardPage__section dashboardPage__grid2">
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
        </section>

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
      </div>
    </PageShell>
  );
}
