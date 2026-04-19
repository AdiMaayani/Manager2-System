(function () {
  "use strict";

  var state = {
    selectedWorkPlanId: null,
    selectedEmployeeFilterId: "",
    allWorkPlansData: [],
    currentWorkPlanData: null,
    apiProjects: [],
  };

  function getState() {
    return {
      selectedWorkPlanId: state.selectedWorkPlanId,
      selectedEmployeeFilterId: state.selectedEmployeeFilterId,
      allWorkPlansData: Array.isArray(state.allWorkPlansData)
        ? state.allWorkPlansData.slice()
        : [],
      currentWorkPlanData: state.currentWorkPlanData,
      apiProjects: Array.isArray(state.apiProjects)
        ? state.apiProjects.slice()
        : [],
    };
  }

  function setSelectedWorkPlanId(value) {
    state.selectedWorkPlanId = value;
  }

  function setSelectedEmployeeFilterId(value) {
    state.selectedEmployeeFilterId = value == null ? "" : String(value).trim();
  }

  function setAllWorkPlansData(value) {
    state.allWorkPlansData = Array.isArray(value) ? value.slice() : [];
  }

  function setCurrentWorkPlanData(value) {
    state.currentWorkPlanData = value || null;
  }

  function setApiProjects(value) {
    state.apiProjects = Array.isArray(value) ? value.slice() : [];
  }

  function resetState() {
    state.selectedWorkPlanId = null;
    state.selectedEmployeeFilterId = "";
    state.allWorkPlansData = [];
    state.currentWorkPlanData = null;
    state.apiProjects = [];
  }

  window.WorkPlanState = {
    getState,
    setSelectedWorkPlanId,
    setSelectedEmployeeFilterId,
    setAllWorkPlansData,
    setCurrentWorkPlanData,
    setApiProjects,
    resetState,
  };
})();
