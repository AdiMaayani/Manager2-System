(function () {
  "use strict";

  function mapWorkPlanResponse(response) {
    var safeResponse = response || {};
    var rawProject = safeResponse.project || {};
    var rawTasks = Array.isArray(safeResponse.tasks) ? safeResponse.tasks : [];
    var rawAssignments = Array.isArray(safeResponse.assignments)
      ? safeResponse.assignments
      : [];

    return {
      project: {
        id: rawProject.workItemId ?? null,
        title: rawProject.title ?? "",
        status: rawProject.status ?? "",
        raw: rawProject,
      },
      tasks: rawTasks.map(function (task) {
        var rawTask = task || {};
        return {
          id: rawTask.workItemId ?? null,
          workItemId: rawTask.workItemId ?? null,
          title: rawTask.title ?? "",
          status: rawTask.status ?? "",
          estimatedHours: rawTask.estimatedHours ?? null,
          priority: rawTask.priority ?? null,
          plannedStart: rawTask.plannedStart ?? null,
          plannedEnd: rawTask.plannedEnd ?? null,
          requiredRole: rawTask.requiredRole ?? null,
          isLocked: rawTask.isLocked === true,
          parentWorkItemId: rawTask.parentWorkItemId ?? null,
          raw: rawTask,
        };
      }),
      assignments: rawAssignments.map(function (assignment) {
        var rawAssignment = assignment || {};
        return {
          workItemId: rawAssignment.workItemId ?? null,
          employeeId: rawAssignment.employeeId ?? null,
          contractorId: rawAssignment.contractorId ?? null,
          assignmentRole: rawAssignment.assignmentRole ?? null,
          assignmentType: rawAssignment.assignmentType ?? null,
          assignedHours: rawAssignment.assignedHours ?? null,
          isManualAssignment: rawAssignment.isManualAssignment === true,
          employeeName: rawAssignment.employeeName ?? null,
          contractorName: rawAssignment.contractorName ?? null,
          raw: rawAssignment,
        };
      }),
      raw: safeResponse,
    };
  }

  function mapAllWorkPlansResponse(response) {
    var safeResponse = Array.isArray(response) ? response : [];
    return safeResponse.map(function (responseItem) {
      return mapWorkPlanResponse(responseItem);
    });
  }

  function mapEmployeeResponse(response) {
    var safeResponse = Array.isArray(response) ? response : [];
    return safeResponse.map(function (employee) {
      var rawEmployee = employee || {};
      return {
        id: rawEmployee.employeeId ?? null,
        employeeId: rawEmployee.employeeId ?? null,
        fullName: rawEmployee.fullName ?? "",
        primaryRole: rawEmployee.primaryRole ?? "",
        dailyCapacityHours: rawEmployee.dailyCapacityHours ?? null,
        isAssignable: rawEmployee.isAssignable === true,
        isActive: rawEmployee.isActive === true,
        raw: rawEmployee,
      };
    });
  }

  window.WorkPlanMappers = Object.freeze({
    mapWorkPlanResponse,
    mapAllWorkPlansResponse,
    mapEmployeeResponse,
  });
})();
