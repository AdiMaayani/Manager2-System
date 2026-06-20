import { useQuery } from '@tanstack/react-query';
import { Select } from '@shared/components/Select';
import { InlineAlert } from '@shared/components/InlineAlert';
import { PageSpinner } from '@shared/components/PageSpinner';
import { getProjectMilestonesAsync } from '@features/projects/api/projectsApiClient';

interface MilestoneSelectorProps {
  projectId: number | null;
  value: string;
  onChange: (milestoneId: string) => void;
  disabled?: boolean;
  label?: string;
}

export function MilestoneSelector({
  projectId,
  value,
  onChange,
  disabled = false,
  label = 'אבן דרך (אופציונלי)',
}: MilestoneSelectorProps) {
  const milestonesQuery = useQuery({
    queryKey: ['projectMilestones', projectId],
    queryFn: () => getProjectMilestonesAsync(projectId!),
    enabled: projectId != null && projectId > 0,
    retry: false,
  });

  if (projectId == null || projectId <= 0) {
    return null;
  }

  if (milestonesQuery.isLoading) {
    return <PageSpinner />;
  }

  if (milestonesQuery.isError) {
    return (
      <InlineAlert variant="danger">
        {milestonesQuery.error instanceof Error
          ? milestonesQuery.error.message
          : 'טעינת אבני הדרך נכשלה'}
      </InlineAlert>
    );
  }

  const milestones = (milestonesQuery.data ?? []).filter(
    (m) => m.isActive !== false && m.status !== 'Cancelled',
  );

  return (
    <>
      <Select
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">ללא אבן דרך</option>
        {milestones.map((milestone) => {
          const id = milestone.projectMilestoneId ?? milestone.milestoneId ?? milestone.workItemId;
          return (
            <option key={id} value={String(id)}>
              {milestone.title}
            </option>
          );
        })}
      </Select>
      {milestones.length === 0 && (
        <p className="milestoneSelector__empty">
          לפרויקט זה אין אבני דרך בטבלת ProjectMilestones. ייתכן שאבני דרך קיימות עדיין ממתינות למיגרציה מאושרת.
        </p>
      )}
    </>
  );
}
