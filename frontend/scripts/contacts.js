// Contacts screen controller - backend integrated via shared api.js
(function () {
  "use strict";

  // State
  let selectedSegment = "הכל";
  let selectedStatus = "All";
  let searchQuery = "";
  let selectedContactId = null;
  let currentMode = "view"; // 'view', 'edit', 'create'
  let contactSnapshot = null; // For cancel operation

  let contactsData = [];
  let customersData = [];

  // DOM elements
  const segmentPills = document.querySelectorAll(".contacts-segment-chip");
  const statusFilterButtons = document.querySelectorAll(".status-filter");
  const searchInput = document.getElementById("contacts-search-input");
  const tableBody = document.getElementById("contacts-table-body");
  const emptyState = document.getElementById("contacts-empty-state");
  const contactCardModal = document.getElementById("contact-card-modal");
  const contactCardClose = document.getElementById("contact-card-close");
  const newContactBtn = document.getElementById("btn-new-contact");
  const editBtn = document.getElementById("contact-card-edit-btn");
  const deleteBtn = document.getElementById("contact-card-delete-btn");
  const saveBtn = document.getElementById("contact-card-save-btn");
  const cancelBtn = document.getElementById("contact-card-cancel-btn");
  const deleteConfirmModal = document.getElementById("delete-confirm-modal");
  const deleteConfirmClose = document.getElementById("delete-confirm-close");
  const deleteConfirmCancel = document.getElementById("delete-confirm-cancel");
  const deleteConfirmDelete = document.getElementById("delete-confirm-delete");

  async function apiRequest(path, options = {}) {
    if (typeof window.apiRequest !== "function") {
      throw new Error(
        "Shared apiRequest is not available. Make sure api.js is loaded before contacts.js.",
      );
    }

    return window.apiRequest(path, options);
  }

  function segmentToCategory(segment) {
    switch (segment) {
      case "הכל":
        return "ALL";
      case "לקוחות":
        return "CustomerPrimary";
      case "נציגי לקוחות":
        return "CustomerRepresentative";
      case "ספקים":
        return "Supplier";
      case "שותפים עסקיים":
        return "BusinessPartner";
      default:
        return "";
    }
  }

  function categoryToSegment(category) {
    switch (category) {
      case "CustomerPrimary":
        return "לקוחות";
      case "CustomerRepresentative":
        return "נציגי לקוחות";
      case "Supplier":
        return "ספקים";
      case "BusinessPartner":
        return "שותפים עסקיים";
      case "Consultant":
      case "Architect":
      case "Contractor":
      case "Other":
      default:
        return "שותפים עסקיים";
    }
  }

  function categoryToLabel(category) {
    switch (category) {
      case "CustomerPrimary":
        return "לקוחות";
      case "CustomerRepresentative":
        return "נציגי לקוחות";
      case "Supplier":
        return "ספקים";
      case "BusinessPartner":
        return "שותפים עסקיים";
      case "Consultant":
        return "יועצים";
      case "Architect":
        return "אדריכלים";
      case "Contractor":
        return "קבלנים";
      case "Other":
        return "אחר";
      default:
        return category || "-";
    }
  }

  function segmentOptionsHtml(selectedValue) {
    const options = [
      { value: "CustomerPrimary", label: "לקוחות" },
      { value: "CustomerRepresentative", label: "נציגי לקוחות" },
      { value: "Supplier", label: "ספקים" },
      { value: "BusinessPartner", label: "שותפים עסקיים" },
      { value: "Consultant", label: "יועצים" },
      { value: "Architect", label: "אדריכלים" },
      { value: "Contractor", label: "קבלנים" },
      { value: "Other", label: "אחר" },
    ];

    return `
      <option value="">-- בחר חתך --</option>
      ${options
        .map(
          (option) =>
            `<option value="${option.value}" ${
              option.value === selectedValue ? "selected" : ""
            }>${option.label}</option>`,
        )
        .join("")}
    `;
  }

  async function loadCustomers() {
    customersData = await apiRequest("/customers");
  }

  async function loadContacts() {
    contactsData = await apiRequest("/contacts");
  }

  async function refreshData() {
    await Promise.all([loadCustomers(), loadContacts()]);
  }

  async function init() {
    try {
      await refreshData();
    } catch (error) {
      console.error("Failed to initialize contacts screen:", error);
      alert(`שגיאה בטעינת נתונים: ${error.message}`);
      return;
    }

    segmentPills.forEach((pill) => {
      pill.addEventListener("click", function () {
        const segment = this.dataset.segment;
        selectSegment(segment);
      });
    });

    statusFilterButtons.forEach((button) => {
      button.addEventListener("click", function () {
        const status = this.dataset.status;
        selectStatus(status);
      });
    });

    if (searchInput) {
      searchInput.addEventListener("input", function (e) {
        searchQuery = e.target.value.trim();
        renderTable();
      });
    }

    if (contactCardClose) {
      contactCardClose.addEventListener("click", closeContactCard);
    }

    if (contactCardModal) {
      const overlay = contactCardModal.querySelector(".contact-card-overlay");
      if (overlay) {
        overlay.addEventListener("click", function () {
          if (currentMode === "view") {
            closeContactCard();
          }
        });
      }
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || e.keyCode === 27) {
        if (contactCardModal && contactCardModal.classList.contains("active")) {
          if (currentMode === "view") {
            closeContactCard();
          } else if (currentMode === "edit" || currentMode === "create") {
            cancelEdit();
          }
        }
        if (
          deleteConfirmModal &&
          deleteConfirmModal.classList.contains("active")
        ) {
          closeDeleteConfirm();
        }
      }
    });

    if (newContactBtn) {
      newContactBtn.addEventListener("click", function () {
        openContactCardForCreate();
      });
    }

    if (editBtn) {
      editBtn.addEventListener("click", enterEditMode);
    }

    if (deleteBtn) {
      deleteBtn.addEventListener("click", showDeleteConfirm);
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", saveContact);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", cancelEdit);
    }

    if (deleteConfirmClose) {
      deleteConfirmClose.addEventListener("click", closeDeleteConfirm);
    }
    if (deleteConfirmCancel) {
      deleteConfirmCancel.addEventListener("click", closeDeleteConfirm);
    }
    if (deleteConfirmDelete) {
      deleteConfirmDelete.addEventListener("click", confirmDelete);
    }
    if (deleteConfirmModal) {
      const overlay = deleteConfirmModal.querySelector(".contact-card-overlay");
      if (overlay) {
        overlay.addEventListener("click", closeDeleteConfirm);
      }
    }

    renderTable();
    await checkDeepLink();
  }

  function selectSegment(segment) {
    selectedSegment = segment;

    segmentPills.forEach((pill) => {
      if (pill.dataset.segment === segment) {
        pill.classList.add("active");
      } else {
        pill.classList.remove("active");
      }
    });

    if (searchInput) {
      searchInput.value = "";
      searchQuery = "";
    }

    selectedContactId = null;
    renderTable();
  }

  function selectStatus(status) {
    selectedStatus = status;

    statusFilterButtons.forEach((button) => {
      if (button.dataset.status === status) {
        button.classList.add("active");
      } else {
        button.classList.remove("active");
      }
    });

    renderTable();
  }
  function getFilteredContacts() {
    const selectedCategory = segmentToCategory(selectedSegment);

    let filtered = contactsData;

    if (selectedStatus === "ACTIVE") {
      filtered = filtered.filter((contact) => contact.isActive === true);
    }

    if (selectedStatus === "INACTIVE") {
      filtered = filtered.filter((contact) => contact.isActive === false);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((contact) => {
        const fullName = (contact.fullName || "").toLowerCase();
        const companyName = (contact.companyName || "").toLowerCase();
        const phone = (contact.phone || "").toLowerCase();
        const email = (contact.email || "").toLowerCase();

        return (
          fullName.includes(query) ||
          companyName.includes(query) ||
          phone.includes(query) ||
          email.includes(query)
        );
      });
    }

    return filtered;
  }

  function renderTable() {
    if (!tableBody) return;

    const contacts = getFilteredContacts();
    tableBody.innerHTML = "";

    if (emptyState) {
      if (contacts.length === 0) {
        emptyState.style.display = "block";
        const emptyStateTitle = document.getElementById("empty-state-title");
        if (emptyStateTitle) {
          emptyStateTitle.textContent = "אין אנשי קשר להצגה בחתך זה";
        }
      } else {
        emptyState.style.display = "none";
      }
    }

    contacts.forEach((contact) => {
      const row = document.createElement("tr");
      row.dataset.contactId = contact.contactId;

      const statusClass = contact.isActive ? "badge-success" : "badge-neutral";
      const statusText = contact.isActive ? "פעיל" : "לא פעיל";

      if (contact.contactId === selectedContactId) {
        row.classList.add("is-selected");
      }

      row.innerHTML = `
        <td>${escapeHtml(contact.fullName || "-")}</td>
        <td>${escapeHtml(contact.companyName || "-")}</td>
        <td>${escapeHtml(contact.phone || "-")}</td>
        <td>${escapeHtml(contact.email || "-")}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td>${escapeHtml(formatDateDisplay(contact.updatedAt || contact.createdAt) || "-")}</td>
      `;

      row.addEventListener("click", function () {
        selectedContactId = contact.contactId;
        openContactCard(contact.contactId);
      });

      tableBody.appendChild(row);
    });
  }

  async function openContactCard(contactId) {
    try {
      const contact = await apiRequest(`/contacts/${contactId}`);

      currentMode = "view";
      selectedContactId = contactId;

      const url = new URL(window.location);
      url.searchParams.set("contactId", contactId);
      window.history.pushState({}, "", url);

      populateViewFields(contact);
      populateNavigationLinks(contact);
      showViewMode();
      syncRowSelection();

      contactCardModal.classList.add("active");
      document.body.classList.add("modal-open");
    } catch (error) {
      alert(`שגיאה בטעינת איש הקשר: ${error.message}`);
    }
  }

  function syncRowSelection() {
    if (!tableBody) return;

    tableBody.querySelectorAll("tr").forEach((r) => {
      r.classList.remove("is-selected");
    });

    if (selectedContactId) {
      const selectedRow = tableBody.querySelector(
        `tr[data-contact-id="${selectedContactId}"]`,
      );
      if (selectedRow) {
        selectedRow.classList.add("is-selected");
        selectedRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }

  function openContactCardForCreate() {
    currentMode = "create";
    selectedContactId = null;

    const url = new URL(window.location);
    url.searchParams.delete("contactId");
    window.history.pushState({}, "", url);

    clearAllFields();

    const segmentSelect = document.getElementById("input-segment");
    segmentSelect.innerHTML = segmentOptionsHtml(
      segmentToCategory(selectedSegment),
    );
    segmentSelect.value = segmentToCategory(selectedSegment);

    updateCompanyDropdownByCategory(segmentSelect.value);
    attachSegmentChangeHandler();
    showEditMode(true);

    contactCardModal.classList.add("active");
    document.body.classList.add("modal-open");
  }

  function populateViewFields(contact) {
    document.getElementById("contact-card-name").textContent =
      contact.fullName || "-";
    document.getElementById("contact-field-fullname").textContent =
      contact.fullName || "-";
    document.getElementById("contact-field-role").textContent =
      contact.jobTitle || "-";
    document.getElementById("contact-field-company").textContent =
      contact.companyName || "-";
    document.getElementById("contact-field-segment").textContent =
      categoryToLabel(contact.contactCategory);

    const statusBadge = contact.isActive
      ? '<span class="badge badge-success">פעיל</span>'
      : '<span class="badge badge-neutral">לא פעיל</span>';

    document.getElementById("contact-field-status").innerHTML = statusBadge;
    document.getElementById("contact-field-city").textContent =
      contact.city || "-";
    document.getElementById("contact-field-phone").textContent =
      contact.phone || "-";
    document.getElementById("contact-field-email").textContent =
      contact.email || "-";
    document.getElementById("contact-field-channel").textContent =
      contact.preferredChannel || "-";
    document.getElementById("contact-field-notes").textContent =
      contact.notes || "-";
    document.getElementById("contact-field-updated").textContent =
      formatDateDisplay(contact.updatedAt || contact.createdAt) || "-";
  }

  function populateNavigationLinks(contact) {
    const linksContainer = document.getElementById("contact-card-links");
    linksContainer.innerHTML = "";

    if (contact.customerId) {
      const customerBtn = document.createElement("a");
      customerBtn.href = `customers.html?customerId=${contact.customerId}`;
      customerBtn.className = "btn btn-outline";
      customerBtn.textContent = "תיק לקוח";
      linksContainer.appendChild(customerBtn);
    }
  }

  function showViewMode() {
    document.querySelectorAll(".contact-card-field-edit").forEach((el) => {
      el.style.display = "none";
    });

    document.querySelectorAll(".contact-card-field-view").forEach((el) => {
      el.style.display = "flex";
    });

    document.getElementById("contact-card-actions-view").style.display = "flex";
    document.getElementById("contact-card-actions-edit").style.display = "none";

    const linksSection = document.querySelector(
      ".contact-card-section:last-of-type",
    );
    if (
      linksSection &&
      linksSection.querySelector(".contact-card-section-title").textContent ===
        "קישוריות"
    ) {
      linksSection.style.display = "block";
    }
  }

  function showEditMode(isCreate) {
    document.querySelectorAll(".contact-card-field-view").forEach((el) => {
      el.style.display = "none";
    });

    document.querySelectorAll(".contact-card-field-edit").forEach((el) => {
      el.style.display = "flex";
    });

    document.getElementById("contact-card-actions-view").style.display = "none";
    document.getElementById("contact-card-actions-edit").style.display = "flex";

    if (isCreate) {
      document.getElementById("contact-field-updated-view").style.display =
        "none";
    }

    const linksSection = document.querySelector(
      ".contact-card-section:last-of-type",
    );
    if (
      linksSection &&
      linksSection.querySelector(".contact-card-section-title").textContent ===
        "קישוריות"
    ) {
      linksSection.style.display = "none";
    }
  }

  function clearAllFields() {
    document.getElementById("input-fullname").value = "";
    document.getElementById("input-role").value = "";
    document.getElementById("input-company").value = "";
    document.getElementById("input-segment").innerHTML = segmentOptionsHtml("");
    document.getElementById("input-status").value = "פעיל";
    document.getElementById("input-city").value = "";
    document.getElementById("input-phone").value = "";
    document.getElementById("input-email").value = "";
    document.getElementById("input-channel").value = "";
    document.getElementById("input-notes").value = "";
  }

  function populateCompanyDropdown(selectedCompanyId) {
    const companySelect = document.getElementById("input-company");
    companySelect.innerHTML = '<option value="">-- בחר חברה --</option>';

    customersData.forEach((customer) => {
      const option = document.createElement("option");
      option.value = customer.customerId;
      option.textContent = customer.customerName;
      if (String(selectedCompanyId) === String(customer.customerId)) {
        option.selected = true;
      }
      companySelect.appendChild(option);
    });
  }

  async function enterEditMode() {
    if (!selectedContactId) return;

    try {
      const contact = await apiRequest(`/contacts/${selectedContactId}`);

      currentMode = "edit";
      contactSnapshot = JSON.parse(JSON.stringify(contact));

      document.getElementById("input-fullname").value = contact.fullName || "";
      document.getElementById("input-role").value = contact.jobTitle || "";
      document.getElementById("input-segment").innerHTML = segmentOptionsHtml(
        contact.contactCategory,
      );
      document.getElementById("input-segment").value =
        contact.contactCategory || "";
      document.getElementById("input-status").value = contact.isActive
        ? "פעיל"
        : "מושהה";
      document.getElementById("input-city").value = contact.city || "";
      document.getElementById("input-phone").value = contact.phone || "";
      document.getElementById("input-email").value = contact.email || "";
      document.getElementById("input-channel").value =
        contact.preferredChannel || "";
      document.getElementById("input-notes").value = contact.notes || "";

      updateCompanyDropdownByCategory(contact.contactCategory);
      if (contact.customerId) {
        document.getElementById("input-company").value = String(
          contact.customerId,
        );
      }

      attachSegmentChangeHandler();
      showEditMode(false);
    } catch (error) {
      alert(`שגיאה בטעינת איש הקשר לעריכה: ${error.message}`);
    }
  }

  function attachSegmentChangeHandler() {
    const segmentSelect = document.getElementById("input-segment");
    const newSegmentSelect = segmentSelect.cloneNode(true);
    segmentSelect.parentNode.replaceChild(newSegmentSelect, segmentSelect);

    newSegmentSelect.addEventListener("change", function () {
      updateCompanyDropdownByCategory(this.value);
      if (
        this.value !== "CustomerPrimary" &&
        this.value !== "CustomerRepresentative"
      ) {
        document.getElementById("input-company").value = "";
      }
    });
  }

  function updateCompanyDropdownByCategory(category) {
    const companySelect = document.getElementById("input-company");

    if (
      category === "CustomerPrimary" ||
      category === "CustomerRepresentative"
    ) {
      populateCompanyDropdown(companySelect.value);
    } else {
      companySelect.innerHTML = '<option value="">-- אין חברה --</option>';
      companySelect.value = "";
    }
  }

  async function saveContact() {
    if (!validateForm()) {
      return;
    }

    const fullName = document.getElementById("input-fullname").value.trim();
    const jobTitle = document.getElementById("input-role").value.trim();
    const customerIdValue = document.getElementById("input-company").value;
    const contactCategory = document.getElementById("input-segment").value;
    const statusValue = document.getElementById("input-status").value;
    const city = document.getElementById("input-city").value.trim();
    const phone = document.getElementById("input-phone").value.trim();
    const email = document.getElementById("input-email").value.trim();
    const preferredChannel = document.getElementById("input-channel").value;
    const notes = document.getElementById("input-notes").value.trim();

    const customerId = customerIdValue ? Number(customerIdValue) : null;
    const selectedCustomer = customersData.find(
      (customer) => String(customer.customerId) === String(customerIdValue),
    );

    const payload = {
      fullName,
      jobTitle: jobTitle || null,
      contactCategory,
      customerId,
      companyName: selectedCustomer?.customerName || null,
      phone: phone || null,
      secondaryPhone: null,
      email: email || null,
      preferredChannel: preferredChannel || null,
      city: city || null,
      address: null,
      status: statusValue === "פעיל" ? "Active" : "Inactive",
      notes: notes || null,
      isActive: statusValue === "פעיל",
    };

    try {
      if (currentMode === "create") {
        const created = await apiRequest("/contacts", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        selectedContactId = created.contactId;

        const targetSegment = categoryToSegment(
          created.contactCategory || contactCategory,
        );
        if (targetSegment !== selectedSegment) {
          selectSegment(targetSegment);
        }

        await refreshData();
        renderTable();
        await openContactCard(selectedContactId);
        return;
      }

      if (currentMode === "edit" && selectedContactId) {
        const updated = await apiRequest(`/contacts/${selectedContactId}`, {
          method: "PUT",
          body: JSON.stringify({
            contactId: selectedContactId,
            ...payload,
          }),
        });

        const targetSegment = categoryToSegment(
          updated.contactCategory || contactCategory,
        );
        if (targetSegment !== selectedSegment) {
          selectSegment(targetSegment);
        }

        await refreshData();
        renderTable();
        populateViewFields(updated);
        populateNavigationLinks(updated);
        showViewMode();
        currentMode = "view";
        syncRowSelection();
      }
    } catch (error) {
      alert(`שגיאה בשמירת איש הקשר: ${error.message}`);
    }
  }

  function validateForm() {
    const fullName = document.getElementById("input-fullname").value.trim();
    const contactCategory = document.getElementById("input-segment").value;
    const phone = document.getElementById("input-phone").value.trim();
    const email = document.getElementById("input-email").value.trim();
    const customerId = document.getElementById("input-company").value;

    if (!fullName) {
      alert("שם מלא הוא שדה חובה");
      document.getElementById("input-fullname").focus();
      return false;
    }

    if (!contactCategory) {
      alert("סוג (חתך) הוא שדה חובה");
      document.getElementById("input-segment").focus();
      return false;
    }

    if (!phone && !email) {
      alert("יש למלא טלפון או מייל");
      document.getElementById("input-phone").focus();
      return false;
    }

    if (
      (contactCategory === "CustomerPrimary" ||
        contactCategory === "CustomerRepresentative") &&
      !customerId
    ) {
      alert("יש לבחור חברה עבור חתך זה");
      document.getElementById("input-company").focus();
      return false;
    }

    return true;
  }

  function cancelEdit() {
    if (currentMode === "create") {
      closeContactCard();
      return;
    }

    if (currentMode === "edit" && contactSnapshot) {
      populateViewFields(contactSnapshot);
      populateNavigationLinks(contactSnapshot);
      showViewMode();
      currentMode = "view";
      renderTable();
    }
  }

  function showDeleteConfirm() {
    if (!selectedContactId) return;
    deleteConfirmModal.classList.add("active");
  }

  function closeDeleteConfirm() {
    deleteConfirmModal.classList.remove("active");
  }

  async function confirmDelete() {
    if (!selectedContactId) return;

    try {
      await apiRequest(`/contacts/${selectedContactId}`, {
        method: "DELETE",
      });

      closeDeleteConfirm();
      closeContactCard();
      await refreshData();
      renderTable();
      selectedContactId = null;
    } catch (error) {
      alert(`שגיאה במחיקת איש הקשר: ${error.message}`);
    }
  }

  function closeContactCard() {
    if (!contactCardModal) return;

    contactCardModal.classList.remove("active");
    document.body.classList.remove("modal-open");

    const url = new URL(window.location);
    url.searchParams.delete("contactId");
    window.history.pushState({}, "", url);

    currentMode = "view";
    contactSnapshot = null;
    const previousContactId = selectedContactId;
    selectedContactId = null;

    if (tableBody && previousContactId) {
      const previousRow = tableBody.querySelector(
        `tr[data-contact-id="${previousContactId}"]`,
      );
      if (previousRow) {
        previousRow.classList.remove("is-selected");
      }
    }
  }

  function formatDateDisplay(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  async function checkDeepLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const contactId = urlParams.get("contactId");

    if (!contactId) {
      return;
    }

    try {
      const contact = await apiRequest(`/contacts/${contactId}`);
      const targetSegment = categoryToSegment(contact.contactCategory);

      if (targetSegment !== selectedSegment) {
        selectSegment(targetSegment);
      }

      await openContactCard(Number(contactId));
    } catch (error) {
      console.warn("Deep link contact could not be opened:", error);
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
