import { Badge } from '@shared/components/Badge';
import type { ProjectLifecycleReport } from '../../../../types';
import { formatProjectDate } from '../../../../utils/projectDisplayUtils';
import './ProjectReportsCard.css';

interface ProjectReportsCardProps {
  reports: ProjectLifecycleReport[];
}

const MAX_VISIBLE_REPORTS = 6;

function getReportTitle(report: ProjectLifecycleReport): string {
  return (
    report.summary?.trim() ||
    report.reportType?.trim() ||
    `דיווח #${report.workReportId}`
  );
}

export function ProjectReportsCard({ reports }: ProjectReportsCardProps) {
  const sortedReports = [...reports].sort((first, second) => {
    const firstTime = first.reportDate ? new Date(first.reportDate).getTime() : 0;
    const secondTime = second.reportDate ? new Date(second.reportDate).getTime() : 0;
    return secondTime - firstTime;
  });
  const visibleReports = sortedReports.slice(0, MAX_VISIBLE_REPORTS);
  const remainingCount = sortedReports.length - visibleReports.length;

  return (
    <section className="projectReportsCard">
      <div className="projectReportsCard__header">
        <h3 className="projectReportsCard__title">דיווחי ביצוע בפרויקט</h3>
        {sortedReports.length > 0 && (
          <span className="projectReportsCard__count">{sortedReports.length}</span>
        )}
      </div>

      {visibleReports.length === 0 ? (
        <p className="projectReportsCard__empty">
          אין דיווחי ביצוע המשויכים לפרויקט זה.
        </p>
      ) : (
        <ul className="projectReportsCard__list">
          {visibleReports.map((report) => (
            <li key={report.workReportId} className="projectReportsCard__item">
              <div className="projectReportsCard__main">
                <span className="projectReportsCard__reportTitle">
                  {getReportTitle(report)}
                </span>
                <span className="projectReportsCard__meta">
                  {[report.reporterName, formatProjectDate(report.reportDate)]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </span>
              </div>
              <div className="projectReportsCard__trailing">
                {report.followUpRequired && <Badge variant="warning">דורש מעקב</Badge>}
                {report.status && <Badge variant="neutral">{report.status}</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}

      {remainingCount > 0 && (
        <p className="projectReportsCard__more">ועוד {remainingCount} דיווחים…</p>
      )}
    </section>
  );
}
