(function () {
  "use strict";

  function buildAssignmentInputModel(workPlanData, options) {
    var raw = workPlanData || null;
    var sourceTasks = raw && Array.isArray(raw.tasks) ? raw.tasks : [];
    var rawAssignments =
      raw && Array.isArray(raw.assignments) ? raw.assignments : [];

    function priorityFromStatus(status) {
      var s = String(status || "").trim();
      if (s === "Planned") {
        return 1;
      }
      if (s === "Open") {
        return 2;
      }
      return 0;
    }

    var tasks = sourceTasks.map(function (task) {
      return {
        id: task && task.workItemId,
        title: task && task.title,
        status: task && task.status,
        duration: 1,
        priority: priorityFromStatus(task && task.status),
        dependencies: [],
        assignedEmployees: [],
      };
    });

    var employeeMap = new Map();
    for (var i = 0; i < rawAssignments.length; i++) {
      var a = rawAssignments[i];
      if (a == null || a.employeeId == null) {
        continue;
      }
      var key = String(a.employeeId);
      if (!employeeMap.has(key)) {
        employeeMap.set(key, {
          id: a.employeeId,
          name: a.employeeName || "",
          role: a.assignmentRole || "",
          capacity: 8,
          currentLoad: 0,
        });
      }
    }

    var taskById = new Map();
    for (var t = 0; t < tasks.length; t++) {
      var taskRow = tasks[t];
      if (taskRow && taskRow.id != null) {
        taskById.set(String(taskRow.id), taskRow);
      }
    }

    for (var j = 0; j < rawAssignments.length; j++) {
      var asg = rawAssignments[j];
      if (asg == null || asg.workItemId == null || asg.employeeId == null) {
        continue;
      }
      var linked = taskById.get(String(asg.workItemId));
      if (!linked) {
        continue;
      }
      var empId = asg.employeeId;
      var already = linked.assignedEmployees.some(function (x) {
        return String(x) === String(empId);
      });
      if (!already) {
        linked.assignedEmployees.push(empId);
      }
      var empRow = employeeMap.get(String(empId));
      if (empRow) {
        empRow.currentLoad += 1;
      }
    }

    var employees = Array.from(employeeMap.values());

    console.groupCollapsed("🧠 [ALGORITHM INPUT MODEL]");
    console.log("projectId:", raw && raw.project ? raw.project.workItemId : null);
    console.log("tasks:", tasks);
    console.log("employees:", employees);
    console.log("assignments:", rawAssignments.slice());
    console.log("constraints:", {
      maxTasksPerEmployee: 5,
      allowOverAllocation: false,
    });
    console.groupEnd();

    return {
      projectId: raw && raw.project ? raw.project.workItemId : null,
      project: raw && raw.project ? raw.project : null,
      tasks: tasks,
      employees: employees,
      assignments: rawAssignments.slice(),
      constraints: {
        maxTasksPerEmployee: 5,
        allowOverAllocation: false,
      },
      options: options || {},
      source: raw,
      raw: raw,
    };
  }

  window.WorkPlanAlgorithmModel = Object.freeze({
    buildAssignmentInputModel,
  });
})();
