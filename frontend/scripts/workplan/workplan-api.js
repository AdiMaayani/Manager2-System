(function () {
  "use strict";

  async function getWorkPlanById(projectId) {
    if (!window.apiRequest) {
      throw new Error("apiRequest is not available on window.");
    }

    try {
      return await window.apiRequest("/WorkItems/" + encodeURIComponent(projectId) + "/work-plan", {
        method: "GET",
      });
    } catch (error) {
      console.warn(error);
      return null;
    }
  }

  async function getAllWorkPlans() {
    if (!window.apiRequest) {
      throw new Error("apiRequest is not available on window.");
    }

    return window.apiRequest("/WorkItems/work-plan/all", {
      method: "GET",
    });
  }

  async function getEmployees() {
    if (!window.apiRequest) {
      throw new Error("apiRequest is not available on window.");
    }

    return window.apiRequest("/Employees", {
      method: "GET",
    });
  }

  window.WorkPlanApi = Object.freeze({
    getWorkPlanById,
    getAllWorkPlans,
    getEmployees,
  });
})();
