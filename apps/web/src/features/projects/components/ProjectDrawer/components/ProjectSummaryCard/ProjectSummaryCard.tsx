import { Badge } from '@shared/components/Badge';
import type { ProjectLifecycleSummary } from '../../../../types';
import './ProjectSummaryCard.css';

interface ProjectSummaryCardProps {
  summary: ProjectLifecycleSummary;
}

export function ProjectSummaryCard({ summary }: ProjectSummaryCardProps) {
  return (
    <div className="projectSummaryCard">
      <div className="projectSummaryCard__item">
        <span className="projectSummaryCard__label">התקדמות</span>
        <strong>{summary.progressPercent}%</strong>
      </div>
      <div className="projectSummaryCard__item">
        <span className="projectSummaryCard__label">בריאות</span>
        <Badge variant="success">{summary.healthStatus || '-'}</Badge>
      </div>
      <div className="projectSummaryCard__item">
        <span className="projectSummaryCard__label">סיכון</span>
        <Badge variant="warning">{summary.riskLevel || '-'}</Badge>
      </div>
      <div className="projectSummaryCard__item">
        <span className="projectSummaryCard__label">אבני דרך</span>
        <strong>
          {summary.closedMilestones}/{summary.totalMilestones}
        </strong>
      </div>
      <div className="projectSummaryCard__item">
        <span className="projectSummaryCard__label">דוחות</span>
        <strong>{summary.totalReports}</strong>
      </div>
    </div>
  );
}
