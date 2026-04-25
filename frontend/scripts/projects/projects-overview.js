// =====================================================
// Projects Overview, Edit Mode, and Form Logic
// =====================================================
// This file contains logic related to:
// - Project overview rendering (edit/view modes)
// - Snapshot (state backup before edit)
// - Save / cancel edit flow
// - Customer & Site selection handling
// - Project form data collection
//
// IMPORTANT:
// - No API definitions here
// - No drawer open/close logic here
// - No milestones / BOQ / drawings / equipment logic here
// =====================================================

// =====================================================
// Snapshot (State Backup)
// =====================================================

function createSnapshot() {
  const p = projectRows[currentProjectId];
  if (!p) return null;

  return {
    name: p.name,
    customer: p.customer,
    managers: Array.isArray(p.managers) ? [...p.managers] : [],
    team: Array.isArray(p.team) ? [...p.team] : [],
    status: p.status,
    openDate: p.openDate,
    closeDate: p.closeDate,
    number: p.number,
    financeNumber: p.financeNumber,
    invoiceNumber: p.invoiceNumber,
    billingType: p.billingType,
    description: p.description,
  };
}

// =====================================================
// Edit Mode Management
// =====================================================

async function enterEditMode() {
  if (!currentProjectId) return;

  await ensureProjectLookupsLoaded();

  isEditMode = true;
  projectSnapshot = createSnapshot();

  const currentProject = projectRows[currentProjectId];

  switchOverviewToEdit(currentProject);

  document.getElementById("header-actions-edit").style.display = "flex";
  document.getElementById("edit-mode-indicator").style.display = "inline";

  updateEditToggleButton();

  switchTeamToView();
}

function exitEditMode() {
  isEditMode = false;

  document.getElementById("header-actions-edit").style.display = "none";
  document.getElementById("edit-mode-indicator").style.display = "none";

  updateEditToggleButton();
  switchOverviewToView();
  switchTeamToView();
}

function updateEditToggleButton() {
  const toggleBtn = document.getElementById("proj-edit-toggle");
  if (!toggleBtn) return;

  if (isEditMode) {
    toggleBtn.innerHTML = '<i data-lucide="x" class="icon"></i> סיום עריכה';
  } else {
    toggleBtn.innerHTML = '<i data-lucide="edit-2" class="icon"></i> עריכת תיק';
  }

  if (window.lucide) lucide.createIcons();
}

// =====================================================
// Save / Cancel Edit
// =====================================================

async function saveEdit() {
  try {
    if (isCreateMode) {
      const newId = await createProjectFromApi();
      if (!newId) return;

      alert("הפרויקט נוצר בהצלחה");
      resetProjectCreateState();
      await refreshProjectsAndOpen(newId);
      return;
    }

    if (!currentProjectId) return;

    const updated = await updateProjectFromApi(currentProjectId);
    if (!updated) return;

    alert("השינויים נשמרו בהצלחה");

    exitEditMode();
    projectSnapshot = null;

    const workItemId = projectRows[currentProjectId]?.workItemId;
    if (workItemId) {
      await refreshProjectsAndOpen(workItemId);
    }
  } catch (error) {
    console.error("Save failed:", error);
    alert("שמירה נכשלה");
  }
}

function cancelEdit() {
  if (!projectSnapshot || !currentProjectId) return;

  const p = projectRows[currentProjectId];

  Object.assign(p, projectSnapshot);

  document.getElementById("proj-name").textContent = p.name;
  document.getElementById("proj-customer").textContent = p.customer;
  document.getElementById("proj-status").textContent = p.status;
  document.getElementById("proj-description").textContent =
    p.description || "-";

  updateTeamView(p.managers, p.team);

  exitEditMode();
  projectSnapshot = null;
}

// =====================================================
// Team Rendering
// =====================================================

function updateTeamView(managers, team) {
  const managerEl = document.getElementById("proj-manager-view");
  const teamEl = document.getElementById("proj-team-view");

  managerEl.textContent =
    managers && managers.length ? managers.join(", ") : "-";

  teamEl.textContent = team && team.length ? team.join(", ") : "-";
}

function switchTeamToView() {
  document.getElementById("proj-manager-view").style.display = "block";
  document.getElementById("proj-team-view").style.display = "block";
}

// =====================================================
// Customer / Site Select Handling
// =====================================================

function populateCustomerSelectOptions(selectedCustomerId = null) {
  const select = document.getElementById("proj-customer-select");
  if (!select) return;

  select.innerHTML = '<option value="">בחר לקוח</option>';

  Object.values(customersById).forEach((c) => {
    const option = document.createElement("option");
    option.value = c.customerId;
    option.textContent = c.customerName;

    if (String(c.customerId) === String(selectedCustomerId)) {
      option.selected = true;
    }

    select.appendChild(option);
  });
}

function populateSiteSelectOptions(selectedSiteId = null, customerId = null) {
  const select = document.getElementById("proj-site-id-select");
  if (!select) return;

  select.innerHTML = '<option value="">בחר אתר</option>';

  let sites = Object.values(sitesById);

  if (customerId) {
    sites = sites.filter((s) => String(s.customerId) === String(customerId));
  }

  sites.forEach((site) => {
    const option = document.createElement("option");
    option.value = site.siteId;
    option.textContent = site.siteName;

    if (String(site.siteId) === String(selectedSiteId)) {
      option.selected = true;
    }

    select.appendChild(option);
  });
}

function handleProjectCustomerChange() {
  const customerId = document.getElementById("proj-customer-select")?.value;

  populateSiteSelectOptions(null, customerId);
  resetNewSiteForm();
}

function resetNewSiteForm() {
  const form = document.getElementById("proj-site-add-form");

  document.getElementById("new-site-name-input").value = "";
  document.getElementById("new-site-address-input").value = "";
  document.getElementById("new-site-city-input").value = "";
  document.getElementById("new-site-notes-input").value = "";
  document.getElementById("new-site-is-primary-input").checked = false;

  if (form) form.style.display = "none";
}

// =====================================================
// Overview Mode Switch
// =====================================================

function switchOverviewToEdit(project) {
  document.getElementById("proj-name").style.display = "none";
  document.getElementById("proj-name-edit").style.display = "block";

  document.getElementById("proj-name-input").value = project?.name || "";

  populateCustomerSelectOptions(project?.raw?.customerId);
  populateSiteSelectOptions(project?.raw?.siteId, project?.raw?.customerId);
}

function switchOverviewToView() {
  document.getElementById("proj-name").style.display = "block";
  document.getElementById("proj-name-edit").style.display = "none";
}

// =====================================================
// Form Data Collection
// =====================================================

function collectProjectFormData() {
  const title = document.getElementById("proj-name-input")?.value.trim();

  const customerId = document.getElementById("proj-customer-select")?.value;

  const siteId = document.getElementById("proj-site-id-select")?.value;

  if (!title) {
    alert("יש להזין שם פרויקט");
    return null;
  }

  if (!customerId || !siteId) {
    alert("יש לבחור לקוח ואתר");
    return null;
  }

  return {
    title,
    description: document.getElementById("proj-description-input")?.value || "",
    status: document.getElementById("proj-status-select")?.value || "Open",
    billingType:
      document.getElementById("proj-billing-type-select")?.value || "Fixed",
    customerId: Number(customerId),
    siteId: Number(siteId),
  };
}

// =====================================================
// Create Mode Reset
// =====================================================

function resetProjectCreateState() {
  isCreateMode = false;
}
