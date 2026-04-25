// נתוני הפרויקטים
// TODO: temporary mock data until backend integration is connected
const projectRows = {};

const projOverlay = document.getElementById("project-drawer-overlay");
const projCloseBtn = document.getElementById("proj-close");
const projBackdrop = projOverlay.querySelector(".project-drawer-backdrop");
const tabbarScroller = document.getElementById("tabbar-scroller");
const tabbarArrowStart = document.getElementById("tabbar-arrow-start"); // חץ ימני
const tabbarArrowEnd = document.getElementById("tabbar-arrow-end"); // חץ שמאלי

// Edit mode state
let isEditMode = false;
let projectSnapshot = null;
let currentProjectId = null;
let isCreateMode = false;
let customersById = {};
let sitesById = {};
let currentProjectMilestones = [];
let editingMilestoneId = null;

const PROJECT_STATUS_OPTIONS = [
  { code: "Open", display: "פתוח", badgeClass: "badge-neutral" },
  { code: "Planned", display: "בתכנון", badgeClass: "badge-primary" },
  { code: "Design", display: "תוכניות", badgeClass: "badge-primary" },
  { code: "Wiring", display: "השחלה", badgeClass: "badge-warning" },
  { code: "Execution", display: "ביצוע", badgeClass: "badge-warning" },
  { code: "Closed", display: "סיום", badgeClass: "badge-success" },
];

const BILLING_TYPE_OPTIONS = [
  { code: "Fixed", display: "קבוע" },
  { code: "Internal", display: "פנימי" },
  { code: "Hourly", display: "שעתי" },
];

// פונקציות פתיחה וסגירה
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

  document
    .querySelectorAll("#projects-table tbody tr")
    .forEach((row) => row.classList.remove("is-selected", "selected"));

  const selectedRow = document.querySelector(
    `#projects-table tbody tr[data-project-id="${id}"]`,
  );

  if (selectedRow) {
    selectedRow.classList.add("is-selected", "selected");
  }

  currentProjectId = id;
  isEditMode = false;
  projectSnapshot = null;

  if (!p.team) {
    p.team = [];
  }

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

  if (!Array.isArray(p.managers)) {
    p.managers = [];
  }

  if (!Array.isArray(p.team)) {
    p.team = [];
  }

  updateTeamView(p.managers, p.team);

  if (isTemporaryNewProject) {
    currentProjectMilestones = [];
    renderProjectMilestones(currentProjectMilestones);
  } else {
    currentProjectMilestones = await loadProjectMilestonesFromApi(id);
    renderProjectMilestones(currentProjectMilestones);
  }

  exitEditMode();
  updateMaximizeButtonState();
  setDefaultProjectTab();

  projOverlay.classList.add("is-open");
  document.body.classList.add("drawer-open");
  setTimeout(updateTabbarArrows, 150);
}

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

function closeProjectDrawer() {
  // If in edit mode, cancel changes first
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

projCloseBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  closeProjectDrawer();
});
projBackdrop.addEventListener("click", closeProjectDrawer);

// ESC key handler
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && projOverlay.classList.contains("is-open")) {
    closeProjectDrawer();
  }
});

// Edit mode functions
function createSnapshot() {
  const p = projectRows[currentProjectId];
  if (!p) return null;

  // Get BOQ data from view table
  const boqData = [];
  const tbody = document.getElementById("boq-tbody-view");
  if (tbody) {
    const rows = tbody.querySelectorAll("tr");
    rows.forEach((row, idx) => {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 3) {
        // Find the item, quantity, and unit cells (skip system cell if it's a rowspan)
        let itemCell, qtyCell, unitCell;
        if (cells.length === 3) {
          itemCell = cells[0];
          qtyCell = cells[1];
          unitCell = cells[2];
        } else if (cells.length === 4) {
          // Has system cell
          itemCell = cells[1];
          qtyCell = cells[2];
          unitCell = cells[3];
        }
        if (itemCell && qtyCell && unitCell) {
          boqData.push({
            id: `boq-${idx}`,
            item: itemCell.textContent.trim(),
            quantity: qtyCell.textContent.trim(),
            unit: unitCell.textContent.trim(),
          });
        }
      }
    });
  }

  // Get Drawings data from view
  const drawingsData = [];
  const drawingsList = document.getElementById("drawings-list-view");
  if (drawingsList) {
    const cards = drawingsList.querySelectorAll(".file-card");
    cards.forEach((card) => {
      const nameEl = card.querySelector(".file-name");
      const metaEl = card.querySelector(".file-meta");
      if (nameEl && metaEl) {
        // Extract name - get all text nodes, skip icon
        const nameText = Array.from(nameEl.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent.trim())
          .join(" ")
          .trim();
        const meta = metaEl.textContent.trim();
        const typeMatch = meta.match(/סוג:\s*(\w+)/);
        const dateMatch = meta.match(/עודכן:\s*(\d{2}\/\d{2}\/\d{4})/);
        drawingsData.push({
          id: card.dataset.drawingId || `draw-${Date.now()}`,
          name: nameText || "ללא שם",
          type: typeMatch ? typeMatch[1] : "PDF",
          date: dateMatch ? dateMatch[1] : "",
          note: "", // Notes not shown in view, will be empty
        });
      }
    });
  }

  // Get Equipment/Products data from view table
  const equipmentData = [];
  const equipmentTbody = document.getElementById("equipment-tbody-view");
  if (equipmentTbody) {
    const rows = equipmentTbody.querySelectorAll("tr");
    rows.forEach((row, idx) => {
      const cells = row.querySelectorAll("td");
      if (cells.length >= 4) {
        const system = cells[0]?.textContent.trim() || "";
        const item = cells[1]?.textContent.trim() || "";
        const location = cells[2]?.textContent.trim() || "";
        const statusBadge = cells[3]?.querySelector(".badge");
        let status = statusBadge ? statusBadge.textContent.trim() : "";
        // Map view status to edit status values
        if (status.includes("הותקן") || status.includes("מותקן")) {
          status = "מותקן";
        } else if (status.includes("בהתקנה")) {
          status = "בהתקנה";
        } else if (status.includes("בהזמנה")) {
          status = "בהזמנה";
        } else {
          status = "ממתין";
        }
        equipmentData.push({
          id: row.dataset.equipmentId || `eq-${idx}`,
          system: system,
          item: item,
          location: location,
          status: status,
        });
      }
    });
  }

  // Get team data
  const managerView = document.getElementById("proj-manager-view");
  const managersText = managerView ? managerView.textContent.trim() : "";
  const managers =
    managersText && managersText !== "-"
      ? managersText
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
      : Array.isArray(p.managers)
        ? [...p.managers]
        : [];

  const team = Array.isArray(p.team) ? [...p.team] : [];

  // Create deep copy of current project data
  return {
    name: p.name,
    customer: p.customer,
    managers: managers,
    status: p.status,
    openDate: p.openDate,
    closeDate: p.closeDate,
    number: p.number,
    financeNumber: p.financeNumber,
    invoiceNumber: p.invoiceNumber,
    billingType: p.billingType,
    description: p.description,
    team: team,
    boq: boqData,
    drawings: drawingsData,
    equipment: equipmentData,
  };
}

async function enterEditMode() {
  if (!currentProjectId) return;

  await ensureProjectLookupsLoaded();

  isEditMode = true;
  projectSnapshot = createSnapshot();
  const currentProject = projectRows[currentProjectId];
  switchOverviewToEdit(currentProject);

  // Update UI
  document.getElementById("header-actions-edit").style.display = "flex";
  document.getElementById("edit-mode-indicator").style.display = "inline";
  updateEditToggleButton();

  // Team section is derived from work assignments and stays read-only
  switchTeamToView();

  // Switch BOQ to edit mode
  switchBOQToEdit();

  // Switch Drawings to edit mode
  switchDrawingsToEdit();

  // Switch Equipment to edit mode
  switchEquipmentToEdit();
}

function exitEditMode() {
  isEditMode = false;

  // Update UI
  document.getElementById("header-actions-edit").style.display = "none";
  document.getElementById("edit-mode-indicator").style.display = "none";
  updateEditToggleButton();
  switchOverviewToView();

  // Switch team section to view mode
  switchTeamToView();

  // Switch BOQ to view mode
  switchBOQToView();

  // Switch Drawings to view mode
  switchDrawingsToView();

  // Switch Equipment to view mode
  switchEquipmentToView();
}

function updateEditToggleButton() {
  const toggleBtn = document.getElementById("proj-edit-toggle");
  if (!toggleBtn) return;

  const icon = toggleBtn.querySelector("i[data-lucide]");
  if (isEditMode) {
    toggleBtn.innerHTML =
      '<i data-lucide="x" class="icon" aria-hidden="true"></i> סיום עריכה';
    if (icon) icon.setAttribute("data-lucide", "x");
  } else {
    toggleBtn.innerHTML =
      '<i data-lucide="edit-2" class="icon" aria-hidden="true"></i> עריכת תיק';
    if (icon) icon.setAttribute("data-lucide", "edit-2");
  }
  if (window.lucide) lucide.createIcons();
}

async function saveEdit() {
  try {
    if (isCreateMode) {
      const newWorkItemId = await createProjectFromApi();
      if (!newWorkItemId) return;

      alert("הפרויקט נוצר בהצלחה");
      resetProjectCreateState();
      await refreshProjectsAndOpen(newWorkItemId);
      return;
    }

    if (!currentProjectId || !projectSnapshot) return;

    if (!validateBOQ()) {
      return;
    }

    const updated = await updateProjectFromApi(currentProjectId);
    if (!updated) return;

    commitBOQChanges();
    commitDrawingsChanges();
    commitEquipmentChanges();

    alert("השינויים נשמרו בהצלחה");
    const currentWorkItemId = projectRows[currentProjectId]?.workItemId;

    exitEditMode();
    projectSnapshot = null;

    if (currentWorkItemId) {
      await refreshProjectsAndOpen(currentWorkItemId);
    }
  } catch (error) {
    console.error("Save project failed:", error);
    alert(error.message || "שמירת הפרויקט נכשלה");
  }
}

function cancelEdit() {
  if (!projectSnapshot || !currentProjectId) return;

  const p = projectRows[currentProjectId];

  // Restore from snapshot
  p.name = projectSnapshot.name;
  p.customer = projectSnapshot.customer;
  p.managers = Array.isArray(projectSnapshot.managers)
    ? [...projectSnapshot.managers]
    : [];
  p.team = Array.isArray(projectSnapshot.team) ? [...projectSnapshot.team] : [];
  p.status = projectSnapshot.status;
  p.openDate = projectSnapshot.openDate;
  p.closeDate = projectSnapshot.closeDate;
  p.number = projectSnapshot.number;
  p.financeNumber = projectSnapshot.financeNumber;
  p.invoiceNumber = projectSnapshot.invoiceNumber;

  p.billingType = projectSnapshot.billingType;

  p.description = projectSnapshot.description;

  // Update UI
  document.getElementById("proj-name").textContent = p.name;
  document.getElementById("proj-customer").textContent = p.customer;
  document.getElementById("proj-status").textContent = p.status;
  document.getElementById("proj-open-date").textContent = p.openDate || "-";
  document.getElementById("proj-close-date").textContent = p.closeDate || "-";
  document.getElementById("proj-number").textContent = p.number || "-";
  document.getElementById("proj-finance-number").textContent =
    p.financeNumber || "-";
  document.getElementById("proj-invoice-number").textContent =
    p.invoiceNumber || "-";

  document.getElementById("proj-billing-type").textContent =
    p.billingType || "-";

  document.getElementById("proj-description").textContent =
    p.description || "-";

  // Restore team from snapshot
  p.managers = Array.isArray(projectSnapshot.managers)
    ? [...projectSnapshot.managers]
    : [];
  p.team = Array.isArray(projectSnapshot.team) ? [...projectSnapshot.team] : [];

  updateTeamView(p.managers, p.team);

  // Restore BOQ from snapshot
  restoreBOQFromSnapshot();

  // Restore Drawings from snapshot
  restoreDrawingsFromSnapshot();

  // Restore Equipment from snapshot
  restoreEquipmentFromSnapshot();

  exitEditMode();
  projectSnapshot = null;
}

// Team management functions
function updateTeamView(managers, team) {
  const managerView = document.getElementById("proj-manager-view");
  const teamView = document.getElementById("proj-team-view");

  if (managerView) {
    if (managers && managers.length > 0) {
      managerView.textContent = managers.join(", ");
    } else {
      managerView.textContent = "-";
    }
  }

  if (teamView) {
    if (team && team.length > 0) {
      teamView.textContent = team.join(", ");
    } else {
      teamView.textContent = "-";
    }
  }
}

function switchTeamToView() {
  const managerView = document.getElementById("proj-manager-view");
  const teamView = document.getElementById("proj-team-view");

  if (managerView) {
    managerView.style.display = "block";
  }

  if (teamView) {
    teamView.style.display = "block";
  }
}

// BOQ editing functions
function switchBOQToEdit() {
  document.getElementById("boq-view").style.display = "none";
  document.getElementById("boq-edit").style.display = "block";

  // Populate edit table from view table
  const tbodyView = document.getElementById("boq-tbody-view");
  const tbodyEdit = document.getElementById("boq-tbody-edit");
  if (!tbodyView || !tbodyEdit) return;

  tbodyEdit.innerHTML = "";
  const rows = tbodyView.querySelectorAll("tr");
  let rowId = 0;

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    if (cells.length >= 3) {
      let itemCell, qtyCell, unitCell;
      if (cells.length === 3) {
        itemCell = cells[0];
        qtyCell = cells[1];
        unitCell = cells[2];
      } else if (cells.length === 4) {
        itemCell = cells[1];
        qtyCell = cells[2];
        unitCell = cells[3];
      }

      if (itemCell && qtyCell && unitCell) {
        const tr = document.createElement("tr");
        tr.dataset.boqId = `boq-${rowId++}`;
        const item = itemCell.textContent.trim();
        const qty = qtyCell.textContent.trim();
        const unit = unitCell.textContent.trim();

        tr.innerHTML = `
                    <td>
                        <input type="text" class="input input-sm boq-item-input" value="${escapeHtml(item)}" placeholder="שם פריט">
                    </td>
                    <td>
                        <input type="number" class="input input-sm boq-qty-input" value="${qty}" min="0" placeholder="0">
                    </td>
                    <td>
                        <select class="input input-sm boq-unit-input">
                            <option value="יח׳" ${unit === "יח׳" ? "selected" : ""}>יח׳</option>
                            <option value="מ׳" ${unit === "מ׳" ? "selected" : ""}>מ׳</option>
                            <option value="מ״ר" ${unit === "מ״ר" ? "selected" : ""}>מ״ר</option>
                            <option value="סט" ${unit === "סט" ? "selected" : ""}>סט</option>
                        </select>
                    </td>
                    <td>
                        <button type="button" class="btn-icon-only btn-sm boq-remove-btn" data-remove-boq="${tr.dataset.boqId}" aria-label="הסר">
                            <i data-lucide="trash-2" class="icon" aria-hidden="true"></i>
                        </button>
                    </td>
                `;
        tbodyEdit.appendChild(tr);
      }
    }
  });

  attachBOQHandlers();
  if (window.lucide) lucide.createIcons();
}

function switchBOQToView() {
  document.getElementById("boq-view").style.display = "block";
  document.getElementById("boq-edit").style.display = "none";
}

function commitBOQChanges() {
  const tbodyEdit = document.getElementById("boq-tbody-edit");
  const tbodyView = document.getElementById("boq-tbody-view");
  if (!tbodyEdit || !tbodyView) return;

  // Rebuild view table from edit table
  tbodyView.innerHTML = "";
  const rows = tbodyEdit.querySelectorAll("tr");
  const systems = {};

  rows.forEach((row, idx) => {
    const itemInput = row.querySelector(".boq-item-input");
    const qtyInput = row.querySelector(".boq-qty-input");
    const unitSelect = row.querySelector(".boq-unit-input");

    if (!itemInput || !qtyInput || !unitSelect) return;

    const item = itemInput.value.trim();
    const qty = qtyInput.value.trim();
    const unit = unitSelect.value;

    if (!item) return; // Skip empty items

    // Simple grouping: first 3 items = חשמל חכם, rest = בקרה
    let system = "";
    if (idx < 3) {
      system = "חשמל חכם";
    } else {
      system = "בקרה";
    }

    if (!systems[system]) {
      systems[system] = [];
    }

    systems[system].push({ item, qty, unit });
  });

  // Build table rows grouped by system
  Object.keys(systems).forEach((system) => {
    const items = systems[system];
    items.forEach((item, itemIdx) => {
      const tr = document.createElement("tr");
      if (itemIdx === 0) {
        tr.innerHTML = `
                    <td rowspan="${items.length}"><strong>${system}</strong></td>
                    <td>${escapeHtml(item.item)}</td>
                    <td>${escapeHtml(item.qty)}</td>
                    <td>${escapeHtml(item.unit)}</td>
                `;
      } else {
        tr.innerHTML = `
                    <td>${escapeHtml(item.item)}</td>
                    <td>${escapeHtml(item.qty)}</td>
                    <td>${escapeHtml(item.unit)}</td>
                `;
      }
      tbodyView.appendChild(tr);
    });
  });
}

function restoreBOQFromSnapshot() {
  if (!projectSnapshot || !projectSnapshot.boq) {
    // If no snapshot, restore to default
    const tbodyView = document.getElementById("boq-tbody-view");
    if (tbodyView) {
      tbodyView.innerHTML = `
                <tr>
                    <td rowspan="3"><strong>חשמל חכם</strong></td>
                    <td>בקר מרכזי</td>
                    <td>1</td>
                    <td>יח׳</td>
                </tr>
                <tr>
                    <td>מתגים חכמים</td>
                    <td>28</td>
                    <td>יח׳</td>
                </tr>
                <tr>
                    <td>חיישני תאורה</td>
                    <td>12</td>
                    <td>יח׳</td>
                </tr>
                <tr>
                    <td rowspan="2"><strong>בקרה</strong></td>
                    <td>מצלמות IP</td>
                    <td>8</td>
                    <td>יח׳</td>
                </tr>
                <tr>
                    <td>ארון תקשורת</td>
                    <td>1</td>
                    <td>יח׳</td>
                </tr>
            `;
    }
    return;
  }

  const tbodyView = document.getElementById("boq-tbody-view");
  if (!tbodyView) return;

  tbodyView.innerHTML = "";

  // Group items by system (simple: first 3 = חשמל חכם, next 2 = בקרה)
  const boqData = projectSnapshot.boq;
  const systems = {};

  boqData.forEach((item, idx) => {
    let system = "";
    if (idx < 3) {
      system = "חשמל חכם";
    } else {
      system = "בקרה";
    }

    if (!systems[system]) {
      systems[system] = [];
    }
    systems[system].push(item);
  });

  // Build table rows
  Object.keys(systems).forEach((system) => {
    const items = systems[system];
    items.forEach((item, itemIdx) => {
      const tr = document.createElement("tr");
      if (itemIdx === 0) {
        tr.innerHTML = `
                    <td rowspan="${items.length}"><strong>${system}</strong></td>
                    <td>${escapeHtml(item.item)}</td>
                    <td>${escapeHtml(item.quantity)}</td>
                    <td>${escapeHtml(item.unit)}</td>
                `;
      } else {
        tr.innerHTML = `
                    <td>${escapeHtml(item.item)}</td>
                    <td>${escapeHtml(item.quantity)}</td>
                    <td>${escapeHtml(item.unit)}</td>
                `;
      }
      tbodyView.appendChild(tr);
    });
  });
}

function validateBOQ() {
  const tbodyEdit = document.getElementById("boq-tbody-edit");
  if (!tbodyEdit) return true;

  const rows = tbodyEdit.querySelectorAll("tr");
  let isValid = true;

  rows.forEach((row) => {
    const itemInput = row.querySelector(".boq-item-input");
    const qtyInput = row.querySelector(".boq-qty-input");

    // Remove previous error states
    if (itemInput) itemInput.classList.remove("error");
    if (qtyInput) qtyInput.classList.remove("error");

    const item = itemInput?.value.trim();
    const qty = qtyInput?.value.trim();

    // Validate item name (required)
    if (!item) {
      if (itemInput) {
        itemInput.classList.add("error");
        isValid = false;
      }
    }

    // Validate quantity (must be numeric >= 0)
    if (qty && (isNaN(parseFloat(qty)) || parseFloat(qty) < 0)) {
      if (qtyInput) {
        qtyInput.classList.add("error");
        isValid = false;
      }
    }
  });

  if (!isValid) {
    alert("יש לתקן שגיאות בטבלה לפני שמירה");
  }

  return isValid;
}

function attachBOQHandlers() {
  // Remove row handlers
  document.querySelectorAll(".boq-remove-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const rowId = btn.dataset.removeBoq;
      const row = document.querySelector(`[data-boq-id="${rowId}"]`);
      if (row) row.remove();
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

async function loadCustomersLookup() {
  try {
    const customers = await apiRequest("/Customers");
    const lookup = {};

    if (Array.isArray(customers)) {
      customers.forEach((customer) => {
        if (customer && customer.customerId != null) {
          lookup[customer.customerId] = customer;
        }
      });
    }

    customersById = lookup;
  } catch (error) {
    console.error("Failed to load customers lookup:", error);
    customersById = {};
  }
}

function getCustomerDisplayName(customerId) {
  if (customerId == null) {
    return "-";
  }

  const customer = customersById[customerId];
  if (customer && customer.customerName) {
    return customer.customerName;
  }

  return `לקוח #${customerId}`;
}

async function loadSitesLookup() {
  try {
    const sites = await apiRequest("/Sites");
    const lookup = {};

    if (Array.isArray(sites)) {
      sites.forEach((site) => {
        if (site && site.siteId != null) {
          lookup[site.siteId] = site;
        }
      });
    }

    sitesById = lookup;
  } catch (error) {
    console.error("Failed to load sites lookup:", error);
    sitesById = {};
  }
}

async function ensureProjectLookupsLoaded() {
  const tasks = [];

  if (Object.keys(customersById).length === 0) {
    tasks.push(loadCustomersLookup());
  }

  if (Object.keys(sitesById).length === 0) {
    tasks.push(loadSitesLookup());
  }

  if (tasks.length > 0) {
    await Promise.all(tasks);
  }
}

function getSiteDisplayName(siteId) {
  if (siteId == null) {
    return "-";
  }

  const site = sitesById[siteId];
  if (site && site.siteName) {
    return site.siteName;
  }

  return `אתר #${siteId}`;
}

function populateSiteSelectOptions(selectedSiteId = null, customerId = null) {
  const select = document.getElementById("proj-site-id-select");
  if (!select) return;

  select.innerHTML = '<option value="">בחר אתר</option>';

  let sites = Object.values(sitesById);

  if (customerId != null && customerId !== "") {
    sites = sites.filter(
      (site) => String(site.customerId) === String(customerId),
    );
  }

  sites
    .sort((a, b) => (a.siteName || "").localeCompare(b.siteName || "", "he"))
    .forEach((site) => {
      const option = document.createElement("option");
      option.value = String(site.siteId);
      option.textContent = site.siteName || `אתר #${site.siteId}`;

      if (
        selectedSiteId != null &&
        String(site.siteId) === String(selectedSiteId)
      ) {
        option.selected = true;
      }

      select.appendChild(option);
    });
}

function resetNewSiteForm() {
  const form = document.getElementById("proj-site-add-form");
  const nameInput = document.getElementById("new-site-name-input");
  const addressInput = document.getElementById("new-site-address-input");
  const cityInput = document.getElementById("new-site-city-input");
  const notesInput = document.getElementById("new-site-notes-input");
  const isPrimaryInput = document.getElementById("new-site-is-primary-input");

  if (nameInput) nameInput.value = "";
  if (addressInput) addressInput.value = "";
  if (cityInput) cityInput.value = "";
  if (notesInput) notesInput.value = "";
  if (isPrimaryInput) isPrimaryInput.checked = false;
  if (form) form.style.display = "none";
}

async function createSiteFromApi() {
  const customerIdValue =
    document.getElementById("proj-customer-select")?.value || "";
  const siteName =
    document.getElementById("new-site-name-input")?.value.trim() || "";
  const addressLine =
    document.getElementById("new-site-address-input")?.value.trim() || "";
  const city =
    document.getElementById("new-site-city-input")?.value.trim() || "";
  const notes =
    document.getElementById("new-site-notes-input")?.value.trim() || "";
  const isPrimary =
    document.getElementById("new-site-is-primary-input")?.checked || false;

  if (!customerIdValue) {
    alert("יש לבחור קודם לקוח לפרויקט");
    return null;
  }

  if (!siteName) {
    alert("יש להזין שם אתר");
    return null;
  }

  const created = await apiRequest("/Sites", {
    method: "POST",
    body: JSON.stringify({
      customerId: Number(customerIdValue),
      siteName,
      addressLine: addressLine || null,
      city: city || null,
      isPrimary,
      notes: notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: null,
    }),
  });

  return created || null;
}

async function refreshSitesAndSelect(siteId) {
  await loadSitesLookup();
  populateSiteSelectOptions(siteId);
}

function getCustomerIdByName(customerName) {
  const entry = Object.values(customersById).find(
    (customer) => customer.customerName === customerName,
  );

  return entry ? entry.customerId : null;
}

function populateCustomerSelectOptions(selectedCustomerId = null) {
  const select = document.getElementById("proj-customer-select");
  if (!select) return;

  select.innerHTML = '<option value="">בחר לקוח</option>';

  Object.values(customersById)
    .sort((a, b) =>
      (a.customerName || "").localeCompare(b.customerName || "", "he"),
    )
    .forEach((customer) => {
      const option = document.createElement("option");
      option.value = String(customer.customerId);
      option.textContent =
        customer.customerName || `לקוח #${customer.customerId}`;

      if (
        selectedCustomerId != null &&
        String(customer.customerId) === String(selectedCustomerId)
      ) {
        option.selected = true;
      }

      select.appendChild(option);
    });
}

function handleProjectCustomerChange() {
  const customerSelect = document.getElementById("proj-customer-select");
  const siteSelect = document.getElementById("proj-site-id-select");

  if (!customerSelect || !siteSelect) return;

  const selectedCustomerId = customerSelect.value || "";
  populateSiteSelectOptions(null, selectedCustomerId);

  const siteValueEl = document.getElementById("proj-site-id");
  if (siteValueEl) {
    siteValueEl.textContent = "-";
  }

  resetNewSiteForm();
}

function switchOverviewToEdit(project) {
  document.getElementById("proj-name").style.display = "none";
  document.getElementById("proj-name-edit").style.display = "block";

  document.getElementById("proj-customer").style.display = "none";
  document.getElementById("proj-customer-edit").style.display = "block";

  document.getElementById("proj-status").style.display = "none";
  document.getElementById("proj-status-edit").style.display = "block";

  document.getElementById("proj-billing-type").style.display = "none";
  document.getElementById("proj-billing-type-edit").style.display = "block";

  document.getElementById("proj-site-id").style.display = "none";
  document.getElementById("proj-site-id-edit").style.display = "block";

  document.getElementById("proj-description").style.display = "none";
  document.getElementById("proj-description-edit").style.display = "block";

  document.getElementById("proj-close-date").style.display = "none";
  document.getElementById("proj-close-date-edit").style.display = "block";

  document.getElementById("proj-finance-number").style.display = "none";
  document.getElementById("proj-finance-number-edit").style.display = "block";

  document.getElementById("proj-invoice-number").style.display = "none";
  document.getElementById("proj-invoice-number-edit").style.display = "block";

  document.getElementById("proj-name-input").value = project?.name || "";
  document.getElementById("proj-status-select").value =
    project?.raw?.status || "Open";
  document.getElementById("proj-billing-type-select").value =
    project?.raw?.billingType || "Fixed";
  document.getElementById("proj-description-input").value =
    project?.raw?.description || "";
  document.getElementById("proj-close-date-input").value = formatDate(
    project?.raw?.dealCloseDate,
    { target: "input" },
  );
  document.getElementById("proj-finance-number-input").value =
    project?.raw?.financeProjectNumber || "";
  document.getElementById("proj-invoice-number-input").value =
    project?.raw?.invoiceNumber || "";

  populateCustomerSelectOptions(project?.raw?.customerId ?? null);
  populateSiteSelectOptions(
    project?.raw?.siteId ?? null,
    project?.raw?.customerId ?? null,
  );
  resetNewSiteForm();

  const customerSelect = document.getElementById("proj-customer-select");
  if (customerSelect) {
    customerSelect.onchange = handleProjectCustomerChange;
  }
}

function switchOverviewToView() {
  document.getElementById("proj-name").style.display = "block";
  document.getElementById("proj-name-edit").style.display = "none";

  document.getElementById("proj-customer").style.display = "block";
  document.getElementById("proj-customer-edit").style.display = "none";

  document.getElementById("proj-status").style.display = "block";
  document.getElementById("proj-status-edit").style.display = "none";

  document.getElementById("proj-billing-type").style.display = "block";
  document.getElementById("proj-billing-type-edit").style.display = "none";

  document.getElementById("proj-site-id").style.display = "block";
  document.getElementById("proj-site-id-edit").style.display = "none";

  document.getElementById("proj-description").style.display = "block";
  document.getElementById("proj-description-edit").style.display = "none";

  document.getElementById("proj-close-date").style.display = "block";
  document.getElementById("proj-close-date-edit").style.display = "none";

  document.getElementById("proj-finance-number").style.display = "block";
  document.getElementById("proj-finance-number-edit").style.display = "none";

  document.getElementById("proj-invoice-number").style.display = "block";
  document.getElementById("proj-invoice-number-edit").style.display = "none";
}

function collectProjectFormData() {
  const title = document.getElementById("proj-name-input")?.value.trim() || "";
  const description =
    document.getElementById("proj-description-input")?.value.trim() || "";
  const status = document.getElementById("proj-status-select")?.value || "Open";
  const billingType =
    document.getElementById("proj-billing-type-select")?.value || "Fixed";
  const customerIdValue =
    document.getElementById("proj-customer-select")?.value || "";
  const siteIdValue =
    document.getElementById("proj-site-id-select")?.value || "";
  const dealCloseDateValue =
    document.getElementById("proj-close-date-input")?.value || "";
  const financeProjectNumber =
    document.getElementById("proj-finance-number-input")?.value.trim() || "";
  const invoiceNumber =
    document.getElementById("proj-invoice-number-input")?.value.trim() || "";

  if (!title) {
    alert("יש להזין שם פרויקט");
    return null;
  }

  if (!customerIdValue) {
    alert("יש לבחור לקוח");
    return null;
  }

  if (!siteIdValue || Number(siteIdValue) <= 0) {
    alert("יש לבחור אתר");
    return null;
  }

  return {
    title,
    description,
    status,
    billingType,
    customerId: Number(customerIdValue),
    siteId: Number(siteIdValue),
    dealCloseDate: dealCloseDateValue || null,
    financeProjectNumber: financeProjectNumber || null,
    invoiceNumber: invoiceNumber || null,
  };
}

async function createProjectFromApi() {
  const formData = collectProjectFormData();
  if (!formData) return null;

  const response = await apiRequest("/WorkItems/project", {
    method: "POST",
    body: JSON.stringify({
      title: formData.title,
      description: formData.description,
      status: formData.status,
      billingType: formData.billingType,
      customerId: formData.customerId,
      siteId: formData.siteId,
      dealCloseDate: formData.dealCloseDate,
      financeProjectNumber: formData.financeProjectNumber,
      invoiceNumber: formData.invoiceNumber,
    }),
  });

  return response?.workItemId ?? null;
}

async function updateProjectFromApi(projectId) {
  const existingProject = projectRows[projectId];
  if (!existingProject || !existingProject.workItemId) {
    throw new Error("Project data is missing.");
  }

  const formData = collectProjectFormData();
  if (!formData) return false;

  const raw = existingProject.raw || {};

  await apiRequest(`/WorkItems/${existingProject.workItemId}`, {
    method: "PUT",
    body: JSON.stringify({
      workItemId: existingProject.workItemId,
      title: formData.title,
      description: formData.description,
      workType: raw.workType || "Project",
      billingType: formData.billingType,
      status: formData.status,
      customerId: formData.customerId,
      siteId: formData.siteId,
      createdAt: raw.createdAt || new Date().toISOString(),
      closedAt: raw.closedAt || null,
      parentWorkItemId: raw.parentWorkItemId || null,
      dealCloseDate: formData.dealCloseDate,
      financeProjectNumber: formData.financeProjectNumber,
      invoiceNumber: formData.invoiceNumber,
    }),
  });

  return true;
}

async function refreshProjectsAndOpen(projectWorkItemId) {
  await loadProjectsFromApi();

  const matchingProjectId = Object.keys(projectRows).find((key) => {
    return projectRows[key]?.workItemId === projectWorkItemId;
  });

  if (matchingProjectId) {
    await openProject(matchingProjectId);
  }
}

function resetProjectCreateState() {
  isCreateMode = false;
}

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

  if (target === "input") {
    return includeTime
      ? `${year}-${month}-${day}T${hours}:${minutes}`
      : `${year}-${month}-${day}`;
  }

  return includeTime
    ? `${day}/${month}/${year} ${hours}:${minutes}`
    : `${day}/${month}/${year}`;
}

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

async function loadProjectMilestonesFromApi(projectId) {
  const existingProject = projectRows[projectId];

  if (!existingProject || !existingProject.workItemId) {
    return [];
  }

  try {
    const milestones = await apiRequest(
      `/WorkItems/${existingProject.workItemId}/milestones`,
    );

    return Array.isArray(milestones) ? milestones : [];
  } catch (error) {
    console.error(`Failed to load milestones for ${projectId}:`, error);
    return [];
  }
}

async function loadProjectAssignmentsFromApi(projectId) {
  const existingProject = projectRows[projectId];

  if (!existingProject || !existingProject.workItemId) {
    return {
      managers: [],
      team: [],
    };
  }

  try {
    const workPlan = await apiRequest(
      `/WorkItems/${existingProject.workItemId}/work-plan`,
    );

    const assignments = Array.isArray(workPlan?.assignments)
      ? workPlan.assignments
      : [];

    const tasks = Array.isArray(workPlan?.tasks) ? workPlan.tasks : [];

    const projectWorkItemId = Number(existingProject.workItemId);

    // 🔹 כל ה־IDs הרלוונטיים (Project + Tasks)
    const relevantWorkItemIds = new Set([
      projectWorkItemId,
      ...tasks.map((t) => Number(t.workItemId)),
    ]);

    // 🔹 סינון עובדים בלבד + שייכות לפרויקט/משימות
    const employeeAssignments = assignments.filter((assignment) => {
      return (
        assignment &&
        assignment.assignmentType === "Employee" &&
        relevantWorkItemIds.has(Number(assignment.workItemId)) &&
        assignment.employeeName
      );
    });

    const managers = [];
    const teamSet = new Set();

    employeeAssignments.forEach((assignment) => {
      const employeeName = String(assignment.employeeName || "").trim();
      const role = String(assignment.assignmentRole || "")
        .trim()
        .toLowerCase();

      if (!employeeName) return;

      if (role === "project manager") {
        if (!managers.includes(employeeName)) {
          managers.push(employeeName);
        }
      } else {
        teamSet.add(employeeName);
      }
    });

    return {
      managers,
      team: Array.from(teamSet),
    };
  } catch (error) {
    console.error(`Failed to load assignments for ${projectId}:`, error);

    return {
      managers: [],
      team: [],
    };
  }
}
function renderProjectMilestones(milestones) {
  const milestonesContainer = document.getElementById(
    "project-milestones-list",
  );
  if (!milestonesContainer) return;

  if (!Array.isArray(milestones) || milestones.length === 0) {
    milestonesContainer.innerHTML = `
      <div class="card">
        <div class="font-semibold mb-sm">אבני דרך / משימות פרויקט</div>
        <div class="text-sm text-neutral-600">לא נמצאו אבני דרך לפרויקט זה.</div>
      </div>
    `;
    return;
  }

  milestonesContainer.innerHTML = "";

  milestones.forEach((milestone) => {
    const statusInfo = getProjectStatusMeta(milestone.status);
    const employees = Array.isArray(milestone.employees)
      ? milestone.employees
      : [];
    const contractors = Array.isArray(milestone.contractors)
      ? milestone.contractors
      : [];

    const employeeNames = employees
      .map((employee) => employee.employeeName)
      .filter(Boolean);

    const contractorNames = contractors
      .map((contractor) => contractor.contractorName)
      .filter(Boolean);

    const assignedEmployeesText =
      employeeNames.length > 0 ? employeeNames.join(", ") : "-";

    const assignedContractorsText =
      contractorNames.length > 0 ? contractorNames.join(", ") : "-";

    const plannedStartText = formatDate(milestone.plannedStart, {
      includeTime: true,
    });

    const plannedEndText = formatDate(milestone.plannedEnd, {
      includeTime: true,
    });

    const closedAtText = formatDate(milestone.closedAt, {
      includeTime: true,
    });

    const estimatedHoursText =
      milestone.estimatedHours != null ? String(milestone.estimatedHours) : "-";

    const priorityText = milestone.priority || "-";
    const requiredRoleText = milestone.requiredRole || "-";

    const lockedBadge = milestone.isLocked
      ? `<span class="badge badge-warning">נעול</span>`
      : "";

    const milestoneCard = document.createElement("div");
    milestoneCard.className = "card milestone-card";

    milestoneCard.innerHTML = `
  <div class="milestone-card-header">
    <div class="milestone-card-main">
      <div class="milestone-card-title-row">
        <h4 class="milestone-card-title">${escapeHtml(milestone.title || "-")}</h4>
        <span class="badge ${escapeHtml(statusInfo.badgeClass)}">${escapeHtml(statusInfo.display)}</span>
        ${lockedBadge}
      </div>

      <div class="milestone-card-description">
        ${escapeHtml(milestone.description || "ללא תיאור")}
      </div>
    </div>

    <div class="milestone-card-actions">
      <button
        type="button"
        class="btn btn-outline btn-sm milestone-edit-btn"
        data-milestone-id="${escapeHtml(String(milestone.workItemId))}"
      >
        ערוך
      </button>

      <button
        type="button"
        class="btn btn-outline btn-sm milestone-delete-btn"
        data-milestone-id="${escapeHtml(String(milestone.workItemId))}"
      >
        בטל
      </button>
    </div>
  </div>

  <div class="milestone-card-grid">
    <div class="milestone-card-section">
      <div class="milestone-card-section-title">פרטי משימה</div>
      <div class="milestone-info-row"><span>מזהה</span><strong>#${escapeHtml(String(milestone.workItemId || "-"))}</strong></div>
      <div class="milestone-info-row"><span>סוג</span><strong>${escapeHtml(milestone.workType || "-")}</strong></div>
      <div class="milestone-info-row"><span>עדיפות</span><strong>${escapeHtml(priorityText)}</strong></div>
      <div class="milestone-info-row"><span>תפקיד נדרש</span><strong>${escapeHtml(requiredRoleText)}</strong></div>
      <div class="milestone-info-row"><span>הערכת שעות</span><strong>${escapeHtml(estimatedHoursText)}</strong></div>
    </div>

    <div class="milestone-card-section">
      <div class="milestone-card-section-title">תאריכים</div>
      <div class="milestone-info-row"><span>תאריך יצירה</span><strong>${escapeHtml(formatDate(milestone.createdAt))}</strong></div>
      <div class="milestone-info-row"><span>תחילה מתוכננת</span><strong>${escapeHtml(plannedStartText)}</strong></div>
      <div class="milestone-info-row"><span>סיום מתוכנן</span><strong>${escapeHtml(plannedEndText)}</strong></div>
      <div class="milestone-info-row"><span>תאריך סגירה</span><strong>${escapeHtml(closedAtText)}</strong></div>
    </div>
  </div>

  <div class="milestone-card-assignments">
    <div class="milestone-info-row">
      <span>עובדים משויכים</span>
      <strong>${escapeHtml(assignedEmployeesText)}</strong>
    </div>
    <div class="milestone-info-row">
      <span>קבלנים משויכים</span>
      <strong>${escapeHtml(assignedContractorsText)}</strong>
    </div>
  </div>
`;

    milestonesContainer.appendChild(milestoneCard);
  });
  attachMilestoneCardHandlers();
}

function attachMilestoneCardHandlers() {
  // Edit
  document.querySelectorAll(".milestone-edit-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      const milestoneId = Number(btn.dataset.milestoneId);

      const milestone = currentProjectMilestones.find(
        (m) => Number(m.workItemId) === milestoneId,
      );

      if (!milestone) {
        alert("אבן דרך לא נמצאה");
        return;
      }

      openMilestoneForm(milestone);
    });
  });

  // Soft Delete (Cancel)
  document.querySelectorAll(".milestone-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();

      const milestoneId = Number(btn.dataset.milestoneId);

      const confirmDelete = confirm("האם לבטל את אבן הדרך?");
      if (!confirmDelete) return;

      try {
        await cancelMilestoneApi(milestoneId);

        alert("אבן הדרך בוטלה");

        const currentProject = projectRows[currentProjectId];

        currentProjectMilestones =
          await loadProjectMilestonesFromApi(currentProjectId);

        renderProjectMilestones(currentProjectMilestones);
      } catch (error) {
        console.error("Cancel milestone failed:", error);
        alert("ביטול אבן הדרך נכשל");
      }
    });
  });
}

async function cancelMilestoneApi(milestoneId) {
  await apiRequest(`/WorkItems/milestones/${milestoneId}/cancel`, {
    method: "PUT",
  });
}

function openMilestoneForm(milestone = null) {
  const formCard = document.getElementById("milestone-form-card");
  if (!formCard) return;

  formCard.style.display = "block";
  formCard.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  if (milestone) {
    // מצב עריכה
    editingMilestoneId = milestone.workItemId;

    document.getElementById("milestone-form-title").textContent =
      "עריכת אבן דרך";

    document.getElementById("milestone-title-input").value =
      milestone.title || "";

    document.getElementById("milestone-status-input").value =
      milestone.status || "Planned";

    document.getElementById("milestone-billing-type-input").value =
      milestone.billingType || "Internal";

    document.getElementById("milestone-priority-input").value =
      milestone.priority || "";

    document.getElementById("milestone-planned-start-input").value =
      milestone.plannedStart
        ? formatDate(milestone.plannedStart, {
            target: "input",
            includeTime: true,
          })
        : "";

    document.getElementById("milestone-planned-end-input").value =
      milestone.plannedEnd
        ? formatDate(milestone.plannedEnd, {
            target: "input",
            includeTime: true,
          })
        : "";

    document.getElementById("milestone-estimated-hours-input").value =
      milestone.estimatedHours ?? "";

    document.getElementById("milestone-required-role-input").value =
      milestone.requiredRole || "";

    document.getElementById("milestone-description-input").value =
      milestone.description || "";

    document.getElementById("milestone-is-locked-input").checked =
      !!milestone.isLocked;
  } else {
    // מצב יצירה
    editingMilestoneId = null;

    document.getElementById("milestone-form-title").textContent =
      "אבן דרך חדשה";

    document.getElementById("milestone-title-input").value = "";
    document.getElementById("milestone-status-input").value = "Planned";
    document.getElementById("milestone-billing-type-input").value = "Internal";
    document.getElementById("milestone-priority-input").value = "";
    document.getElementById("milestone-planned-start-input").value = "";
    document.getElementById("milestone-planned-end-input").value = "";
    document.getElementById("milestone-estimated-hours-input").value = "";
    document.getElementById("milestone-required-role-input").value = "";
    document.getElementById("milestone-description-input").value = "";
    document.getElementById("milestone-is-locked-input").checked = false;
  }
}

function closeMilestoneForm() {
  const formCard = document.getElementById("milestone-form-card");
  if (!formCard) return;

  formCard.style.display = "none";
  editingMilestoneId = null;
}

const milestoneAddBtn = document.getElementById("milestone-add-btn");
const milestoneCancelBtn = document.getElementById("milestone-cancel-btn");

if (milestoneAddBtn) {
  milestoneAddBtn.addEventListener("click", () => {
    openMilestoneForm();
  });
}

if (milestoneCancelBtn) {
  milestoneCancelBtn.addEventListener("click", () => {
    closeMilestoneForm();
  });
}

function collectMilestoneFormData() {
  const title =
    document.getElementById("milestone-title-input")?.value.trim() || "";
  const status =
    document.getElementById("milestone-status-input")?.value || "Planned";
  const billingType =
    document.getElementById("milestone-billing-type-input")?.value ||
    "Internal";
  const priority =
    document.getElementById("milestone-priority-input")?.value || null;
  const plannedStart =
    document.getElementById("milestone-planned-start-input")?.value || null;
  const plannedEnd =
    document.getElementById("milestone-planned-end-input")?.value || null;
  const estimatedHoursValue =
    document.getElementById("milestone-estimated-hours-input")?.value || "";
  const requiredRole =
    document.getElementById("milestone-required-role-input")?.value.trim() ||
    null;
  const description =
    document.getElementById("milestone-description-input")?.value.trim() ||
    null;
  const isLocked =
    document.getElementById("milestone-is-locked-input")?.checked || false;

  if (!title) {
    alert("יש להזין שם אבן דרך");
    return null;
  }

  if (plannedStart && plannedEnd) {
    const startDate = new Date(plannedStart);
    const endDate = new Date(plannedEnd);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      alert("אחד מתאריכי התכנון אינו תקין");
      return null;
    }

    if (endDate < startDate) {
      alert("תאריך סיום מתוכנן לא יכול להיות לפני תאריך התחלה מתוכנן");
      return null;
    }
  }

  const currentProject = projectRows[currentProjectId];

  if (!currentProject || !currentProject.workItemId) {
    alert("לא נמצא פרויקט פעיל");
    return null;
  }

  const raw = currentProject.raw || {};

  const customerId = Number(raw.customerId || currentProject.customerId || 0);
  const siteId = Number(raw.siteId || currentProject.siteId || 0);

  if (customerId <= 0) {
    alert("חסר לקוח בפרויקט");
    return null;
  }

  if (siteId <= 0) {
    alert("חסר אתר בפרויקט");
    return null;
  }

  return {
    title,
    description,
    status,
    billingType,
    customerId,
    siteId,
    plannedStart,
    plannedEnd,
    estimatedHours: estimatedHoursValue ? Number(estimatedHoursValue) : null,
    priority,
    requiredRole,
    isLocked,
    employees: [],
    contractors: [],
  };
}

async function saveMilestoneFromForm() {
  const saveBtn = document.getElementById("milestone-save-btn");

  const formData = collectMilestoneFormData();
  if (!formData) return;

  const currentProject = projectRows[currentProjectId];

  if (!currentProject || !currentProject.workItemId) {
    alert("לא נמצא פרויקט פעיל");
    return;
  }

  try {
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = "שומר...";
    }

    if (editingMilestoneId) {
      await updateMilestoneApi(editingMilestoneId, formData);
      alert("אבן הדרך עודכנה בהצלחה");
    } else {
      await createMilestoneApi(currentProject.workItemId, formData);
      alert("אבן הדרך נוספה בהצלחה");
    }

    closeMilestoneForm();

    currentProjectMilestones =
      await loadProjectMilestonesFromApi(currentProjectId);

    renderProjectMilestones(currentProjectMilestones);
  } catch (error) {
    console.error("Save milestone failed:", error);
    alert(error.message || "שמירת אבן הדרך נכשלה");
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = "שמור אבן דרך";
    }
  }
}

const milestoneSaveBtn = document.getElementById("milestone-save-btn");

if (milestoneSaveBtn) {
  milestoneSaveBtn.addEventListener("click", () => {
    saveMilestoneFromForm();
  });
}

async function createMilestoneApi(projectId, data) {
  const response = await apiRequest(`/WorkItems/${projectId}/milestones`, {
    method: "POST",
    body: JSON.stringify({
      title: data.title,
      description: data.description,
      status: data.status,
      billingType: data.billingType,
      customerId: data.customerId,
      siteId: data.siteId,
      plannedStart: data.plannedStart,
      plannedEnd: data.plannedEnd,
      estimatedHours: data.estimatedHours,
      priority: data.priority,
      requiredRole: data.requiredRole,
      isLocked: data.isLocked,
      employees: data.employees || [],
      contractors: data.contractors || [],
    }),
  });

  return response;
}

async function updateMilestoneApi(milestoneId, data) {
  await apiRequest(`/WorkItems/milestones/${milestoneId}`, {
    method: "PUT",
    body: JSON.stringify({
      workItemId: milestoneId,
      title: data.title,
      description: data.description,
      status: data.status,
      billingType: data.billingType,
      customerId: data.customerId,
      siteId: data.siteId,
      plannedStart: data.plannedStart,
      plannedEnd: data.plannedEnd,
      estimatedHours: data.estimatedHours,
      priority: data.priority,
      requiredRole: data.requiredRole,
      isLocked: data.isLocked,
      employees: data.employees || [],
      contractors: data.contractors || [],
    }),
  });
}

async function loadProjectsFromApi() {
  try {
    const projects = await apiRequest("/WorkItems/projects-list");

    console.log("PROJECTS FROM API:", projects);

    Object.keys(projectRows).forEach((key) => delete projectRows[key]);

    const mappedProjects = Array.isArray(projects)
      ? projects.map((project) => {
          const statusInfo = getProjectStatusMeta(project.status);
          const billingTypeInfo = getBillingTypeMeta(project.billingType);

          return {
            id: `project-${project.workItemId}`,
            workItemId: project.workItemId,
            name: project.title || "-",
            customer: project.customerName || "-",
            managers:
              project.projectManagerName && project.projectManagerName !== "-"
                ? [project.projectManagerName]
                : [],
            status: statusInfo.display,
            statusCode: statusInfo.code,
            statusBadgeClass: statusInfo.badgeClass,
            openDate: formatDate(project.createdAt),
            area: project.siteName || "-",
            closeDate: project.dealCloseDate
              ? formatDate(project.dealCloseDate)
              : "-",
            number: project.projectNumber || `P-${project.workItemId}`,
            financeNumber: project.financeProjectNumber || "-",
            invoiceNumber: project.invoiceNumber || "-",
            billingType: billingTypeInfo.display,
            billingTypeCode: billingTypeInfo.code,
            team: [],
            raw: {
              workItemId: project.workItemId,
              title: project.title || "",
              status: project.status || "",
              createdAt: project.createdAt || null,
              customerId: project.customerId || null,
              siteId: project.siteId || null,
              customerName: project.customerName || "",
              siteName: project.siteName || "",
              projectManagerName: project.projectManagerName || "",
              dealCloseDate: project.dealCloseDate || null,
              financeProjectNumber: project.financeProjectNumber || "",
              invoiceNumber: project.invoiceNumber || "",
              billingType: project.billingType || "",
            },
          };
        })
      : [];

    mappedProjects.forEach((project) => {
      projectRows[project.id] = {
        name: project.name,
        customer: project.customer,
        managers: Array.isArray(project.managers) ? project.managers : [],
        status: project.status,
        statusCode: project.statusCode,
        openDate: project.openDate,
        closeDate: project.closeDate,
        number: project.number,
        financeNumber: project.financeNumber,
        invoiceNumber: project.invoiceNumber,
        billingType: project.billingType,
        billingTypeCode: project.billingTypeCode,
        team: project.team,
        workItemId: project.workItemId,
        raw: project.raw,
      };
    });

    renderProjectsTable(mappedProjects);
    handleProjectDeepLink();
  } catch (error) {
    console.error("Failed to load projects from API:", error);
  }
}

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
      <td><span class="badge ${escapeHtml(project.statusBadgeClass)}">${escapeHtml(project.status)}</span></td>
      <td>${escapeHtml(project.openDate)}</td>
      <td>${escapeHtml(project.area)}</td>
    `;

    tr.addEventListener("click", () => openProject(project.id));
    tbody.appendChild(tr);
  });
}

async function loadProjectDetailsFromApi(projectId) {
  const existingProject = projectRows[projectId];
  if (!existingProject || !existingProject.workItemId) {
    return existingProject || null;
  }

  try {
    const workItem = await apiRequest(
      `/WorkItems/${existingProject.workItemId}`,
    );

    const statusInfo = getProjectStatusMeta(workItem.status);
    const billingTypeInfo = getBillingTypeMeta(workItem.billingType);

    projectRows[projectId] = {
      ...existingProject,
      name: workItem.title || existingProject.name || "-",
      customer: getCustomerDisplayName(workItem.customerId),
      managers: Array.isArray(existingProject.managers)
        ? existingProject.managers
        : [],
      status: statusInfo.display,
      statusCode: statusInfo.code,
      openDate: formatDate(workItem.createdAt),
      closeDate: workItem.dealCloseDate
        ? formatDate(workItem.dealCloseDate)
        : "-",
      number: `P-${workItem.workItemId}`,
      financeNumber: workItem.financeProjectNumber || "-",
      invoiceNumber: workItem.invoiceNumber || "-",
      billingType: billingTypeInfo.display,
      billingTypeCode: billingTypeInfo.code,
      siteId: workItem.siteId,
      area: getSiteDisplayName(workItem.siteId),
      team: Array.isArray(existingProject.team) ? existingProject.team : [],
      workItemId: workItem.workItemId,
      raw: {
        ...workItem,
        dealCloseDate: workItem.dealCloseDate || null,
        financeProjectNumber: workItem.financeProjectNumber || "",
        invoiceNumber: workItem.invoiceNumber || "",
        billingType: workItem.billingType || "",
        status: workItem.status || "",
      },
      description: workItem.description || "",
    };

    return projectRows[projectId];
  } catch (error) {
    console.error(`Failed to load project details for ${projectId}:`, error);
    return existingProject;
  }
}

// BOQ add row
const boqAddRowBtn = document.getElementById("boq-add-row");
if (boqAddRowBtn) {
  boqAddRowBtn.addEventListener("click", () => {
    const tbodyEdit = document.getElementById("boq-tbody-edit");
    if (!tbodyEdit) return;

    const newId = `boq-${Date.now()}`;
    const tr = document.createElement("tr");
    tr.dataset.boqId = newId;
    tr.innerHTML = `
            <td>
                <input type="text" class="input input-sm boq-item-input" placeholder="שם פריט">
            </td>
            <td>
                <input type="number" class="input input-sm boq-qty-input" value="0" min="0" placeholder="0">
            </td>
            <td>
                <select class="input input-sm boq-unit-input">
                    <option value="יח׳" selected>יח׳</option>
                    <option value="מ׳">מ׳</option>
                    <option value="מ״ר">מ״ר</option>
                    <option value="סט">סט</option>
                </select>
            </td>
            <td>
                <button type="button" class="btn-icon-only btn-sm boq-remove-btn" data-remove-boq="${newId}" aria-label="הסר">
                    <i data-lucide="trash-2" class="icon" aria-hidden="true"></i>
                </button>
            </td>
        `;
    tbodyEdit.appendChild(tr);
    attachBOQHandlers();
    if (window.lucide) lucide.createIcons();
  });
}

// Drawings editing functions
function switchDrawingsToEdit() {
  document.getElementById("drawings-view").style.display = "none";
  document.getElementById("drawings-edit").style.display = "block";

  // Populate edit list from view list
  const listView = document.getElementById("drawings-list-view");
  const listEdit = document.getElementById("drawings-list-edit");
  if (!listView || !listEdit) return;

  listEdit.innerHTML = "";
  const cards = listView.querySelectorAll(".file-card");

  cards.forEach((card) => {
    const nameEl = card.querySelector(".file-name");
    const metaEl = card.querySelector(".file-meta");
    if (!nameEl || !metaEl) return;

    // Extract name - get all text nodes, skip icon
    const nameText = Array.from(nameEl.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .join(" ")
      .trim();
    const meta = metaEl.textContent.trim();
    const typeMatch = meta.match(/סוג:\s*(\w+)/);
    const dateMatch = meta.match(/עודכן:\s*(\d{2}\/\d{2}\/\d{4})/);
    const type = typeMatch ? typeMatch[1] : "PDF";
    const date = dateMatch ? dateMatch[1] : "";
    const icon = type === "PDF" ? "file-text" : "drafting-compass";
    const drawingId = card.dataset.drawingId || `draw-${Date.now()}`;

    const newCard = document.createElement("div");
    newCard.className = "file-card";
    newCard.dataset.drawingId = drawingId;
    newCard.innerHTML = `
            <div class="file-name">
                <i data-lucide="${icon}" class="icon" aria-hidden="true"></i>
                ${escapeHtml(nameText || "ללא שם")}
            </div>
            <div class="file-meta">סוג: ${type} • עודכן: ${date}</div>
            <button type="button" class="file-remove" data-remove-drawing="${drawingId}" aria-label="הסר">×</button>
        `;
    listEdit.appendChild(newCard);
  });

  attachDrawingsHandlers();
  if (window.lucide) lucide.createIcons();
}

function switchDrawingsToView() {
  document.getElementById("drawings-view").style.display = "block";
  document.getElementById("drawings-edit").style.display = "none";
  document.getElementById("drawing-add-form").style.display = "none";
}

function commitDrawingsChanges() {
  const listEdit = document.getElementById("drawings-list-edit");
  const listView = document.getElementById("drawings-list-view");
  if (!listEdit || !listView) return;

  // Rebuild view list from edit list
  listView.innerHTML = "";
  const cards = listEdit.querySelectorAll(".file-card");

  cards.forEach((card) => {
    const nameEl = card.querySelector(".file-name");
    const metaEl = card.querySelector(".file-meta");
    if (!nameEl || !metaEl) return;

    // Extract name - get all text nodes, skip icon
    const nameText = Array.from(nameEl.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .join(" ")
      .trim();
    const meta = metaEl.textContent.trim();
    const typeMatch = meta.match(/סוג:\s*(\w+)/);
    const dateMatch = meta.match(/עודכן:\s*(\d{2}\/\d{2}\/\d{4})/);
    const type = typeMatch ? typeMatch[1] : "PDF";
    const date = dateMatch ? dateMatch[1] : "";
    const icon = type === "PDF" ? "file-text" : "drafting-compass";
    const drawingId = card.dataset.drawingId;

    const newCard = document.createElement("div");
    newCard.className = "file-card";
    newCard.dataset.drawingId = drawingId;
    newCard.innerHTML = `
            <div class="file-name">
                <i data-lucide="${icon}" class="icon" aria-hidden="true"></i>
                ${escapeHtml(nameText || "ללא שם")}
            </div>
            <div class="file-meta">סוג: ${type} • עודכן: ${date}</div>
        `;
    listView.appendChild(newCard);
  });

  if (window.lucide) lucide.createIcons();
}

function restoreDrawingsFromSnapshot() {
  if (!projectSnapshot || !projectSnapshot.drawings) {
    // If no snapshot, restore to default
    const listView = document.getElementById("drawings-list-view");
    if (listView) {
      listView.innerHTML = `
                <div class="file-card" data-drawing-id="draw-1">
                    <div class="file-name">
                        <i data-lucide="file-text" class="icon" aria-hidden="true"></i>
                        תכנון כללי – Rev B.pdf
                    </div>
                    <div class="file-meta">סוג: PDF • עודכן: 15/01/2025</div>
                </div>
                <div class="file-card" data-drawing-id="draw-2">
                    <div class="file-name">
                        <i data-lucide="file-text" class="icon" aria-hidden="true"></i>
                        חיווט – Rev A.pdf
                    </div>
                    <div class="file-meta">סוג: PDF • עודכן: 10/01/2025</div>
                </div>
                <div class="file-card" data-drawing-id="draw-3">
                    <div class="file-name">
                        <i data-lucide="drafting-compass" class="icon" aria-hidden="true"></i>
                        מיקום ציוד.dwg
                    </div>
                    <div class="file-meta">סוג: DWG • עודכן: 08/01/2025</div>
                </div>
            `;
      if (window.lucide) lucide.createIcons();
    }
    return;
  }

  const listView = document.getElementById("drawings-list-view");
  if (!listView) return;

  listView.innerHTML = "";
  projectSnapshot.drawings.forEach((drawing) => {
    const icon = drawing.type === "PDF" ? "file-text" : "drafting-compass";
    const card = document.createElement("div");
    card.className = "file-card";
    card.dataset.drawingId = drawing.id;
    card.innerHTML = `
            <div class="file-name">
                <i data-lucide="${icon}" class="icon" aria-hidden="true"></i>
                ${escapeHtml(drawing.name)}
            </div>
            <div class="file-meta">סוג: ${drawing.type} • עודכן: ${drawing.date || ""}</div>
        `;
    listView.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

function attachDrawingsHandlers() {
  // Remove drawing handlers
  document.querySelectorAll(".file-remove").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const drawingId = btn.dataset.removeDrawing;
      const card = document.querySelector(`[data-drawing-id="${drawingId}"]`);
      if (card) card.remove();
    });
  });
}

// Drawing add form handlers
const drawingAddBtn = document.getElementById("drawing-add-btn");
const drawingAddForm = document.getElementById("drawing-add-form");
const drawingAddConfirm = document.getElementById("drawing-add-confirm");
const drawingAddCancel = document.getElementById("drawing-add-cancel");

if (drawingAddBtn) {
  drawingAddBtn.addEventListener("click", () => {
    drawingAddForm.style.display = "block";
  });
}

if (drawingAddCancel) {
  drawingAddCancel.addEventListener("click", () => {
    drawingAddForm.style.display = "none";
    document.getElementById("drawing-name-input").value = "";
    document.getElementById("drawing-type-input").value = "PDF";
    document.getElementById("drawing-date-input").value = "";
    document.getElementById("drawing-note-input").value = "";
  });
}

if (drawingAddConfirm) {
  drawingAddConfirm.addEventListener("click", () => {
    const name = document.getElementById("drawing-name-input").value.trim();
    const type = document.getElementById("drawing-type-input").value;
    const date = document.getElementById("drawing-date-input").value;
    const note = document.getElementById("drawing-note-input").value.trim();

    if (!name) {
      alert("יש להזין שם קובץ");
      return;
    }

    const dateStr = date
      ? formatDate(date)
      : new Date().toLocaleDateString("he-IL");
    const icon = type === "PDF" ? "file-text" : "drafting-compass";
    const newId = `draw-${Date.now()}`;

    const listEdit = document.getElementById("drawings-list-edit");
    const card = document.createElement("div");
    card.className = "file-card";
    card.dataset.drawingId = newId;
    card.innerHTML = `
            <div class="file-name">
                <i data-lucide="${icon}" class="icon" aria-hidden="true"></i>
                ${escapeHtml(name)}
            </div>
            <div class="file-meta">סוג: ${type} • עודכן: ${dateStr}</div>
            <button type="button" class="file-remove" data-remove-drawing="${newId}" aria-label="הסר">×</button>
        `;
    listEdit.appendChild(card);
    attachDrawingsHandlers();
    if (window.lucide) lucide.createIcons();

    drawingAddForm.style.display = "none";
    document.getElementById("drawing-name-input").value = "";
    document.getElementById("drawing-type-input").value = "PDF";
    document.getElementById("drawing-date-input").value = "";
    document.getElementById("drawing-note-input").value = "";
  });
}

// Equipment/Products editing functions
function switchEquipmentToEdit() {
  document.getElementById("equipment-view").style.display = "none";
  document.getElementById("equipment-edit").style.display = "block";

  // Populate edit cards from view table
  const tbodyView = document.getElementById("equipment-tbody-view");
  const cardsEdit = document.getElementById("equipment-cards-edit");
  if (!tbodyView || !cardsEdit) return;

  cardsEdit.innerHTML = "";
  const rows = tbodyView.querySelectorAll("tr");

  rows.forEach((row, idx) => {
    const cells = row.querySelectorAll("td");
    if (cells.length >= 4) {
      const system = cells[0]?.textContent.trim() || "";
      const item = cells[1]?.textContent.trim() || "";
      const location = cells[2]?.textContent.trim() || "";
      const statusBadge = cells[3]?.querySelector(".badge");
      const status = statusBadge ? statusBadge.textContent.trim() : "ממתין";
      const equipmentId = row.dataset.equipmentId || `eq-${idx}`;

      const card = document.createElement("div");
      card.className = "card equipment-card";
      card.dataset.equipmentId = equipmentId;
      card.dataset.equipmentSystem = system;
      const statusValue =
        status.includes("מותקן") || status.includes("הותקן")
          ? "מותקן"
          : status.includes("בהתקנה")
            ? "בהתקנה"
            : status.includes("בהזמנה")
              ? "בהזמנה"
              : "ממתין";
      card.innerHTML = `
                <div class="flex justify-content-between align-items-start mb-sm">
                    <div class="flex-1">
                        <div class="details-field">
                            <div class="details-field-label">שם</div>
                            <input type="text" class="input input-sm equipment-name-input" value="${escapeHtml(item)}" data-equipment-name="${equipmentId}" placeholder="שם מוצר/מערכת">
                        </div>
                    </div>
                    <div class="flex gap-xs">
                        <button type="button" class="btn-icon-only btn-sm equipment-move-up" data-move-up="${equipmentId}" aria-label="למעלה">↑</button>
                        <button type="button" class="btn-icon-only btn-sm equipment-move-down" data-move-down="${equipmentId}" aria-label="למטה">↓</button>
                    </div>
                </div>
                <div class="details-field">
                    <div class="details-field-label">סטטוס</div>
                    <select class="input input-sm equipment-status-select" data-equipment-status="${equipmentId}">
                        <option value="מותקן" ${statusValue === "מותקן" ? "selected" : ""}>מותקן</option>
                        <option value="בהתקנה" ${statusValue === "בהתקנה" ? "selected" : ""}>בהתקנה</option>
                        <option value="בהזמנה" ${statusValue === "בהזמנה" ? "selected" : ""}>בהזמנה</option>
                        <option value="ממתין" ${statusValue === "ממתין" ? "selected" : ""}>ממתין</option>
                    </select>
                </div>
                <div class="details-field">
                    <div class="details-field-label">מיקום (אופציונלי)</div>
                    <input type="text" class="input input-sm equipment-location-input" value="${escapeHtml(location)}" data-equipment-location="${equipmentId}" placeholder="מיקום">
                </div>
            `;
      cardsEdit.appendChild(card);
    }
  });

  attachEquipmentHandlers();
}

function switchEquipmentToView() {
  document.getElementById("equipment-view").style.display = "block";
  document.getElementById("equipment-edit").style.display = "none";
  document.getElementById("equipment-add-form").style.display = "none";
}

function commitEquipmentChanges() {
  const cardsEdit = document.getElementById("equipment-cards-edit");
  const tbodyView = document.getElementById("equipment-tbody-view");
  if (!cardsEdit || !tbodyView) return;

  // Rebuild view table from edit cards
  tbodyView.innerHTML = "";
  const cards = cardsEdit.querySelectorAll(".equipment-card");

  cards.forEach((card) => {
    const nameInput = card.querySelector(".equipment-name-input");
    const locationInput = card.querySelector(".equipment-location-input");
    const statusSelect = card.querySelector(".equipment-status-select");

    if (!nameInput || !statusSelect) return;

    const item = nameInput.value.trim();
    if (!item) return; // Skip empty items

    const system = card.dataset.equipmentSystem || "מערכת";
    const location = locationInput ? locationInput.value.trim() : "";
    const status = statusSelect.value;
    const equipmentId = card.dataset.equipmentId;

    const tr = document.createElement("tr");
    tr.dataset.equipmentId = equipmentId;
    const statusClass = getEquipmentStatusBadgeClass(status);
    // Map edit status values to display text
    let statusDisplay = status;
    if (status === "מותקן") {
      statusDisplay = "הותקן";
    } else if (status === "בהתקנה") {
      statusDisplay = "בהתקנה";
    } else if (status === "בהזמנה") {
      statusDisplay = "בהזמנה";
    } else if (status === "ממתין") {
      statusDisplay = "בהכנה";
    }
    tr.innerHTML = `
            <td>${escapeHtml(system)}</td>
            <td>${escapeHtml(item)}</td>
            <td>${escapeHtml(location || "")}</td>
            <td><span class="badge ${statusClass}">${escapeHtml(statusDisplay)}</span></td>
        `;
    tbodyView.appendChild(tr);
  });
}

function restoreEquipmentFromSnapshot() {
  if (!projectSnapshot || !projectSnapshot.equipment) {
    // If no snapshot, restore to default
    const tbodyView = document.getElementById("equipment-tbody-view");
    if (tbodyView) {
      tbodyView.innerHTML = `
                <tr data-equipment-id="eq-1">
                    <td>חשמל חכם</td>
                    <td>בקר מרכזי</td>
                    <td>ארון חשמל</td>
                    <td><span class="badge badge-primary">בהתקנה</span></td>
                </tr>
                <tr data-equipment-id="eq-2">
                    <td>בקרה</td>
                    <td>מצלמות IP</td>
                    <td>חצר + כניסה</td>
                    <td><span class="badge badge-warning">בהכנה</span></td>
                </tr>
                <tr data-equipment-id="eq-3">
                    <td>תקשורת</td>
                    <td>ארון תקשורת</td>
                    <td>מחסן</td>
                    <td><span class="badge badge-success">הותקן</span></td>
                </tr>
            `;
    }
    return;
  }

  const tbodyView = document.getElementById("equipment-tbody-view");
  if (!tbodyView) return;

  tbodyView.innerHTML = "";
  projectSnapshot.equipment.forEach((eq) => {
    const tr = document.createElement("tr");
    tr.dataset.equipmentId = eq.id;
    const statusClass = getEquipmentStatusBadgeClass(eq.status);
    // Map edit status values back to display text
    let statusDisplay = eq.status;
    if (eq.status === "מותקן") {
      statusDisplay = "הותקן";
    } else if (eq.status === "בהתקנה") {
      statusDisplay = "בהתקנה";
    } else if (eq.status === "בהזמנה") {
      statusDisplay = "בהזמנה";
    } else if (eq.status === "ממתין") {
      statusDisplay = "בהכנה";
    }
    tr.innerHTML = `
            <td>${escapeHtml(eq.system)}</td>
            <td>${escapeHtml(eq.item)}</td>
            <td>${escapeHtml(eq.location || "")}</td>
            <td><span class="badge ${statusClass}">${escapeHtml(statusDisplay)}</span></td>
        `;
    tbodyView.appendChild(tr);
  });
}

function getEquipmentStatusBadgeClass(status) {
  if (!status) return "badge-neutral";
  if (status.includes("מותקן") || status.includes("הותקן"))
    return "badge-success";
  if (status.includes("בהתקנה")) return "badge-primary";
  if (status.includes("בהזמנה")) return "badge-warning";
  if (status.includes("ממתין") || status.includes("בהכנה"))
    return "badge-warning";
  return "badge-neutral";
}

function attachEquipmentHandlers() {
  // Reorder handlers
  document.querySelectorAll(".equipment-move-up").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const equipmentId = btn.dataset.moveUp;
      const card = document.querySelector(
        `[data-equipment-id="${equipmentId}"]`,
      );
      const prev = card?.previousElementSibling;
      if (card && prev && prev.classList.contains("equipment-card")) {
        card.parentNode.insertBefore(card, prev);
      }
    });
  });

  document.querySelectorAll(".equipment-move-down").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const equipmentId = btn.dataset.moveDown;
      const card = document.querySelector(
        `[data-equipment-id="${equipmentId}"]`,
      );
      const next = card?.nextElementSibling;
      if (card && next && next.classList.contains("equipment-card")) {
        card.parentNode.insertBefore(next, card);
      }
    });
  });
}

// Equipment add form handlers
const equipmentAddBtn = document.getElementById("equipment-add-btn");
const equipmentAddForm = document.getElementById("equipment-add-form");
const equipmentAddConfirm = document.getElementById("equipment-add-confirm");
const equipmentAddCancel = document.getElementById("equipment-add-cancel");

if (equipmentAddBtn) {
  equipmentAddBtn.addEventListener("click", () => {
    equipmentAddForm.style.display = "block";
  });
}

if (equipmentAddCancel) {
  equipmentAddCancel.addEventListener("click", () => {
    equipmentAddForm.style.display = "none";
    document.getElementById("equipment-name-input").value = "";
    document.getElementById("equipment-status-input").value = "ממתין";
    document.getElementById("equipment-location-input").value = "";
  });
}

if (equipmentAddConfirm) {
  equipmentAddConfirm.addEventListener("click", () => {
    const name = document.getElementById("equipment-name-input").value.trim();
    const status = document.getElementById("equipment-status-input").value;
    const location = document
      .getElementById("equipment-location-input")
      .value.trim();

    if (!name) {
      alert("יש להזין שם מוצר/מערכת");
      return;
    }

    const newId = `eq-${Date.now()}`;
    const cardsEdit = document.getElementById("equipment-cards-edit");
    const card = document.createElement("div");
    card.className = "card equipment-card";
    card.dataset.equipmentId = newId;
    card.dataset.equipmentSystem = "מערכת חדשה";
    card.innerHTML = `
            <div class="flex justify-content-between align-items-start mb-sm">
                <div class="flex-1">
                    <div class="details-field">
                        <div class="details-field-label">שם</div>
                        <input type="text" class="input input-sm equipment-name-input" value="${escapeHtml(name)}" data-equipment-name="${newId}" placeholder="שם מוצר/מערכת">
                    </div>
                </div>
                <div class="flex gap-xs">
                    <button type="button" class="btn-icon-only btn-sm equipment-move-up" data-move-up="${newId}" aria-label="למעלה">↑</button>
                    <button type="button" class="btn-icon-only btn-sm equipment-move-down" data-move-down="${newId}" aria-label="למטה">↓</button>
                </div>
            </div>
            <div class="details-field">
                <div class="details-field-label">סטטוס</div>
                <select class="input input-sm equipment-status-select" data-equipment-status="${newId}">
                    <option value="מותקן">מותקן</option>
                    <option value="בהתקנה">בהתקנה</option>
                    <option value="בהזמנה">בהזמנה</option>
                    <option value="ממתין" ${status === "ממתין" ? "selected" : ""}>ממתין</option>
                </select>
            </div>
            <div class="details-field">
                <div class="details-field-label">מיקום (אופציונלי)</div>
                <input type="text" class="input input-sm equipment-location-input" value="${escapeHtml(location)}" data-equipment-location="${newId}" placeholder="מיקום">
            </div>
        `;
    cardsEdit.appendChild(card);
    attachEquipmentHandlers();

    equipmentAddForm.style.display = "none";
    document.getElementById("equipment-name-input").value = "";
    document.getElementById("equipment-status-input").value = "ממתין";
    document.getElementById("equipment-location-input").value = "";
  });
}

// Edit mode toggle
const projEditToggle = document.getElementById("proj-edit-toggle");
if (projEditToggle) {
  projEditToggle.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (isEditMode) {
      cancelEdit();
    } else {
      await enterEditMode();
    }
  });
}

// Save/Cancel buttons
const projSaveBtn = document.getElementById("proj-save");
const projCancelBtn = document.getElementById("proj-cancel");
if (projSaveBtn) {
  projSaveBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    saveEdit();
  });
}
if (projCancelBtn) {
  projCancelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    cancelEdit();
  });
}

// New Project button
const btnNewProject = document.getElementById("btn-new-project");

if (btnNewProject) {
  btnNewProject.addEventListener("click", async () => {
    const tempProjectId = "project-new-temp";

    projectRows[tempProjectId] = {
      name: "",
      customer: "-",
      managers: [],
      status: "פתוח",
      statusCode: "Open",
      openDate: "-",
      closeDate: "-",
      number: "חדש",
      financeNumber: "-",
      invoiceNumber: "-",
      billingType: "קבוע",
      billingTypeCode: "Fixed",
      siteId: null,
      description: "",
      team: [],
      raw: {
        workType: "Project",
        billingType: "Fixed",
        status: "Open",
        customerId: null,
        siteId: null,
        siteName: "",
        description: "",
        dealCloseDate: null,
        financeProjectNumber: "",
        invoiceNumber: "",
        createdAt: null,
        closedAt: null,
        parentWorkItemId: null,
      },
    };

    isCreateMode = true;
    currentProjectId = tempProjectId;

    await openProject(tempProjectId);
    await enterEditMode();
  });
}

const projSiteAddToggle = document.getElementById("proj-site-add-toggle");
const projSiteAddForm = document.getElementById("proj-site-add-form");
const newSiteSaveBtn = document.getElementById("new-site-save-btn");
const newSiteCancelBtn = document.getElementById("new-site-cancel-btn");

if (projSiteAddToggle) {
  projSiteAddToggle.addEventListener("click", () => {
    if (!projSiteAddForm) return;

    const customerIdValue =
      document.getElementById("proj-customer-select")?.value || "";

    if (!customerIdValue) {
      alert("יש לבחור קודם לקוח לפני הוספת אתר");
      return;
    }

    const isOpen = projSiteAddForm.style.display === "block";
    projSiteAddForm.style.display = isOpen ? "none" : "block";

    if (!isOpen) {
      resetNewSiteForm();
      projSiteAddForm.style.display = "block";
    }
  });
}

if (newSiteCancelBtn) {
  newSiteCancelBtn.addEventListener("click", () => {
    resetNewSiteForm();
  });
}

if (newSiteSaveBtn) {
  newSiteSaveBtn.addEventListener("click", async () => {
    try {
      const createdSite = await createSiteFromApi();
      if (!createdSite || !createdSite.siteId) return;

      const selectedCustomerId =
        document.getElementById("proj-customer-select")?.value || "";

      await loadSitesLookup();
      populateSiteSelectOptions(createdSite.siteId, selectedCustomerId);

      const siteValueEl = document.getElementById("proj-site-id");
      if (siteValueEl) {
        siteValueEl.textContent = getSiteDisplayName(createdSite.siteId);
      }

      resetNewSiteForm();

      alert("האתר נוצר בהצלחה");
    } catch (error) {
      console.error("Create site failed:", error);
      alert(error.message || "יצירת האתר נכשלה");
    }
  });
}

// Maximize/Restore
const projDrawer = document.getElementById("project-details");
const projMaximizeBtn = document.getElementById("proj-maximize");

// Function to update maximize button label and tooltip based on current state
function updateMaximizeButtonState() {
  if (!projMaximizeBtn || !projDrawer) return;

  const isMaximized = projDrawer.classList.contains("is-maximized");
  const labelEl = projMaximizeBtn.querySelector(".modal-max-label");

  if (isMaximized) {
    // Maximized state - restore/minimize
    projMaximizeBtn.setAttribute("aria-label", "הקטן מסך");
    projMaximizeBtn.setAttribute("title", "הקטן מסך");
    if (labelEl) {
      labelEl.textContent = "הקטן מסך";
    }
  } else {
    // Normal state - maximize
    projMaximizeBtn.setAttribute("aria-label", "הגדל מסך");
    projMaximizeBtn.setAttribute("title", "הגדל מסך");
    if (labelEl) {
      labelEl.textContent = "הגדל מסך";
    }
  }
}

if (projMaximizeBtn && projDrawer) {
  projMaximizeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    projDrawer.classList.toggle("is-maximized");
    updateMaximizeButtonState();
  });
}

// --- תיקון החצים והגלילה ---

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

  // ב-RTL רוב הדפדפנים נותנים ערך 0 כשהסקרובר הכי ימני
  const pos = Math.abs(scrollLeft);

  // שליטה על השקיפות כדי לתת אינדיקציה שהגענו לסוף
  tabbarArrowStart.style.opacity = pos <= 5 ? "0.3" : "1";
  tabbarArrowEnd.style.opacity = pos >= max - 5 ? "0.3" : "1";

  // מבטל את ה-disabled כדי שהלחיצה תעבוד תמיד ולא יהיה אייקון "אין כניסה"
  tabbarArrowStart.disabled = false;
  tabbarArrowEnd.disabled = false;
}

function scrollTabbar(direction) {
  if (!tabbarScroller) return;
  const scrollAmount = 200;

  /* תיקון הכיוונים:
       direction === 'start' זה החץ הימני (שמצביע ימינה >). הוא צריך לקחת אותנו שמאלה להמשך הטאבים.
       direction === 'end' זה החץ השמאלי (שמצביע שמאלה <). הוא צריך לקחת אותנו ימינה לתחילת הטאבים.
    */
  const move = direction === "start" ? scrollAmount : -scrollAmount;

  tabbarScroller.scrollBy({
    left: move,
    behavior: "smooth",
  });
}

// לחיצה על החצים
if (tabbarScroller && tabbarArrowStart && tabbarArrowEnd) {
  tabbarScroller.addEventListener("scroll", updateTabbarArrows);
  new ResizeObserver(updateTabbarArrows).observe(tabbarScroller);

  tabbarArrowStart.addEventListener("click", (e) => {
    e.preventDefault();
    scrollTabbar("start");
  });

  tabbarArrowEnd.addEventListener("click", (e) => {
    e.preventDefault();
    scrollTabbar("end");
  });
}

// החלפת טאבים
document.querySelectorAll(".project-drawer-tabs .tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const key = tab.dataset.tab;
    document
      .querySelectorAll(".project-drawer-tabs .tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));
    tab.classList.add("active");
    const content = document.getElementById(key + "-content");
    if (content) {
      content.classList.add("active");
    }
  });
});

// Stage filter dropdown
const stageFilter = document.getElementById("stage-filter");
const stageLabel = document.getElementById("stage-label");
const stageMenu = stageFilter?.querySelector(".filter-dropdown-menu");
let currentStage = "all";

// Map table statuses to dropdown stages
function mapStatusToStage(status) {
  if (status === "פתוח") return "פתוח";
  if (status === "בתכנון") return "בתכנון";
  if (status === "תוכניות") return "תוכניות";
  if (status === "השחלה") return "השחלה";
  if (status === "ביצוע") return "ביצוע";
  if (status === "סיום") return "סיום";
  return null;
}
function filterByStage(stage) {
  currentStage = stage;
  const table = document.getElementById("projects-table");
  const rows = table.querySelectorAll("tbody tr");

  rows.forEach((row) => {
    const statusBadge = row.querySelector(".badge");
    if (!statusBadge) {
      row.style.display = "none";
      return;
    }

    const statusText = statusBadge.textContent.trim();
    const mappedStage = mapStatusToStage(statusText);

    if (stage === "all") {
      row.style.display = "";
    } else if (mappedStage === stage) {
      row.style.display = "";
    } else {
      row.style.display = "none";
    }
  });

  // Update label
  if (stageLabel) {
    const stageName = stage === "all" ? "הכל" : stage;
    stageLabel.textContent = `שלב פרויקט: ${stageName}`;
  }
}

if (stageMenu) {
  stageMenu.querySelectorAll(".filter-dropdown-item").forEach((item) => {
    item.addEventListener("click", () => {
      const stage = item.getAttribute("data-stage");
      filterByStage(stage);
    });
  });
}

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

if (window.lucide) lucide.createIcons();

window.bootProtectedPage(() => {
  loadProjectsFromApi();
});
