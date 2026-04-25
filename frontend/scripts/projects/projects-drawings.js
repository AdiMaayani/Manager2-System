// =====================================================
// Projects Drawings Logic
// =====================================================
// This file contains all frontend logic for managing project drawings.
//
// Responsibilities:
// - Switch between view/edit modes for drawings
// - Build editable drawings list from view
// - Commit edited drawings back to view
// - Restore drawings from snapshot
// - Handle add/remove drawing actions
//
// IMPORTANT:
// - No API integration here (currently UI-only)
// - No project save logic here
// - No drawer logic here
// =====================================================

// =====================================================
// Drawings View/Edit Mode Switching
// =====================================================

// Switch drawings section to edit mode.
function switchDrawingsToEdit() {
  document.getElementById("drawings-view").style.display = "none";
  document.getElementById("drawings-edit").style.display = "block";

  const listView = document.getElementById("drawings-list-view");
  const listEdit = document.getElementById("drawings-list-edit");

  if (!listView || !listEdit) return;

  listEdit.innerHTML = "";

  const cards = listView.querySelectorAll(".file-card");

  cards.forEach((card) => {
    const nameEl = card.querySelector(".file-name");
    const metaEl = card.querySelector(".file-meta");

    if (!nameEl || !metaEl) return;

    // Extract drawing name (without icon)
    const nameText = extractTextContent(nameEl);

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

      <div class="file-meta">
        סוג: ${type} • עודכן: ${date}
      </div>

      <button
        type="button"
        class="file-remove"
        data-remove-drawing="${drawingId}"
        aria-label="הסר"
      >
        ×
      </button>
    `;

    listEdit.appendChild(newCard);
  });

  attachDrawingsHandlers();

  if (window.lucide) lucide.createIcons();
}

// Switch drawings section back to view mode.
function switchDrawingsToView() {
  document.getElementById("drawings-view").style.display = "block";
  document.getElementById("drawings-edit").style.display = "none";

  // Hide add form as well
  const form = document.getElementById("drawing-add-form");
  if (form) form.style.display = "none";
}

// =====================================================
// Commit / Restore
// =====================================================

// Commit drawings from edit mode to view mode.
function commitDrawingsChanges() {
  const listEdit = document.getElementById("drawings-list-edit");
  const listView = document.getElementById("drawings-list-view");

  if (!listEdit || !listView) return;

  listView.innerHTML = "";

  const cards = listEdit.querySelectorAll(".file-card");

  cards.forEach((card) => {
    const nameEl = card.querySelector(".file-name");
    const metaEl = card.querySelector(".file-meta");

    if (!nameEl || !metaEl) return;

    const nameText = extractTextContent(nameEl);

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
        <i data-lucide="${icon}" class="icon"></i>
        ${escapeHtml(nameText)}
      </div>

      <div class="file-meta">
        סוג: ${type} • עודכן: ${date}
      </div>
    `;

    listView.appendChild(newCard);
  });

  if (window.lucide) lucide.createIcons();
}

// Restore drawings from snapshot.
function restoreDrawingsFromSnapshot() {
  const listView = document.getElementById("drawings-list-view");
  if (!listView) return;

  if (!projectSnapshot || !projectSnapshot.drawings) {
    restoreDefaultDrawings(listView);
    return;
  }

  listView.innerHTML = "";

  projectSnapshot.drawings.forEach((drawing) => {
    const icon = drawing.type === "PDF" ? "file-text" : "drafting-compass";

    const card = document.createElement("div");
    card.className = "file-card";
    card.dataset.drawingId = drawing.id;

    card.innerHTML = `
      <div class="file-name">
        <i data-lucide="${icon}" class="icon"></i>
        ${escapeHtml(drawing.name)}
      </div>

      <div class="file-meta">
        סוג: ${drawing.type} • עודכן: ${drawing.date || ""}
      </div>
    `;

    listView.appendChild(card);
  });

  if (window.lucide) lucide.createIcons();
}

// Default fallback drawings.
function restoreDefaultDrawings(container) {
  container.innerHTML = `
    <div class="file-card">
      <div class="file-name">
        <i data-lucide="file-text" class="icon"></i>
        תכנון כללי – Rev B.pdf
      </div>
      <div class="file-meta">סוג: PDF • עודכן: 15/01/2025</div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

// =====================================================
// Handlers
// =====================================================

// Attach remove handlers.
function attachDrawingsHandlers() {
  document.querySelectorAll(".file-remove").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();

      const id = btn.dataset.removeDrawing;
      const card = document.querySelector(`[data-drawing-id="${id}"]`);

      if (card) card.remove();
    });
  });
}

// =====================================================
// Add Drawing Logic
// =====================================================

function addDrawing() {
  const name = document.getElementById("drawing-name-input")?.value.trim();
  const type = document.getElementById("drawing-type-input")?.value || "PDF";
  const date =
    document.getElementById("drawing-date-input")?.value ||
    new Date().toLocaleDateString("he-IL");

  if (!name) {
    alert("יש להזין שם קובץ");
    return;
  }

  const listEdit = document.getElementById("drawings-list-edit");
  if (!listEdit) return;

  const id = `draw-${Date.now()}`;
  const icon = type === "PDF" ? "file-text" : "drafting-compass";

  const card = document.createElement("div");
  card.className = "file-card";
  card.dataset.drawingId = id;

  card.innerHTML = `
    <div class="file-name">
      <i data-lucide="${icon}" class="icon"></i>
      ${escapeHtml(name)}
    </div>

    <div class="file-meta">
      סוג: ${type} • עודכן: ${date}
    </div>

    <button class="file-remove" data-remove-drawing="${id}">×</button>
  `;

  listEdit.appendChild(card);

  attachDrawingsHandlers();

  if (window.lucide) lucide.createIcons();
}

// =====================================================
// Helpers
// =====================================================

// Extract text from element (without icons).
function extractTextContent(element) {
  return Array.from(element.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent.trim())
    .join(" ")
    .trim();
}
