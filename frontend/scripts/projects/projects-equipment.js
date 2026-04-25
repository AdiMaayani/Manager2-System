// =====================================================
// Projects Equipment / Products Logic
// =====================================================
// This file contains all frontend logic for managing
// equipment/products inside a project.
//
// Responsibilities:
// - Switch between view/edit modes
// - Build editable cards from table view
// - Commit changes back to table
// - Restore from snapshot
// - Handle reorder (move up/down)
// - Handle add/remove equipment
//
// IMPORTANT:
// - No API integration here (UI only)
// - No project save logic here
// - No drawer logic here
// =====================================================

// =====================================================
// View/Edit Mode Switching
// =====================================================

// Switch equipment section to edit mode (cards UI)
function switchEquipmentToEdit() {
  document.getElementById("equipment-view").style.display = "none";
  document.getElementById("equipment-edit").style.display = "block";

  const tbodyView = document.getElementById("equipment-tbody-view");
  const cardsEdit = document.getElementById("equipment-cards-edit");

  if (!tbodyView || !cardsEdit) return;

  cardsEdit.innerHTML = "";

  const rows = tbodyView.querySelectorAll("tr");

  rows.forEach((row, idx) => {
    const cells = row.querySelectorAll("td");
    if (cells.length < 4) return;

    const system = cells[0]?.textContent.trim() || "";
    const item = cells[1]?.textContent.trim() || "";
    const location = cells[2]?.textContent.trim() || "";

    const statusBadge = cells[3]?.querySelector(".badge");
    const statusText = statusBadge ? statusBadge.textContent.trim() : "";

    const status = mapStatusToEditValue(statusText);

    const equipmentId = row.dataset.equipmentId || `eq-${idx}`;

    const card = document.createElement("div");
    card.className = "card equipment-card";
    card.dataset.equipmentId = equipmentId;
    card.dataset.equipmentSystem = system;

    card.innerHTML = `
      <div class="flex justify-content-between align-items-start mb-sm">
        <div class="flex-1">
          <div class="details-field">
            <div class="details-field-label">שם</div>
            <input
              type="text"
              class="input input-sm equipment-name-input"
              value="${escapeHtml(item)}"
              placeholder="שם מוצר/מערכת"
            >
          </div>
        </div>

        <div class="flex gap-xs">
          <button class="btn-icon-only btn-sm equipment-move-up" data-move-up="${equipmentId}">↑</button>
          <button class="btn-icon-only btn-sm equipment-move-down" data-move-down="${equipmentId}">↓</button>
        </div>
      </div>

      <div class="details-field">
        <div class="details-field-label">סטטוס</div>
        <select class="input input-sm equipment-status-select">
          <option value="מותקן" ${status === "מותקן" ? "selected" : ""}>מותקן</option>
          <option value="בהתקנה" ${status === "בהתקנה" ? "selected" : ""}>בהתקנה</option>
          <option value="בהזמנה" ${status === "בהזמנה" ? "selected" : ""}>בהזמנה</option>
          <option value="ממתין" ${status === "ממתין" ? "selected" : ""}>ממתין</option>
        </select>
      </div>

      <div class="details-field">
        <div class="details-field-label">מיקום</div>
        <input
          type="text"
          class="input input-sm equipment-location-input"
          value="${escapeHtml(location)}"
          placeholder="מיקום"
        >
      </div>
    `;

    cardsEdit.appendChild(card);
  });

  attachEquipmentHandlers();
}

// Switch back to table view
function switchEquipmentToView() {
  document.getElementById("equipment-view").style.display = "block";
  document.getElementById("equipment-edit").style.display = "none";

  const form = document.getElementById("equipment-add-form");
  if (form) form.style.display = "none";
}

// =====================================================
// Commit / Restore
// =====================================================

// Commit edited cards back to table view
function commitEquipmentChanges() {
  const cardsEdit = document.getElementById("equipment-cards-edit");
  const tbodyView = document.getElementById("equipment-tbody-view");

  if (!cardsEdit || !tbodyView) return;

  tbodyView.innerHTML = "";

  const cards = cardsEdit.querySelectorAll(".equipment-card");

  cards.forEach((card) => {
    const item = card.querySelector(".equipment-name-input")?.value.trim();
    const location = card
      .querySelector(".equipment-location-input")
      ?.value.trim();
    const status = card.querySelector(".equipment-status-select")?.value;

    if (!item) return;

    const system = card.dataset.equipmentSystem || "מערכת";
    const equipmentId = card.dataset.equipmentId;

    const statusDisplay = mapStatusToDisplayValue(status);
    const statusClass = getEquipmentStatusBadgeClass(statusDisplay);

    const tr = document.createElement("tr");
    tr.dataset.equipmentId = equipmentId;

    tr.innerHTML = `
      <td>${escapeHtml(system)}</td>
      <td>${escapeHtml(item)}</td>
      <td>${escapeHtml(location || "")}</td>
      <td><span class="badge ${statusClass}">${escapeHtml(statusDisplay)}</span></td>
    `;

    tbodyView.appendChild(tr);
  });
}

// Restore from snapshot
function restoreEquipmentFromSnapshot() {
  const tbody = document.getElementById("equipment-tbody-view");
  if (!tbody) return;

  if (!projectSnapshot || !projectSnapshot.equipment) {
    restoreDefaultEquipment(tbody);
    return;
  }

  tbody.innerHTML = "";

  projectSnapshot.equipment.forEach((eq) => {
    const statusDisplay = mapStatusToDisplayValue(eq.status);
    const statusClass = getEquipmentStatusBadgeClass(statusDisplay);

    const tr = document.createElement("tr");
    tr.dataset.equipmentId = eq.id;

    tr.innerHTML = `
      <td>${escapeHtml(eq.system)}</td>
      <td>${escapeHtml(eq.item)}</td>
      <td>${escapeHtml(eq.location || "")}</td>
      <td><span class="badge ${statusClass}">${escapeHtml(statusDisplay)}</span></td>
    `;

    tbody.appendChild(tr);
  });
}

// Default fallback
function restoreDefaultEquipment(tbody) {
  tbody.innerHTML = `
    <tr>
      <td>חשמל חכם</td>
      <td>בקר מרכזי</td>
      <td>ארון חשמל</td>
      <td><span class="badge badge-primary">בהתקנה</span></td>
    </tr>
  `;
}

// =====================================================
// Handlers
// =====================================================

// Attach move up/down handlers
function attachEquipmentHandlers() {
  document.querySelectorAll(".equipment-move-up").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".equipment-card");
      const prev = card?.previousElementSibling;
      if (card && prev) card.parentNode.insertBefore(card, prev);
    });
  });

  document.querySelectorAll(".equipment-move-down").forEach((btn) => {
    btn.addEventListener("click", () => {
      const card = btn.closest(".equipment-card");
      const next = card?.nextElementSibling;
      if (card && next) card.parentNode.insertBefore(next, card);
    });
  });
}

// =====================================================
// Add Equipment
// =====================================================

function addEquipment() {
  const name = document.getElementById("equipment-name-input")?.value.trim();
  const status = document.getElementById("equipment-status-input")?.value;
  const location = document
    .getElementById("equipment-location-input")
    ?.value.trim();

  if (!name) {
    alert("יש להזין שם מוצר");
    return;
  }

  const container = document.getElementById("equipment-cards-edit");
  if (!container) return;

  const id = `eq-${Date.now()}`;

  const card = document.createElement("div");
  card.className = "card equipment-card";
  card.dataset.equipmentId = id;
  card.dataset.equipmentSystem = "מערכת חדשה";

  card.innerHTML = `
    <div class="details-field">
      <input class="input equipment-name-input" value="${escapeHtml(name)}">
    </div>
  `;

  container.appendChild(card);

  attachEquipmentHandlers();
}

// =====================================================
// Helpers
// =====================================================

// Map display status → edit value
function mapStatusToEditValue(text) {
  if (text.includes("הותקן") || text.includes("מותקן")) return "מותקן";
  if (text.includes("בהתקנה")) return "בהתקנה";
  if (text.includes("בהזמנה")) return "בהזמנה";
  return "ממתין";
}

// Map edit value → display text
function mapStatusToDisplayValue(value) {
  if (value === "מותקן") return "הותקן";
  if (value === "בהתקנה") return "בהתקנה";
  if (value === "בהזמנה") return "בהזמנה";
  return "בהכנה";
}

// Badge class mapping
function getEquipmentStatusBadgeClass(status) {
  if (status.includes("הותקן")) return "badge-success";
  if (status.includes("בהתקנה")) return "badge-primary";
  if (status.includes("בהזמנה")) return "badge-warning";
  return "badge-neutral";
}
