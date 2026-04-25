// =====================================================
// Projects Drawer, Tabs, and Navigation
// =====================================================
// This file contains drawer-level behavior for the Projects page.
//
// Responsibilities:
// - Open selected project drawer
// - Close project drawer
// - Reset default drawer tab
// - Manage drawer maximize/restore behavior
// - Manage horizontal tabbar arrows and scrolling
// - Handle project deep links from URL
//
// IMPORTANT:
// - No API definitions here
// - No milestone CRUD logic here
// - No BOQ / drawings / equipment editing logic here
// - This file may call functions from other files,
//   but should not define unrelated module logic
// =====================================================

// =====================================================
// Project Drawer Open / Close
// =====================================================

// Opens the project drawer for an existing project or temporary new project.
async function openProject(id) {
  let p = projectRows[id];
  if (!p) return;

  const isTemporaryNewProject = isCreateMode && !p.workItemId;

  await ensureProjectLookupsLoaded();

  if (!isTemporaryNewProject) {
    p = await loadProjectDetailsFromApi(id);
    if (!p) return;

    const assignmentData = await loadProjectAssignmentsFromApi(id);
    p.managers = assignmentData.managers;
    p.team = assignmentData.team;

    projectRows[id] = {
      ...projectRows[id],
      managers: p.managers,
      team: p.team,
    };
  }

  // Clear previous selected row styling.
  document
    .querySelectorAll("#projects-table tbody tr")
    .forEach((row) => row.classList.remove("is-selected", "selected"));

  // Mark current project row as selected.
  const selectedRow = document.querySelector(
    `#projects-table tbody tr[data-project-id="${id}"]`,
  );

  if (selectedRow) {
    selectedRow.classList.add("is-selected", "selected");
  }

  // Reset drawer state before rendering selected project.
  currentProjectId = id;
  isEditMode = false;
  projectSnapshot = null;

  if (!p.team) {
    p.team = [];
  }

  // Render main project fields in drawer overview.
  document.getElementById("proj-name").textContent = p.name || "-";
  document.getElementById("proj-customer").textContent = p.customer || "-";
  document.getElementById("proj-status").textContent = p.status || "-";
  document.getElementById("proj-open-date").textContent = p.openDate || "-";

  document.getElementById("proj-close-date").textContent = p.raw?.dealCloseDate
    ? formatDate(p.raw.dealCloseDate)
    : "-";

  document.getElementById("proj-number").textContent = p.number || "-";

  document.getElementById("proj-finance-number").textContent =
    p.raw?.financeProjectNumber || p.financeNumber || "-";

  document.getElementById("proj-invoice-number").textContent =
    p.raw?.invoiceNumber || p.invoiceNumber || "-";

  document.getElementById("proj-billing-type").textContent = getBillingTypeMeta(
    p.raw?.billingType || p.billingTypeCode || "",
  ).display;

  document.getElementById("proj-site-id").textContent =
    p.raw?.siteName || getSiteDisplayName(p.raw?.siteId ?? p.siteId);

  document.getElementById("proj-description").textContent =
    p.raw?.description || p.description || "-";

  // Normalize managers/team arrays before rendering.
  if (!Array.isArray(p.managers)) {
    p.managers = [];
  }

  if (!Array.isArray(p.team)) {
    p.team = [];
  }

  updateTeamView(p.managers, p.team);

  // Load and render milestones for existing projects only.
  if (isTemporaryNewProject) {
    currentProjectMilestones = [];
    renderProjectMilestones(currentProjectMilestones);
  } else {
    currentProjectMilestones = await loadProjectMilestonesFromApi(id);
    renderProjectMilestones(currentProjectMilestones);
  }

  // Ensure drawer opens in view mode and default tab.
  exitEditMode();
  updateMaximizeButtonState();
  setDefaultProjectTab();

  projOverlay.classList.add("is-open");
  document.body.classList.add("drawer-open");

  // Delay arrow update until drawer layout is visible.
  setTimeout(updateTabbarArrows, 150);
}

// Closes the project drawer and resets drawer-level state.
function closeProjectDrawer() {
  if (isEditMode) {
    cancelEdit();
  }

  projOverlay.classList.remove("is-open");
  document.body.classList.remove("drawer-open");

  isCreateMode = false;
  isEditMode = false;
  projectSnapshot = null;
  currentProjectId = null;
}

// =====================================================
// Drawer Tabs
// =====================================================

// Resets the drawer to the default overview tab whenever a project is opened.
function setDefaultProjectTab() {
  document
    .querySelectorAll(".project-drawer-tabs .tab")
    .forEach((tab) => tab.classList.remove("active"));

  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));

  const overviewTab = document.querySelector(
    '.project-drawer-tabs .tab[data-tab="overview"]',
  );

  const overviewContent = document.getElementById("overview-content");

  if (overviewTab) overviewTab.classList.add("active");
  if (overviewContent) overviewContent.classList.add("active");
}

// Handles switching between drawer tabs.
function handleProjectTabClick(tab) {
  const key = tab.dataset.tab;

  document
    .querySelectorAll(".project-drawer-tabs .tab")
    .forEach((item) => item.classList.remove("active"));

  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));

  tab.classList.add("active");

  const content = document.getElementById(`${key}-content`);

  if (content) {
    content.classList.add("active");
  }
}

// =====================================================
// Drawer Maximize / Restore
// =====================================================

const projDrawer = document.getElementById("project-details");
const projMaximizeBtn = document.getElementById("proj-maximize");

// Updates maximize button label and accessibility attributes.
function updateMaximizeButtonState() {
  if (!projMaximizeBtn || !projDrawer) return;

  const isMaximized = projDrawer.classList.contains("is-maximized");
  const labelEl = projMaximizeBtn.querySelector(".modal-max-label");

  if (isMaximized) {
    projMaximizeBtn.setAttribute("aria-label", "הקטן מסך");
    projMaximizeBtn.setAttribute("title", "הקטן מסך");

    if (labelEl) {
      labelEl.textContent = "הקטן מסך";
    }
  } else {
    projMaximizeBtn.setAttribute("aria-label", "הגדל מסך");
    projMaximizeBtn.setAttribute("title", "הגדל מסך");

    if (labelEl) {
      labelEl.textContent = "הגדל מסך";
    }
  }
}

// Toggles drawer maximize state.
function toggleProjectDrawerMaximize(event) {
  event.stopPropagation();

  if (!projDrawer) return;

  projDrawer.classList.toggle("is-maximized");
  updateMaximizeButtonState();
}

// =====================================================
// Tabbar Horizontal Scrolling
// =====================================================

// Updates tabbar arrow visibility and opacity according to scroll position.
function updateTabbarArrows() {
  if (!tabbarScroller || !tabbarArrowStart || !tabbarArrowEnd) return;

  const { scrollWidth, clientWidth, scrollLeft } = tabbarScroller;
  const max = scrollWidth - clientWidth;

  if (max <= 1) {
    tabbarArrowStart.style.display = "none";
    tabbarArrowEnd.style.display = "none";
    return;
  }

  tabbarArrowStart.style.display = "flex";
  tabbarArrowEnd.style.display = "flex";

  // RTL browsers may use negative scrollLeft values.
  const pos = Math.abs(scrollLeft);

  tabbarArrowStart.style.opacity = pos <= 5 ? "0.3" : "1";
  tabbarArrowEnd.style.opacity = pos >= max - 5 ? "0.3" : "1";

  // Keep buttons clickable to avoid disabled cursor issues.
  tabbarArrowStart.disabled = false;
  tabbarArrowEnd.disabled = false;
}

// Scrolls the tabbar in RTL-aware directions.
function scrollTabbar(direction) {
  if (!tabbarScroller) return;

  const scrollAmount = 200;

  // In this UI:
  // "start" = right arrow in RTL
  // "end" = left arrow in RTL
  const move = direction === "start" ? scrollAmount : -scrollAmount;

  tabbarScroller.scrollBy({
    left: move,
    behavior: "smooth",
  });
}

// =====================================================
// Project Deep Link
// =====================================================

// Opens a project directly when URL contains ?projectId={id}.
function handleProjectDeepLink() {
  const urlParams = new URLSearchParams(window.location.search);
  const rawProjectId = urlParams.get("projectId");

  if (!rawProjectId) return;

  const normalizedProjectId = rawProjectId.startsWith("project-")
    ? rawProjectId
    : `project-${rawProjectId}`;

  if (projectRows[normalizedProjectId]) {
    openProject(normalizedProjectId);

    const row = document.querySelector(
      `#projects-table tbody tr[data-project-id="${normalizedProjectId}"]`,
    );

    if (row) {
      row.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return;
  }

  const row = document.querySelector(
    `#projects-table tbody tr[data-project-id="${normalizedProjectId}"]`,
  );

  if (row) {
    row.click();
    row.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
