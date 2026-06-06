import { Badge } from '@shared/components/Badge';
import type { ProjectLifecycleSummary } from '../../../../types';
import { getProjectHealthMeta, getProjectRiskMeta } from '../../../../utils/projectDisplayUtils';
import './ProjectSummaryCard.css';

interface ProjectSummaryCardProps {
  summary: ProjectLifecycleSummary;
}

export function ProjectSummaryCard({ summary }: ProjectSummaryCardProps) {
  const progress = Math.max(0, Math.min(100, Math.round(summary.progressPercent ?? 0)));
  const healthMeta = getProjectHealthMeta(summary.healthStatus);
  const riskMeta = getProjectRiskMeta(summary.riskLevel);

  return (
    <div className="projectSummaryCard">
      <div className="projectSummaryCard__progress">
        <div className="projectSummaryCard__progressHead">
          <span className="projectSummaryCard__label">התקדמות הפרויקט</span>
          <strong className="projectSummaryCard__percent">{progress}%</strong>
        </div>
        <div
          className="projectSummaryCard__bar"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span className="projectSummaryCard__barFill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="projectSummaryCard__stats">
        <div className="projectSummaryCard__item">
          <span className="projectSummaryCard__label">בריאות</span>
          <Badge variant={healthMeta.badgeVariant}>{healthMeta.display}</Badge>
        </div>
        <div className="projectSummaryCard__item">
          <span className="projectSummaryCard__label">רמת סיכון</span>
          <Badge variant={riskMeta.badgeVariant}>{riskMeta.display}</Badge>
        </div>
        <div className="projectSummaryCard__item">
          <span className="projectSummaryCard__label">אבני דרך שהושלמו</span>
          <strong className="projectSummaryCard__value">
            {summary.closedMilestones}/{summary.totalMilestones}
          </strong>
        </div>
        <div className="projectSummaryCard__item">
          <span className="projectSummaryCard__label">דוחות</span>
          <strong className="projectSummaryCard__value">{summary.totalReports}</strong>
        </div>
      </div>
    </div>
  );
}
