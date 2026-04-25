// =====================================================
// Projects Milestones Logic
// =====================================================
// This file contains all milestone-related frontend logic
// for the Projects page.
//
// Responsibilities:
// - Render project milestones
// - Open milestone create/edit form
// - Collect milestone form data
// - Save milestone create/update actions
// - Attach milestone card action handlers
// - Attach planned/actual date calculation handlers
//
// IMPORTANT:
// - No API definitions here
// - No drawer open/close logic here
// - No project overview edit logic here
// - No BOQ / drawings / equipment logic here
// =====================================================

// =====================================================
// Milestone Date / Hours Handling
// =====================================================

// Attaches change handlers to planned and actual date fields.
// When start/end dates change, the related hours field is recalculated.
function attachMilestoneDateHandlers() {
  const plannedStartInput = document.getElementById(
    "milestone-planned-start-input",
  );

  const plannedEndInput = document.getElementById(
    "milestone-planned-end-input",
  );

  const actualStartInput = document.getElementById(
    "milestone-actual-start-input",
  );

  const actualEndInput = document.getElementById("milestone-actual-end-input");

  if (plannedStartInput) {
    plannedStartInput.addEventListener("change", () => {
      handleDatesChange(
        "milestone-planned-start-input",
        "milestone-planned-end-input",
        "milestone-estimated-hours-input",
      );
    });
  }

  if (plannedEndInput) {
    plannedEndInput.addEventListener("change", () => {
      handleDatesChange(
        "milestone-planned-start-input",
        "milestone-planned-end-input",
        "milestone-estimated-hours-input",
      );
    });
  }

  if (actualStartInput) {
    actualStartInput.addEventListener("change", () => {
      handleDatesChange(
        "milestone-actual-start-input",
        "milestone-actual-end-input",
        "milestone-actual-hours-input",
      );
    });
  }

  if (actualEndInput) {
    actualEndInput.addEventListener("change", () => {
      handleDatesChange(
        "milestone-actual-start-input",
        "milestone-actual-end-input",
        "milestone-actual-hours-input",
      );
    });
  }
}

// =====================================================
// Milestones Rendering
// =====================================================

// Renders the milestones list inside the project drawer.
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

    const isLockedStatus =
      milestone.status === "Cancelled" || milestone.status === "Closed";

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

    const actualStartText = formatDate(milestone.actualStart, {
      includeTime: true,
    });

    const actualEndText = formatDate(milestone.actualEnd, {
      includeTime: true,
    });

    const closedAtText = formatDate(milestone.closedAt, {
      includeTime: true,
    });

    const estimatedHoursText =
      milestone.estimatedHours != null
        ? formatDecimalHoursToTime(milestone.estimatedHours)
        : "-";

    const actualHoursText =
      milestone.actualHours != null
        ? formatDecimalHoursToTime(milestone.actualHours)
        : "-";

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
            ${isLockedStatus ? "disabled" : ""}
          >
            ערוך
          </button>

          <button
            type="button"
            class="btn btn-outline btn-sm milestone-delete-btn"
            data-milestone-id="${escapeHtml(String(milestone.workItemId))}"
            ${isLockedStatus ? "disabled" : ""}
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
          <div class="milestone-info-row"><span>שעות בפועל</span><strong>${escapeHtml(actualHoursText)}</strong></div>
        </div>

        <div class="milestone-card-section">
          <div class="milestone-card-section-title">תאריכים</div>
          <div class="milestone-info-row"><span>תאריך יצירה</span><strong>${escapeHtml(formatDate(milestone.createdAt))}</strong></div>
          <div class="milestone-info-row"><span>תחילה מתוכננת</span><strong>${escapeHtml(plannedStartText)}</strong></div>
          <div class="milestone-info-row"><span>תחילה בפועל</span><strong>${escapeHtml(actualStartText)}</strong></div>
          <div class="milestone-info-row"><span>סיום מתוכנן</span><strong>${escapeHtml(plannedEndText)}</strong></div>
          <div class="milestone-info-row"><span>סיום בפועל</span><strong>${escapeHtml(actualEndText)}</strong></div>
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

// =====================================================
// Milestone Card Actions
// =====================================================

// Attaches edit/cancel handlers to rendered milestone cards.
function attachMilestoneCardHandlers() {
  document.querySelectorAll(".milestone-edit-btn").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();

      if (btn.disabled) return;

      const milestoneId = Number(btn.dataset.milestoneId);

      const milestone = currentProjectMilestones.find(
        (item) => Number(item.workItemId) === milestoneId,
      );

      if (!milestone) {
        alert("אבן דרך לא נמצאה");
        return;
      }

      openMilestoneForm(milestone);
    });
  });

  document.querySelectorAll(".milestone-delete-btn").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();

      if (btn.disabled) return;

      const milestoneId = Number(btn.dataset.milestoneId);
      const confirmed = confirm("האם לבטל את אבן הדרך?");

      if (!confirmed) return;

      try {
        await cancelMilestoneApi(milestoneId);

        alert("אבן הדרך בוטלה");

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

// =====================================================
// Milestone Form Open / Close
// =====================================================

// Opens milestone form in create or edit mode.
function openMilestoneForm(milestone = null) {
  if (
    milestone &&
    (milestone.status === "Cancelled" || milestone.status === "Closed")
  ) {
    alert("לא ניתן לערוך אבן דרך שבוטלה או נסגרה");
    return;
  }

  const formCard = document.getElementById("milestone-form-card");
  if (!formCard) return;

  formCard.style.display = "block";

  formCard.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });

  if (milestone) {
    populateMilestoneEditForm(milestone);
  } else {
    resetMilestoneCreateForm();
  }
}

// Closes the milestone form and clears edit state.
function closeMilestoneForm() {
  const formCard = document.getElementById("milestone-form-card");
  if (!formCard) return;

  formCard.style.display = "none";
  editingMilestoneId = null;
}

// =====================================================
// Milestone Form Population
// =====================================================

// Populates form fields with an existing milestone for edit mode.
function populateMilestoneEditForm(milestone) {
  editingMilestoneId = milestone.workItemId;

  document.getElementById("milestone-form-title").textContent = "עריכת אבן דרך";

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

  document.getElementById("milestone-actual-start-input").value =
    milestone.actualStart
      ? formatDate(milestone.actualStart, {
          target: "input",
          includeTime: true,
        })
      : "";

  document.getElementById("milestone-actual-end-input").value =
    milestone.actualEnd
      ? formatDate(milestone.actualEnd, {
          target: "input",
          includeTime: true,
        })
      : "";

  const estimatedHoursInput = document.getElementById(
    "milestone-estimated-hours-input",
  );

  if (estimatedHoursInput) {
    estimatedHoursInput.value =
      milestone.estimatedHours != null
        ? formatDecimalHoursToTime(milestone.estimatedHours)
        : "";

    estimatedHoursInput.dataset.decimalValue = milestone.estimatedHours ?? "";
  }

  const actualHoursInput = document.getElementById(
    "milestone-actual-hours-input",
  );

  if (actualHoursInput) {
    actualHoursInput.value =
      milestone.actualHours != null
        ? formatDecimalHoursToTime(milestone.actualHours)
        : "";

    actualHoursInput.dataset.decimalValue = milestone.actualHours ?? "";
  }

  document.getElementById("milestone-required-role-input").value =
    milestone.requiredRole || "";

  document.getElementById("milestone-description-input").value =
    milestone.description || "";

  document.getElementById("milestone-is-locked-input").checked =
    !!milestone.isLocked;
}

// Resets form fields for creating a new milestone.
function resetMilestoneCreateForm() {
  editingMilestoneId = null;

  document.getElementById("milestone-form-title").textContent = "אבן דרך חדשה";

  document.getElementById("milestone-title-input").value = "";
  document.getElementById("milestone-status-input").value = "Planned";
  document.getElementById("milestone-billing-type-input").value = "Internal";
  document.getElementById("milestone-priority-input").value = "";
  document.getElementById("milestone-planned-start-input").value = "";
  document.getElementById("milestone-planned-end-input").value = "";
  document.getElementById("milestone-estimated-hours-input").value = "";
  document.getElementById("milestone-actual-start-input").value = "";
  document.getElementById("milestone-actual-end-input").value = "";
  document.getElementById("milestone-actual-hours-input").value = "";
  document.getElementById("milestone-required-role-input").value = "";
  document.getElementById("milestone-description-input").value = "";
  document.getElementById("milestone-is-locked-input").checked = false;

  const estimatedHoursInput = document.getElementById(
    "milestone-estimated-hours-input",
  );

  if (estimatedHoursInput) {
    estimatedHoursInput.dataset.decimalValue = "";
  }

  const actualHoursInput = document.getElementById(
    "milestone-actual-hours-input",
  );

  if (actualHoursInput) {
    actualHoursInput.dataset.decimalValue = "";
  }
}

// =====================================================
// Milestone Form Data Collection
// =====================================================

// Reads milestone form fields and builds backend payload data.
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

  const actualStart =
    document.getElementById("milestone-actual-start-input")?.value || null;

  const actualEnd =
    document.getElementById("milestone-actual-end-input")?.value || null;

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

  if (
    !validateMilestoneDates(plannedStart, plannedEnd, actualStart, actualEnd)
  ) {
    return null;
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
    estimatedHours: getHoursDecimalValue(
      "milestone-estimated-hours-input",
      plannedStart,
      plannedEnd,
    ),
    actualStart,
    actualEnd,
    actualHours: getHoursDecimalValue(
      "milestone-actual-hours-input",
      actualStart,
      actualEnd,
    ),
    priority,
    requiredRole,
    isLocked,
    employees: [],
    contractors: [],
  };
}

// Validates planned and actual date ranges before save.
function validateMilestoneDates(
  plannedStart,
  plannedEnd,
  actualStart,
  actualEnd,
) {
  if (plannedStart && plannedEnd) {
    const startDate = new Date(plannedStart);
    const endDate = new Date(plannedEnd);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      alert("אחד מתאריכי התכנון אינו תקין");
      return false;
    }

    if (endDate < startDate) {
      alert("תאריך סיום מתוכנן לא יכול להיות לפני תאריך התחלה מתוכנן");
      return false;
    }
  }

  if (actualStart && actualEnd) {
    const startDate = new Date(actualStart);
    const endDate = new Date(actualEnd);

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      alert("אחד מתאריכי הביצוע בפועל אינו תקין");
      return false;
    }

    if (endDate < startDate) {
      alert("תאריך סיום בפועל לא יכול להיות לפני תאריך התחלה בפועל");
      return false;
    }
  }

  return true;
}

// =====================================================
// Milestone Save Flow
// =====================================================

// Saves milestone form either as create or update.
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
