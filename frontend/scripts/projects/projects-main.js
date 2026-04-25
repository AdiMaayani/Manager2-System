// =====================================================
// Projects Main Initialization
// =====================================================
// This file is the main entry point for the Projects page.
//
// Responsibilities:
// - Initialize page events
// - Load projects from backend
// - Render project table
// - Apply stage filtering
// - Start protected page flow
//
// IMPORTANT:
// - No module-specific implementation logic here
// - No duplicated API logic here
// - No BOQ / milestones / drawings / equipment logic here
// - This file only connects the page startup flow
// =====================================================

// =====================================================
// Projects Table Rendering
// =====================================================

// Renders the main projects table from mapped project objects.
function renderProjectsTable(projects) {
  const tbody = document.querySelector("#projects-table tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  projects.forEach((project) => {
    const tr = document.createElement("tr");
    tr.dataset.projectId = project.id;

    tr.innerHTML = `
      <td>${escapeHtml(project.number)}</td>
      <td>${escapeHtml(project.name)}</td>
      <td>${escapeHtml(project.customer)}</td>
      <td>${escapeHtml(
        Array.isArray(project.managers) && project.managers.length > 0
          ? project.managers.join(", ")
          : "-",
      )}</td>
      <td>
        <span class="badge ${escapeHtml(project.statusBadgeClass)}">
          ${escapeHtml(project.status)}
        </span>
      </td>
      <td>${escapeHtml(project.openDate)}</td>
      <td>${escapeHtml(project.area)}</td>
    `;

    tr.addEventListener("click", () => openProject(project.id));
    tbody.appendChild(tr);
  });
}

// =====================================================
// Projects Stage Filtering
// =====================================================

// Maps displayed project status text to the filter stage value.
function mapStatusToStage(status) {
  if (status === "פתוח") return "פתוח";
  if (status === "בתכנון") return "בתכנון";
  if (status === "תוכניות") return "תוכניות";
  if (status === "השחלה") return "השחלה";
  if (status === "ביצוע") return "ביצוע";
  if (status === "סיום") return "סיום";

  return null;
}

// Filters the projects table by selected stage.
function filterByStage(stage) {
  const table = document.getElementById("projects-table");
  const stageLabel = document.getElementById("stage-label");

  if (!table) return;

  const rows = table.querySelectorAll("tbody tr");

  rows.forEach((row) => {
    const statusBadge = row.querySelector(".badge");

    if (!statusBadge) {
      row.style.display = "none";
      return;
    }

    const statusText = statusBadge.textContent.trim();
    const mappedStage = mapStatusToStage(statusText);

    if (stage === "all" || mappedStage === stage) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });

  if (stageLabel) {
    const stageName = stage === "all" ? "הכל" : stage;
    stageLabel.textContent = `שלב פרויקט: ${stageName}`;
  }
}

// =====================================================
// Page Initialization
// =====================================================

// Initializes all project page behavior after auth/session validation.
function initializeProjectsPage() {
  bindProjectsEvents();

  if (window.lucide) {
    lucide.createIcons();
  }

  loadProjectsFromApi();
}

// Starts the Projects page only after protected-page validation passes.
window.bootProtectedPage(() => {
  initializeProjectsPage();
});
