// =====================================================
// Projects API Functions
// =====================================================
// This file contains only API communication functions for
// the Projects page.
//
// Responsibilities:
// - Load projects from backend
// - Load project details
// - Load project milestones
// - Load project assignments
// - Create/update projects
// - Create/update/cancel milestones
// - Load/create customers/sites lookups
//
// IMPORTANT:
// - No direct event listeners here
// - No drawer open/close logic here
// - No UI-only BOQ / drawings / equipment logic here
// - API functions may update shared state when needed
// =====================================================

// =====================================================
// Lookup API Functions
// =====================================================

// Loads customers from backend and stores them in customersById lookup.
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

// Loads sites from backend and stores them in sitesById lookup.
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

// Ensures required lookup data is loaded before rendering/editing projects.
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

// =====================================================
// Lookup Display Helpers
// =====================================================

// Returns customer display name from local lookup cache.
function getCustomerDisplayName(customerId) {
  if (customerId == null) return "-";

  const customer = customersById[customerId];

  if (customer && customer.customerName) {
    return customer.customerName;
  }

  return `לקוח #${customerId}`;
}

// Returns site display name from local lookup cache.
function getSiteDisplayName(siteId) {
  if (siteId == null) return "-";

  const site = sitesById[siteId];

  if (site && site.siteName) {
    return site.siteName;
  }

  return `אתר #${siteId}`;
}

// =====================================================
// Projects API Functions
// =====================================================

// Loads the projects list from backend and renders the projects table.
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

// Loads full project details from backend.
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

// Creates a new project using current project form data.
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

// Updates an existing project using current project form data.
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

// Refreshes projects list and opens a specific project after create/update.
async function refreshProjectsAndOpen(projectWorkItemId) {
  await loadProjectsFromApi();

  const matchingProjectId = Object.keys(projectRows).find((key) => {
    return projectRows[key]?.workItemId === projectWorkItemId;
  });

  if (matchingProjectId) {
    await openProject(matchingProjectId);
  }
}

// =====================================================
// Project Assignments API Functions
// =====================================================

// Loads project/team assignments from work-plan endpoint.
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

    const relevantWorkItemIds = new Set([
      projectWorkItemId,
      ...tasks.map((task) => Number(task.workItemId)),
    ]);

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

// =====================================================
// Milestones API Functions
// =====================================================

// Loads milestones for a specific project.
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

// Creates a new milestone under a project.
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
      actualStart: data.actualStart,
      actualEnd: data.actualEnd,
      actualHours: data.actualHours,
      priority: data.priority,
      requiredRole: data.requiredRole,
      isLocked: data.isLocked,
      employees: data.employees || [],
      contractors: data.contractors || [],
    }),
  });

  return response;
}

// Updates an existing milestone.
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
      actualStart: data.actualStart,
      actualEnd: data.actualEnd,
      actualHours: data.actualHours,
      priority: data.priority,
      requiredRole: data.requiredRole,
      isLocked: data.isLocked,
      employees: data.employees || [],
      contractors: data.contractors || [],
    }),
  });
}

// Cancels a milestone using backend soft-delete/cancel endpoint.
async function cancelMilestoneApi(milestoneId) {
  await apiRequest(`/WorkItems/milestones/${milestoneId}/cancel`, {
    method: "PUT",
  });
}

// =====================================================
// Sites API Functions
// =====================================================

// Creates a new site from the inline site form in project drawer.
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

// Refreshes sites lookup and selects a specific site.
async function refreshSitesAndSelect(siteId) {
  await loadSitesLookup();
  populateSiteSelectOptions(siteId);
}
