(function () {
  "use strict";

  window.WORKPLAN_CONSTANTS = Object.freeze({
    QUERY_PARAMS: Object.freeze({
      PROJECT_ID: "projectId",
    }),

    SCOPES: Object.freeze({
      COMPANY: "company",
      PERSONAL: "personal",
      EMPLOYEE: "employee",
      PROJECT: "project",
    }),

    RANGES: Object.freeze({
      DAILY: "daily",
      WEEKLY: "weekly",
      MONTHLY: "monthly",
      YEARLY: "yearly",
    }),

    DEFAULTS: Object.freeze({
      SCOPE: "company",
      RANGE: "daily",
      PROJECT_FILTER: "all",
    }),
  });
})();
