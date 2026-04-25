// =====================================================
// Projects Utility Functions
// =====================================================
// This file contains reusable helper functions used across
// the Projects page.
//
// Responsibilities:
// - Safe rendering (HTML escaping)
// - Date formatting (display + input compatibility)
// - Time calculations (hours between dates)
// - Decimal hours ↔ HH:mm conversions
// - Mapping status & billing types to UI metadata
//
// IMPORTANT:
// - No DOM state variables here
// - No API calls here
// - No event listeners here
// - Pure utility / helper functions only
// =====================================================

// =====================================================
// HTML / Rendering Utilities
// =====================================================

/**
 * Escapes text before inserting into innerHTML.
 * Prevents XSS and HTML injection from API/user input.
 */
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text ?? "";
  return div.innerHTML;
}

// =====================================================
// Date Utilities
// =====================================================

/**
 * Formats a date for:
 * - Display (DD/MM/YYYY or with time)
 * - Input fields (YYYY-MM-DD or datetime-local)
 */
function formatDate(dateValue, options = {}) {
  const {
    target = "display", // "display" | "input"
    includeTime = false,
    emptyValue = "-",
  } = options;

  if (!dateValue) return target === "input" ? "" : emptyValue;

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return target === "input" ? "" : emptyValue;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  // Format for input fields
  if (target === "input") {
    return includeTime
      ? `${year}-${month}-${day}T${hours}:${minutes}`
      : `${year}-${month}-${day}`;
  }

  // Format for display
  return includeTime
    ? `${day}/${month}/${year} ${hours}:${minutes}`
    : `${day}/${month}/${year}`;
}

// =====================================================
// Time / Hours Calculations
// =====================================================

/**
 * Calculates duration between two datetime values.
 *
 * Returns:
 * - value: decimal hours (for backend)
 * - display: HH:mm format (for UI)
 */
function calculateHoursBetween(startValue, endValue) {
  if (!startValue || !endValue) {
    return { value: "", display: "" };
  }

  const start = new Date(startValue);
  const end = new Date(endValue);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { value: "", display: "" };
  }

  const diffMs = end.getTime() - start.getTime();

  if (diffMs <= 0) {
    return { value: "", display: "" };
  }

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hoursDecimal = totalMinutes / 60;

  const hh = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const mm = String(totalMinutes % 60).padStart(2, "0");

  return {
    value: Number(hoursDecimal.toFixed(2)),
    display: `${hh}:${mm}`,
  };
}

/**
 * Converts decimal hours (e.g. 3.5) to HH:mm format (03:30).
 * Used for displaying backend values in UI.
 */
function formatDecimalHoursToTime(decimalHours) {
  if (decimalHours == null || decimalHours === "") return "-";

  const numeric = Number(decimalHours);

  if (Number.isNaN(numeric) || numeric < 0) return "-";

  const totalMinutes = Math.round(numeric * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Returns decimal hours value for backend.
 * Priority:
 * 1. dataset (manually calculated)
 * 2. auto-calculated from dates
 */
function getHoursDecimalValue(hoursInputId, startValue, endValue) {
  const input = document.getElementById(hoursInputId);

  if (input?.dataset.decimalValue) {
    return Number(input.dataset.decimalValue);
  }

  const calculated = calculateHoursBetween(startValue, endValue);

  return calculated.value !== "" ? calculated.value : null;
}

/**
 * Handles change of start/end dates and updates hours field.
 * Keeps UI and backend values synchronized.
 */
function handleDatesChange(startInputId, endInputId, hoursInputId) {
  const startInput = document.getElementById(startInputId);
  const endInput = document.getElementById(endInputId);
  const hoursInput = document.getElementById(hoursInputId);

  if (!startInput || !endInput || !hoursInput) return;

  const result = calculateHoursBetween(startInput.value, endInput.value);

  hoursInput.value = result.display || "";
  hoursInput.dataset.decimalValue = result.value || "";
}

// =====================================================
// Metadata Mapping (UI Representation)
// =====================================================

/**
 * Maps status code → display text + badge class.
 * Used across table, drawer, and milestones.
 */
function getProjectStatusMeta(statusCode) {
  if (!statusCode) {
    return {
      code: "",
      display: "-",
      badgeClass: "badge-neutral",
    };
  }

  const match = PROJECT_STATUS_OPTIONS.find(
    (option) => option.code === String(statusCode).trim(),
  );

  if (!match) {
    return {
      code: String(statusCode).trim(),
      display: String(statusCode).trim(),
      badgeClass: "badge-neutral",
    };
  }

  return match;
}

/**
 * Maps billing type code → display text.
 */
function getBillingTypeMeta(billingTypeCode) {
  if (!billingTypeCode) {
    return {
      code: "",
      display: "-",
    };
  }

  const match = BILLING_TYPE_OPTIONS.find(
    (option) => option.code === String(billingTypeCode).trim(),
  );

  if (!match) {
    return {
      code: String(billingTypeCode).trim(),
      display: String(billingTypeCode).trim(),
    };
  }

  return match;
}
