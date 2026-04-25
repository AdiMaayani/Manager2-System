// =====================================================
// Projects State, DOM References, and Static Options
// =====================================================
// This file contains only shared state variables, DOM references,
// and static option lists used across the Projects page.
// No business logic or event handlers should be placed here.
// =====================================================

// In-memory project rows cache.
// Key format: "project-{workItemId}"
const projectRows = {};

// Main project drawer DOM references.
const projOverlay = document.getElementById("project-drawer-overlay");
const projCloseBtn = document.getElementById("proj-close");
const projBackdrop = projOverlay?.querySelector(".project-drawer-backdrop");

// Drawer tabbar scrolling DOM references.
const tabbarScroller = document.getElementById("tabbar-scroller");
const tabbarArrowStart = document.getElementById("tabbar-arrow-start"); // Right arrow in RTL
const tabbarArrowEnd = document.getElementById("tabbar-arrow-end"); // Left arrow in RTL

// Edit/create mode state.
let isEditMode = false;
let projectSnapshot = null;
let currentProjectId = null;
let isCreateMode = false;

// Lookup caches loaded from backend.
let customersById = {};
let sitesById = {};

// Current project milestones state.
let currentProjectMilestones = [];
let editingMilestoneId = null;

// Project status metadata used for display and badges.
const PROJECT_STATUS_OPTIONS = [
  { code: "Open", display: "פתוח", badgeClass: "badge-neutral" },
  { code: "Planned", display: "בתכנון", badgeClass: "badge-primary" },
  { code: "Design", display: "תוכניות", badgeClass: "badge-primary" },
  { code: "Wiring", display: "השחלה", badgeClass: "badge-warning" },
  { code: "Execution", display: "ביצוע", badgeClass: "badge-warning" },
  { code: "Closed", display: "סיום", badgeClass: "badge-success" },
  { code: "Cancelled", display: "מבוטל", badgeClass: "badge-neutral" },
];

// Billing type metadata used for display.
const BILLING_TYPE_OPTIONS = [
  { code: "Fixed", display: "קבוע" },
  { code: "Internal", display: "פנימי" },
  { code: "Hourly", display: "שעתי" },
];
