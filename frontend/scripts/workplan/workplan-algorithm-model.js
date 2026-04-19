(function () {
  "use strict";

  function buildAssignmentInputModel(workPlanData, options) {
    return {
      project: null,
      tasks: [],
      employees: [],
      assignments: [],
      constraints: [],
      options: options || {},
      source: workPlanData || null,
    };
  }

  window.WorkPlanAlgorithmModel = Object.freeze({
    buildAssignmentInputModel,
  });
})();
