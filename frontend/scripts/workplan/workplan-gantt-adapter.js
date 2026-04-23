(function () {
  "use strict";

  function toGanttTasks(workPlanData) {
    return [];
  }

  function toGanttResources(workPlanData) {
    return [];
  }

  function fromGanttChange(change) {
    return change || null;
  }

  window.WorkPlanGanttAdapter = Object.freeze({
    toGanttTasks,
    toGanttResources,
    fromGanttChange,
  });
})();
