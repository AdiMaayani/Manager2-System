(function () {
  "use strict";

  var MOCK_PROJECTS = window.MOCK_PROJECTS || [];
  console.groupCollapsed("🔍 [DATA AUDIT] Employees data loaded");
  var MOCK_EMPLOYEES = window.MOCK_EMPLOYEES || [];
  console.log("Source: window.MOCK_EMPLOYEES");
  console.log("Count:", MOCK_EMPLOYEES.length);
  console.log("Data:", MOCK_EMPLOYEES);
  console.groupEnd();
  var MOCK_SYSTEMS = window.MOCK_SYSTEMS || [];
  var MOCK_PRODUCTS = window.MOCK_PRODUCTS || [];
  var MOCK_RECENT_REPORTS = window.MOCK_RECENT_REPORTS || [];
  var MOCK_SERVICE_CALLS =
    (window.CONTACTS_MOCK_DATA && window.CONTACTS_MOCK_DATA.SERVICE_CALLS) ||
    [];
  var CUSTOMERS =
    (window.CONTACTS_MOCK_DATA && window.CONTACTS_MOCK_DATA.CUSTOMERS) || [];

  var QUICK_REPORT_KEY = "manager2_quick_report_prefill";

  var el = {
    date: null,
    project: null,
    customer: null,
    serviceCall: null,
    projectWrap: null,
    serviceCallWrap: null,
    projectLinkedWrap: null,
    projectLinked: null,
    reportTypeProject: null,
    reportTypeService: null,
    site: null,
    start: null,
    end: null,
    reporter: null,
    systems: null,
    summary: null,
    notes: null,
    role: null,
    productsTbody: null,
    addProduct: null,
    followup: null,
    followupReasonWrap: null,
    submit: null,
    draft: null,
    recentTbody: null,
    viewModal: null,
    viewClose: null,
    viewBody: null,
    viewHeaderActions: null,
    viewReportId: null,
    formModal: null,
    formModalOverlay: null,
    formModalClose: null,
    btnNew: null,
    relatedWorkersSelect: null,
    relatedWorkersAddBtn: null,
    relatedWorkersChips: null,
  };

  var formRelatedWorkers = [];

  var selectedReportId = null;
  var isDetailsExpanded = false;
  var isEditMode = false;

  function initRefs() {
    el.date = document.getElementById("report-date");
    el.project = document.getElementById("report-project");
    el.customer = document.getElementById("report-customer");
    el.serviceCall = document.getElementById("report-service-call");
    el.projectWrap = document.getElementById("report-form-project-wrap");
    el.serviceCallWrap = document.getElementById(
      "report-form-service-call-wrap",
    );
    el.projectLinkedWrap = document.getElementById(
      "report-form-project-linked-wrap",
    );
    el.projectLinked = document.getElementById("report-project-linked");
    el.reportTypeProject = document.getElementById("report-type-project");
    el.reportTypeService = document.getElementById("report-type-service");
    el.site = document.getElementById("report-site");
    el.start = document.getElementById("report-start");
    el.end = document.getElementById("report-end");
    el.reporter = document.getElementById("report-reporter");
    el.summary = document.getElementById("report-summary");
    el.notes = document.getElementById("report-notes");
    el.role = document.getElementById("report-role");
    el.systems = document.getElementById("report-systems");
    el.productsTbody = document.getElementById("report-products-tbody");
    el.addProduct = document.getElementById("report-add-product");
    el.followup = document.getElementById("report-followup");
    el.followupReasonWrap = document.getElementById(
      "report-followup-reason-wrap",
    );
    el.submit = document.getElementById("report-submit");
    el.draft = document.getElementById("report-draft");
    el.recentTbody = document.getElementById("report-recent-tbody");
    el.viewModal = document.getElementById("report-view-modal");
    el.viewClose = document.getElementById("report-view-close");
    el.viewBody = document.getElementById("report-view-body");
    el.viewHeaderActions = document.getElementById(
      "report-view-header-actions",
    );
    el.viewReportId = document.getElementById("report-view-report-id");
    el.formModal = document.getElementById("report-form-modal");
    el.formModalOverlay = document.getElementById("report-form-overlay");
    el.formModalClose = document.getElementById("report-form-close");
    el.btnNew = document.getElementById("report-btn-new");
    el.relatedWorkersSelect = document.getElementById(
      "report-related-workers-select",
    );
    el.relatedWorkersAddBtn = document.getElementById(
      "report-related-workers-add-btn",
    );
    el.relatedWorkersChips = document.getElementById(
      "report-related-workers-chips",
    );
  }

  function formatDateYmd(ymd) {
    if (!ymd) return "";
    var p = ymd.split("-");
    if (p.length !== 3) return ymd;
    return p[2] + "/" + p[1] + "/" + p[0];
  }

  function setDefaultDate() {
    if (el.date) {
      var today = new Date().toISOString().slice(0, 10);
      el.date.value = today;
    }
  }

  function populateProjects() {
    if (!el.project) return;
    var frag = document.createDocumentFragment();
    MOCK_PROJECTS.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      opt.dataset.customerName = p.customerName || "";
      frag.appendChild(opt);
    });
    el.project.appendChild(frag);
  }

  function populateEmployees() {
    if (!el.reporter) return;
    console.groupCollapsed(
      "🔍 [DATA AUDIT] Employees populated in reporter dropdown",
    );
    console.log("Source: MOCK_EMPLOYEES array");
    console.log("Count:", MOCK_EMPLOYEES.length);
    var frag = document.createDocumentFragment();
    MOCK_EMPLOYEES.forEach(function (e) {
      var opt = document.createElement("option");
      opt.value = e.id;
      opt.textContent = e.fullName;
      frag.appendChild(opt);
    });
    el.reporter.appendChild(frag);
    console.log("Populated dropdown with", MOCK_EMPLOYEES.length, "employees");
    console.groupEnd();
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/["״']/g, "")
      .toLowerCase();
  }

  function setSelectByCandidates(selectEl, candidates, useTextFallback) {
    if (!selectEl || !candidates || !candidates.length) return false;

    var normalizedCandidates = candidates
      .filter(function (x) {
        return x != null && String(x).trim();
      })
      .map(function (x) {
        return String(x).trim();
      });

    if (!normalizedCandidates.length) return false;

    for (var i = 0; i < normalizedCandidates.length; i++) {
      var candidate = normalizedCandidates[i];
      selectEl.value = candidate;
      if (String(selectEl.value) === String(candidate)) {
        return true;
      }
    }

    if (useTextFallback) {
      for (var o = 0; o < selectEl.options.length; o++) {
        var opt = selectEl.options[o];
        var optText = normalizeText(opt.textContent);
        for (var c = 0; c < normalizedCandidates.length; c++) {
          if (optText === normalizeText(normalizedCandidates[c])) {
            selectEl.value = opt.value;
            return true;
          }
        }
      }
    }

    return false;
  }

  function normalizeQuickText(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/["״']/g, "")
      .toLowerCase();
  }

  function setSelectByCandidates(selectEl, candidates, useTextFallback) {
    if (!selectEl || !candidates || !candidates.length) return false;

    var cleanCandidates = candidates
      .filter(function (x) {
        return x != null && String(x).trim();
      })
      .map(function (x) {
        return String(x).trim();
      });

    if (!cleanCandidates.length) return false;

    for (var i = 0; i < cleanCandidates.length; i++) {
      var candidate = cleanCandidates[i];
      selectEl.value = candidate;
      if (String(selectEl.value) === String(candidate)) {
        return true;
      }
    }

    if (useTextFallback) {
      for (var o = 0; o < selectEl.options.length; o++) {
        var opt = selectEl.options[o];
        var optText = normalizeQuickText(opt.textContent);
        for (var c = 0; c < cleanCandidates.length; c++) {
          if (optText === normalizeQuickText(cleanCandidates[c])) {
            selectEl.value = opt.value;
            return true;
          }
        }
      }
    }

    return false;
  }

  function onProjectChange() {
    if (!el.project || !el.customer) return;
    var sel = el.project.options[el.project.selectedIndex];
    var name = sel && sel.dataset.customerName ? sel.dataset.customerName : "";
    el.customer.value = name;
  }

  function populateServiceCalls() {
    if (!el.serviceCall) return;
    var frag = document.createDocumentFragment();
    MOCK_SERVICE_CALLS.forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s.id || "";
      opt.textContent = "#" + (s.id || "") + " – " + (s.title || "");
      opt.dataset.title = s.title || "";
      opt.dataset.customerId = s.customerId || "";
      opt.dataset.projectId = s.projectId || "";
      frag.appendChild(opt);
    });
    el.serviceCall.appendChild(frag);
  }

  function getReportType() {
    if (el.reportTypeService && el.reportTypeService.checked)
      return "service_call";
    return "project";
  }

  function setReportType(type) {
    if (type === "service_call" && el.reportTypeService) {
      el.reportTypeService.checked = true;
      if (el.reportTypeProject) el.reportTypeProject.checked = false;
    } else {
      if (el.reportTypeProject) el.reportTypeProject.checked = true;
      if (el.reportTypeService) el.reportTypeService.checked = false;
    }
    applyReportTypeUI();
  }

  function applyReportTypeUI() {
    var isProject = getReportType() === "project";
    if (el.projectWrap) el.projectWrap.style.display = isProject ? "" : "none";
    if (el.serviceCallWrap)
      el.serviceCallWrap.style.display = isProject ? "none" : "";
    if (el.projectLinkedWrap) el.projectLinkedWrap.style.display = "none";
    if (el.projectLinked) el.projectLinked.value = "";
    if (isProject) {
      if (el.serviceCall) el.serviceCall.value = "";
      if (el.project && el.customer) onProjectChange();
    } else {
      if (el.project) el.project.value = "";
      onServiceCallChange();
    }
  }

  function onReportTypeChange() {
    var isProject = getReportType() === "project";
    if (isProject) {
      if (el.serviceCall) el.serviceCall.value = "";
      if (el.projectWrap) el.projectWrap.style.display = "";
      if (el.serviceCallWrap) el.serviceCallWrap.style.display = "none";
      if (el.projectLinkedWrap) el.projectLinkedWrap.style.display = "none";
      if (el.projectLinked) el.projectLinked.value = "";
      if (el.project && el.customer) onProjectChange();
    } else {
      if (el.project) el.project.value = "";
      if (el.projectWrap) el.projectWrap.style.display = "none";
      if (el.serviceCallWrap) el.serviceCallWrap.style.display = "";
      if (el.projectLinkedWrap) el.projectLinkedWrap.style.display = "none";
      if (el.projectLinked) el.projectLinked.value = "";
      onServiceCallChange();
    }
  }

  function customerNameById(customerId) {
    if (!customerId) return "";
    var c = CUSTOMERS.filter(function (x) {
      return x.id === customerId;
    })[0];
    return c && c.name ? c.name : "";
  }

  function projectNameById(projectId) {
    if (!projectId) return "";
    var p = MOCK_PROJECTS.filter(function (x) {
      return x.id === projectId;
    })[0];
    return p && p.name ? p.name : "";
  }

  function onServiceCallChange() {
    if (!el.serviceCall || !el.customer) return;
    var opt = el.serviceCall.options[el.serviceCall.selectedIndex];
    var customerId =
      opt && opt.dataset.customerId ? opt.dataset.customerId : "";
    var projectId = opt && opt.dataset.projectId ? opt.dataset.projectId : "";
    el.customer.value = customerNameById(customerId);
    if (el.projectLinkedWrap && el.projectLinked) {
      if (projectId) {
        el.projectLinked.value = projectNameById(projectId);
        el.projectLinkedWrap.style.display = "";
      } else {
        el.projectLinked.value = "";
        el.projectLinkedWrap.style.display = "none";
      }
    }
  }

  function populateSystems() {
    if (!el.systems) return;
    el.systems.innerHTML = "";
    MOCK_SYSTEMS.forEach(function (s) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "report-system-chip";
      chip.textContent = s;
      chip.dataset.system = s;
      chip.addEventListener("click", function () {
        chip.classList.toggle("selected");
      });
      el.systems.appendChild(chip);
    });
  }

  function populateRelatedWorkersSelect() {
    if (!el.relatedWorkersSelect) return;
    el.relatedWorkersSelect.innerHTML = "";
    var opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "הוסף עובד";
    el.relatedWorkersSelect.appendChild(opt0);
    MOCK_EMPLOYEES.forEach(function (e) {
      var o = document.createElement("option");
      o.value = e.id;
      o.textContent = e.fullName;
      o.dataset.name = e.fullName || "";
      el.relatedWorkersSelect.appendChild(o);
    });
  }

  function renderFormRelatedWorkersChips() {
    if (!el.relatedWorkersChips) return;
    el.relatedWorkersChips.innerHTML = "";
    formRelatedWorkers.forEach(function (w, idx) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "report-related-worker-chip";
      chip.dataset.idx = String(idx);
      chip.dataset.id = w.id;
      chip.innerHTML =
        '<span class="report-related-worker-chip-label">' +
        (w.name || "").replace(/</g, "&lt;") +
        '</span><span class="report-related-worker-chip-remove" aria-hidden="true">×</span>';
      chip.addEventListener("click", function (e) {
        var t = e.target.nodeType === 3 ? e.target.parentElement : e.target;
        if (
          !t ||
          !t.classList ||
          !t.classList.contains("report-related-worker-chip-remove")
        )
          return;
        e.preventDefault();
        var i = parseInt(chip.dataset.idx, 10);
        if (!isNaN(i) && i >= 0 && i < formRelatedWorkers.length) {
          formRelatedWorkers.splice(i, 1);
          renderFormRelatedWorkersChips();
        }
      });
      el.relatedWorkersChips.appendChild(chip);
    });
  }

  function initRelatedWorkersForm() {
    populateRelatedWorkersSelect();
    renderFormRelatedWorkersChips();
    if (el.relatedWorkersAddBtn && el.relatedWorkersSelect) {
      el.relatedWorkersAddBtn.addEventListener("click", function () {
        var v = el.relatedWorkersSelect.value;
        if (!v) return;
        if (
          formRelatedWorkers.some(function (w) {
            return w.id === v;
          })
        )
          return;
        var opt =
          el.relatedWorkersSelect.options[
            el.relatedWorkersSelect.selectedIndex
          ];
        var name =
          opt && opt.dataset.name
            ? opt.dataset.name
            : opt
              ? opt.textContent
              : "";
        formRelatedWorkers.push({ id: v, name: name, role: "" });
        el.relatedWorkersSelect.value = "";
        renderFormRelatedWorkersChips();
      });
    }
  }

  function createProductRow() {
    var tr = document.createElement("tr");
    tr.className = "report-product-row";

    var categoryCell = document.createElement("td");
    categoryCell.className = "report-product-category";
    var categorySelect = document.createElement("select");
    categorySelect.className = "select";
    var catEmpty = document.createElement("option");
    catEmpty.value = "";
    catEmpty.textContent = "בחר קטגוריה";
    categorySelect.appendChild(catEmpty);
    MOCK_SYSTEMS.forEach(function (s) {
      var opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      categorySelect.appendChild(opt);
    });
    categoryCell.appendChild(categorySelect);
    tr.appendChild(categoryCell);

    var productCell = document.createElement("td");
    productCell.className = "report-product-product";
    var productSelect = document.createElement("select");
    productSelect.className = "select";
    var emptyOpt = document.createElement("option");
    emptyOpt.value = "";
    emptyOpt.textContent = "בחר מוצר/רכיב";
    productSelect.appendChild(emptyOpt);
    MOCK_PRODUCTS.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      productSelect.appendChild(opt);
    });
    productCell.appendChild(productSelect);
    tr.appendChild(productCell);

    var qtyCell = document.createElement("td");
    qtyCell.className = "report-product-qty";
    var qtyInput = document.createElement("input");
    qtyInput.type = "number";
    qtyInput.className = "input";
    qtyInput.min = "1";
    qtyInput.placeholder = "0";
    qtyCell.appendChild(qtyInput);
    tr.appendChild(qtyCell);

    var locCell = document.createElement("td");
    locCell.className = "report-product-location";
    var locInput = document.createElement("input");
    locInput.type = "text";
    locInput.className = "input";
    locCell.appendChild(locInput);
    tr.appendChild(locCell);

    var notesCell = document.createElement("td");
    notesCell.className = "report-product-notes";
    var notesInput = document.createElement("input");
    notesInput.type = "text";
    notesInput.className = "input";
    notesCell.appendChild(notesInput);
    tr.appendChild(notesCell);

    var removeCell = document.createElement("td");
    removeCell.className = "report-product-remove";
    var removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "btn btn-outline btn-sm";
    removeBtn.textContent = "הסרה";
    removeBtn.addEventListener("click", function () {
      tr.remove();
    });
    removeCell.appendChild(removeBtn);
    tr.appendChild(removeCell);

    return tr;
  }

  function initProducts() {
    if (!el.productsTbody || !el.addProduct) return;
    el.productsTbody.innerHTML = "";
    el.productsTbody.appendChild(createProductRow());
    el.addProduct.addEventListener("click", function () {
      el.productsTbody.appendChild(createProductRow());
    });
  }

  function initFollowup() {
    if (!el.followup || !el.followupReasonWrap) return;
    el.followup.addEventListener("change", function () {
      el.followupReasonWrap.hidden = !el.followup.checked;
    });
  }

  function getFormReportDraft() {
    var reportType = getReportType();
    var projectId = "";
    var projectName = "";
    var serviceCallId = "";
    var serviceCallTitle = "";
    if (reportType === "project") {
      var opt = el.project && el.project.options[el.project.selectedIndex];
      if (opt && opt.value) {
        projectId = opt.value;
        projectName = opt.textContent || "";
      }
    } else {
      var scOpt =
        el.serviceCall && el.serviceCall.options[el.serviceCall.selectedIndex];
      if (scOpt && scOpt.value) {
        serviceCallId = scOpt.value;
        serviceCallTitle =
          scOpt.dataset && scOpt.dataset.title ? scOpt.dataset.title : "";
        var linkedProjectId =
          scOpt.dataset && scOpt.dataset.projectId
            ? scOpt.dataset.projectId
            : "";
        if (linkedProjectId) {
          projectId = linkedProjectId;
          projectName = projectNameById(linkedProjectId);
        }
      }
    }
    var systems = [];
    if (el.systems) {
      el.systems
        .querySelectorAll(".report-system-chip.selected")
        .forEach(function (chip) {
          var s = chip.dataset.system;
          if (s) systems.push(s);
        });
    }
    var draft = {
      reportType: reportType,
      date: el.date ? el.date.value : "",
      projectId: projectId || undefined,
      projectName: projectName,
      customerName: el.customer ? el.customer.value : "",
      serviceCallId: serviceCallId || undefined,
      serviceCallTitle: serviceCallTitle || undefined,
      site: el.site ? el.site.value : "",
      reporterId: el.reporter ? el.reporter.value : "",
      reporterName:
        el.reporter && el.reporter.options[el.reporter.selectedIndex]
          ? el.reporter.options[el.reporter.selectedIndex].textContent
          : "",
      role:
        (document.getElementById("report-role") &&
          document.getElementById("report-role").value) ||
        "",
      start: el.start ? el.start.value : "",
      end: el.end ? el.end.value : "",
      summary: el.summary ? el.summary.value : "",
      systems: systems,
      relatedWorkers: formRelatedWorkers.slice(),
      notes: el.notes ? el.notes.value : "",
      followup: el.followup ? el.followup.checked : false,
      followupReason:
        (document.getElementById("report-followup-reason") &&
          document.getElementById("report-followup-reason").value) ||
        "",
    };
    return draft;
  }

  function initActions() {
    if (el.submit) {
      el.submit.addEventListener("click", function () {
        var draft = getFormReportDraft();
        console.log("שלח דיווח", draft);
      });
    }
    if (el.draft) {
      el.draft.addEventListener("click", function () {
        var draft = getFormReportDraft();
        console.log("שמור טיוטה", draft);
      });
    }
  }

  function statusBadgeClass(s) {
    if (s === "הועבר להנה״ח") return "badge-success";
    if (s === "הוגש") return "badge-primary";
    return "badge-neutral";
  }

  function renderRecentReports() {
    if (!el.recentTbody) return;
    el.recentTbody.innerHTML = "";
    MOCK_RECENT_REPORTS.forEach(function (r) {
      var tr = document.createElement("tr");
      tr.className = "report-row-clickable";
      tr.dataset.reportId = r.id || "";
      var status = r.status || "טיוטה";
      var badgeClass = statusBadgeClass(status);
      tr.innerHTML =
        "<td>" +
        formatDateYmd(r.date) +
        "</td>" +
        "<td>" +
        (r.reportNumber || "") +
        "</td>" +
        "<td>" +
        (r.projectName || "") +
        "</td>" +
        "<td>" +
        (r.customerName || "") +
        "</td>" +
        "<td>" +
        (r.reporterName || "") +
        "</td>" +
        '<td><span class="badge ' +
        badgeClass +
        ' report-status-badge">' +
        status +
        "</span></td>";
      el.recentTbody.appendChild(tr);
    });
  }

  var expandIconSvg =
    '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
  var collapseIconSvg =
    '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>';
  var pencilIconSvg =
    '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>';
  var checkIconSvg =
    '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';

  function getReport() {
    if (!selectedReportId) return null;
    return (
      MOCK_RECENT_REPORTS.filter(function (r) {
        return r.id === selectedReportId;
      })[0] || null
    );
  }

  var STATUS_OPTIONS = ["טיוטה", "הוגש", "הועבר להנה״ח"];

  var EDETAILS_SYSTEMS = [
    "חשמל חכם",
    "בקרה",
    "תקשורת",
    "מולטימדיה",
    "מצלמות ואבטחה",
    "מתנים",
    "NVR",
    "ארונות תקשורת",
  ];

  var removeIconSvg =
    '<svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';

  function buildDetailsContent(report, editMode) {
    var wrap = document.createElement("div");
    wrap.className = "report-view-details";

    var status = report.status || "טיוטה";
    var badgeClass = statusBadgeClass(status);

    /* Section A: פרטי דיווח (meta) */
    var secA = document.createElement("div");
    secA.className = "report-view-section";
    secA.innerHTML = '<h3 class="report-view-section-title">פרטי דיווח</h3>';
    var metaGrid = document.createElement("div");
    metaGrid.className = "report-view-meta-grid";

    var serviceCallCompact = "";
    if (report.serviceCallId || report.serviceCallTitle) {
      var sid = report.serviceCallId ? "#" + report.serviceCallId : "";
      var stit = report.serviceCallTitle || "";
      serviceCallCompact =
        sid && stit
          ? "קריאת שירות: " + sid + " – " + stit
          : sid || stit
            ? "קריאת שירות: " + (sid || stit)
            : "";
    }
    var metaItems = [
      { l: "תאריך", v: formatDateYmd(report.date) },
      { l: "מס׳ דיווח", v: report.reportNumber || "" },
      { l: "פרויקט", v: report.projectName || "" },
      { l: "לקוח", v: report.customerName || "" },
      serviceCallCompact
        ? { l: "", v: serviceCallCompact, valueOnly: true }
        : { l: "קריאת שירות", v: "—" },
      { l: "מדווח", v: report.reporterName || "" },
      { status: true, statusVal: status, badgeClass: badgeClass },
      { l: "אתר / מיקום עבודה", editKey: "site", v: report.site || "" },
      { l: "תפקיד", v: report.role || "" },
      { l: "שעות עבודה", v: (report.start || "") + " – " + (report.end || "") },
    ];

    metaItems.forEach(function (x) {
      var item = document.createElement("div");
      item.className = "report-view-meta-item";
      if (x.valueOnly) {
        item.className = "report-view-meta-item report-view-meta-item-full";
        item.innerHTML =
          '<div class="report-view-meta-value">' + (x.v || "—") + "</div>";
      } else if (x.status) {
        item.innerHTML = '<span class="report-view-meta-label">סטטוס</span>';
        if (editMode) {
          var sel = document.createElement("select");
          sel.className = "select report-view-edit-status";
          STATUS_OPTIONS.forEach(function (opt) {
            var o = document.createElement("option");
            o.value = opt;
            o.textContent = opt;
            if (opt === x.statusVal) o.selected = true;
            sel.appendChild(o);
          });
          item.appendChild(sel);
        } else {
          var val = document.createElement("div");
          val.className = "report-view-meta-value";
          val.innerHTML =
            '<span class="badge ' +
            x.badgeClass +
            ' report-view-status-badge">' +
            x.statusVal +
            "</span>";
          item.appendChild(val);
        }
      } else if (editMode && x.editKey === "site") {
        item.innerHTML =
          '<span class="report-view-meta-label">אתר / מיקום עבודה</span>';
        var siteInput = document.createElement("input");
        siteInput.type = "text";
        siteInput.className = "input report-view-edit-site";
        siteInput.value = x.v || "";
        item.appendChild(siteInput);
      } else {
        item.innerHTML =
          '<span class="report-view-meta-label">' +
          x.l +
          '</span><div class="report-view-meta-value">' +
          (x.v || "—") +
          "</div>";
      }
      metaGrid.appendChild(item);
    });
    secA.appendChild(metaGrid);
    wrap.appendChild(secA);

    /* Section B: סיכום עבודה */
    var secB = document.createElement("div");
    secB.className = "report-view-section";
    secB.innerHTML = '<h3 class="report-view-section-title">סיכום עבודה</h3>';
    if (editMode) {
      var sumTa = document.createElement("textarea");
      sumTa.className = "textarea report-view-edit-summary";
      sumTa.rows = 4;
      sumTa.value = report.summary || "";
      secB.appendChild(sumTa);
    } else {
      var sumVal = document.createElement("div");
      sumVal.className = "report-view-summary-value";
      sumVal.textContent = report.summary || "—";
      secB.appendChild(sumVal);
    }
    wrap.appendChild(secB);

    /* Section C: מערכות שבוצעו */
    var secC = document.createElement("div");
    secC.className = "report-view-section";
    secC.innerHTML = '<h3 class="report-view-section-title">מערכות שבוצעו</h3>';
    var chips = document.createElement("div");
    chips.className = "report-view-chips";
    if (!report.systems) report.systems = [];
    if (editMode) {
      report.systems.forEach(function (s) {
        var c = document.createElement("button");
        c.type = "button";
        c.className = "report-view-chip report-view-chip-removable";
        c.textContent = s;
        c.dataset.system = s;
        c.innerHTML =
          '<span class="report-view-chip-label">' +
          s +
          '</span><span class="report-view-chip-remove" aria-hidden="true">×</span>';
        chips.appendChild(c);
      });
      secC.appendChild(chips);
      var addWrap = document.createElement("div");
      addWrap.className = "report-view-systems-add";
      var addSel = document.createElement("select");
      addSel.className = "select report-view-add-system-select";
      var addOpt0 = document.createElement("option");
      addOpt0.value = "";
      addOpt0.textContent = "הוספת מערכת";
      addSel.appendChild(addOpt0);
      EDETAILS_SYSTEMS.forEach(function (s) {
        var o = document.createElement("option");
        o.value = s;
        o.textContent = s;
        addSel.appendChild(o);
      });
      addWrap.appendChild(addSel);
      var addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className = "btn btn-outline btn-sm report-view-add-system-btn";
      addBtn.textContent = "הוסף";
      addWrap.appendChild(addBtn);
      secC.appendChild(addWrap);
    } else {
      if (report.systems.length) {
        report.systems.forEach(function (s) {
          var c = document.createElement("span");
          c.className = "report-view-chip";
          c.textContent = s;
          chips.appendChild(c);
        });
      } else {
        var empty = document.createElement("span");
        empty.className = "report-view-meta-value";
        empty.textContent = "—";
        chips.appendChild(empty);
      }
      secC.appendChild(chips);
    }
    wrap.appendChild(secC);

    /* Section C2: עובדים קשורים */
    var secWorkers = document.createElement("div");
    secWorkers.className = "report-view-section";
    secWorkers.innerHTML =
      '<h3 class="report-view-section-title">עובדים קשורים</h3>';
    var workersChips = document.createElement("div");
    workersChips.className =
      "report-view-chips report-view-related-workers-chips";
    if (!report.relatedWorkers) report.relatedWorkers = [];
    if (editMode) {
      report.relatedWorkers.forEach(function (w, idx) {
        var c = document.createElement("button");
        c.type = "button";
        c.className =
          "report-view-chip report-view-chip-removable report-view-worker-chip";
        c.dataset.idx = String(idx);
        c.dataset.id = w.id || "";
        c.innerHTML =
          '<span class="report-view-chip-label">' +
          (w.name || "").replace(/</g, "&lt;") +
          '</span><span class="report-view-chip-remove" aria-hidden="true">×</span>';
        workersChips.appendChild(c);
      });
      secWorkers.appendChild(workersChips);
      var addWrapW = document.createElement("div");
      addWrapW.className =
        "report-view-systems-add report-view-related-workers-add";
      var addSelW = document.createElement("select");
      addSelW.className = "select report-view-add-worker-select";
      var addOptW0 = document.createElement("option");
      addOptW0.value = "";
      addOptW0.textContent = "הוסף עובד";
      addSelW.appendChild(addOptW0);
      MOCK_EMPLOYEES.forEach(function (e) {
        var o = document.createElement("option");
        o.value = e.id;
        o.textContent = e.fullName;
        o.dataset.name = e.fullName || "";
        addSelW.appendChild(o);
      });
      addWrapW.appendChild(addSelW);
      var addBtnW = document.createElement("button");
      addBtnW.type = "button";
      addBtnW.className = "btn btn-outline btn-sm report-view-add-worker-btn";
      addBtnW.textContent = "הוסף";
      addWrapW.appendChild(addBtnW);
      secWorkers.appendChild(addWrapW);
    } else {
      if (report.relatedWorkers.length) {
        report.relatedWorkers.forEach(function (w) {
          var c = document.createElement("span");
          c.className = "report-view-chip";
          c.textContent = w.name || "";
          workersChips.appendChild(c);
        });
      } else {
        var emptyW = document.createElement("span");
        emptyW.className = "report-view-meta-value";
        emptyW.textContent = "—";
        workersChips.appendChild(emptyW);
      }
      secWorkers.appendChild(workersChips);
    }
    wrap.appendChild(secWorkers);

    /* Section D: פירוט מערכות מוצרים וחומרים */
    var hasProducts = report.products && report.products.length;
    if (editMode || hasProducts) {
      if (!report.products) report.products = [];
      var secD = document.createElement("div");
      secD.className = "report-view-section";
      secD.innerHTML =
        '<h3 class="report-view-section-title">פירוט מערכות מוצרים וחומרים</h3>';
      var tableWrap = document.createElement("div");
      tableWrap.className = "report-view-products-table-wrap";
      var tbl = document.createElement("table");
      tbl.className = "report-view-products-table table";
      var thead = editMode
        ? "<thead><tr><th>קטגוריה</th><th>מוצר/רכיב</th><th>כמות</th><th>מיקום</th><th>הערות</th><th>הסרה</th></tr></thead>"
        : "<thead><tr><th>קטגוריה</th><th>מוצר/רכיב</th><th>כמות</th><th>מיקום</th><th>הערות</th></tr></thead>";
      tbl.innerHTML = thead + "<tbody></tbody>";
      var tbody = tbl.querySelector("tbody");
      if (editMode) {
        report.products.forEach(function (row, idx) {
          var tr = document.createElement("tr");
          tr.className = "report-view-product-row";
          tr.dataset.idx = String(idx);
          var catOpts = EDETAILS_SYSTEMS.map(function (c) {
            var sel = row.category === c ? " selected" : "";
            return (
              '<option value="' +
              c.replace(/"/g, "&quot;") +
              '"' +
              sel +
              ">" +
              c +
              "</option>"
            );
          }).join("");
          var catSel =
            '<select class="select report-view-edit-cat" data-idx="' +
            idx +
            '"><option value="">בחר קטגוריה</option>' +
            catOpts +
            "</select>";
          var prodOpts = MOCK_PRODUCTS.map(function (p) {
            var sel =
              row.productId === p.id || row.productName === p.name
                ? " selected"
                : "";
            return (
              '<option value="' +
              p.id +
              '" data-name="' +
              (p.name || "").replace(/"/g, "&quot;") +
              '"' +
              sel +
              ">" +
              (p.name || "") +
              "</option>"
            );
          }).join("");
          var prodSel =
            '<select class="select report-view-edit-prod" data-idx="' +
            idx +
            '"><option value="">בחר מוצר/רכיב</option>' +
            prodOpts +
            "</select>";
          var qtyVal = row.qty != null ? String(row.qty) : "";
          var locVal = (row.location || "").replace(/"/g, "&quot;");
          var notesVal = (row.notes || "").replace(/"/g, "&quot;");
          tr.innerHTML =
            "<td>" +
            catSel +
            "</td><td>" +
            prodSel +
            "</td>" +
            '<td><input type="number" class="input report-view-edit-qty" data-idx="' +
            idx +
            '" value="' +
            qtyVal +
            '" min="0"></td>' +
            '<td><input type="text" class="input report-view-edit-loc" data-idx="' +
            idx +
            '" value="' +
            locVal +
            '"></td>' +
            '<td><input type="text" class="input report-view-edit-notes" data-idx="' +
            idx +
            '" value="' +
            notesVal +
            '"></td>' +
            '<td class="report-view-product-remove-cell"><button type="button" class="btn btn-icon-only btn-sm report-view-remove-row" data-idx="' +
            idx +
            '" aria-label="הסר שורה">' +
            removeIconSvg +
            "</button></td>";
          tbody.appendChild(tr);
        });
        tableWrap.appendChild(tbl);
        var addRowBtn = document.createElement("button");
        addRowBtn.type = "button";
        addRowBtn.className = "btn btn-outline btn-sm report-view-add-row-btn";
        addRowBtn.textContent = "הוספת שורה +";
        secD.appendChild(tableWrap);
        secD.appendChild(addRowBtn);
      } else {
        report.products.forEach(function (row) {
          var tr = document.createElement("tr");
          tr.innerHTML =
            "<td>" +
            (row.category || "—") +
            "</td><td>" +
            (row.productName || "—") +
            "</td>" +
            "<td>" +
            (row.qty != null ? row.qty : "") +
            "</td><td>" +
            (row.location || "") +
            "</td><td>" +
            (row.notes || "") +
            "</td>";
          tbody.appendChild(tr);
        });
        tableWrap.appendChild(tbl);
        secD.appendChild(tableWrap);
      }
      wrap.appendChild(secD);
    }

    /* Section E: הערות נוספות */
    var secE = document.createElement("div");
    secE.className = "report-view-section";
    secE.innerHTML = '<h3 class="report-view-section-title">הערות נוספות</h3>';
    if (editMode) {
      var notesInput = document.createElement("input");
      notesInput.type = "text";
      notesInput.className = "input report-view-edit-notes-global";
      notesInput.value = report.notes || "";
      secE.appendChild(notesInput);
    } else {
      var notesVal = document.createElement("div");
      notesVal.className = "report-view-notes-value";
      notesVal.textContent = report.notes || "—";
      secE.appendChild(notesVal);
    }
    wrap.appendChild(secE);

    if (report.followup) {
      var secFollow = document.createElement("div");
      secFollow.className = "report-view-section";
      secFollow.innerHTML =
        '<h3 class="report-view-section-title">דורש ביקור חוזר</h3><div class="report-view-meta-value">' +
        (report.followupReason || "—") +
        "</div>";
      wrap.appendChild(secFollow);
    }

    /* Section F: הועבר להנהלת חשבונות */
    var secF = document.createElement("div");
    secF.className = "report-view-section report-view-section-accounting";
    secF.innerHTML =
      '<label class="report-view-accounting-wrap">' +
      '<input type="checkbox" class="report-view-accounting-checkbox" ' +
      (report.transferredToAccounting ? "checked" : "") +
      ">" +
      "<span>הועבר להנהלת חשבונות</span>" +
      "</label>";
    wrap.appendChild(secF);

    return wrap;
  }

  function renderDetailsHeader(report) {
    if (!el.viewReportId || !el.viewHeaderActions) return;
    el.viewReportId.textContent = report.reportNumber
      ? "#" + report.reportNumber
      : "";

    el.viewHeaderActions.innerHTML = "";
    var frag = document.createDocumentFragment();

    if (isEditMode) {
      var saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "btn btn-primary btn-sm";
      saveBtn.innerHTML =
        '<span class="report-view-action-icon">' +
        checkIconSvg +
        "</span>שמירה";
      saveBtn.addEventListener("click", function () {
        var r = getReport();
        if (!r) return;
        var siteEl = el.viewBody.querySelector(".report-view-edit-site");
        var sumEl = el.viewBody.querySelector(".report-view-edit-summary");
        var notesEl = el.viewBody.querySelector(
          ".report-view-edit-notes-global",
        );
        var statusEl = el.viewBody.querySelector(".report-view-edit-status");
        var accCheck = el.viewBody.querySelector(
          ".report-view-accounting-checkbox",
        );
        if (siteEl) r.site = siteEl.value;
        if (sumEl) r.summary = sumEl.value;
        if (notesEl) r.notes = notesEl.value;
        if (accCheck && accCheck.checked) {
          r.status = "הועבר להנה״ח";
          r.transferredToAccounting = true;
        } else if (statusEl) {
          r.status = statusEl.value || "טיוטה";
          r.transferredToAccounting = r.status === "הועבר להנה״ח";
        }
        var rows = el.viewBody.querySelectorAll(".report-view-product-row");
        if (r.products) {
          rows.forEach(function (tr, i) {
            if (!r.products[i]) return;
            var catSel = tr.querySelector(".report-view-edit-cat");
            var prodSel = tr.querySelector(".report-view-edit-prod");
            var qtyEl = tr.querySelector(".report-view-edit-qty");
            var locEl = tr.querySelector(".report-view-edit-loc");
            var notesEl = tr.querySelector(".report-view-edit-notes");
            if (catSel) r.products[i].category = catSel.value || "";
            if (prodSel) {
              var opt = prodSel.options[prodSel.selectedIndex];
              r.products[i].productId = opt ? opt.value : "";
              r.products[i].productName =
                opt && opt.dataset.name ? opt.dataset.name : "";
            }
            if (qtyEl) {
              var v = parseInt(qtyEl.value, 10);
              r.products[i].qty = isNaN(v) ? 0 : v;
            }
            if (locEl) r.products[i].location = locEl.value || "";
            if (notesEl) r.products[i].notes = notesEl.value || "";
          });
        }
        isEditMode = false;
        renderDetailsModal();
      });
      frag.appendChild(saveBtn);
      var cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn-outline btn-sm";
      cancelBtn.textContent = "ביטול";
      cancelBtn.addEventListener("click", function () {
        isEditMode = false;
        renderDetailsModal();
      });
      frag.appendChild(cancelBtn);

      var expandBtnEdit = document.createElement("button");
      expandBtnEdit.type = "button";
      expandBtnEdit.className =
        "btn btn-outline btn-sm report-view-expand-btn" +
        (isDetailsExpanded ? " report-view-expand-btn-hidden" : "");
      expandBtnEdit.title = "הגדל מסך";
      expandBtnEdit.innerHTML =
        '<span class="report-view-action-icon">' +
        expandIconSvg +
        "</span>הגדל מסך";
      expandBtnEdit.addEventListener("click", function () {
        isDetailsExpanded = true;
        el.viewModal.classList.add("report-view-modal-fullscreen");
        renderDetailsHeader(getReport());
      });
      frag.appendChild(expandBtnEdit);

      var collapseBtnEdit = document.createElement("button");
      collapseBtnEdit.type = "button";
      collapseBtnEdit.className =
        "btn btn-outline btn-sm report-view-collapse-btn" +
        (isDetailsExpanded ? "" : " report-view-collapse-btn-hidden");
      collapseBtnEdit.title = "הקטן מסך";
      collapseBtnEdit.innerHTML =
        '<span class="report-view-action-icon">' +
        collapseIconSvg +
        "</span>הקטן מסך";
      collapseBtnEdit.addEventListener("click", function () {
        isDetailsExpanded = false;
        el.viewModal.classList.remove("report-view-modal-fullscreen");
        renderDetailsHeader(getReport());
      });
      frag.appendChild(collapseBtnEdit);
    } else {
      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-outline btn-sm";
      editBtn.innerHTML =
        '<span class="report-view-action-icon">' +
        pencilIconSvg +
        "</span>עריכה";
      editBtn.addEventListener("click", function () {
        isEditMode = true;
        renderDetailsModal();
      });
      frag.appendChild(editBtn);

      var expandBtn = document.createElement("button");
      expandBtn.type = "button";
      expandBtn.className =
        "btn btn-outline btn-sm report-view-expand-btn" +
        (isDetailsExpanded ? " report-view-expand-btn-hidden" : "");
      expandBtn.title = "הגדל מסך";
      expandBtn.innerHTML =
        '<span class="report-view-action-icon">' +
        expandIconSvg +
        "</span>הגדל מסך";
      expandBtn.addEventListener("click", function () {
        isDetailsExpanded = true;
        el.viewModal.classList.add("report-view-modal-fullscreen");
        renderDetailsHeader(getReport());
      });
      frag.appendChild(expandBtn);

      var collapseBtn = document.createElement("button");
      collapseBtn.type = "button";
      collapseBtn.className =
        "btn btn-outline btn-sm report-view-collapse-btn" +
        (isDetailsExpanded ? "" : " report-view-collapse-btn-hidden");
      collapseBtn.title = "הקטן מסך";
      collapseBtn.innerHTML =
        '<span class="report-view-action-icon">' +
        collapseIconSvg +
        "</span>הקטן מסך";
      collapseBtn.addEventListener("click", function () {
        isDetailsExpanded = false;
        el.viewModal.classList.remove("report-view-modal-fullscreen");
        renderDetailsHeader(getReport());
      });
      frag.appendChild(collapseBtn);
    }

    el.viewHeaderActions.appendChild(frag);
  }

  function wireDetailsBody(report) {
    var accountingCheck = el.viewBody.querySelector(
      ".report-view-accounting-checkbox",
    );
    var statusBadge = el.viewBody.querySelector(".report-view-status-badge");
    var statusSelect = el.viewBody.querySelector(".report-view-edit-status");

    if (accountingCheck) {
      accountingCheck.addEventListener("change", function () {
        report.transferredToAccounting = accountingCheck.checked;
        report.status = accountingCheck.checked
          ? "הועבר להנה״ח"
          : report.status === "הועבר להנה״ח"
            ? "הוגש"
            : report.status;
        if (statusBadge) {
          statusBadge.textContent = report.status;
          statusBadge.className =
            "badge " +
            statusBadgeClass(report.status) +
            " report-view-status-badge";
        }
        if (statusSelect) {
          statusSelect.value = report.status;
        }
      });
    }

    if (statusSelect && accountingCheck) {
      statusSelect.addEventListener("change", function () {
        var v = statusSelect.value;
        if (v === "הועבר להנה״ח") {
          accountingCheck.checked = true;
          report.transferredToAccounting = true;
          report.status = "הועבר להנה״ח";
        } else {
          accountingCheck.checked = false;
          report.transferredToAccounting = false;
          report.status = v || "טיוטה";
        }
      });
    }

    /* Add row (items table) */
    var addRowBtn = el.viewBody.querySelector(".report-view-add-row-btn");
    if (addRowBtn && report) {
      addRowBtn.addEventListener("click", function () {
        if (!report.products) report.products = [];
        report.products.push({
          category: "",
          productId: "",
          productName: "",
          qty: 0,
          location: "",
          notes: "",
        });
        renderDetailsModal();
      });
    }

    /* Remove row (items table) */
    el.viewBody
      .querySelectorAll(".report-view-remove-row")
      .forEach(function (btn) {
        btn.addEventListener("click", function () {
          var idx = parseInt(btn.dataset.idx, 10);
          if (
            isNaN(idx) ||
            !report.products ||
            idx < 0 ||
            idx >= report.products.length
          )
            return;
          report.products.splice(idx, 1);
          renderDetailsModal();
        });
      });

    /* Add system */
    var addSystemBtn = el.viewBody.querySelector(".report-view-add-system-btn");
    var addSystemSel = el.viewBody.querySelector(
      ".report-view-add-system-select",
    );
    if (addSystemBtn && addSystemSel && report) {
      if (!report.systems) report.systems = [];
      addSystemBtn.addEventListener("click", function () {
        var v = addSystemSel.value;
        if (!v) return;
        if (report.systems.indexOf(v) !== -1) return;
        report.systems.push(v);
        addSystemSel.value = "";
        renderDetailsModal();
      });
    }

    /* Remove system chip (click on × only) */
    el.viewBody
      .querySelectorAll(".report-view-chip-removable[data-system]")
      .forEach(function (chip) {
        chip.addEventListener("click", function (e) {
          var t = e.target.nodeType === 3 ? e.target.parentElement : e.target;
          if (
            !t ||
            !t.classList ||
            !t.classList.contains("report-view-chip-remove")
          )
            return;
          e.preventDefault();
          var s = chip.dataset.system;
          if (!s || !report.systems) return;
          var i = report.systems.indexOf(s);
          if (i !== -1) {
            report.systems.splice(i, 1);
            renderDetailsModal();
          }
        });
      });

    /* Add worker (details edit) */
    var addWorkerBtn = el.viewBody.querySelector(".report-view-add-worker-btn");
    var addWorkerSel = el.viewBody.querySelector(
      ".report-view-add-worker-select",
    );
    if (addWorkerBtn && addWorkerSel && report) {
      if (!report.relatedWorkers) report.relatedWorkers = [];
      addWorkerBtn.addEventListener("click", function () {
        var v = addWorkerSel.value;
        if (!v) return;
        if (
          report.relatedWorkers.some(function (w) {
            return w.id === v;
          })
        )
          return;
        var opt = addWorkerSel.options[addWorkerSel.selectedIndex];
        var name =
          opt && opt.dataset.name
            ? opt.dataset.name
            : opt
              ? opt.textContent
              : "";
        report.relatedWorkers.push({ id: v, name: name, role: "" });
        addWorkerSel.value = "";
        renderDetailsModal();
      });
    }

    /* Remove worker chip (details edit, click on × only) */
    el.viewBody
      .querySelectorAll(".report-view-worker-chip")
      .forEach(function (chip) {
        chip.addEventListener("click", function (e) {
          var t = e.target.nodeType === 3 ? e.target.parentElement : e.target;
          if (
            !t ||
            !t.classList ||
            !t.classList.contains("report-view-chip-remove")
          )
            return;
          e.preventDefault();
          var idx = parseInt(chip.dataset.idx, 10);
          if (
            isNaN(idx) ||
            !report.relatedWorkers ||
            idx < 0 ||
            idx >= report.relatedWorkers.length
          )
            return;
          report.relatedWorkers.splice(idx, 1);
          renderDetailsModal();
        });
      });
  }

  function renderDetailsModal() {
    var report = getReport();
    if (!report || !el.viewBody || !el.viewModal) return;
    el.viewBody.innerHTML = "";
    el.viewBody.appendChild(buildDetailsContent(report, isEditMode));
    renderDetailsHeader(report);
    wireDetailsBody(report);
  }

  function openViewModal(id) {
    var report = MOCK_RECENT_REPORTS.filter(function (r) {
      return r.id === id;
    })[0];
    if (!report || !el.viewBody || !el.viewModal) return;
    selectedReportId = report.id;
    isDetailsExpanded = false;
    isEditMode = false;
    el.viewModal.classList.remove("report-view-modal-fullscreen");
    renderDetailsModal();
    el.viewModal.classList.add("active");
    el.viewModal.setAttribute("aria-hidden", "false");
  }

  function closeViewModal() {
    if (!el.viewModal) return;
    selectedReportId = null;
    isDetailsExpanded = false;
    isEditMode = false;
    el.viewModal.classList.remove("active", "report-view-modal-fullscreen");
    el.viewModal.setAttribute("aria-hidden", "true");
    renderRecentReports();
  }

  function openFormModal() {
    if (!el.formModal) return;
    formRelatedWorkers = [];
    renderFormRelatedWorkersChips();
    setReportType("project");
    el.formModal.classList.add("active");
    el.formModal.setAttribute("aria-hidden", "false");
    if (el.date) {
      el.date.focus();
    }
  }

  function closeFormModal() {
    if (!el.formModal) return;
    el.formModal.classList.remove("active");
    el.formModal.setAttribute("aria-hidden", "true");
  }

  function initFormModal() {
    if (el.btnNew) {
      el.btnNew.addEventListener("click", openFormModal);
    }
    if (el.formModalOverlay) {
      el.formModalOverlay.addEventListener("click", closeFormModal);
    }
    if (el.formModalClose) {
      el.formModalClose.addEventListener("click", closeFormModal);
    }
    document.addEventListener("keydown", function (e) {
      if (
        e.key === "Escape" &&
        el.formModal &&
        el.formModal.classList.contains("active")
      ) {
        closeFormModal();
      }
    });
  }

  function prefillFormFromQuickReport(prefill) {
    if (!prefill) return;
    var defaultService = !!(
      prefill.serviceCallId && String(prefill.serviceCallId).trim()
    );
    setReportType(defaultService ? "service_call" : "project");
    if (el.date && prefill.date) el.date.value = prefill.date;
    if (defaultService && el.serviceCall && prefill.serviceCallId) {
      setSelectByCandidates(el.serviceCall, [prefill.serviceCallId], false);
      onServiceCallChange();
    } else if (!defaultService && el.project) {
      var projectMatched = setSelectByCandidates(
        el.project,
        [prefill.projectId, prefill.projectName, prefill.customerName],
        true,
      );

      if (projectMatched) {
        onProjectChange();
      }
    }
    if (!defaultService && el.customer && prefill.customerName) {
      if (!el.customer.value || !String(el.customer.value).trim()) {
        el.customer.value = prefill.customerName;
      }
    }
    if (el.site && prefill.site) el.site.value = prefill.site;
    if (el.start && prefill.start) el.start.value = prefill.start;
    if (el.end && prefill.end) el.end.value = prefill.end;
    if (el.reporter && (prefill.reporterId || prefill.reporterName)) {
      var reporterMatched = setSelectByCandidates(
        el.reporter,
        [prefill.reporterId, prefill.reporterName],
        true,
      );

      if (!reporterMatched && prefill.reporterName) {
        var reporterNameNormalized = normalizeText(prefill.reporterName);

        var match = MOCK_EMPLOYEES.filter(function (e) {
          return normalizeText(e.fullName) === reporterNameNormalized;
        })[0];

        if (match) {
          el.reporter.value = String(match.id);
        }
      }
    }
    if (el.role && prefill.reporterRole) {
      var roleText = (
        typeof prefill.reporterRole === "string" ? prefill.reporterRole : ""
      ).trim();

      if (roleText) {
        var roleMap = {
          מנהל: "מנהל פרויקט",
          "מנהל עבודה": "מנהל פרויקט",
          "מתקין ראשי": "מתקין",
        };

        var mappedRole = roleMap[roleText] || roleText;

        setSelectByCandidates(el.role, [mappedRole, roleText], true);
      }
    }
    if (el.summary) el.summary.value = "";
    if (el.notes) el.notes.value = "";
    if (el.systems) {
      el.systems
        .querySelectorAll(".report-system-chip")
        .forEach(function (chip) {
          chip.classList.remove("selected");
        });
    }
  }

  function tryOpenQuickReportForm() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("quick") !== "1") return;
    console.groupCollapsed(
      "🔍 [DATA AUDIT] Quick-report payload received from workplan",
    );
    var raw;
    try {
      raw = sessionStorage.getItem(QUICK_REPORT_KEY);
      console.log("Source: sessionStorage key:", QUICK_REPORT_KEY);
      console.log("Raw data:", raw);
    } catch (e) {
      console.error("Error reading from sessionStorage:", e);
      console.groupEnd();
      return;
    }
    if (!raw) {
      console.log("No prefill data found in sessionStorage");
      console.groupEnd();
      return;
    }
    var prefill;
    try {
      prefill = JSON.parse(raw);
      console.log("Parsed payload:", prefill);
    } catch (e) {
      console.error("Error parsing prefill JSON:", e);
      console.groupEnd();
      return;
    }
    sessionStorage.removeItem(QUICK_REPORT_KEY);
    console.log("Payload applied to form via prefillFormFromQuickReport()");
    console.groupEnd();
    openFormModal();
    prefillFormFromQuickReport(prefill);
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  function initReportTypeAndLinkage() {
    applyReportTypeUI();
    if (el.reportTypeProject) {
      el.reportTypeProject.addEventListener("change", onReportTypeChange);
    }
    if (el.reportTypeService) {
      el.reportTypeService.addEventListener("change", onReportTypeChange);
    }
    if (el.serviceCall) {
      el.serviceCall.addEventListener("change", onServiceCallChange);
    }
  }

  function initToolbarFilters() {
    var projectSel = document.getElementById("report-filter-project");
    var customerSel = document.getElementById("report-filter-customer");
    if (projectSel) {
      MOCK_PROJECTS.forEach(function (p) {
        var opt = document.createElement("option");
        opt.value = p.id;
        opt.textContent = p.name;
        projectSel.appendChild(opt);
      });
    }
    if (customerSel) {
      var seen = {};
      MOCK_PROJECTS.forEach(function (p) {
        var name = p.customerName || "";
        if (name && !seen[name]) {
          seen[name] = true;
          var opt = document.createElement("option");
          opt.value = name;
          opt.textContent = name;
          customerSel.appendChild(opt);
        }
      });
    }
  }

  function initRecentReports() {
    renderRecentReports();
    if (el.recentTbody) {
      el.recentTbody.addEventListener("click", function (e) {
        var row = e.target.closest("tr.report-row-clickable");
        if (row && row.dataset.reportId) {
          openViewModal(row.dataset.reportId);
        }
      });
    }
    if (el.viewClose) {
      el.viewClose.addEventListener("click", closeViewModal);
    }
  }

  function init() {
    initRefs();
    setDefaultDate();
    populateProjects();
    populateEmployees();
    populateServiceCalls();
    populateSystems();
    initProducts();
    initFollowup();
    initRelatedWorkersForm();
    initActions();
    initFormModal();
    initReportTypeAndLinkage();
    initToolbarFilters();
    initRecentReports();

    if (el.project) {
      el.project.addEventListener("change", onProjectChange);
    }

    tryOpenQuickReportForm();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
