// Workplan specific interactivity (no backend, UX-only)
document.addEventListener("DOMContentLoaded", () => {
  const MOCK_EMPLOYEES = window.MOCK_EMPLOYEES || [];
  let API_EMPLOYEES = [];

  function getEmployeesData() {
    return API_EMPLOYEES.length ? API_EMPLOYEES : MOCK_EMPLOYEES;
  }

  async function loadEmployeesFromApi() {
    console.groupCollapsed("🔍 [DATA AUDIT] Employees source resolution");

    try {
      const response = await fetch("http://localhost:5161/api/Employees", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(
          "Employees API request failed with status " + response.status,
        );
      }

      const data = await response.json();

      console.log("Source: http://localhost:5161/api/Employees");
      console.log("Raw API data:", data);

      API_EMPLOYEES = Array.isArray(data)
        ? data.map((item) => ({
            id: item && item.employeeId != null ? String(item.employeeId) : "",
            employeeId:
              item && item.employeeId != null ? String(item.employeeId) : "",
            fullName: item && item.fullName ? item.fullName : "",
            role: item && item.primaryRole ? item.primaryRole : "",
            primaryRole: item && item.primaryRole ? item.primaryRole : "",
            dailyCapacityHours:
              item && item.dailyCapacityHours != null
                ? item.dailyCapacityHours
                : null,
            isAssignable: item && item.isAssignable === true,
            phone: item && item.phone ? item.phone : "",
            email: item && item.email ? item.email : "",
            isActive: !!(item && item.isActive),
            createdAt: item && item.createdAt ? item.createdAt : null,
            raw: item || null,
          }))
        : [];

      console.log("Resolved API employees count:", API_EMPLOYEES.length);
      console.log("Resolved employees data:", API_EMPLOYEES);

      renderEmployeeFilterMenu();
    } catch (error) {
      API_EMPLOYEES = [];
      console.warn(
        "Employees API unavailable. Falling back to MOCK_EMPLOYEES.",
      );
      console.warn(error);
    }

    renderEmployeeFilterMenu();

    console.groupEnd();
  }

  const workplanShell = document.querySelector(".workplan-shell");
  if (workplanShell) {
    workplanShell.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
          e.preventDefault();
          workplanShell.scrollLeft += e.deltaY;
        }
      },
      { passive: false },
    );
  }

  let selectedEmployeeFilterId = "";
  const roleLabel = document.getElementById("role-label");
  const roleMenu = document.getElementById("role-menu");
  const viewModeDropdown = document.getElementById("workplan-view-mode");
  const projectFilterDropdown = document.getElementById(
    "workplan-project-filter",
  );

  const projectFilterToggle = projectFilterDropdown
    ? projectFilterDropdown.querySelector(".filter-dropdown-toggle")
    : null;

  const projectFilterMenu = projectFilterDropdown
    ? projectFilterDropdown.querySelector(".filter-dropdown-menu")
    : null;

  let apiProjects = [];

  let allWorkPlansData = [];

  let selectedWorkPlanId = null;

  function updateEmployeeFilterLabel() {
    if (!roleLabel) return;

    if (!selectedEmployeeFilterId) {
      roleLabel.textContent = "הצג לפי עובד: כל העובדים";
      return;
    }

    const selectedEmployee = getEmployeesData().find(
      (employee) =>
        String(employee.id || employee.employeeId || "").trim() ===
        String(selectedEmployeeFilterId).trim(),
    );

    roleLabel.textContent = `הצג לפי עובד: ${selectedEmployee?.fullName || "כל העובדים"}`;
  }

  function renderEmployeeFilterMenu() {
    if (!roleMenu) return;

    roleMenu.innerHTML = "";

    const createMenuItem = (label, employeeId) => {
      const item = document.createElement("div");
      item.className = "filter-dropdown-item";
      item.textContent = label;
      item.setAttribute("data-employee-id", employeeId);

      item.addEventListener("click", () => {
        selectedEmployeeFilterId = employeeId;
        updateEmployeeFilterLabel();

        const activeScopeBtn = document.querySelector(".tab-scope.active");
        const currentScope = activeScopeBtn
          ? activeScopeBtn.getAttribute("data-scope") || "company"
          : "company";

        const activeRangeBtn = document.querySelector(".tab-range.active");
        const currentRange = activeRangeBtn
          ? activeRangeBtn.getAttribute("data-range") || "daily"
          : "daily";

        applyScope(currentScope);

        if (currentRange === "weekly") {
          renderWeeklyView();
        } else if (currentRange === "monthly") {
          renderMonthlyView();
        } else if (currentRange === "yearly") {
          renderYearlyView();
        }

        closeDetails();
      });

      return item;
    };

    roleMenu.appendChild(createMenuItem("כל העובדים", ""));

    getEmployeesData().forEach((employee) => {
      const employeeId = String(
        employee.id || employee.employeeId || "",
      ).trim();
      if (!employeeId) return;

      roleMenu.appendChild(
        createMenuItem(employee.fullName || employeeId, employeeId),
      );
    });

    updateEmployeeFilterLabel();
  }

  if (projectFilterDropdown && projectFilterToggle && projectFilterMenu) {
    projectFilterToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      projectFilterDropdown.classList.toggle("open");
    });

    document.addEventListener("click", () => {
      projectFilterDropdown.classList.remove("open");
    });

    projectFilterMenu.addEventListener("click", (e) => {
      e.stopPropagation();
      projectFilterDropdown.classList.remove("open");
    });
  }

  function toggleConditionalDropdowns(scope) {
    if (viewModeDropdown) {
      if (scope === "employee") {
        viewModeDropdown.style.display = "block";
        viewModeDropdown.classList.add("visible");
      } else {
        viewModeDropdown.style.display = "none";
        viewModeDropdown.classList.remove("visible");
      }
    }

    if (projectFilterDropdown) {
      if (scope === "project") {
        projectFilterDropdown.style.display = "block";
        projectFilterDropdown.classList.add("visible");
      } else {
        projectFilterDropdown.style.display = "none";
        projectFilterDropdown.classList.remove("visible");
      }
    }
  }

  function extractTaskData() {
    console.groupCollapsed("🔍 [DATA AUDIT] Tasks data extracted from DOM");
    const tasks = [];
    document.querySelectorAll(".task[data-task-id]").forEach((task) => {
      const row = task.closest(".workplan-row");
      const taskId = task.getAttribute("data-task-id");

      const resolvedAssignee = getResolvedAssigneeNameByTaskId(taskId);
      const fallbackAssignee = row
        ? row.querySelector(".row-title")?.textContent || ""
        : "";

      const assignee = resolvedAssignee || fallbackAssignee;
      const name = task.querySelector(".task-name")?.textContent || "";
      const metaText = task.querySelector(".task-meta")?.textContent || "";
      const meta = parseMeta(metaText);
      const kind = task.getAttribute("data-kind") || "project";
      const locked = task.getAttribute("data-locked") === "true";
      const personal = task.getAttribute("data-personal") === "true";
      const projectId = task.getAttribute("data-project-id") || null;
      const serviceCallId = task.getAttribute("data-service-call-id") || null;
      const assignedRaw = task.getAttribute("data-assigned-ids") || "";
      const assignedEmployeeIds = assignedRaw
        ? assignedRaw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      const role = task.getAttribute("data-role") || "";

      const timeMatch = meta.time.match(/(\d{2}):(\d{2})–(\d{2}):(\d{2})/);
      let startHour = 0;
      let endHour = 0;
      if (timeMatch) {
        startHour = parseInt(timeMatch[1]);
        endHour = parseInt(timeMatch[3]);
      }

      tasks.push({
        id: taskId,
        name,
        assignee,
        startHour,
        endHour,
        status: meta.status,
        urgency: meta.urgency,
        kind,
        locked,
        personal,
        projectId: projectId || undefined,
        serviceCallId: serviceCallId || undefined,
        assignedEmployeeIds,
        role: role || undefined,
      });
    });
    console.log("Source: DOM elements (.task[data-task-id])");
    console.log("Count:", tasks.length);
    console.log("Data:", tasks);
    console.groupEnd();
    return tasks;
  }

  let currentWeekStart = new Date();
  currentWeekStart.setDate(
    currentWeekStart.getDate() - currentWeekStart.getDay(),
  );
  currentWeekStart.setHours(0, 0, 0, 0);

  function getTasksForWeekly() {
    if (currentWorkPlanData && currentWorkPlanData.tasks) {
      return currentWorkPlanData.tasks.map((task, index) => {
        const assignment = resolveAssignment(task, currentWorkPlanData);

        const startHour = 8 + index * 2;
        const endHour = startHour + 2;

        return {
          id: task.workItemId,
          name: task.title,
          assignee: assignment.displayName || "",
          startHour,
          endHour,
          status: task.status || "-",
          urgency: "-",
          kind: "project",
          locked: false,
          personal: false,
          projectId:
            task.parentWorkItemId ||
            currentWorkPlanData.project?.workItemId ||
            undefined,
          serviceCallId: undefined,
          assignedEmployeeIds: [],
          role: undefined,
        };
      });
    }

    return [];
  }

  function renderWeeklyView() {
    if (!currentWorkPlanData || !currentWorkPlanData.tasks) {
      console.warn("WorkPlan data not ready for rendering");
      return;
    }

    const grid = document.getElementById("weekly-grid");
    if (!grid) return;

    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const titleEl = document.getElementById("week-title");
    if (titleEl) {
      const options = { year: "numeric", month: "long", day: "numeric" };
      titleEl.textContent = `${currentWeekStart.toLocaleDateString("he-IL", options)} - ${weekEnd.toLocaleDateString("he-IL", options)}`;
    }

    const tasks = getTasksForWeekly();
    const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

    grid.innerHTML = "";

    const header = document.createElement("div");
    header.className = "workplan-weekly-header";

    const emptyHeader = document.createElement("div");
    emptyHeader.className = "workplan-weekly-name-header";
    header.appendChild(emptyHeader);

    days.forEach((day) => {
      const dayEl = document.createElement("div");
      dayEl.className = "workplan-weekly-day-header";
      const dayDate = new Date(currentWeekStart);
      dayDate.setDate(currentWeekStart.getDate() + days.indexOf(day));
      dayEl.innerHTML = `<div class="day-name">${day}</div><div class="day-date">${dayDate.getDate()}/${dayDate.getMonth() + 1}</div>`;
      header.appendChild(dayEl);
    });
    grid.appendChild(header);

    let employees = [...new Set(tasks.map((t) => t.assignee).filter(Boolean))];

    if (selectedEmployeeFilterId) {
      const selectedEmployeeName = employeeNameById(selectedEmployeeFilterId);
      employees = employees.filter(
        (employeeName) => employeeName === selectedEmployeeName,
      );
    }

    employees.forEach((employee) => {
      const row = document.createElement("div");
      row.className = "workplan-weekly-row";

      const nameCell = document.createElement("div");
      nameCell.className = "workplan-weekly-name";
      nameCell.textContent = employee;
      row.appendChild(nameCell);

      days.forEach((day, dayIndex) => {
        const dayCell = document.createElement("div");
        dayCell.className = "workplan-weekly-day";
        const dayDate = new Date(currentWeekStart);
        dayDate.setDate(currentWeekStart.getDate() + dayIndex);

        const dayTasks = tasks.filter((t) => t.assignee === employee);
        dayTasks.forEach((task) => {
          const taskEl = document.createElement("button");
          taskEl.type = "button";
          taskEl.className = `workplan-weekly-task task-${task.kind} ${task.locked ? "task-locked" : ""} ${task.personal ? "task-personal" : ""}`;
          taskEl.setAttribute("data-task-id", task.id);
          taskEl.setAttribute("data-start-hour", String(task.startHour));
          taskEl.setAttribute("data-end-hour", String(task.endHour));
          if (task.projectId) {
            taskEl.setAttribute("data-project-id", task.projectId);
          }
          if (task.serviceCallId) {
            taskEl.setAttribute("data-service-call-id", task.serviceCallId);
          }
          if (task.assignedEmployeeIds && task.assignedEmployeeIds.length) {
            taskEl.setAttribute(
              "data-assigned-ids",
              task.assignedEmployeeIds.join(","),
            );
          }
          if (task.role) {
            taskEl.setAttribute("data-role", task.role);
          }
          taskEl.innerHTML = `<div class="task-name">${task.name}</div><div class="task-meta">${task.startHour}:00-${task.endHour}:00</div>`;
          dayCell.appendChild(taskEl);
        });

        row.appendChild(dayCell);
      });

      grid.appendChild(row);
    });
  }

  let currentMonth = new Date().getMonth();
  let currentYear = new Date().getFullYear();

  function getTasksForMonthly() {
    if (currentWorkPlanData && currentWorkPlanData.tasks) {
      return currentWorkPlanData.tasks.map((task, index) => {
        const assignment = resolveAssignment(task, currentWorkPlanData);

        const startHour = 8 + (index % 4) * 2;
        const endHour = startHour + 2;
        const dayIndex = index % 7;

        return {
          id: task.workItemId,
          name: task.title,
          assignee: assignment.displayName || "",
          startHour,
          endHour,
          status: task.status || "-",
          urgency: "-",
          kind: "project",
          locked: false,
          personal: false,
          projectId:
            task.parentWorkItemId ||
            currentWorkPlanData.project?.workItemId ||
            undefined,
          serviceCallId: undefined,
          assignedEmployeeIds: [],
          role: undefined,
          dayIndex,
        };
      });
    }

    return [];
  }

  function renderMonthlyView() {
    if (!currentWorkPlanData || !currentWorkPlanData.tasks) {
      console.warn("WorkPlan data not ready for rendering");
      return;
    }

    const grid = document.getElementById("monthly-grid");
    if (!grid) return;

    const titleEl = document.getElementById("month-title");
    if (titleEl) {
      const monthNames = [
        "ינואר",
        "פברואר",
        "מרץ",
        "אפריל",
        "מאי",
        "יוני",
        "יולי",
        "אוגוסט",
        "ספטמבר",
        "אוקטובר",
        "נובמבר",
        "דצמבר",
      ];
      titleEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;
    }

    const tasks = getTasksForMonthly();
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    grid.innerHTML = "";

    const header = document.createElement("div");
    header.className = "workplan-monthly-header";
    const dayNames = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
    dayNames.forEach((day) => {
      const dayEl = document.createElement("div");
      dayEl.className = "workplan-monthly-day-header";
      dayEl.textContent = day;
      header.appendChild(dayEl);
    });
    grid.appendChild(header);

    let currentDate = new Date(startDate);
    const weeks = [];
    let week = [];

    while (currentDate <= lastDay || week.length < 7) {
      week.push(new Date(currentDate));
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
      currentDate.setDate(currentDate.getDate() + 1);
      if (
        currentDate > lastDay &&
        week.length > 0 &&
        week[0].getMonth() !== currentMonth
      ) {
        break;
      }
    }

    if (week.length > 0) {
      while (week.length < 7) {
        week.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      weeks.push(week);
    }

    weeks.forEach((weekDates) => {
      const weekRow = document.createElement("div");
      weekRow.className = "workplan-monthly-week";

      weekDates.forEach((date) => {
        const dayCell = document.createElement("div");
        dayCell.className = "workplan-monthly-day";
        if (date.getMonth() !== currentMonth) {
          dayCell.classList.add("workplan-monthly-day-other");
        }
        if (date.toDateString() === new Date().toDateString()) {
          dayCell.classList.add("workplan-monthly-day-today");
        }

        const dayNumber = document.createElement("div");
        dayNumber.className = "workplan-monthly-day-number";
        dayNumber.textContent = date.getDate();
        dayCell.appendChild(dayNumber);

        const dayTasks = document.createElement("div");
        dayTasks.className = "workplan-monthly-day-tasks";

        const dayOfWeek = date.getDay();
        const dayTasksList = tasks
          .filter((t) => t.dayIndex === dayOfWeek)
          .slice(0, 3);

        dayTasksList.forEach((task) => {
          const taskEl = document.createElement("button");
          taskEl.type = "button";
          taskEl.className = `workplan-monthly-task task-${task.kind} ${task.locked ? "task-locked" : ""}`;
          taskEl.setAttribute("data-task-id", task.id);
          taskEl.setAttribute("data-start-hour", String(task.startHour));
          taskEl.setAttribute("data-end-hour", String(task.endHour));
          if (task.projectId) {
            taskEl.setAttribute("data-project-id", task.projectId);
          }
          if (task.serviceCallId) {
            taskEl.setAttribute("data-service-call-id", task.serviceCallId);
          }
          if (task.assignedEmployeeIds && task.assignedEmployeeIds.length) {
            taskEl.setAttribute(
              "data-assigned-ids",
              task.assignedEmployeeIds.join(","),
            );
          }
          if (task.role) {
            taskEl.setAttribute("data-role", task.role);
          }
          taskEl.textContent = task.name;
          dayTasks.appendChild(taskEl);
        });

        if (tasks.length > dayTasksList.length) {
          const moreEl = document.createElement("div");
          moreEl.className = "workplan-monthly-more";
          moreEl.textContent = `+ עוד ${tasks.length - dayTasksList.length}`;
          dayTasks.appendChild(moreEl);
        }

        dayCell.appendChild(dayTasks);
        weekRow.appendChild(dayCell);
      });

      grid.appendChild(weekRow);
    });
  }

  let currentYearView = new Date().getFullYear();

  function getTasksForYearly() {
    if (currentWorkPlanData && currentWorkPlanData.tasks) {
      return currentWorkPlanData.tasks.map((task, index) => {
        const assignment = resolveAssignment(task, currentWorkPlanData);

        return {
          id: task.workItemId,
          name: task.title,
          assignee: assignment.displayName || "",
          status: task.status || "-",
          kind: "project",
          monthIndex: index % 12,
        };
      });
    }

    return [];
  }

  function renderYearlyView() {
    if (!currentWorkPlanData || !currentWorkPlanData.tasks) {
      console.warn("WorkPlan data not ready for rendering");
      return;
    }

    const grid = document.getElementById("yearly-grid");
    if (!grid) return;

    const titleEl = document.getElementById("year-title");
    if (titleEl) {
      titleEl.textContent = `שנת ${currentYearView}`;
    }

    const tasks = getTasksForYearly();
    const monthNames = [
      "ינואר",
      "פברואר",
      "מרץ",
      "אפריל",
      "מאי",
      "יוני",
      "יולי",
      "אוגוסט",
      "ספטמבר",
      "אוקטובר",
      "נובמבר",
      "דצמבר",
    ];

    grid.innerHTML = "";

    monthNames.forEach((monthName, monthIndex) => {
      const monthCard = document.createElement("button");
      monthCard.type = "button";
      monthCard.className = "workplan-yearly-month";
      monthCard.setAttribute("data-month", monthIndex);

      const monthTitle = document.createElement("div");
      monthTitle.className = "workplan-yearly-month-title";
      monthTitle.textContent = monthName;
      monthCard.appendChild(monthTitle);

      const monthCount = document.createElement("div");
      monthCount.className = "workplan-yearly-month-count";
      const taskCount = tasks.filter(
        (task) => task.monthIndex === monthIndex,
      ).length;
      monthCount.textContent = `${taskCount} משימות`;
      monthCard.appendChild(monthCount);

      monthCard.addEventListener("click", () => {
        currentMonth = monthIndex;
        currentYear = currentYearView;
        renderMonthlyView();
        const monthlyBtn = document.querySelector(
          '.tab-range[data-range="monthly"]',
        );
        if (monthlyBtn) {
          monthlyBtn.click();
        }
      });

      grid.appendChild(monthCard);
    });
  }

  const rangeButtons = document.querySelectorAll(
    ".tab-group-range [data-range]",
  );
  const views = document.querySelectorAll(".workplan-view");
  rangeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const range = btn.getAttribute("data-range");
      rangeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      views.forEach((v) =>
        v.classList.toggle("active", v.getAttribute("data-range") === range),
      );
      closeDetails();
      updateWorkplanTitle();

      if (range === "weekly") {
        renderWeeklyView();
      } else if (range === "monthly") {
        renderMonthlyView();
      } else if (range === "yearly") {
        renderYearlyView();
      }
    });
  });

  const weekPrev = document.getElementById("week-prev");
  const weekNext = document.getElementById("week-next");
  if (weekPrev) {
    weekPrev.addEventListener("click", () => {
      currentWeekStart.setDate(currentWeekStart.getDate() - 7);
      renderWeeklyView();
    });
  }
  if (weekNext) {
    weekNext.addEventListener("click", () => {
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
      renderWeeklyView();
    });
  }

  const monthPrev = document.getElementById("month-prev");
  const monthNext = document.getElementById("month-next");
  if (monthPrev) {
    monthPrev.addEventListener("click", () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      renderMonthlyView();
    });
  }
  if (monthNext) {
    monthNext.addEventListener("click", () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      renderMonthlyView();
    });
  }

  const yearPrev = document.getElementById("year-prev");
  const yearNext = document.getElementById("year-next");
  if (yearPrev) {
    yearPrev.addEventListener("click", () => {
      currentYearView--;
      renderYearlyView();
    });
  }
  if (yearNext) {
    yearNext.addEventListener("click", () => {
      currentYearView++;
      renderYearlyView();
    });
  }

  const scopeButtons = document.querySelectorAll(
    ".tab-group-scope [data-scope]",
  );
  const employeesMode = document.querySelector(".workplan-mode-employees");
  const projectsMode = document.querySelector(".workplan-mode-projects");
  const employeeRows = document.querySelectorAll(
    '.workplan-mode-employees .workplan-row[data-row-type="employee"]',
  );

  const CURRENT_SESSION_REPORTER = {
    id: "EMP-001",
    name: "רביב מעיני",
    role: "מנהל פרויקט",
  };

  function applyScope(scope, options) {
    const opts = options == null ? {} : options;
    const skipProjectIdUrlCleanup = opts.skipProjectIdUrlCleanup === true;

    if (scope !== "project" && !skipProjectIdUrlCleanup) {
      const url = new URL(window.location.href);
      if (url.searchParams.has("projectId")) {
        url.searchParams.delete("projectId");
        window.history.replaceState({}, "", url.toString());
      }
    }

    scopeButtons.forEach((b) => b.classList.remove("active"));
    const activeBtn = document.querySelector(
      `.tab-group-scope [data-scope="${scope}"]`,
    );
    if (activeBtn) {
      activeBtn.classList.add("active");
    }

    toggleConditionalDropdowns(scope);

    if (scope === "project") {
      if (employeesMode) {
        employeesMode.classList.remove("active");
      }
      if (projectsMode) {
        projectsMode.classList.add("active");
      }

      const urlPidForScope = getProjectIdFromUrl();
      const hasExplicitUrlProjectSelectionForScope =
        urlPidForScope === "all" ||
        (urlPidForScope !== null && typeof urlPidForScope === "number");
      if (!hasExplicitUrlProjectSelectionForScope) {
        void loadWorkPlanFromApi();
      }
    } else {
      if (employeesMode) {
        employeesMode.classList.add("active");
      }
      if (projectsMode) {
        projectsMode.classList.remove("active");
      }

      const employeeRows = document.querySelectorAll(
        '.workplan-mode-employees .workplan-row[data-row-type="employee"]',
      );

      const currentUserEmployeeId = getCurrentUserEmployeeId();

      employeeRows.forEach((row) => {
        const rowKey = normalizeEmployeeId(row.getAttribute("data-row-key"));

        if (scope === "personal") {
          row.style.display = rowMatchesEmployee(row, currentUserEmployeeId)
            ? "grid"
            : "none";
          return;
        }

        if (scope === "employee") {
          row.style.display =
            !selectedEmployeeFilterId ||
            rowKey === normalizeEmployeeId(selectedEmployeeFilterId)
              ? "grid"
              : "none";
          return;
        }

        row.style.display = "grid";
      });
    }

    closeDetails();
    updateWorkplanTitle();
  }

  scopeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const scope = btn.getAttribute("data-scope") || "company";
      applyScope(scope);
    });
  });

  const modalOverlay = document.getElementById("wp-modal-overlay");
  const panel = document.getElementById("workplan-details");
  const closeBtn = document.getElementById("wp-close");
  const modalBackdrop = modalOverlay?.querySelector(".wp-modal-backdrop");
  const modalMainTitle = document.getElementById("wp-modal-main-title");
  const projectContext = document.getElementById("wp-project-context");
  const projectNameEl = document.getElementById("wp-project-name");
  const projectLinkEl = document.getElementById("wp-project-link");
  const titleEl = document.getElementById("wp-title");
  const assigneeEl = document.getElementById("wp-assignee");
  const timeEl = document.getElementById("wp-time");
  const statusEl = document.getElementById("wp-status");
  const urgencyEl = document.getElementById("wp-urgency");
  const linkedEl = document.getElementById("wp-linked");

  const projectManagerMap = {
    villa: "רביב",
    abc: "רביב",
    hotel: "מנהלת פרויקטים",
  };
  const permsEl = document.getElementById("wp-perms");
  const actionEdit = document.getElementById("wp-action-edit");
  const actionLock = document.getElementById("wp-action-lock");
  const actionHint = document.getElementById("wp-action-hint");
  const viewMode = document.getElementById("wp-view-mode");
  const editMode = document.getElementById("wp-edit-mode");
  const actionsView = document.getElementById("wp-actions-view");
  const actionsEdit = document.getElementById("wp-actions-edit");
  const editTitle = document.getElementById("wp-edit-title");
  const editAssignee = document.getElementById("wp-edit-assignee");
  const editTime = document.getElementById("wp-edit-time");
  const editStatus = document.getElementById("wp-edit-status");
  const editUrgency = document.getElementById("wp-edit-urgency");
  const editLinked = document.getElementById("wp-edit-linked");
  const actionSave = document.getElementById("wp-action-save");
  const actionCancel = document.getElementById("wp-action-cancel");
  const assignedWorkersEl = document.getElementById("wp-assigned-workers");
  const roleEl = document.getElementById("wp-role");
  const editAssignedSelect = document.getElementById("wp-edit-assigned-select");
  const editAssignedAdd = document.getElementById("wp-edit-assigned-add");
  const editAssignedChips = document.getElementById("wp-edit-assigned-chips");
  const editRole = document.getElementById("wp-edit-role");

  let currentTaskElement = null;
  let editModeAssigned = [];

  function getCanonicalTaskElement(taskId) {
    if (!taskId) return null;
    const inEmployees = document.querySelector(
      '.workplan-mode-employees .task[data-task-id="' + taskId + '"]',
    );
    const inProjects = document.querySelector(
      '.workplan-mode-projects .task[data-task-id="' + taskId + '"]',
    );
    return inEmployees || inProjects || null;
  }

  function employeeNameById(id) {
    const normalizedId = String(id || "").trim();
    const e = getEmployeesData().find(
      (x) => String(x.id || x.employeeId || "").trim() === normalizedId,
    );
    return e && e.fullName ? e.fullName : id;
  }

  function getCurrentUserEmployeeId() {
    const currentUser =
      typeof window.getCurrentUser === "function"
        ? window.getCurrentUser()
        : null;

    if (!currentUser || currentUser.employeeId == null) {
      return "";
    }

    return String(currentUser.employeeId).trim();
  }

  function normalizeEmployeeId(value) {
    return String(value || "").trim();
  }

  function taskAssignedToEmployee(task, employeeId) {
    const normalizedEmployeeId = normalizeEmployeeId(employeeId);
    if (!normalizedEmployeeId || !task) {
      return false;
    }

    const assignedIds = Array.isArray(task.assignedEmployeeIds)
      ? task.assignedEmployeeIds.map(normalizeEmployeeId).filter(Boolean)
      : [];

    if (assignedIds.includes(normalizedEmployeeId)) {
      return true;
    }

    const directEmployeeId = normalizeEmployeeId(
      task.employeeId || task.assigneeEmployeeId,
    );

    return !!directEmployeeId && directEmployeeId === normalizedEmployeeId;
  }

  function rowMatchesEmployee(row, employeeId) {
    const normalizedEmployeeId = normalizeEmployeeId(employeeId);
    if (!row || !normalizedEmployeeId) {
      return false;
    }

    const rowKey = normalizeEmployeeId(row.getAttribute("data-row-key"));
    return !!rowKey && rowKey === normalizedEmployeeId;
  }

  function normalizeQuickText(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function getCurrentSessionReporterContext() {
    const selectedEmployee =
      getEmployeesData().find(
        (employee) =>
          String(employee.id || employee.employeeId || "").trim() ===
          String(selectedEmployeeFilterId || "").trim(),
      ) || null;

    if (selectedEmployee) {
      return {
        reporterId: String(
          selectedEmployee.id || selectedEmployee.employeeId || "",
        ),
        reporterName: selectedEmployee.fullName || "",
        reporterRole:
          selectedEmployee.role || selectedEmployee.primaryRole || "",
      };
    }

    if (
      CURRENT_SESSION_REPORTER &&
      (CURRENT_SESSION_REPORTER.id ||
        CURRENT_SESSION_REPORTER.name ||
        CURRENT_SESSION_REPORTER.role)
    ) {
      return {
        reporterId: CURRENT_SESSION_REPORTER.id || "",
        reporterName: CURRENT_SESSION_REPORTER.name || "",
        reporterRole: CURRENT_SESSION_REPORTER.role || "",
      };
    }

    return {
      reporterId: "",
      reporterName: "",
      reporterRole: "מנהל פרויקט",
    };
  }

  function populateAssignedSelect(excludeIds) {
    if (!editAssignedSelect) return;
    editAssignedSelect.innerHTML = '<option value="">בחר עובד</option>';
    const skip = new Set(excludeIds || []);
    getEmployeesData().forEach((emp) => {
      const employeeId = String(emp.id || emp.employeeId || "").trim();
      if (!employeeId || skip.has(employeeId)) return;

      const o = document.createElement("option");
      o.value = employeeId;
      o.textContent = emp.fullName || employeeId;
      o.dataset.name = emp.fullName || "";
      editAssignedSelect.appendChild(o);
    });
  }

  function renderEditAssignedChips() {
    if (!editAssignedChips) return;
    editAssignedChips.innerHTML = "";
    editModeAssigned.forEach((w, idx) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "wp-assigned-chip";
      chip.dataset.idx = String(idx);
      chip.dataset.id = w.id;
      chip.innerHTML =
        '<span class="wp-assigned-chip-label">' +
        (w.name || "").replace(/</g, "&lt;") +
        '</span><span class="wp-assigned-chip-remove" aria-hidden="true">×</span>';
      chip.style.cssText =
        "display:inline-flex;align-items:center;gap:0.25rem;padding:0.2rem 0.5rem;margin:0.15rem;border-radius:999px;background:var(--color-neutral-200, #e5e7eb);font-size:0.875rem;border:1px solid transparent;cursor:pointer;";
      chip.addEventListener("click", (e) => {
        const t = e.target.nodeType === 3 ? e.target.parentElement : e.target;
        if (
          !t ||
          !t.classList ||
          !t.classList.contains("wp-assigned-chip-remove")
        ) {
          return;
        }
        e.preventDefault();
        const i = parseInt(chip.dataset.idx, 10);
        if (!isNaN(i) && i >= 0 && i < editModeAssigned.length) {
          editModeAssigned.splice(i, 1);
          renderEditAssignedChips();
          populateAssignedSelect(editModeAssigned.map((x) => x.id));
        }
      });
      editAssignedChips.appendChild(chip);
    });
  }

  function closeDetails() {
    if (modalOverlay) {
      modalOverlay.classList.remove("active");
    }
    document.body.classList.remove("modal-open");
    exitEditMode();
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", closeDetails);
  }
  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", closeDetails);
  }
  if (panel) {
    panel.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  }

  function enterEditMode() {
    if (!viewMode || !editMode || !actionsView || !actionsEdit) return;

    if (editTitle) {
      editTitle.value = titleEl ? titleEl.textContent : "";
    }
    if (editAssignee) {
      editAssignee.value = assigneeEl ? assigneeEl.textContent : "";
    }
    if (editTime) {
      editTime.value = timeEl ? timeEl.textContent : "";
    }
    if (editStatus) {
      const statusText = statusEl ? statusEl.textContent : "";
      editStatus.value = statusText;
    }
    if (editUrgency) {
      const urgencyText = urgencyEl ? urgencyEl.textContent : "";
      editUrgency.value = urgencyText;
    }
    if (editLinked) {
      editLinked.value = linkedEl ? linkedEl.textContent : "";
    }

    editModeAssigned = [];
    if (currentTaskElement) {
      const raw = currentTaskElement.getAttribute("data-assigned-ids") || "";
      const ids = raw
        ? raw
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
      ids.forEach((id) => {
        editModeAssigned.push({ id, name: employeeNameById(id) });
      });
      if (editRole) {
        editRole.value = currentTaskElement.getAttribute("data-role") || "";
      }
    }

    populateAssignedSelect(editModeAssigned.map((x) => x.id));
    renderEditAssignedChips();

    viewMode.style.display = "none";
    editMode.style.display = "block";
    actionsView.style.display = "none";
    actionsEdit.style.display = "block";
  }

  function exitEditMode() {
    if (!viewMode || !editMode || !actionsView || !actionsEdit) return;

    viewMode.style.display = "block";
    editMode.style.display = "none";
    actionsView.style.display = "block";
    actionsEdit.style.display = "none";
  }

  function saveTask() {
    if (!currentTaskElement) return;

    const taskId = currentTaskElement.getAttribute("data-task-id");
    const canonical = getCanonicalTaskElement(taskId) || currentTaskElement;
    const target = canonical;

    if (editTitle && titleEl) {
      titleEl.textContent = editTitle.value;
      const taskNameEl = currentTaskElement.querySelector(".task-name");
      if (taskNameEl) {
        taskNameEl.textContent = editTitle.value;
      }
    }

    if (editAssignee && assigneeEl) {
      assigneeEl.textContent = editAssignee.value;
    }

    if (editTime && timeEl) {
      timeEl.textContent = editTime.value;
      const taskMetaEl = currentTaskElement.querySelector(".task-meta");
      if (taskMetaEl) {
        const parts = taskMetaEl.textContent.split("•");
        parts[0] = editTime.value;
        taskMetaEl.textContent = parts.join("•");
      }
    }

    if (editStatus && statusEl) {
      statusEl.textContent = editStatus.value;
      const taskMetaEl = currentTaskElement.querySelector(".task-meta");
      if (taskMetaEl) {
        const parts = taskMetaEl.textContent.split("•");
        if (parts.length > 1) {
          parts[1] = " " + editStatus.value;
        }
        taskMetaEl.textContent = parts.join("•");
      }
    }

    if (editUrgency && urgencyEl) {
      urgencyEl.textContent = editUrgency.value;
      const taskMetaEl = currentTaskElement.querySelector(".task-meta");
      if (taskMetaEl) {
        const parts = taskMetaEl.textContent.split("•");
        if (parts.length > 2) {
          parts[2] = " " + editUrgency.value;
        }
        taskMetaEl.textContent = parts.join("•");
      }
    }

    if (editLinked && linkedEl) {
      linkedEl.textContent = editLinked.value;
    }

    const assignedIds = editModeAssigned.map((w) => w.id);
    if (assignedIds.length) {
      target.setAttribute("data-assigned-ids", assignedIds.join(","));
    } else {
      target.removeAttribute("data-assigned-ids");
    }

    const roleVal = editRole ? editRole.value : "";
    if (roleVal) {
      target.setAttribute("data-role", roleVal);
    } else {
      target.removeAttribute("data-role");
    }

    if (assignedWorkersEl) {
      assignedWorkersEl.textContent = editModeAssigned.length
        ? editModeAssigned.map((w) => w.name).join(", ")
        : "—";
    }

    if (roleEl) {
      roleEl.textContent = roleVal || "—";
    }

    if (canonical !== currentTaskElement) {
      if (assignedIds.length) {
        currentTaskElement.setAttribute(
          "data-assigned-ids",
          assignedIds.join(","),
        );
      } else {
        currentTaskElement.removeAttribute("data-assigned-ids");
      }

      if (roleVal) {
        currentTaskElement.setAttribute("data-role", roleVal);
      } else {
        currentTaskElement.removeAttribute("data-role");
      }
    }

    exitEditMode();
  }

  if (actionEdit) {
    actionEdit.addEventListener("click", () => {
      if (canEditTask(currentTaskElement)) {
        enterEditMode();
      }
    });
  }

  if (actionSave) {
    actionSave.addEventListener("click", saveTask);
  }

  if (actionCancel) {
    actionCancel.addEventListener("click", exitEditMode);
  }

  if (editAssignedAdd && editAssignedSelect) {
    editAssignedAdd.addEventListener("click", () => {
      const v = editAssignedSelect.value;
      if (!v) return;
      if (editModeAssigned.some((w) => w.id === v)) return;

      const opt = editAssignedSelect.options[editAssignedSelect.selectedIndex];
      const name =
        opt && opt.dataset.name ? opt.dataset.name : opt ? opt.textContent : "";
      editModeAssigned.push({ id: v, name: name || v });
      renderEditAssignedChips();
      populateAssignedSelect(editModeAssigned.map((x) => x.id));
      editAssignedSelect.value = "";
    });
  }

  const QUICK_REPORT_KEY = "manager2_quick_report_prefill";
  const WORKPLAN_REFRESH_KEY = "manager2_workplan_refresh_needed";

  function buildQuickReportPrefill(taskEl) {
    console.groupCollapsed("🔍 [DATA AUDIT] Quick-report payload built");
    if (!taskEl) {
      console.log("No task element provided");
      console.groupEnd();
      return null;
    }

    const row = taskEl.closest(".workplan-row, .workplan-weekly-row");
    const taskId = taskEl.getAttribute("data-task-id");
    const workPlanTask = getWorkPlanTaskById(taskId);

    const assignment = workPlanTask
      ? resolveAssignment(workPlanTask, currentWorkPlanData)
      : { displayName: "" };

    const taskNameEl = taskEl.querySelector(".task-name");
    const name = taskNameEl
      ? taskNameEl.textContent.trim()
      : (taskEl.textContent || "").trim();

    const taskMetaEl = taskEl.querySelector(".task-meta");
    const metaText = taskMetaEl ? taskMetaEl.textContent : "";
    const meta = parseMeta(metaText);

    const projectAttr = row ? row.getAttribute("data-project") : null;
    const rowTitle = row
      ? (
          row.querySelector(".row-title, .workplan-weekly-name")?.textContent ||
          ""
        ).trim()
      : "";

    const today = new Date();
    const date =
      today.getFullYear() +
      "-" +
      String(today.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(today.getDate()).padStart(2, "0");

    let projectId =
      taskEl.getAttribute("data-project-id") ||
      workPlanTask?.parentWorkItemId ||
      currentWorkPlanData?.project?.workItemId ||
      null;

    let customerName = currentWorkPlanData?.project?.title || null;
    let site = "";

    if (projectAttr === "villa" || name.includes("וילה רמת אביב")) {
      projectId = "PRJ-001";
      customerName = "וילה רמת אביב";
      site = site || "וילה רמת אביב";
    } else if (
      projectAttr === "abc" ||
      name.includes("ABC") ||
      name.includes("משרדי")
    ) {
      projectId = "PRJ-004";
      customerName = "חברת ABC בע״מ";
      site = site || "משרדי חברת ABC";
    } else if (name.includes("מלון דן")) {
      projectId = "PRJ-002";
      customerName = "מלון דן תל אביב";
      site = "מלון דן תל אביב";
    } else if (name.includes("אורכידאה")) {
      projectId = "PRJ-003";
      customerName = "מלון אורכידאה תל אביב";
      site = "מלון אורכידאה תל אביב";
    } else if (name.includes("בית פרטי חיפה") || name.includes("חיפה")) {
      site = (name.split("–")[0] || "").trim() || rowTitle || "";
    }

    let start = "";
    let end = "";
    const timeMatch =
      meta.time && meta.time.match(/(\d{1,2}):(\d{2})[-–](\d{1,2}):(\d{2})/);
    if (timeMatch) {
      start =
        String(parseInt(timeMatch[1], 10)).padStart(2, "0") +
        ":" +
        timeMatch[2];
      end =
        String(parseInt(timeMatch[3], 10)).padStart(2, "0") +
        ":" +
        timeMatch[4];
    } else {
      const sh = taskEl.getAttribute("data-start-hour");
      const eh = taskEl.getAttribute("data-end-hour");
      if (sh != null && eh != null) {
        start = String(sh).padStart(2, "0") + ":00";
        end = String(eh).padStart(2, "0") + ":00";
      }
    }

    const assignee =
      assignment.displayName ||
      (row && !projectAttr
        ? (
            row.querySelector(".row-title, .workplan-weekly-name")
              ?.textContent || ""
          ).trim()
        : "");

    const sessionReporter = getCurrentSessionReporterContext();
    const serviceCallId = taskEl.getAttribute("data-service-call-id") || null;

    const payload = {
      date,
      projectId,
      projectName: currentWorkPlanData?.project?.title || "",
      customerName,
      site,
      start,
      end,
      reporterId: sessionReporter.reporterId || "",
      reporterName: sessionReporter.reporterName || "",
      reporterRole: sessionReporter.reporterRole || "",
      taskAssigneeName: assignee || "",
      serviceCallId: serviceCallId || undefined,
    };

    console.log("Source: Task element + DOM extraction");
    console.log("Payload:", payload);
    console.groupEnd();
    return payload;
  }

  const actionQuickReport = document.getElementById("wp-action-quick-report");
  if (actionQuickReport) {
    actionQuickReport.addEventListener("click", () => {
      if (!currentTaskElement) return;
      const prefill = buildQuickReportPrefill(currentTaskElement);
      if (!prefill) return;
      try {
        console.groupCollapsed(
          "🔍 [DATA AUDIT] Quick-report payload passed to reports",
        );
        console.log("Storage key:", QUICK_REPORT_KEY);
        console.log("Payload:", prefill);
        sessionStorage.setItem(QUICK_REPORT_KEY, JSON.stringify(prefill));
        console.log(
          "Stored in sessionStorage, navigating to reports.html?quick=1",
        );
        console.groupEnd();
        sessionStorage.setItem(QUICK_REPORT_KEY, JSON.stringify(prefill));
        sessionStorage.setItem(WORKPLAN_REFRESH_KEY, "1");
        window.location.href = "reports.html?quick=1";
      } catch (e) {
        console.error("Error storing quick report prefill:", e);
      }
    });
  }

  function parseMeta(metaText) {
    const parts = metaText.split("•").map((p) => p.trim());
    return {
      time: parts[0] || "-",
      status: parts[1] || "-",
      urgency: parts[2] || "-",
      updated: (parts[3] || "-").replace("עודכן:", "").trim(),
    };
  }

  function canEditTask(taskEl) {
    if (!taskEl) return false;

    const locked = taskEl.getAttribute("data-locked") === "true";
    const personal = taskEl.getAttribute("data-personal") === "true";
    const currentScope = getCurrentScope();

    if (locked) {
      return false;
    }

    if (currentScope === "personal") {
      return personal;
    }

    return true;
  }

  function canLockTask() {
    const currentScope = getCurrentScope();
    return currentScope !== "personal";
  }

  function isTaskReportRelevant(taskEl) {
    if (!taskEl) return false;
    const pid = taskEl.getAttribute("data-project-id");
    const sid = taskEl.getAttribute("data-service-call-id");
    return !!(pid && pid.trim()) || !!(sid && sid.trim());
  }

  function updatePanelActions(taskEl) {
    const locked = taskEl.getAttribute("data-locked") === "true";
    const personal = taskEl.getAttribute("data-personal") === "true";
    const editable = canEditTask(taskEl);
    const currentScope = getCurrentScope();

    if (actionEdit) {
      actionEdit.disabled = !editable;
    }

    if (actionLock) {
      actionLock.disabled = !canLockTask();
    }

    if (actionQuickReport) {
      actionQuickReport.style.display = isTaskReportRelevant(taskEl)
        ? ""
        : "none";
    }

    if (permsEl) {
      if (currentScope === "personal") {
        permsEl.textContent = locked
          ? "אין הרשאה: משימה נעולה."
          : personal
            ? "יש הרשאה: ניתן לערוך/לגרור משימות אישיות."
            : "אין הרשאה: בחתך אישי ניתן לשנות רק משימות אישיות.";
      } else if (currentScope === "project") {
        permsEl.textContent =
          "הרשאות פרויקט: ניתן לערוך משימות פעילות ולנהל שיוכים.";
      } else {
        permsEl.textContent =
          "הרשאות תצוגה כללית: ניתן לערוך משימות לא נעולות ולצפות בפרטים.";
      }
    }

    if (actionHint) {
      if (!editable && currentScope === "personal") {
        actionHint.textContent =
          "כדי לשנות משימה שאינה אישית או נעולה — עבור לחתך מתאים או פנה למנהל.";
      } else if (editable) {
        actionHint.textContent =
          "גרירה/שינוי זמן משימה מתאפשרים רק לפי ההרשאות הפעילות.";
      } else {
        actionHint.textContent = "";
      }
    }
  }

  function getCurrentScope() {
    const activeScopeBtn = document.querySelector(".tab-scope.active");
    if (!activeScopeBtn) return "company";
    const scopeId = activeScopeBtn.getAttribute("data-scope");
    return scopeId || "company";
  }

  function getStatusBadgeClass(status) {
    if (!status) return "badge-neutral";
    const statusLower = status.toLowerCase();
    if (statusLower.includes("מתוכנן") || statusLower.includes("תכנון")) {
      return "badge-neutral";
    }
    if (statusLower.includes("בביצוע") || statusLower.includes("ביצוע")) {
      return "badge-primary";
    }
    if (statusLower.includes("הושלם") || statusLower.includes("סיום")) {
      return "badge-success";
    }
    if (statusLower.includes("תקוע") || statusLower.includes("בעיה")) {
      return "badge-danger";
    }
    return "badge-neutral";
  }

  function openTaskPanel(taskEl) {
    if (!taskEl) return;

    const currentScope = getCurrentScope();
    const isProjectScope = currentScope === "project";

    const row = taskEl.closest(".workplan-row, .workplan-weekly-row");
    let assignee = "-";
    let projectId = null;
    let projectName = null;
    let projectManager = null;

    if (row) {
      const rowTitle =
        row.querySelector(".row-title, .workplan-weekly-name")?.textContent ||
        "";
      const projectAttr = row.getAttribute("data-project");

      if (isProjectScope && projectAttr) {
        projectId = projectAttr;
        projectName = rowTitle;
        projectManager = projectManagerMap[projectId] || "לא הוגדר";
      }
    }

    let assignment = {
      displayName: "—",
      source: "none",
      type: null,
    };

    if (currentWorkPlanData && taskEl) {
      const taskId = taskEl.getAttribute("data-task-id");

      const task = currentWorkPlanData.tasks.find(
        (t) => String(t.workItemId) === String(taskId),
      );

      if (task) {
        assignment = resolveAssignment(task, currentWorkPlanData);
      }
    }

    assignee = assignment.displayName || "—";

    const taskNameEl = taskEl.querySelector(".task-name");
    const name = taskNameEl
      ? taskNameEl.textContent
      : taskEl.textContent.trim().split("\n")[0] || "-";
    const taskMetaEl = taskEl.querySelector(".task-meta");
    const metaText = taskMetaEl ? taskMetaEl.textContent : "";
    const meta = parseMeta(metaText);

    if (isProjectScope && projectName) {
      if (modalMainTitle) {
        modalMainTitle.textContent = "פרטי הפרויקט";
      }
      if (projectContext) {
        projectContext.style.display = "block";
      }
      if (projectNameEl) {
        projectNameEl.textContent = projectName;
      }
      if (projectLinkEl && projectId) {
        projectLinkEl.href = `../pages/projects.html?projectId=${projectId}`;
      }
    } else {
      if (modalMainTitle) {
        modalMainTitle.textContent = "פרטי משימה";
      }
      if (projectContext) {
        projectContext.style.display = "none";
      }
    }

    if (titleEl) {
      titleEl.textContent = name;
    }
    if (assigneeEl) {
      assigneeEl.textContent = assignee || "—";
    }
    if (timeEl) {
      timeEl.textContent = meta.time || "-";
    }

    if (statusEl) {
      const statusBadge = statusEl.querySelector("#wp-status-badge");
      const actualStatus =
        meta.urgency && meta.urgency !== "-"
          ? meta.urgency
          : meta.status && meta.status !== "-"
            ? meta.status
            : "-";

      if (statusBadge) {
        if (actualStatus && actualStatus !== "-") {
          statusBadge.textContent = actualStatus;
          statusBadge.className = `badge ${getStatusBadgeClass(actualStatus)}`;
          statusBadge.style.display = "inline-block";
        } else {
          statusBadge.textContent = "-";
          statusBadge.className = "badge badge-neutral";
          statusBadge.style.display = "inline-block";
        }
      } else {
        statusEl.innerHTML = "";
        const badge = document.createElement("span");
        badge.id = "wp-status-badge";
        badge.className =
          actualStatus && actualStatus !== "-"
            ? `badge ${getStatusBadgeClass(actualStatus)}`
            : "badge badge-neutral";
        badge.textContent = actualStatus || "-";
        statusEl.appendChild(badge);
      }
    }

    if (urgencyEl) {
      urgencyEl.textContent = meta.urgency || "-";
    }

    if (linkedEl) {
      if (name.includes("וילה רמת אביב")) {
        linkedEl.textContent =
          "פרויקט: וילה רמת אביב • לקוח: וילה רמת אביב • שירות: לפי צורך";
      } else if (name.includes("ABC")) {
        linkedEl.textContent =
          "פרויקט: משרדי חברת ABC • לקוח: חברת ABC בע״מ • שירות: #2456";
      } else if (name.includes("מלון דן")) {
        linkedEl.textContent =
          "פרויקט: מלון דן תל אביב • לקוח: מלון דן • ציוד: ארון תקשורת";
      } else {
        linkedEl.textContent = "משימה פנימית/משרדית (ללא קישור לפרויקט).";
      }
    }

    const assignedRaw = taskEl.getAttribute("data-assigned-ids") || "";
    const assignedIds = assignedRaw
      ? assignedRaw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    if (assignedWorkersEl) {
      assignedWorkersEl.textContent = assignedIds.length
        ? assignedIds.map((id) => employeeNameById(id)).join(", ")
        : "—";
    }

    const taskRole = taskEl.getAttribute("data-role") || "";
    if (roleEl) {
      roleEl.textContent = taskRole || "—";
    }

    currentTaskElement = taskEl;
    updatePanelActions(taskEl);
    exitEditMode();
    if (modalOverlay) {
      modalOverlay.classList.add("active");
      document.body.classList.add("modal-open");
    }
  }

  function handleTaskClick(e) {
    if (isDragging) return;
    const taskEl = e.target.closest(
      ".task[data-task-id], .workplan-weekly-task[data-task-id], .workplan-monthly-task[data-task-id]",
    );
    if (taskEl && taskEl.closest(".workplan-view")) {
      e.stopPropagation();
      openTaskPanel(taskEl);
    }
  }

  const contentArea = document.querySelector(".content-wide, .content");
  if (contentArea) {
    contentArea.addEventListener("click", handleTaskClick);
  }

  const workplanViews = document.querySelectorAll(".workplan-view");
  workplanViews.forEach((view) => {
    view.addEventListener("click", handleTaskClick);
  });

  let dragTask = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartLeftPx = 0;
  let isDragging = false;

  function getCurrentScope() {
    const activeScopeBtn = document.querySelector(".tab-scope.active");
    return activeScopeBtn
      ? activeScopeBtn.getAttribute("data-scope") || "company"
      : "company";
  }

  function updateTaskInteractivity() {
    const currentScope = getCurrentScope();

    document.querySelectorAll(".task[data-task-id]").forEach((task) => {
      const locked = task.getAttribute("data-locked") === "true";
      const personal = task.getAttribute("data-personal") === "true";

      const allowed =
        currentScope === "personal" ? personal && !locked : !locked;

      task.classList.toggle("task-draggable", allowed);
      task.setAttribute("aria-disabled", allowed ? "false" : "true");
    });
  }

  function onMouseDown(e) {
    const task = e.target.closest(".task.task-draggable");
    if (!task) return;
    if (!task.closest(".workplan-track")) return;
    dragTask = task;
    dragStartX = e.clientX;
    dragStartLeftPx = task.offsetLeft;
    dragStartY = e.clientY;
    task.classList.add("dragging");
  }

  function onMouseMove(e) {
    if (!dragTask) return;
    const dx = Math.abs(e.clientX - dragStartX);
    const dy = Math.abs(e.clientY - dragStartY);
    if (dx > 5 || dy > 5) {
      isDragging = true;
      const track = dragTask.closest(".workplan-track");
      if (!track) return;

      const rawLeft = dragStartLeftPx + (e.clientX - dragStartX);
      const maxLeft = track.clientWidth - dragTask.offsetWidth;
      const clampedLeft = Math.max(0, Math.min(maxLeft, rawLeft));

      dragTask.style.left = `${clampedLeft}px`;
    }
  }

  function snapToHour(task) {
    const track = task.closest(".workplan-track");
    if (!track) return;
    const hourWidth = track.clientWidth / 24;
    const leftPx = task.offsetLeft;
    const snappedHour = Math.round(leftPx / hourWidth);
    const snappedLeft = snappedHour * hourWidth;
    task.style.left = `${snappedLeft}px`;

    const meta = task.querySelector(".task-meta");
    if (meta) {
      const parts = meta.textContent.split("•").map((p) => p.trim());
      const durationHours = Math.max(
        1,
        Math.round(task.offsetWidth / hourWidth),
      );
      const start = snappedHour;
      const end = Math.min(24, start + durationHours);
      const timeText = `${String(start).padStart(2, "0")}:00–${String(end).padStart(2, "0")}:00`;
      parts[0] = timeText;
      const updatedIdx = parts.findIndex((p) => p.startsWith("עודכן"));
      if (updatedIdx >= 0) {
        parts[updatedIdx] = "עודכן: עכשיו";
      } else {
        parts.push("עודכן: עכשיו");
      }
      meta.textContent = parts.join(" • ");
    }
  }

  function onMouseUp() {
    if (!dragTask) return;
    const wasDragging = isDragging;
    const taskEl = dragTask;
    dragTask.classList.remove("dragging");
    if (wasDragging) {
      snapToHour(taskEl);
    }
    dragTask = null;
    isDragging = false;
    dragStartX = 0;
    dragStartY = 0;
  }

  document.addEventListener("mousedown", onMouseDown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("mouseup", onMouseUp);

  updateEmployeeFilterLabel();

  function updateWorkplanTitle() {
    const titleEl = document.getElementById("workplan-title");
    if (!titleEl) return;

    const activeScopeBtn = document.querySelector(".tab-scope.active");
    const activeRangeBtn = document.querySelector(".tab-range.active");

    const scopeMap = {
      company: "כללי",
      personal: "אישי",
      employee: "לפי עובד",
      project: "לפי פרויקט",
    };

    const rangeMap = {
      daily: "יומי",
      weekly: "שבועי",
      monthly: "חודשי",
      yearly: "שנתי",
    };

    const scope = activeScopeBtn
      ? activeScopeBtn.getAttribute("data-scope") || "company"
      : "company";
    const range = activeRangeBtn
      ? activeRangeBtn.getAttribute("data-range") || "daily"
      : "daily";

    const scopeText = scopeMap[scope] || "כללי";
    const rangeTextMap = {
      יומי: "יומית",
      שבועי: "שבועית",
      חודשי: "חודשית",
      שנתי: "שנתית",
    };
    const rangeText = rangeMap[range] || "יומי";
    const rangeDisplayText = rangeTextMap[rangeText] || "יומית";

    titleEl.textContent = `תוכנית עבודה – חתך: ${scopeText} | תצוגה: ${rangeDisplayText}`;
  }

  applyScope("company", { skipProjectIdUrlCleanup: true });
  updateWorkplanTitle();
  toggleConditionalDropdowns("company");

  async function fetchWorkPlan(projectId) {
    try {
      console.groupCollapsed("🌐 [API] Fetch WorkPlan");

      const response = await fetch(
        `http://localhost:5161/api/WorkItems/${projectId}/work-plan`,
      );

      console.log("Request URL:", `/api/WorkItems/${projectId}/work-plan`);
      console.log("Status:", response.status);

      if (!response.ok) {
        console.error("❌ Failed to fetch WorkPlan");
        console.groupEnd();
        return null;
      }

      const data = await response.json();

      console.log("Response:", data);
      console.groupEnd();

      return data;
    } catch (err) {
      console.error("❌ Error fetching WorkPlan:", err);
      return null;
    }
  }

  function resolveAssignment(task, workPlan) {
    if (!workPlan || !workPlan.assignments) {
      return {
        displayName: "—",
        source: "none",
        type: null,
        employeeId: null,
        contractorId: null,
        role: "",
      };
    }

    let assignment = workPlan.assignments.find(
      (a) => a.workItemId === task.workItemId,
    );

    let source = "task";

    if (!assignment) {
      assignment = workPlan.assignments.find(
        (a) => a.workItemId === workPlan.project.workItemId,
      );
      source = assignment ? "project" : "none";
    }

    if (!assignment) {
      return {
        displayName: "—",
        source: "none",
        type: null,
        employeeId: null,
        contractorId: null,
        role: "",
      };
    }

    if (assignment.employeeName) {
      return {
        displayName: assignment.employeeName,
        source,
        type: "employee",
        employeeId:
          assignment.employeeId != null ? String(assignment.employeeId) : null,
        contractorId: null,
        role: assignment.assignmentRole || "",
      };
    }

    if (assignment.contractorName) {
      return {
        displayName: assignment.contractorName,
        source,
        type: "contractor",
        employeeId: null,
        contractorId:
          assignment.contractorId != null
            ? String(assignment.contractorId)
            : null,
        role: assignment.assignmentRole || "",
      };
    }

    if (assignment.employeeId) {
      return {
        displayName: `Employee #${assignment.employeeId}`,
        source,
        type: "employee",
        employeeId: String(assignment.employeeId),
        contractorId: null,
        role: assignment.assignmentRole || "",
      };
    }

    if (assignment.contractorId) {
      return {
        displayName: `Contractor #${assignment.contractorId}`,
        source,
        type: "contractor",
        employeeId: null,
        contractorId: String(assignment.contractorId),
        role: assignment.assignmentRole || "",
      };
    }

    return {
      displayName: "—",
      source: "none",
      type: null,
      employeeId: null,
      contractorId: null,
      role: "",
    };
  }

  function getResolvedAssigneeNameByTaskId(taskId) {
    if (!currentWorkPlanData || !currentWorkPlanData.tasks || !taskId) {
      return "";
    }

    const task = currentWorkPlanData.tasks.find(
      (t) => String(t.workItemId) === String(taskId),
    );

    if (!task) {
      return "";
    }

    const assignment = resolveAssignment(task, currentWorkPlanData);
    return assignment.displayName || "";
  }

  function getWorkPlanTaskById(taskId) {
    if (!currentWorkPlanData || !currentWorkPlanData.tasks || !taskId) {
      return null;
    }

    return (
      currentWorkPlanData.tasks.find(
        (t) => String(t.workItemId) === String(taskId),
      ) || null
    );
  }

  async function loadProjectsFromApi() {
    const response = await fetch(
      "http://localhost:5161/api/WorkItems/type/Project",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        "Projects API request failed with status " + response.status,
      );
    }

    const data = await response.json();

    apiProjects = Array.isArray(data)
      ? data
          .map((item) => ({
            id: item && item.workItemId != null ? String(item.workItemId) : "",
            title: item && item.title ? item.title : "",
          }))
          .filter((project) => project.id && project.title)
      : [];
  }

  async function loadAllWorkPlansFromApi() {
    const data = await window.apiRequest("/WorkItems/work-plan/all");

    allWorkPlansData = Array.isArray(data) ? data : [];

    if (
      selectedWorkPlanId == null &&
      allWorkPlansData.length > 0 &&
      getProjectIdFromUrl() !== "all"
    ) {
      const firstProjectId = allWorkPlansData[0]?.project?.workItemId;
      if (firstProjectId != null) {
        selectedWorkPlanId = firstProjectId;
      }
    }

    console.groupCollapsed("📦 [ALL WORKPLANS API]");
    console.log("Raw all workplans data:", data);
    console.log("Resolved allWorkPlansData:", allWorkPlansData);
    console.log("All workplans count:", allWorkPlansData.length);
    console.log("selectedWorkPlanId:", selectedWorkPlanId);
    console.groupEnd();
  }

  function populateProjectFilterDropdown(selectedProjectId) {
    if (!projectFilterDropdown || !projectFilterMenu || !projectFilterToggle) {
      return;
    }

    projectFilterMenu.innerHTML = "";

    const dropdownProjects = [];
    const seenProjectIds = new Set();

    allWorkPlansData.forEach((workPlan) => {
      const projectId = String(workPlan?.project?.workItemId || "").trim();
      const projectTitle = String(workPlan?.project?.title || "").trim();

      if (!projectId || !projectTitle || seenProjectIds.has(projectId)) {
        return;
      }

      seenProjectIds.add(projectId);
      dropdownProjects.push({
        id: projectId,
        title: projectTitle,
      });
    });

    const isAllProjectsSelected =
      String(selectedProjectId || "")
        .trim()
        .toLowerCase() === "all";

    const allProjectsItem = document.createElement("div");
    allProjectsItem.className = "filter-dropdown-item";
    allProjectsItem.textContent = "כל הפרויקטים";
    allProjectsItem.setAttribute("data-project-id", "all");

    if (isAllProjectsSelected) {
      allProjectsItem.classList.add("active");
    }

    allProjectsItem.addEventListener("click", async () => {
      await handleProjectFilterChange("all");
    });

    projectFilterMenu.appendChild(allProjectsItem);

    const selectedProject = dropdownProjects.find(
      (project) => String(project.id) === String(selectedProjectId),
    );

    projectFilterToggle.innerHTML = `
      ${
        isAllProjectsSelected
          ? "כל הפרויקטים"
          : selectedProject
            ? selectedProject.title
            : "סינון לפי פרויקט"
      }
      <span>▼</span>
    `;

    dropdownProjects.forEach((project) => {
      const item = document.createElement("div");
      item.className = "filter-dropdown-item";
      item.setAttribute("data-project-id", project.id);
      const sameTitleProjects = dropdownProjects.filter(
        (p) => String(p.title).trim() === String(project.title).trim(),
      );

      item.textContent =
        sameTitleProjects.length > 1
          ? `${project.title} (#${project.id})`
          : project.title;

      if (String(project.id) === String(selectedProjectId)) {
        item.classList.add("active");
      }

      item.addEventListener("click", async () => {
        await handleProjectFilterChange(project.id);
      });

      projectFilterMenu.appendChild(item);
    });
  }

  function setProjectIdInUrl(projectId) {
    const url = new URL(window.location.href);
    url.searchParams.set("projectId", String(projectId));
    window.history.replaceState({}, "", url.toString());
  }

  function getEffectiveProjectId() {
    const projectIdFromUrl = getProjectIdFromUrl();

    if (projectIdFromUrl === "all") {
      return {
        projectId: "all",
        source: "URL",
      };
    }

    if (selectedWorkPlanId != null) {
      return {
        projectId: selectedWorkPlanId,
        source: "SELECTED",
      };
    }

    if (
      projectIdFromUrl !== null &&
      apiProjects.some(
        (project) => String(project.id) === String(projectIdFromUrl),
      )
    ) {
      return {
        projectId: projectIdFromUrl,
        source: "URL",
      };
    }

    return {
      projectId: null,
      source: "DEFAULT",
    };
  }

  async function handleProjectFilterChange(projectId) {
    if (!projectId) {
      return;
    }

    if (String(projectId).trim().toLowerCase() === "all") {
      selectedWorkPlanId = null;
    } else {
      selectedWorkPlanId = projectId;
    }

    setProjectIdInUrl(projectId);
    await loadWorkPlanFromApi();
  }

  function isAllProjectsMode() {
    const urlProjectId = getProjectIdFromUrl();

    if (
      String(urlProjectId || "")
        .trim()
        .toLowerCase() === "all"
    ) {
      return true;
    }

    return urlProjectId === null;
  }

  function getProjectIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const rawProjectId = params.get("projectId");

    if (!rawProjectId) {
      return null;
    }

    const normalizedProjectId = String(rawProjectId).trim().toLowerCase();

    if (normalizedProjectId === "all") {
      return "all";
    }

    const parsedProjectId = parseInt(rawProjectId, 10);

    if (Number.isNaN(parsedProjectId) || parsedProjectId <= 0) {
      return null;
    }

    return parsedProjectId;
  }

  let currentWorkPlanData = null;

  function clearWorkPlanViews() {
    const weeklyGrid = document.getElementById("weekly-grid");
    const monthlyGrid = document.getElementById("monthly-grid");
    const yearlyGrid = document.getElementById("yearly-grid");

    if (weeklyGrid) {
      weeklyGrid.innerHTML = "";
    }

    if (monthlyGrid) {
      monthlyGrid.innerHTML = "";
    }

    if (yearlyGrid) {
      yearlyGrid.innerHTML = "";
    }

    document
      .querySelectorAll(".workplan-mode-projects .workplan-grid .workplan-row")
      .forEach((row) => row.remove());

    document
      .querySelectorAll(".workplan-mode-employees .workplan-grid .workplan-row")
      .forEach((row) => row.remove());

    const weekTitle = document.getElementById("week-title");
    const monthTitle = document.getElementById("month-title");
    const yearTitle = document.getElementById("year-title");

    if (weekTitle) {
      weekTitle.textContent = "לא נבחר פרויקט";
    }

    if (monthTitle) {
      monthTitle.textContent = "לא נבחר פרויקט";
    }

    if (yearTitle) {
      yearTitle.textContent = "לא נבחר פרויקט";
    }
  }

  async function loadWorkPlanFromApi() {
    await Promise.all([
      loadProjectsFromApi(),
      loadEmployeesFromApi(),
      loadAllWorkPlansFromApi(),
    ]);

    const projectIdFromUrl = getProjectIdFromUrl();
    const { projectId: effectiveProjectId, source: projectIdSource } =
      getEffectiveProjectId();

    if (effectiveProjectId === null) {
      currentWorkPlanData = null;
      clearWorkPlanViews();
      console.warn("No projects available for WorkPlan");
      console.log("Selected projectId source:", projectIdSource);
      return;
    }

    const hasExplicitUrlProjectSelection =
      projectIdFromUrl === "all" ||
      (projectIdFromUrl !== null && typeof projectIdFromUrl === "number");

    const resolvedProjectId = hasExplicitUrlProjectSelection
      ? projectIdFromUrl
      : "all";

    if (projectIdSource === "URL") {
      setProjectIdInUrl(effectiveProjectId);
    }

    populateProjectFilterDropdown(resolvedProjectId);

    if (resolvedProjectId === "all") {
      currentWorkPlanData = {
        project: null,
        tasks: [],
        assignments: [],
      };

      clearWorkPlanViews();
      renderTasksFromAPI(currentWorkPlanData);
      updateWorkplanTitle();

      console.groupCollapsed("📦 [MAPPED DATA]");
      console.log("Project ID from URL:", projectIdFromUrl);
      console.log("Selected projectId source:", projectIdSource);
      console.log("Effective Project ID:", effectiveProjectId);
      console.log("All WorkPlans:", allWorkPlansData);
      console.groupEnd();

      return;
    }

    const workPlan = await window.WorkPlanApi.getWorkPlanById(effectiveProjectId);
    currentWorkPlanData = workPlan;

    if (!workPlan) {
      clearWorkPlanViews();
      console.warn("No work plan returned from API");
      console.log("Selected projectId source:", projectIdSource);
      return;
    }

    const mappedEmployees =
      window.WorkPlanMappers.mapEmployeeResponse(getEmployeesData());

    const algorithmInputModel =
      window.WorkPlanAlgorithmModel.buildAssignmentInputModel(workPlan, {
        employees: mappedEmployees,
      });
    console.log("algorithmInputModel:", algorithmInputModel);

    renderTasksFromAPI(workPlan);
    renderWeeklyView();
    renderMonthlyView();
    renderYearlyView();
    updateWorkplanTitle();

    console.groupCollapsed("📦 [MAPPED DATA]");
    console.log("Project ID from URL:", projectIdFromUrl);
    console.log("Selected projectId source:", projectIdSource);
    console.log("Effective Project ID:", effectiveProjectId);
    console.log("Resolved Project ID:", resolvedProjectId);
    console.log("Project:", workPlan.project);
    console.log("Tasks:", workPlan.tasks);
    console.log("Assignments:", workPlan.assignments);
    console.groupEnd();
  }

  async function refreshWorkPlan() {
    await loadWorkPlanFromApi();
    console.log("🔄 WorkPlan refreshed");
  }

  async function refreshWorkPlanIfNeeded() {
    const refreshNeeded = sessionStorage.getItem(WORKPLAN_REFRESH_KEY);

    if (refreshNeeded !== "1") {
      return;
    }

    sessionStorage.removeItem(WORKPLAN_REFRESH_KEY);
    await refreshWorkPlan();
  }

  function renderTasksFromAPI(workPlan) {
    const allProjectsMode = isAllProjectsMode();

    if (!allProjectsMode && (!workPlan || !Array.isArray(workPlan.tasks))) {
      return;
    }

    console.groupCollapsed("🎯 Rendering Tasks From API");

    if (allProjectsMode) {
      renderDailyAllProjectsModeFromApi(allWorkPlansData);
      console.log(
        "Rendered all projects:",
        Array.isArray(allWorkPlansData) ? allWorkPlansData.length : 0,
      );
    } else {
      renderDailyProjectModeFromApi(workPlan);
      console.log("Rendered tasks:", workPlan.tasks.length);
    }

    renderDailyEmployeesModeFromApi(workPlan);

    console.groupEnd();
  }

  function renderDailyProjectModeFromApi(workPlan) {
    const projectsGrid = document.querySelector(
      ".workplan-mode-projects .workplan-grid",
    );

    if (!projectsGrid) {
      console.warn("Projects daily grid was not found");
      return;
    }

    const header = projectsGrid.querySelector(".workplan-header");

    if (!header) {
      console.warn("Projects daily grid header was not found");
      return;
    }

    projectsGrid
      .querySelectorAll(".workplan-row")
      .forEach((row) => row.remove());

    const row = document.createElement("div");
    row.className = "workplan-row";
    row.setAttribute("data-row-type", "project");
    row.setAttribute(
      "data-project-id",
      String(workPlan.project?.workItemId || ""),
    );

    const stickyCol = document.createElement("div");
    stickyCol.className = "workplan-sticky-col row-cell";

    const rowTitle = document.createElement("div");
    rowTitle.className = "row-title";
    rowTitle.textContent = workPlan.project?.title || "פרויקט";

    const rowSubtitle = document.createElement("div");
    rowSubtitle.className = "row-subtitle";
    rowSubtitle.textContent =
      "משימות פרויקט • " + String(workPlan.tasks.length || 0);

    stickyCol.appendChild(rowTitle);
    stickyCol.appendChild(rowSubtitle);

    const track = document.createElement("div");
    track.className = "workplan-track";
    track.setAttribute(
      "data-drop-row",
      "project-" + String(workPlan.project?.workItemId || "current"),
    );

    workPlan.tasks.forEach((task, index) => {
      const assignment = resolveAssignment(task, workPlan);
      const startHour = Math.min(8 + index * 2, 22);
      const duration = 2;
      const endHour = Math.min(startHour + duration, 24);

      const taskEl = document.createElement("button");
      taskEl.type = "button";
      taskEl.className = "task task-project";
      taskEl.setAttribute("data-task-id", String(task.workItemId));
      taskEl.setAttribute(
        "data-project-id",
        String(task.parentWorkItemId || workPlan.project?.workItemId || ""),
      );
      taskEl.setAttribute("data-start-hour", String(startHour));
      taskEl.setAttribute("data-end-hour", String(endHour));
      taskEl.setAttribute("data-assignee-name", assignment.displayName || "");
      taskEl.setAttribute(
        "data-assignment-source",
        assignment.source || "none",
      );
      taskEl.setAttribute("data-assignment-type", assignment.type || "");

      taskEl.style.left = `calc((${startHour} / 24) * 100%)`;
      taskEl.style.width = `calc((${Math.max(endHour - startHour, 1)} / 24) * 100%)`;

      taskEl.innerHTML = `
        <div class="task-name">${task.title || ""}</div>
        <div class="task-meta">
          ${String(startHour).padStart(2, "0")}:00–${String(endHour).padStart(2, "0")}:00
          • ${task.status || "-"}
          • ${assignment.displayName || "ללא שיוך"}
        </div>
      `;

      track.appendChild(taskEl);
    });

    row.appendChild(stickyCol);
    row.appendChild(track);

    projectsGrid.appendChild(row);
  }

  function renderDailyAllProjectsModeFromApi(workPlans) {
    const projectsGrid = document.querySelector(
      ".workplan-mode-projects .workplan-grid",
    );

    if (!projectsGrid) {
      console.warn("Projects daily grid was not found");
      return;
    }

    const header = projectsGrid.querySelector(".workplan-header");

    if (!header) {
      console.warn("Projects daily grid header was not found");
      return;
    }

    projectsGrid
      .querySelectorAll(".workplan-row")
      .forEach((row) => row.remove());

    if (!Array.isArray(workPlans) || !workPlans.length) {
      return;
    }

    workPlans.forEach((workPlan) => {
      if (
        !workPlan ||
        !workPlan.project ||
        !Array.isArray(workPlan.tasks) ||
        !workPlan.tasks.length
      ) {
        return;
      }

      const row = document.createElement("div");
      row.className = "workplan-row";
      row.setAttribute("data-row-type", "project");
      row.setAttribute(
        "data-project-id",
        String(workPlan.project?.workItemId || ""),
      );

      const stickyCol = document.createElement("div");
      stickyCol.className = "workplan-sticky-col row-cell";

      const rowTitle = document.createElement("div");
      rowTitle.className = "row-title";
      rowTitle.textContent = workPlan.project?.title || "פרויקט";

      const rowSubtitle = document.createElement("div");
      rowSubtitle.className = "row-subtitle";
      rowSubtitle.textContent =
        "משימות פרויקט • " + String(workPlan.tasks.length || 0);

      stickyCol.appendChild(rowTitle);
      stickyCol.appendChild(rowSubtitle);

      const track = document.createElement("div");
      track.className = "workplan-track";
      track.setAttribute(
        "data-drop-row",
        "project-" + String(workPlan.project?.workItemId || "current"),
      );

      workPlan.tasks.forEach((task, index) => {
        const assignment = resolveAssignment(task, workPlan);
        const startHour = Math.min(8 + index * 2, 22);
        const duration = 2;
        const endHour = Math.min(startHour + duration, 24);

        const taskEl = document.createElement("button");
        taskEl.type = "button";
        taskEl.className = "task task-project";
        taskEl.setAttribute("data-task-id", String(task.workItemId));
        taskEl.setAttribute(
          "data-project-id",
          String(task.parentWorkItemId || workPlan.project?.workItemId || ""),
        );
        taskEl.setAttribute("data-start-hour", String(startHour));
        taskEl.setAttribute("data-end-hour", String(endHour));
        taskEl.setAttribute("data-assignee-name", assignment.displayName || "");
        taskEl.setAttribute(
          "data-assignment-source",
          assignment.source || "none",
        );
        taskEl.setAttribute("data-assignment-type", assignment.type || "");

        taskEl.style.left = `calc((${startHour} / 24) * 100%)`;
        taskEl.style.width = `calc((${Math.max(endHour - startHour, 1)} / 24) * 100%)`;

        taskEl.innerHTML = `
          <div class="task-name">${task.title || ""}</div>
          <div class="task-meta">
            ${String(startHour).padStart(2, "0")}:00–${String(endHour).padStart(2, "0")}:00
            • ${task.status || "-"}
            • ${assignment.displayName || "ללא שיוך"}
          </div>
        `;

        track.appendChild(taskEl);
      });

      row.appendChild(stickyCol);
      row.appendChild(track);

      projectsGrid.appendChild(row);
    });
  }

  function renderDailyEmployeesModeFromApi(workPlan) {
    const employeesGrid = document.querySelector(
      ".workplan-mode-employees .workplan-grid",
    );

    if (!employeesGrid) {
      console.warn("Employees daily grid was not found");
      return;
    }

    const header = employeesGrid.querySelector(".workplan-header");

    if (!header) {
      console.warn("Employees daily grid header was not found");
      return;
    }

    employeesGrid
      .querySelectorAll(".workplan-row")
      .forEach((row) => row.remove());

    const employees = getEmployeesData().filter(
      (employee) => employee && employee.fullName,
    );

    const allProjectsMode = isAllProjectsMode();

    const taskContexts = allProjectsMode
      ? Array.isArray(allWorkPlansData)
        ? allWorkPlansData.flatMap((currentWorkPlan) =>
            Array.isArray(currentWorkPlan?.tasks)
              ? currentWorkPlan.tasks.map((task) => ({
                  task,
                  workPlan: currentWorkPlan,
                }))
              : [],
          )
        : []
      : Array.isArray(workPlan?.tasks)
        ? workPlan.tasks.map((task) => ({
            task,
            workPlan,
          }))
        : [];

    employees.forEach((employee) => {
      const employeeId = String(
        employee.id || employee.employeeId || "",
      ).trim();

      const row = document.createElement("div");
      row.className = "workplan-row";
      row.setAttribute("data-row-type", "employee");
      row.setAttribute("data-row-key", employeeId);

      const stickyCol = document.createElement("div");
      stickyCol.className = "workplan-sticky-col row-cell";

      const rowTitle = document.createElement("div");
      rowTitle.className = "row-title";
      rowTitle.textContent = employee.fullName || "עובד";

      const rowSubtitle = document.createElement("div");
      rowSubtitle.className = "row-subtitle";
      rowSubtitle.textContent = employee.role || employee.primaryRole || "—";

      stickyCol.appendChild(rowTitle);
      stickyCol.appendChild(rowSubtitle);

      const track = document.createElement("div");
      track.className = "workplan-track";
      track.setAttribute("data-drop-row", employeeId);

      const employeeTasks = taskContexts.filter(
        ({ task, workPlan: taskWorkPlan }) => {
          const assignment = resolveAssignment(task, taskWorkPlan);

          return String(assignment.employeeId || "").trim() === employeeId;
        },
      );

      employeeTasks.forEach(({ task, workPlan: taskWorkPlan }, index) => {
        const assignment = resolveAssignment(task, taskWorkPlan);
        const startHour = Math.min(8 + index * 2, 22);
        const duration = 2;
        const endHour = Math.min(startHour + duration, 24);

        const taskEl = document.createElement("button");
        taskEl.type = "button";
        taskEl.className = "task task-project";
        taskEl.setAttribute("data-task-id", String(task.workItemId));
        taskEl.setAttribute(
          "data-project-id",
          String(
            task.parentWorkItemId || taskWorkPlan.project?.workItemId || "",
          ),
        );
        taskEl.setAttribute("data-start-hour", String(startHour));
        taskEl.setAttribute("data-end-hour", String(endHour));
        taskEl.setAttribute("data-assignee-name", employee.fullName || "");
        taskEl.setAttribute("data-assigned-ids", employeeId);
        taskEl.setAttribute(
          "data-assignment-source",
          assignment.source || "employee",
        );
        taskEl.setAttribute("data-assignment-type", assignment.type || "");
        if (assignment.role) {
          taskEl.setAttribute("data-role", assignment.role);
        }

        taskEl.style.left = `calc((${startHour} / 24) * 100%)`;
        taskEl.style.width = `calc((${Math.max(endHour - startHour, 1)} / 24) * 100%)`;

        taskEl.innerHTML = `
          <div class="task-name">${task.title || ""}</div>
          <div class="task-meta">
            ${String(startHour).padStart(2, "0")}:00–${String(endHour).padStart(2, "0")}:00
            • ${task.status || "-"}
            • ${assignment.role || employee.role || "שיוך עובד"}
          </div>
        `;

        track.appendChild(taskEl);
      });

      row.appendChild(stickyCol);
      row.appendChild(track);

      employeesGrid.appendChild(row);
    });
  }

  (async () => {
    await loadWorkPlanFromApi();
    await refreshWorkPlanIfNeeded();
  })();
});
