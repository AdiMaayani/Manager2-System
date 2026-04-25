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

  async function getSmartAssignmentRecommendations(request) {
    if (!request) {
      throw new Error("Smart assignment request is required.");
    }

    return window.apiRequest("/SmartAssignment/recommend", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async function createWorkItem(request) {
    if (!request) {
      throw new Error("Create work item request is required.");
    }

    return window.apiRequest("/WorkItems", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async function assignEmployeeToWorkItem(workItemId, request) {
    if (!workItemId) {
      throw new Error("Work item id is required.");
    }

    if (!request) {
      throw new Error("Assign employee request is required.");
    }

    return window.apiRequest(
      "/WorkItems/" + encodeURIComponent(workItemId) + "/assign-employee",
      {
        method: "POST",
        body: JSON.stringify(request),
      }
    );
  }

  window.WorkPlanApi = Object.freeze({
    getWorkPlanById,
    getAllWorkPlans,
    getEmployees,
    getSmartAssignmentRecommendations,
    createWorkItem,
    assignEmployeeToWorkItem,
  });
})();
