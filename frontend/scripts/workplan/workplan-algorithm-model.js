(function () {
  "use strict";

  function buildAssignmentInputModel(workPlanData, options) {
    var source = workPlanData || null;
    var safeOptions = options || {};
    var rawProject = source && source.project ? source.project : null;
    var rawTasks = source && Array.isArray(source.tasks) ? source.tasks : [];
    var rawAssignments =
      source && Array.isArray(source.assignments) ? source.assignments : [];
    var rawEmployees = Array.isArray(safeOptions.employees)
      ? safeOptions.employees
      : [];

    var assignments = rawAssignments.map(function (assignment) {
      var row = assignment || {};
      return {
        workItemId: row.workItemId ?? null,
        employeeId: row.employeeId ?? null,
        contractorId: row.contractorId ?? null,
        assignmentRole: row.assignmentRole ?? null,
        assignmentType: row.assignmentType ?? null,
        assignedHours: row.assignedHours ?? null,
        isManualAssignment: row.isManualAssignment === true,
        employeeName: row.employeeName ?? null,
        contractorName: row.contractorName ?? null,
      };
    });

    var taskAssignmentsMap = new Map();
    for (var i = 0; i < assignments.length; i++) {
      var assignmentRow = assignments[i];
      if (assignmentRow.workItemId == null) {
        continue;
      }
      var taskKey = String(assignmentRow.workItemId);
      if (!taskAssignmentsMap.has(taskKey)) {
        taskAssignmentsMap.set(taskKey, []);
      }
      taskAssignmentsMap.get(taskKey).push(assignmentRow);
    }

    var tasks = rawTasks.map(function (task) {
      var row = task || {};
      var taskId = row.id ?? row.workItemId ?? null;
      var relatedAssignments =
        taskId == null ? [] : taskAssignmentsMap.get(String(taskId)) || [];

      var assignedEmployeeIds = [];
      for (var j = 0; j < relatedAssignments.length; j++) {
        var related = relatedAssignments[j];
        if (related.employeeId == null) {
          continue;
        }
        var exists = assignedEmployeeIds.some(function (employeeId) {
          return String(employeeId) === String(related.employeeId);
        });
        if (!exists) {
          assignedEmployeeIds.push(related.employeeId);
        }
      }

      var manualAssignmentCount = relatedAssignments.filter(function (related) {
        return related.isManualAssignment === true;
      }).length;

      return {
        id: taskId,
        title: row.title ?? "",
        status: row.status ?? "",
        estimatedHours: row.estimatedHours ?? null,
        priority: row.priority ?? null,
        plannedStart: row.plannedStart ?? null,
        plannedEnd: row.plannedEnd ?? null,
        requiredRole: row.requiredRole ?? null,
        isLocked: row.isLocked === true,
        parentWorkItemId: row.parentWorkItemId ?? null,
        assignedEmployeeIds: assignedEmployeeIds,
        manualAssignmentCount: manualAssignmentCount,
      };
    });

    var employees = rawEmployees.map(function (employee) {
      var row = employee || {};
      var employeeId = row.id ?? row.employeeId ?? null;
      return {
        id: employeeId,
        fullName: row.fullName ?? "",
        role: row.primaryRole ?? row.role ?? "",
        dailyCapacityHours: row.dailyCapacityHours ?? null,
        isAssignable: row.isAssignable === true,
        isActive: row.isActive === true,
      };
    });

    var constraints = [];

    for (var k = 0; k < tasks.length; k++) {
      var taskRow = tasks[k];
      if (taskRow.isLocked === true) {
        constraints.push({
          type: "locked_task",
          taskId: taskRow.id,
          value: true,
        });
      }
      if (taskRow.requiredRole != null && String(taskRow.requiredRole) !== "") {
        constraints.push({
          type: "required_role",
          taskId: taskRow.id,
          value: taskRow.requiredRole,
        });
      }
      if (taskRow.plannedStart != null || taskRow.plannedEnd != null) {
        constraints.push({
          type: "task_time_window",
          taskId: taskRow.id,
          value: {
            plannedStart: taskRow.plannedStart,
            plannedEnd: taskRow.plannedEnd,
          },
        });
      }
    }

    for (var m = 0; m < employees.length; m++) {
      var employeeRow = employees[m];
      if (employeeRow.isAssignable === false) {
        constraints.push({
          type: "employee_assignable",
          employeeId: employeeRow.id,
          value: false,
        });
      }
    }

    for (var n = 0; n < assignments.length; n++) {
      var assignment = assignments[n];
      if (assignment.isManualAssignment === true) {
        constraints.push({
          type: "manual_assignment",
          taskId: assignment.workItemId,
          employeeId: assignment.employeeId,
          value: true,
        });
      }
    }

    return {
      project: rawProject
        ? {
            id: rawProject.id ?? rawProject.workItemId ?? null,
            title: rawProject.title ?? "",
            status: rawProject.status ?? "",
          }
        : null,
      tasks: tasks,
      employees: employees,
      assignments: assignments,
      constraints: constraints,
      options: safeOptions,
      source: source,
    };
  }

  window.WorkPlanAlgorithmModel = Object.freeze({
    buildAssignmentInputModel,
  });
})();
