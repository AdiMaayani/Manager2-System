// =====================================================
// Projects BOQ Logic
// =====================================================
// This file contains all Bill of Quantities (BOQ) frontend
// behavior for the Projects page.
//
// Responsibilities:
// - Switch BOQ section between view/edit modes
// - Build editable BOQ rows from the current view table
// - Commit edited BOQ rows back to the view table
// - Restore BOQ data from project snapshot
// - Validate BOQ fields before save
// - Attach BOQ remove/add row handlers
//
// IMPORTANT:
// - No API calls here
// - No drawer open/close logic here
// - No project form save logic here
// - BOQ is currently UI-local and not persisted to backend
// =====================================================

// =====================================================
// BOQ View/Edit Mode Switching
// =====================================================

// Switches BOQ section from read-only table to editable table.
function switchBOQToEdit() {
  document.getElementById("boq-view").style.display = "none";
  document.getElementById("boq-edit").style.display = "block";

  const tbodyView = document.getElementById("boq-tbody-view");
  const tbodyEdit = document.getElementById("boq-tbody-edit");

  if (!tbodyView || !tbodyEdit) return;

  tbodyEdit.innerHTML = "";

  const rows = tbodyView.querySelectorAll("tr");
  let rowId = 0;

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");

    if (cells.length < 3) return;

    let itemCell;
    let qtyCell;
    let unitCell;

    // Rows without system rowspan.
    if (cells.length === 3) {
      itemCell = cells[0];
      qtyCell = cells[1];
      unitCell = cells[2];
    }

    // Rows with system rowspan.
    if (cells.length === 4) {
      itemCell = cells[1];
      qtyCell = cells[2];
      unitCell = cells[3];
    }

    if (!itemCell || !qtyCell || !unitCell) return;

    const tr = document.createElement("tr");
    tr.dataset.boqId = `boq-${rowId++}`;

    const item = itemCell.textContent.trim();
    const qty = qtyCell.textContent.trim();
    const unit = unitCell.textContent.trim();

    tr.innerHTML = `
      <td>
        <input
          type="text"
          class="input input-sm boq-item-input"
          value="${escapeHtml(item)}"
          placeholder="שם פריט"
        >
      </td>

      <td>
        <input
          type="number"
          class="input input-sm boq-qty-input"
          value="${escapeHtml(qty)}"
          min="0"
          placeholder="0"
        >
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
        <button
          type="button"
          class="btn-icon-only btn-sm boq-remove-btn"
          data-remove-boq="${tr.dataset.boqId}"
          aria-label="הסר"
        >
          <i data-lucide="trash-2" class="icon" aria-hidden="true"></i>
        </button>
      </td>
    `;

    tbodyEdit.appendChild(tr);
  });

  attachBOQHandlers();

  if (window.lucide) lucide.createIcons();
}

// Switches BOQ section back to read-only view mode.
function switchBOQToView() {
  document.getElementById("boq-view").style.display = "block";
  document.getElementById("boq-edit").style.display = "none";
}

// =====================================================
// BOQ Commit / Restore
// =====================================================

// Commits edited BOQ rows back into the read-only BOQ table.
function commitBOQChanges() {
  const tbodyEdit = document.getElementById("boq-tbody-edit");
  const tbodyView = document.getElementById("boq-tbody-view");

  if (!tbodyEdit || !tbodyView) return;

  tbodyView.innerHTML = "";

  const rows = tbodyEdit.querySelectorAll("tr");
  const systems = {};

  rows.forEach((row, index) => {
    const itemInput = row.querySelector(".boq-item-input");
    const qtyInput = row.querySelector(".boq-qty-input");
    const unitSelect = row.querySelector(".boq-unit-input");

    if (!itemInput || !qtyInput || !unitSelect) return;

    const item = itemInput.value.trim();
    const qty = qtyInput.value.trim();
    const unit = unitSelect.value;

    if (!item) return;

    // Temporary UI grouping rule.
    // First 3 items are grouped under "חשמל חכם"; the rest under "בקרה".
    const system = index < 3 ? "חשמל חכם" : "בקרה";

    if (!systems[system]) {
      systems[system] = [];
    }

    systems[system].push({ item, qty, unit });
  });

  renderBOQGroupedRows(tbodyView, systems);
}

// Restores BOQ table from the last project snapshot.
function restoreBOQFromSnapshot() {
  const tbodyView = document.getElementById("boq-tbody-view");
  if (!tbodyView) return;

  if (!projectSnapshot || !Array.isArray(projectSnapshot.boq)) {
    restoreDefaultBOQRows(tbodyView);
    return;
  }

  tbodyView.innerHTML = "";

  const systems = {};

  projectSnapshot.boq.forEach((item, index) => {
    const system = index < 3 ? "חשמל חכם" : "בקרה";

    if (!systems[system]) {
      systems[system] = [];
    }

    systems[system].push({
      item: item.item,
      qty: item.quantity,
      unit: item.unit,
    });
  });

  renderBOQGroupedRows(tbodyView, systems);
}

// Renders grouped BOQ rows into the target table body.
function renderBOQGroupedRows(tbodyView, systems) {
  Object.keys(systems).forEach((system) => {
    const items = systems[system];

    items.forEach((item, itemIndex) => {
      const tr = document.createElement("tr");

      if (itemIndex === 0) {
        tr.innerHTML = `
          <td rowspan="${items.length}"><strong>${escapeHtml(system)}</strong></td>
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

// Restores default fallback BOQ rows when no snapshot exists.
function restoreDefaultBOQRows(tbodyView) {
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

// =====================================================
// BOQ Validation
// =====================================================

// Validates BOQ editable rows before project save.
function validateBOQ() {
  const tbodyEdit = document.getElementById("boq-tbody-edit");
  if (!tbodyEdit) return true;

  const rows = tbodyEdit.querySelectorAll("tr");
  let isValid = true;

  rows.forEach((row) => {
    const itemInput = row.querySelector(".boq-item-input");
    const qtyInput = row.querySelector(".boq-qty-input");

    if (itemInput) itemInput.classList.remove("error");
    if (qtyInput) qtyInput.classList.remove("error");

    const item = itemInput?.value.trim();
    const qty = qtyInput?.value.trim();

    if (!item) {
      itemInput?.classList.add("error");
      isValid = false;
    }

    if (qty && (Number.isNaN(Number(qty)) || Number(qty) < 0)) {
      qtyInput?.classList.add("error");
      isValid = false;
    }
  });

  if (!isValid) {
    alert("יש לתקן שגיאות בטבלה לפני שמירה");
  }

  return isValid;
}

// =====================================================
// BOQ Event Handlers
// =====================================================

// Attaches remove-row handlers to BOQ edit rows.
function attachBOQHandlers() {
  document.querySelectorAll(".boq-remove-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();

      const rowId = btn.dataset.removeBoq;
      const row = document.querySelector(`[data-boq-id="${rowId}"]`);

      if (row) row.remove();
    });
  });
}

// Adds a new editable BOQ row.
function addBOQRow() {
  const tbodyEdit = document.getElementById("boq-tbody-edit");
  if (!tbodyEdit) return;

  const newId = `boq-${Date.now()}`;
  const tr = document.createElement("tr");

  tr.dataset.boqId = newId;

  tr.innerHTML = `
    <td>
      <input
        type="text"
        class="input input-sm boq-item-input"
        placeholder="שם פריט"
      >
    </td>

    <td>
      <input
        type="number"
        class="input input-sm boq-qty-input"
        value="0"
        min="0"
        placeholder="0"
      >
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
      <button
        type="button"
        class="btn-icon-only btn-sm boq-remove-btn"
        data-remove-boq="${newId}"
        aria-label="הסר"
      >
        <i data-lucide="trash-2" class="icon" aria-hidden="true"></i>
      </button>
    </td>
  `;

  tbodyEdit.appendChild(tr);
  attachBOQHandlers();

  if (window.lucide) lucide.createIcons();
}
