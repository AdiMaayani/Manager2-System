(function () {
  "use strict";

  var DEFAULT_TASK_HOURS = 8;

  function safeDate(value, fallbackDate) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return new Date(value.getTime());
    }

    if (typeof value === "string" || typeof value === "number") {
      var parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    if (fallbackDate instanceof Date && !Number.isNaN(fallbackDate.getTime())) {
      return new Date(fallbackDate.getTime());
    }

    return new Date();
  }

  function addHours(date, hoursToAdd) {
    var baseDate = safeDate(date, new Date());
    var parsedHours = Number(hoursToAdd);
    var safeHours = Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : DEFAULT_TASK_HOURS;
    return new Date(baseDate.getTime() + safeHours * 60 * 60 * 1000);
  }

  function diffHours(startDate, endDate) {
    var start = safeDate(startDate, new Date());
    var end = safeDate(endDate, start);
    var diffMs = end.getTime() - start.getTime();
    if (diffMs <= 0) {
      return DEFAULT_TASK_HOURS;
    }

    return Math.max(1, Math.round(diffMs / (60 * 60 * 1000)));
  }

  function normalizeStatusProgress(status) {
    var normalizedStatus = String(status || "").trim().toLowerCase();

    if (normalizedStatus === "closed" || normalizedStatus === "completed" || normalizedStatus === "done") {
      return 1;
    }

    if (normalizedStatus === "execution" || normalizedStatus === "inprogress" || normalizedStatus === "in progress") {
      return 0.6;
    }

    if (
      normalizedStatus === "planned" ||
      normalizedStatus === "open" ||
      normalizedStatus === "design" ||
      normalizedStatus === "wiring"
    ) {
      return 0.2;
    }

    return 0;
  }

  function uniquePush(array, value) {
    if (value === null || value === undefined || value === "") {
      return;
    }

    if (array.indexOf(value) === -1) {
      array.push(value);
    }
  }

  function collectAssignmentsByTaskId(workPlanData) {
    var assignments = (workPlanData && workPlanData.assignments) || [];
    var assignmentsByTaskId = {};

    for (var i = 0; i < assignments.length; i += 1) {
      var assignment = assignments[i];
      if (!assignment || assignment.workItemId === null || assignment.workItemId === undefined || assignment.workItemId === "") {
        continue;
      }

      var taskId = String(assignment.workItemId);
      if (!assignmentsByTaskId[taskId]) {
        assignmentsByTaskId[taskId] = [];
      }

      assignmentsByTaskId[taskId].push(assignment);
    }

    return assignmentsByTaskId;
  }

  function calculateProjectDates(tasks, fallbackStart, fallbackEnd) {
    var minStart = null;
    var maxEnd = null;

    for (var i = 0; i < tasks.length; i += 1) {
      var task = tasks[i];
      if (!task || task.type !== "task") {
        continue;
      }

      var startDate = safeDate(task.start_date, fallbackStart);
      var endDate = safeDate(task.end_date, startDate);

      if (!minStart || startDate.getTime() < minStart.getTime()) {
        minStart = startDate;
      }

      if (!maxEnd || endDate.getTime() > maxEnd.getTime()) {
        maxEnd = endDate;
      }
    }

    return {
      start_date: minStart || safeDate(fallbackStart, new Date()),
      end_date: maxEnd || safeDate(fallbackEnd, minStart || fallbackStart || new Date()),
    };
  }

  function toGanttTasks(workPlanData) {
    var source = workPlanData || {};
    var project = source.project || null;
    var tasks = Array.isArray(source.tasks) ? source.tasks : [];
    var assignmentsByTaskId = collectAssignmentsByTaskId(source);

    var projectBaseDate = safeDate(project && project.createdAt, new Date());
    var projectFallbackEnd = safeDate(project && project.plannedEnd, addHours(projectBaseDate, DEFAULT_TASK_HOURS));
    var projectId = project && project.workItemId !== undefined && project.workItemId !== null ? String(project.workItemId) : null;

    var ganttTasks = [];
    var childProgressSum = 0;
    var childProgressCount = 0;

    for (var i = 0; i < tasks.length; i += 1) {
      var task = tasks[i];
      if (!task || task.workItemId === null || task.workItemId === undefined || task.workItemId === "") {
        continue;
      }

      var fallbackStart = safeDate(task.createdAt, projectBaseDate);
      var startDate = safeDate(task.plannedStart, fallbackStart);

      var estimatedHours = Number(task.estimatedHours);
      var normalizedEstimatedHours =
        Number.isFinite(estimatedHours) && estimatedHours > 0 ? estimatedHours : DEFAULT_TASK_HOURS;

      var endDate;
      if (task.plannedEnd) {
        endDate = safeDate(task.plannedEnd, addHours(startDate, normalizedEstimatedHours));
      } else {
        endDate = addHours(startDate, normalizedEstimatedHours);
      }

      var durationHours = diffHours(startDate, endDate);
      if (!Number.isFinite(durationHours) || durationHours <= 0) {
        durationHours = normalizedEstimatedHours;
      }

      var taskAssignments = assignmentsByTaskId[String(task.workItemId)] || [];
      var resourceIds = [];
      var resourceNames = [];

      for (var j = 0; j < taskAssignments.length; j += 1) {
        var assignment = taskAssignments[j];
        if (!assignment) {
          continue;
        }

        if (assignment.employeeId !== null && assignment.employeeId !== undefined && assignment.employeeId !== "") {
          uniquePush(resourceIds, "employee-" + String(assignment.employeeId));
          uniquePush(resourceNames, assignment.employeeName || "Employee " + String(assignment.employeeId));
        }

        if (assignment.contractorId !== null && assignment.contractorId !== undefined && assignment.contractorId !== "") {
          uniquePush(resourceIds, "contractor-" + String(assignment.contractorId));
          uniquePush(resourceNames, assignment.contractorName || "Contractor " + String(assignment.contractorId));
        }
      }

      var progress = normalizeStatusProgress(task.status);
      childProgressSum += progress;
      childProgressCount += 1;

      ganttTasks.push({
        id: String(task.workItemId),
        text: task.title || "Untitled Task",
        title: task.title || "Untitled Task",
        start_date: startDate,
        end_date: endDate,
        durationHours: durationHours,
        progress: progress,
        status: task.status || null,
        priority: task.priority || null,
        type: "task",
        parent:
          task.parentWorkItemId !== null && task.parentWorkItemId !== undefined && task.parentWorkItemId !== ""
            ? String(task.parentWorkItemId)
            : projectId,
        resourceIds: resourceIds,
        resourceNames: resourceNames,
        isLocked: Boolean(task.isLocked),
        requiredRole: task.requiredRole || null,
        raw: task,
      });
    }

    if (project && project.workItemId !== null && project.workItemId !== undefined && project.workItemId !== "") {
      var projectDates = calculateProjectDates(
        ganttTasks,
        safeDate(project.plannedStart, projectBaseDate),
        projectFallbackEnd
      );
      var projectProgress = childProgressCount > 0 ? childProgressSum / childProgressCount : normalizeStatusProgress(project.status);

      ganttTasks.unshift({
        id: "project-" + String(project.workItemId),
        text: project.title || "Project",
        title: project.title || "Project",
        start_date: projectDates.start_date,
        end_date: projectDates.end_date,
        durationHours: diffHours(projectDates.start_date, projectDates.end_date),
        progress: projectProgress,
        status: project.status || null,
        priority: null,
        type: "project",
        parent: null,
        resourceIds: [],
        resourceNames: [],
        isLocked: Boolean(project.isLocked),
        requiredRole: null,
        raw: project,
      });
    }

    return ganttTasks;
  }

  function toGanttResources(workPlanData) {
    var source = workPlanData || {};
    var assignments = Array.isArray(source.assignments) ? source.assignments : [];
    var resources = [];
    var seenIds = {};

    for (var i = 0; i < assignments.length; i += 1) {
      var assignment = assignments[i];
      if (!assignment) {
        continue;
      }

      if (assignment.employeeId !== null && assignment.employeeId !== undefined && assignment.employeeId !== "") {
        var employeeId = "employee-" + String(assignment.employeeId);
        if (!seenIds[employeeId]) {
          seenIds[employeeId] = true;
          resources.push({
            id: employeeId,
            type: "employee",
            name: assignment.employeeName || "Employee " + String(assignment.employeeId),
            role: assignment.assignmentRole || null,
            raw: assignment,
          });
        }
      }

      if (assignment.contractorId !== null && assignment.contractorId !== undefined && assignment.contractorId !== "") {
        var contractorId = "contractor-" + String(assignment.contractorId);
        if (!seenIds[contractorId]) {
          seenIds[contractorId] = true;
          resources.push({
            id: contractorId,
            type: "contractor",
            name: assignment.contractorName || "Contractor " + String(assignment.contractorId),
            role: assignment.assignmentRole || null,
            raw: assignment,
          });
        }
      }
    }

    return resources;
  }

  function fromGanttChange(change) {
    if (!change) {
      return null;
    }

    var taskId = change.taskId !== undefined ? change.taskId : change.id;
    var startDateValue = change.startDate !== undefined ? change.startDate : change.start_date;
    var endDateValue = change.endDate !== undefined ? change.endDate : change.end_date;
    var resourcesValue = change.resourceIds !== undefined ? change.resourceIds : change.resources;

    var startDate = startDateValue ? safeDate(startDateValue, null) : null;
    var endDate = endDateValue ? safeDate(endDateValue, startDate || null) : null;
    var durationHours =
      startDate && endDate
        ? diffHours(startDate, endDate)
        : Number.isFinite(Number(change.durationHours))
          ? Number(change.durationHours)
          : null;

    var resourceIds = [];
    if (Array.isArray(resourcesValue)) {
      for (var i = 0; i < resourcesValue.length; i += 1) {
        uniquePush(resourceIds, resourcesValue[i]);
      }
    }

    return {
      taskId: taskId !== undefined && taskId !== null ? String(taskId) : null,
      startDate: startDate,
      endDate: endDate,
      durationHours: durationHours,
      resourceIds: resourceIds,
      raw: change,
    };
  }

  window.WorkPlanGanttAdapter = Object.freeze({
    toGanttTasks,
    toGanttResources,
    fromGanttChange,
  });
})();
