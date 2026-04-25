// =====================================================
// Projects Event Bindings
// =====================================================
// This file connects DOM events to existing project functions.
//
// Responsibilities:
// - Attach click/change/keyboard listeners
// - Keep all event wiring in one centralized place
// - Call functions defined in the dedicated project modules
//
// IMPORTANT:
// - No API logic here
// - No rendering logic here
// - No business rules here
// - No shared state declarations here
// =====================================================

// =====================================================
// Drawer Events
// =====================================================

function bindProjectDrawerEvents() {
  if (projCloseBtn) {
    projCloseBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      closeProjectDrawer();
    });
  }

  if (projBackdrop) {
    projBackdrop.addEventListener("click", closeProjectDrawer);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && projOverlay?.classList.contains("is-open")) {
      closeProjectDrawer();
    }
  });
}

// =====================================================
// Project Edit Events
// =====================================================

function bindProjectEditEvents() {
  const projEditToggle = document.getElementById("proj-edit-toggle");
  const projSaveBtn = document.getElementById("proj-save");
  const projCancelBtn = document.getElementById("proj-cancel");

  if (projEditToggle) {
    projEditToggle.addEventListener("click", async (event) => {
      event.stopPropagation();

      if (isEditMode) {
        cancelEdit();
      } else {
        await enterEditMode();
      }
    });
  }

  if (projSaveBtn) {
    projSaveBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      saveEdit();
    });
  }

  if (projCancelBtn) {
    projCancelBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      cancelEdit();
    });
  }
}

// =====================================================
// Create Project Events
// =====================================================

function bindProjectCreateEvents() {
  const btnNewProject = document.getElementById("btn-new-project");

  if (!btnNewProject) return;

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

// =====================================================
// Site Inline Creation Events
// =====================================================

function bindProjectSiteEvents() {
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
    newSiteCancelBtn.addEventListener("click", resetNewSiteForm);
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
}

// =====================================================
// Milestone Events
// =====================================================

function bindMilestoneEvents() {
  const milestoneAddBtn = document.getElementById("milestone-add-btn");
  const milestoneCancelBtn = document.getElementById("milestone-cancel-btn");
  const milestoneSaveBtn = document.getElementById("milestone-save-btn");

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

  if (milestoneSaveBtn) {
    milestoneSaveBtn.addEventListener("click", () => {
      saveMilestoneFromForm();
    });
  }

  attachMilestoneDateHandlers();
}

// =====================================================
// BOQ Events
// =====================================================

function bindBOQEvents() {
  const boqAddRowBtn = document.getElementById("boq-add-row");

  if (boqAddRowBtn) {
    boqAddRowBtn.addEventListener("click", addBOQRow);
  }
}

// =====================================================
// Drawings Events
// =====================================================

function bindDrawingsEvents() {
  const drawingAddBtn = document.getElementById("drawing-add-btn");
  const drawingAddForm = document.getElementById("drawing-add-form");
  const drawingAddConfirm = document.getElementById("drawing-add-confirm");
  const drawingAddCancel = document.getElementById("drawing-add-cancel");

  if (drawingAddBtn && drawingAddForm) {
    drawingAddBtn.addEventListener("click", () => {
      drawingAddForm.style.display = "block";
    });
  }

  if (drawingAddCancel && drawingAddForm) {
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
      addDrawing();

      if (drawingAddForm) {
        drawingAddForm.style.display = "none";
      }

      document.getElementById("drawing-name-input").value = "";
      document.getElementById("drawing-type-input").value = "PDF";
      document.getElementById("drawing-date-input").value = "";
      document.getElementById("drawing-note-input").value = "";
    });
  }
}

// =====================================================
// Equipment Events
// =====================================================

function bindEquipmentEvents() {
  const equipmentAddBtn = document.getElementById("equipment-add-btn");
  const equipmentAddForm = document.getElementById("equipment-add-form");
  const equipmentAddConfirm = document.getElementById("equipment-add-confirm");
  const equipmentAddCancel = document.getElementById("equipment-add-cancel");

  if (equipmentAddBtn && equipmentAddForm) {
    equipmentAddBtn.addEventListener("click", () => {
      equipmentAddForm.style.display = "block";
    });
  }

  if (equipmentAddCancel && equipmentAddForm) {
    equipmentAddCancel.addEventListener("click", () => {
      equipmentAddForm.style.display = "none";
      document.getElementById("equipment-name-input").value = "";
      document.getElementById("equipment-status-input").value = "ממתין";
      document.getElementById("equipment-location-input").value = "";
    });
  }

  if (equipmentAddConfirm) {
    equipmentAddConfirm.addEventListener("click", () => {
      addEquipment();

      if (equipmentAddForm) {
        equipmentAddForm.style.display = "none";
      }

      document.getElementById("equipment-name-input").value = "";
      document.getElementById("equipment-status-input").value = "ממתין";
      document.getElementById("equipment-location-input").value = "";
    });
  }
}

// =====================================================
// Drawer Maximize Events
// =====================================================

function bindDrawerMaximizeEvents() {
  if (projMaximizeBtn && projDrawer) {
    projMaximizeBtn.addEventListener("click", toggleProjectDrawerMaximize);
  }
}

// =====================================================
// Drawer Tab Events
// =====================================================

function bindDrawerTabEvents() {
  document.querySelectorAll(".project-drawer-tabs .tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      handleProjectTabClick(tab);
    });
  });
}

// =====================================================
// Tabbar Scroll Events
// =====================================================

function bindTabbarScrollEvents() {
  if (!tabbarScroller || !tabbarArrowStart || !tabbarArrowEnd) return;

  tabbarScroller.addEventListener("scroll", updateTabbarArrows);

  new ResizeObserver(updateTabbarArrows).observe(tabbarScroller);

  tabbarArrowStart.addEventListener("click", (event) => {
    event.preventDefault();
    scrollTabbar("start");
  });

  tabbarArrowEnd.addEventListener("click", (event) => {
    event.preventDefault();
    scrollTabbar("end");
  });
}

// =====================================================
// Project Filter Events
// =====================================================

function bindProjectFilterEvents() {
  const stageFilter = document.getElementById("stage-filter");
  const stageMenu = stageFilter?.querySelector(".filter-dropdown-menu");

  if (!stageMenu) return;

  stageMenu.querySelectorAll(".filter-dropdown-item").forEach((item) => {
    item.addEventListener("click", () => {
      const stage = item.getAttribute("data-stage");
      filterByStage(stage);
    });
  });
}

// =====================================================
// Bind All Events
// =====================================================

function bindProjectsEvents() {
  bindProjectDrawerEvents();
  bindProjectEditEvents();
  bindProjectCreateEvents();
  bindProjectSiteEvents();
  bindMilestoneEvents();
  bindBOQEvents();
  bindDrawingsEvents();
  bindEquipmentEvents();
  bindDrawerMaximizeEvents();
  bindDrawerTabEvents();
  bindTabbarScrollEvents();
  bindProjectFilterEvents();
}
