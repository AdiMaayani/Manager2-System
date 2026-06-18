namespace ManageR2.Infrastructure.Models;

public enum DeleteWorkPlanTaskResultCode
{
    Deleted = 0,
    NotFound = 1,
    ProjectRoot = 2,
    NotTask = 3,
    Locked = 4,
    HasChildTasks = 5,
    HasProtectedHistory = 6,
    Failed = 7
}

public sealed class DeleteWorkPlanTaskResult
{
    public DeleteWorkPlanTaskResultCode ResultCode { get; set; }
    public string Message { get; set; } = string.Empty;
    public int RowsAffected { get; set; }

    public bool WasDeleted => ResultCode == DeleteWorkPlanTaskResultCode.Deleted && RowsAffected > 0;
}
