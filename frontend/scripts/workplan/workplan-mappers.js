(function () {
  "use strict";

  function mapWorkPlanResponse(response) {
    return response || null;
  }

  function mapAllWorkPlansResponse(response) {
    return Array.isArray(response) ? response.slice() : [];
  }

  function mapEmployeeResponse(response) {
    return Array.isArray(response) ? response.slice() : [];
  }

  window.WorkPlanMappers = Object.freeze({
    mapWorkPlanResponse,
    mapAllWorkPlansResponse,
    mapEmployeeResponse,
  });
})();
