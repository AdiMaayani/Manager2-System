// Contacts screen controller
(function() {
  'use strict';

  // State
  let selectedSegment = 'לקוחות';
  let searchQuery = '';
  let selectedContactId = null;
  let currentMode = 'view'; // 'view', 'edit', 'create'
  let contactSnapshot = null; // For cancel operation

  // DOM elements
  const segmentPills = document.querySelectorAll('.contacts-segment-chip');
  const searchInput = document.getElementById('contacts-search-input');
  const tableBody = document.getElementById('contacts-table-body');
  const emptyState = document.getElementById('contacts-empty-state');
  const contactCardModal = document.getElementById('contact-card-modal');
  const contactCardClose = document.getElementById('contact-card-close');
  const newContactBtn = document.getElementById('btn-new-contact');
  const editBtn = document.getElementById('contact-card-edit-btn');
  const deleteBtn = document.getElementById('contact-card-delete-btn');
  const saveBtn = document.getElementById('contact-card-save-btn');
  const cancelBtn = document.getElementById('contact-card-cancel-btn');
  const deleteConfirmModal = document.getElementById('delete-confirm-modal');
  const deleteConfirmClose = document.getElementById('delete-confirm-close');
  const deleteConfirmCancel = document.getElementById('delete-confirm-cancel');
  const deleteConfirmDelete = document.getElementById('delete-confirm-delete');

  // Initialize
  function init() {
    if (!window.CONTACTS_MOCK_DATA) {
      console.error('CONTACTS_MOCK_DATA not loaded. Make sure mock-data.js is loaded before contacts.js.');
      return;
    }

    // Attach segment pill click handlers
    segmentPills.forEach(pill => {
      pill.addEventListener('click', function() {
        const segment = this.dataset.segment;
        selectSegment(segment);
      });
    });

    // Attach search input handler
    if (searchInput) {
      searchInput.addEventListener('input', function(e) {
        searchQuery = e.target.value.trim();
        renderTable();
      });
    }

    // Attach contact card close handler
    if (contactCardClose) {
      contactCardClose.addEventListener('click', closeContactCard);
    }

    // Close card when clicking overlay
    if (contactCardModal) {
      const overlay = contactCardModal.querySelector('.contact-card-overlay');
      if (overlay) {
        overlay.addEventListener('click', function() {
          if (currentMode === 'view') {
            closeContactCard();
          }
        });
      }
    }

    // ESC key handler for closing card
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        if (contactCardModal && contactCardModal.classList.contains('active')) {
          if (currentMode === 'view') {
            closeContactCard();
          } else if (currentMode === 'edit' || currentMode === 'create') {
            cancelEdit();
          }
        }
        if (deleteConfirmModal && deleteConfirmModal.classList.contains('active')) {
          closeDeleteConfirm();
        }
      }
    });

    // New contact button
    if (newContactBtn) {
      newContactBtn.addEventListener('click', function() {
        openContactCardForCreate();
      });
    }

    // Edit button
    if (editBtn) {
      editBtn.addEventListener('click', enterEditMode);
    }

    // Delete button
    if (deleteBtn) {
      deleteBtn.addEventListener('click', showDeleteConfirm);
    }

    // Save button
    if (saveBtn) {
      saveBtn.addEventListener('click', saveContact);
    }

    // Cancel button
    if (cancelBtn) {
      cancelBtn.addEventListener('click', cancelEdit);
    }

    // Delete confirmation handlers
    if (deleteConfirmClose) {
      deleteConfirmClose.addEventListener('click', closeDeleteConfirm);
    }
    if (deleteConfirmCancel) {
      deleteConfirmCancel.addEventListener('click', closeDeleteConfirm);
    }
    if (deleteConfirmDelete) {
      deleteConfirmDelete.addEventListener('click', confirmDelete);
    }
    if (deleteConfirmModal) {
      const overlay = deleteConfirmModal.querySelector('.contact-card-overlay');
      if (overlay) {
        overlay.addEventListener('click', closeDeleteConfirm);
      }
    }

    // Initial render
    renderTable();

    // Check for deep-link contactId
    checkDeepLink();
  }

  // Select segment
  function selectSegment(segment) {
    selectedSegment = segment;
    
    // Update active pill
    segmentPills.forEach(pill => {
      if (pill.dataset.segment === segment) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });

    // Clear search
    if (searchInput) {
      searchInput.value = '';
      searchQuery = '';
    }

    // Clear selection when switching segments
    selectedContactId = null;

    // Re-render table
    renderTable();
    
    // Sync row selection if card is open
    if (contactCardModal && contactCardModal.classList.contains('active') && selectedContactId) {
      setTimeout(() => {
        syncRowSelection();
      }, 50);
    }
  }

  // Filter contacts by segment and search
  function getFilteredContacts() {
    if (!window.CONTACTS_MOCK_DATA) return [];

    const allContacts = window.CONTACTS_MOCK_DATA.CONTACTS;
    
    // Filter by segment
    let filtered = allContacts.filter(contact => contact.segment === selectedSegment);

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(contact => {
        const fullName = (contact.fullName || '').toLowerCase();
        const companyName = (contact.companyName || '').toLowerCase();
        const phone = (contact.phone || '').toLowerCase();
        const email = (contact.email || '').toLowerCase();
        
        return fullName.includes(query) ||
               companyName.includes(query) ||
               phone.includes(query) ||
               email.includes(query);
      });
    }

    return filtered;
  }

  // Render table
  function renderTable() {
    if (!tableBody) return;

    const contacts = getFilteredContacts();

    // Clear table
    tableBody.innerHTML = '';

    // Show/hide empty state with segment-specific message
    if (emptyState) {
      if (contacts.length === 0) {
        emptyState.style.display = 'block';
        const emptyStateTitle = document.getElementById('empty-state-title');
        if (emptyStateTitle) {
          emptyStateTitle.textContent = 'אין אנשי קשר להצגה בחתך זה';
        }
      } else {
        emptyState.style.display = 'none';
      }
    }

    // Render rows
    contacts.forEach(contact => {
      const row = document.createElement('tr');
      row.dataset.contactId = contact.id;
      
      // Status badge
      let statusBadge = '';
      if (contact.segment === 'נציגי לקוחות') {
        statusBadge = '<span class="badge badge-success">פעיל</span>';
      } else if (contact.status) {
        const statusClass = contact.status === 'פעיל' ? 'badge-success' : 'badge-neutral';
        statusBadge = `<span class="badge ${statusClass}">${contact.status}</span>`;
      }

      // Mark as selected if this is the selected contact (sync with open card)
      if (contact.id === selectedContactId) {
        row.classList.add('is-selected');
      }

      row.innerHTML = `
        <td>${contact.fullName || '-'}</td>
        <td>${contact.companyName || '-'}</td>
        <td>${contact.phone || '-'}</td>
        <td>${contact.email || '-'}</td>
        <td>${statusBadge}</td>
        <td>${contact.updatedAt || '-'}</td>
      `;

      // Attach row click handler
      row.addEventListener('click', function() {
        // Update selected contact ID
        selectedContactId = contact.id;

        // Open contact card (will sync selection)
        openContactCard(contact.id);
      });

      tableBody.appendChild(row);
    });
  }

  // Open contact card (view mode)
  function openContactCard(contactId) {
    if (!window.CONTACTS_MOCK_DATA || !contactCardModal) return;

    const contact = window.CONTACTS_MOCK_DATA.CONTACTS.find(c => c.id === contactId);
    if (!contact) return;

    currentMode = 'view';
    selectedContactId = contactId;

    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set('contactId', contactId);
    window.history.pushState({}, '', url);

    // Populate view fields
    populateViewFields(contact);

    // Populate navigation links
    populateNavigationLinks(contact);

    // Show view mode, hide edit mode
    showViewMode();

    // Sync row selection with open card
    syncRowSelection();

    // Show modal with animation
    contactCardModal.classList.add('active');
    document.body.classList.add('modal-open');
  }

  // Sync row selection with open card
  function syncRowSelection() {
    if (!tableBody) return;
    
    // Remove selection from all rows
    tableBody.querySelectorAll('tr').forEach(r => {
      r.classList.remove('is-selected');
    });
    
    // Mark selected row if contact card is open
    if (selectedContactId) {
      const selectedRow = tableBody.querySelector(`tr[data-contact-id="${selectedContactId}"]`);
      if (selectedRow) {
        selectedRow.classList.add('is-selected');
        // Scroll into view if needed
        selectedRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }

  // Open contact card for create
  function openContactCardForCreate() {
    if (!window.CONTACTS_MOCK_DATA || !contactCardModal) return;

    currentMode = 'create';
    selectedContactId = null;

    // Clear URL parameter
    const url = new URL(window.location);
    url.searchParams.delete('contactId');
    window.history.pushState({}, '', url);

    // Clear all fields
    clearAllFields();

    // Set default segment to current selected segment
    const segmentSelect = document.getElementById('input-segment');
    segmentSelect.value = selectedSegment;

    // Update company dropdown based on segment
    updateCompanyDropdownBySegment(selectedSegment);

    // Handle segment change for company dropdown (remove old listener first)
    const newSegmentSelect = segmentSelect.cloneNode(true);
    segmentSelect.parentNode.replaceChild(newSegmentSelect, segmentSelect);
    newSegmentSelect.addEventListener('change', function() {
      updateCompanyDropdownBySegment(this.value);
      // Clear company if segment doesn't require it
      if (this.value !== 'לקוחות' && this.value !== 'נציגי לקוחות') {
        document.getElementById('input-company').value = '';
      }
    });

    // Show edit mode (for create)
    showEditMode(true);

    // Show modal
    contactCardModal.classList.add('active');
    document.body.classList.add('modal-open');
  }

  // Populate view fields
  function populateViewFields(contact) {
    document.getElementById('contact-card-name').textContent = contact.fullName || '-';
    document.getElementById('contact-field-fullname').textContent = contact.fullName || '-';
    document.getElementById('contact-field-role').textContent = contact.role || '-';
    document.getElementById('contact-field-company').textContent = contact.companyName || '-';
    document.getElementById('contact-field-segment').textContent = contact.segment || '-';
    
    // Status badge
    let statusBadge = '';
    if (contact.segment === 'נציגי לקוחות') {
      statusBadge = '<span class="badge badge-success">פעיל</span>';
    } else if (contact.status) {
      const statusClass = contact.status === 'פעיל' ? 'badge-success' : 'badge-neutral';
      statusBadge = `<span class="badge ${statusClass}">${contact.status}</span>`;
    }
    document.getElementById('contact-field-status').innerHTML = statusBadge || '-';
    
    document.getElementById('contact-field-city').textContent = contact.city || '-';
    document.getElementById('contact-field-phone').textContent = contact.phone || '-';
    document.getElementById('contact-field-email').textContent = contact.email || '-';
    document.getElementById('contact-field-channel').textContent = contact.preferredChannel || '-';
    document.getElementById('contact-field-notes').textContent = contact.notes || '-';
    document.getElementById('contact-field-updated').textContent = contact.updatedAt || '-';
  }

  // Populate navigation links
  function populateNavigationLinks(contact) {
    const linksContainer = document.getElementById('contact-card-links');
    linksContainer.innerHTML = '';

    // Customer link (if companyId exists)
    if (contact.companyId) {
      const customerBtn = document.createElement('a');
      customerBtn.href = `customers.html?customerId=${contact.companyId}`;
      customerBtn.className = 'btn btn-outline';
      customerBtn.textContent = 'תיק לקוח';
      linksContainer.appendChild(customerBtn);
    }

    // Project link (if projectId exists)
    if (contact.projectId) {
      const projectBtn = document.createElement('a');
      projectBtn.href = `projects.html?projectId=${contact.projectId}`;
      projectBtn.className = 'btn btn-outline';
      projectBtn.textContent = 'תיק פרויקט';
      linksContainer.appendChild(projectBtn);
    }

    // Service call link (if serviceCallId exists)
    if (contact.serviceCallId) {
      const serviceBtn = document.createElement('a');
      serviceBtn.href = `service-calls.html?callId=${contact.serviceCallId}`;
      serviceBtn.className = 'btn btn-outline';
      serviceBtn.textContent = 'קריאת שירות';
      linksContainer.appendChild(serviceBtn);
    }
  }

  // Show view mode
  function showViewMode() {
    // Hide all edit fields
    document.querySelectorAll('.contact-card-field-edit').forEach(el => {
      el.style.display = 'none';
    });
    // Show all view fields (except updated in create mode)
    document.querySelectorAll('.contact-card-field-view').forEach(el => {
      el.style.display = 'flex';
    });
    // Show view actions, hide edit actions
    document.getElementById('contact-card-actions-view').style.display = 'flex';
    document.getElementById('contact-card-actions-edit').style.display = 'none';
    
    // Show navigation links section in view mode
    const linksSection = document.querySelector('.contact-card-section:last-of-type');
    if (linksSection && linksSection.querySelector('.contact-card-section-title').textContent === 'קישוריות') {
      linksSection.style.display = 'block';
    }
  }

  // Show edit mode
  function showEditMode(isCreate) {
    // Hide all view fields
    document.querySelectorAll('.contact-card-field-view').forEach(el => {
      el.style.display = 'none';
    });
    // Show all edit fields
    document.querySelectorAll('.contact-card-field-edit').forEach(el => {
      el.style.display = 'flex';
    });
    // Hide view actions, show edit actions
    document.getElementById('contact-card-actions-view').style.display = 'none';
    document.getElementById('contact-card-actions-edit').style.display = 'flex';
    
    // Hide "עודכן לאחרונה" in create mode
    if (isCreate) {
      document.getElementById('contact-field-updated-view').style.display = 'none';
    }
    
    // Hide navigation links section in edit/create mode
    const linksSection = document.querySelector('.contact-card-section:last-of-type');
    if (linksSection && linksSection.querySelector('.contact-card-section-title').textContent === 'קישוריות') {
      linksSection.style.display = 'none';
    }
  }

  // Clear all fields
  function clearAllFields() {
    document.getElementById('input-fullname').value = '';
    document.getElementById('input-role').value = '';
    document.getElementById('input-company').value = '';
    document.getElementById('input-segment').value = '';
    document.getElementById('input-status').value = 'פעיל';
    document.getElementById('input-city').value = '';
    document.getElementById('input-phone').value = '';
    document.getElementById('input-email').value = '';
    document.getElementById('input-channel').value = '';
    document.getElementById('input-notes').value = '';
  }

  // Populate company dropdown
  function populateCompanyDropdown(selectedCompanyId) {
    const companySelect = document.getElementById('input-company');
    companySelect.innerHTML = '<option value="">-- בחר חברה --</option>';

    if (!window.CONTACTS_MOCK_DATA) return;

    window.CONTACTS_MOCK_DATA.CUSTOMERS.forEach(customer => {
      const option = document.createElement('option');
      option.value = customer.id;
      option.textContent = customer.name;
      if (selectedCompanyId === customer.id) {
        option.selected = true;
      }
      companySelect.appendChild(option);
    });
  }

  // Enter edit mode
  function enterEditMode() {
    if (!selectedContactId || !window.CONTACTS_MOCK_DATA) return;

    const contact = window.CONTACTS_MOCK_DATA.CONTACTS.find(c => c.id === selectedContactId);
    if (!contact) return;

    currentMode = 'edit';
    contactSnapshot = JSON.parse(JSON.stringify(contact)); // Deep copy

    // Populate edit fields
    document.getElementById('input-fullname').value = contact.fullName || '';
    document.getElementById('input-role').value = contact.role || '';
    document.getElementById('input-segment').value = contact.segment || '';
    document.getElementById('input-status').value = contact.status || 'פעיל';
    document.getElementById('input-city').value = contact.city || '';
    document.getElementById('input-phone').value = contact.phone || '';
    document.getElementById('input-email').value = contact.email || '';
    document.getElementById('input-channel').value = contact.preferredChannel || '';
    document.getElementById('input-notes').value = contact.notes || '';

    // Update company dropdown based on segment
    updateCompanyDropdownBySegment(contact.segment);
    if (contact.companyId) {
      document.getElementById('input-company').value = contact.companyId;
    }

    // Handle segment change for company dropdown (remove old listener first)
    const segmentSelect = document.getElementById('input-segment');
    const newSegmentSelect = segmentSelect.cloneNode(true);
    segmentSelect.parentNode.replaceChild(newSegmentSelect, segmentSelect);
    newSegmentSelect.addEventListener('change', function() {
      updateCompanyDropdownBySegment(this.value);
      // Clear company if segment doesn't require it
      if (this.value !== 'לקוחות' && this.value !== 'נציגי לקוחות') {
        document.getElementById('input-company').value = '';
      }
    });

    // Show edit mode
    showEditMode(false);
  }

  // Update company dropdown based on segment
  function updateCompanyDropdownBySegment(segment) {
    const companySelect = document.getElementById('input-company');
    const currentValue = companySelect.value;

    // If segment requires a customer (לקוחות or נציגי לקוחות), show only customers
    if (segment === 'לקוחות' || segment === 'נציגי לקוחות') {
      populateCompanyDropdown(currentValue);
    } else {
      // For suppliers and partners, clear company
      companySelect.innerHTML = '<option value="">-- אין חברה --</option>';
      companySelect.value = '';
    }
  }

  // Save contact (create or edit)
  function saveContact() {
    // Validate form
    if (!validateForm()) {
      return;
    }

    const fullName = document.getElementById('input-fullname').value.trim();
    const role = document.getElementById('input-role').value.trim();
    const companyId = document.getElementById('input-company').value;
    const segment = document.getElementById('input-segment').value;
    const status = document.getElementById('input-status').value;
    const city = document.getElementById('input-city').value.trim();
    const phone = document.getElementById('input-phone').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const preferredChannel = document.getElementById('input-channel').value;
    const notes = document.getElementById('input-notes').value.trim();

    // Get company name
    let companyName = '';
    if (companyId && window.CONTACTS_MOCK_DATA) {
      const customer = window.CONTACTS_MOCK_DATA.CUSTOMERS.find(c => c.id === companyId);
      companyName = customer ? customer.name : '';
    }

    if (currentMode === 'create') {
      // Create new contact
      const newId = 'CONT-' + String(Date.now()).slice(-6);
      const newContact = {
        id: newId,
        fullName: fullName,
        role: role || '',
        companyId: companyId || null,
        companyName: companyName,
        segment: segment,
        email: email,
        phone: phone,
        city: city || '',
        notes: notes || '',
        preferredChannel: preferredChannel || '',
        updatedAt: formatDate(new Date()),
        status: status,
        projectId: null,
        serviceCallId: null
      };

      window.CONTACTS_MOCK_DATA.CONTACTS.push(newContact);
      selectedContactId = newId;

      // Switch to the contact's segment
      if (segment !== selectedSegment) {
        selectSegment(segment);
      } else {
        renderTable();
      }
    } else if (currentMode === 'edit' && selectedContactId) {
      // Update existing contact
      const contact = window.CONTACTS_MOCK_DATA.CONTACTS.find(c => c.id === selectedContactId);
      if (contact) {
        contact.fullName = fullName;
        contact.role = role || '';
        contact.companyId = companyId || null;
        contact.companyName = companyName;
        contact.segment = segment;
        contact.status = status;
        contact.city = city || '';
        contact.phone = phone;
        contact.email = email;
        contact.preferredChannel = preferredChannel || '';
        contact.notes = notes || '';
        contact.updatedAt = formatDate(new Date());

        // If segment changed, switch to new segment
        if (segment !== selectedSegment) {
          selectSegment(segment);
        } else {
          renderTable();
        }
      }
    }

    // Switch back to view mode
    currentMode = 'view';
    const updatedContact = window.CONTACTS_MOCK_DATA.CONTACTS.find(c => c.id === selectedContactId);
    if (updatedContact) {
      populateViewFields(updatedContact);
      populateNavigationLinks(updatedContact);
      showViewMode();
      
      // Sync row selection with open card
      syncRowSelection();
    }
  }

  // Validate form
  function validateForm() {
    const fullName = document.getElementById('input-fullname').value.trim();
    const segment = document.getElementById('input-segment').value;
    const phone = document.getElementById('input-phone').value.trim();
    const email = document.getElementById('input-email').value.trim();
    const companyId = document.getElementById('input-company').value;
    const segmentSelect = document.getElementById('input-segment').value;

    // Required: fullName
    if (!fullName) {
      alert('שם מלא הוא שדה חובה');
      document.getElementById('input-fullname').focus();
      return false;
    }

    // Required: segment
    if (!segment) {
      alert('סוג (חתך) הוא שדה חובה');
      document.getElementById('input-segment').focus();
      return false;
    }

    // Required: phone OR email
    if (!phone && !email) {
      alert('יש למלא טלפון או מייל');
      if (!phone) {
        document.getElementById('input-phone').focus();
      } else {
        document.getElementById('input-email').focus();
      }
      return false;
    }

    // If segment is לקוחות or נציגי לקוחות, company is required
    if ((segmentSelect === 'לקוחות' || segmentSelect === 'נציגי לקוחות') && !companyId) {
      alert('יש לבחור חברה עבור חתך זה');
      document.getElementById('input-company').focus();
      return false;
    }

    return true;
  }

  // Cancel edit
  function cancelEdit() {
    if (currentMode === 'create') {
      // Close card if creating
      closeContactCard();
    } else if (currentMode === 'edit' && contactSnapshot) {
      // Restore from snapshot
      const contact = window.CONTACTS_MOCK_DATA.CONTACTS.find(c => c.id === selectedContactId);
      if (contact && contactSnapshot) {
        Object.assign(contact, contactSnapshot);
        populateViewFields(contact);
        populateNavigationLinks(contact);
        showViewMode();
        currentMode = 'view';
        renderTable();
      }
    }
  }

  // Show delete confirmation
  function showDeleteConfirm() {
    if (!selectedContactId) return;
    deleteConfirmModal.classList.add('active');
  }

  // Close delete confirmation
  function closeDeleteConfirm() {
    deleteConfirmModal.classList.remove('active');
  }

  // Confirm delete
  function confirmDelete() {
    if (!selectedContactId || !window.CONTACTS_MOCK_DATA) return;

    const index = window.CONTACTS_MOCK_DATA.CONTACTS.findIndex(c => c.id === selectedContactId);
    if (index !== -1) {
      window.CONTACTS_MOCK_DATA.CONTACTS.splice(index, 1);
      closeDeleteConfirm();
      closeContactCard();
      renderTable();
      selectedContactId = null;
    }
  }

  // Close contact card
  function closeContactCard() {
    if (!contactCardModal) return;

    // If in edit/create mode, just reset without saving
    if (currentMode === 'create') {
      // Just close, no need to restore
    } else if (currentMode === 'edit' && contactSnapshot) {
      // Restore from snapshot
      const contact = window.CONTACTS_MOCK_DATA.CONTACTS.find(c => c.id === selectedContactId);
      if (contact && contactSnapshot) {
        Object.assign(contact, contactSnapshot);
        renderTable();
      }
    }

    contactCardModal.classList.remove('active');
    document.body.classList.remove('modal-open');

    // Clear URL parameter
    const url = new URL(window.location);
    url.searchParams.delete('contactId');
    window.history.pushState({}, '', url);

    currentMode = 'view';
    contactSnapshot = null;
    const previousContactId = selectedContactId;
    selectedContactId = null;
    
    // Clear row selection when card closes
    if (tableBody && previousContactId) {
      const previousRow = tableBody.querySelector(`tr[data-contact-id="${previousContactId}"]`);
      if (previousRow) {
        previousRow.classList.remove('is-selected');
      }
    }
  }

  // Format date for display
  function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  // Check for deep-link contactId
  function checkDeepLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const contactId = urlParams.get('contactId');
    
    if (contactId) {
      // Wait for table to render, then try to open
      setTimeout(() => {
        const contact = window.CONTACTS_MOCK_DATA.CONTACTS.find(c => c.id === contactId);
        if (contact) {
          // Switch to the correct segment if needed
          if (contact.segment !== selectedSegment) {
            selectSegment(contact.segment);
            // Wait for table to render after segment switch
            setTimeout(() => {
              openContactCard(contactId);
            }, 100);
          } else {
            openContactCard(contactId);
          }
        }
      }, 100);
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
