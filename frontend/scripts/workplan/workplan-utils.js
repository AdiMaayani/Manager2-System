(function () {
  "use strict";

  function normalizeId(value) {
    if (value === null || value === undefined) {
      return "";
    }

    return String(value).trim();
  }

  function isNullOrWhiteSpace(value) {
    return String(value || "").trim() === "";
  }

  function toArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function cloneArray(value) {
    return toArray(value).slice();
  }

  function cloneObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return { ...value };
  }

  window.WorkPlanUtils = Object.freeze({
    normalizeId,
    isNullOrWhiteSpace,
    toArray,
    cloneArray,
    cloneObject,
  });
})();
