// Employees page functionality
document.addEventListener('DOMContentLoaded', () => {
  const employeesTable = document.querySelector('#employees-table tbody');
  const employeeModal = document.getElementById('employee-modal');
  const modalOverlay = employeeModal?.querySelector('.modal-overlay');
  const modalClose = employeeModal?.querySelector('.modal-close');
  const btnEdit = document.getElementById('btn-edit-employee');
  const btnSave = document.getElementById('btn-save-employee');
  const btnCancel = document.getElementById('btn-cancel-employee');
  
  let currentEmployee = null;
  let originalEmployeeData = null;
  let isEditMode = false;

  // Get employees data
  function getEmployees() {
    return window.MOCK_DATA?.employees || [];
  }

  // Get status badge class
  function getStatusBadgeClass(status) {
    if (status === 'זמין') return 'badge-success';
    if (status === 'עמוס' || status === 'בשירות') return 'badge-warning';
    return 'badge-neutral';
  }

  // Render table rows
  function renderTable() {
    if (!employeesTable) return;
    
    const employees = getEmployees();
    employeesTable.innerHTML = '';

    employees.forEach(employee => {
      const row = document.createElement('tr');
      row.setAttribute('data-employee-id', employee.id);
      row.style.cursor = 'pointer';
      
      row.innerHTML = `
        <td>${employee.fullName}</td>
        <td>${employee.primaryRole || employee.role}</td>
        <td><span class="badge ${getStatusBadgeClass(employee.status)}">${employee.status}</span></td>
        <td>-</td>
        <td>-</td>
      `;

      row.addEventListener('click', (e) => {
        if (e.target.closest('.dropdown')) return;
        openEmployeeModal(employee.id);
      });

      employeesTable.appendChild(row);
    });
  }

  // Open employee modal
  function openEmployeeModal(employeeId) {
    const employees = getEmployees();
    const employee = employees.find(emp => emp.id === employeeId);
    
    if (!employee || !employeeModal) return;

    currentEmployee = employee;
    originalEmployeeData = { ...employee };
    isEditMode = false;

    populateModal(employee, false);
    employeeModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  // Close employee modal
  function closeEmployeeModal() {
    if (!employeeModal) return;
    
    employeeModal.classList.remove('active');
    document.body.style.overflow = '';
    currentEmployee = null;
    originalEmployeeData = null;
    isEditMode = false;
  }

  // Populate modal with employee data
  function populateModal(employee, editMode) {
    const modalSubtitle = document.getElementById('employee-modal-subtitle');
    const fieldName = document.getElementById('employee-field-name');
    const fieldRole = document.getElementById('employee-field-role');
    const fieldRoles = document.getElementById('employee-field-roles');
    const fieldPhone = document.getElementById('employee-field-phone');
    const fieldEmail = document.getElementById('employee-field-email');
    const fieldStatus = document.getElementById('employee-field-status');
    const fieldNotes = document.getElementById('employee-field-notes');
    const viewModeActions = document.getElementById('employee-view-actions');
    const editModeActions = document.getElementById('employee-edit-actions');

    if (modalSubtitle) {
      modalSubtitle.textContent = employee.fullName;
    }

    // Set field values
    if (fieldName) {
      const input = fieldName.querySelector('input');
      const valueEl = fieldName.querySelector('.field-value');
      if (editMode && input) {
        input.value = employee.fullName || '';
      } else if (valueEl) {
        valueEl.textContent = employee.fullName || '';
      }
    }

    if (fieldRole) {
      const input = fieldRole.querySelector('input');
      const valueEl = fieldRole.querySelector('.field-value');
      if (editMode && input) {
        input.value = (employee.primaryRole || employee.role) || '';
      } else if (valueEl) {
        valueEl.textContent = (employee.primaryRole || employee.role) || '';
      }
    }

    if (fieldRoles) {
      const valueEl = fieldRoles.querySelector('.field-value');
      if (valueEl && !editMode) {
        const roles = employee.roles || [];
        if (roles.length > 0) {
          valueEl.innerHTML = '';
          const chipsContainer = document.createElement('div');
          chipsContainer.style.display = 'flex';
          chipsContainer.style.flexWrap = 'wrap';
          chipsContainer.style.gap = 'var(--spacing-xs)';
          roles.forEach(function(role) {
            const chip = document.createElement('span');
            chip.className = 'badge badge-neutral';
            chip.textContent = role;
            chipsContainer.appendChild(chip);
          });
          valueEl.appendChild(chipsContainer);
        } else {
          valueEl.textContent = '—';
        }
      }
    }

    if (fieldPhone) {
      const input = fieldPhone.querySelector('input');
      const valueEl = fieldPhone.querySelector('.field-value');
      if (editMode && input) {
        input.value = employee.phone || '';
      } else if (valueEl) {
        valueEl.textContent = employee.phone || '';
      }
    }

    if (fieldEmail) {
      const input = fieldEmail.querySelector('input');
      const valueEl = fieldEmail.querySelector('.field-value');
      if (editMode && input) {
        input.value = employee.email || '';
      } else if (valueEl) {
        valueEl.textContent = employee.email || '';
      }
    }

    if (fieldStatus) {
      const select = fieldStatus.querySelector('select');
      const valueEl = fieldStatus.querySelector('.field-value');
      if (editMode && select) {
        select.value = employee.status || '';
      } else if (valueEl) {
        valueEl.textContent = employee.status || '';
      }
    }

    if (fieldNotes) {
      const textarea = fieldNotes.querySelector('textarea');
      const valueEl = fieldNotes.querySelector('.field-value');
      if (editMode && textarea) {
        textarea.value = employee.notes || '';
      } else if (valueEl) {
        valueEl.textContent = employee.notes || '';
      }
    }

    // Toggle view/edit mode
    if (viewModeActions) viewModeActions.style.display = editMode ? 'none' : 'flex';
    if (editModeActions) editModeActions.style.display = editMode ? 'flex' : 'none';

    // Toggle field editability
    document.querySelectorAll('#employee-modal .field-value').forEach(el => {
      el.style.display = editMode ? 'none' : 'block';
    });
    document.querySelectorAll('#employee-modal .field-input').forEach(el => {
      el.style.display = editMode ? 'block' : 'none';
    });
  }

  // Enter edit mode
  function enterEditMode() {
    if (!currentEmployee) return;
    isEditMode = true;
    populateModal(currentEmployee, true);
  }

  // Cancel edit mode
  function cancelEdit() {
    if (!currentEmployee || !originalEmployeeData) return;
    isEditMode = false;
    populateModal(originalEmployeeData, false);
  }

  // Save employee
  function saveEmployee() {
    if (!currentEmployee) return;

    const fieldName = document.getElementById('employee-field-name');
    const fieldRole = document.getElementById('employee-field-role');
    const fieldPhone = document.getElementById('employee-field-phone');
    const fieldEmail = document.getElementById('employee-field-email');
    const fieldStatus = document.getElementById('employee-field-status');
    const fieldNotes = document.getElementById('employee-field-notes');

    // Get values from inputs
    const updatedEmployee = {
      ...currentEmployee,
      fullName: fieldName?.querySelector('input')?.value || currentEmployee.fullName,
      role: fieldRole?.querySelector('input')?.value || currentEmployee.role,
      phone: fieldPhone?.querySelector('input')?.value || currentEmployee.phone,
      email: fieldEmail?.querySelector('input')?.value || currentEmployee.email,
      status: fieldStatus?.querySelector('select')?.value || currentEmployee.status,
      notes: fieldNotes?.querySelector('textarea')?.value || currentEmployee.notes
    };

    // Update in mock data
    const employees = getEmployees();
    const index = employees.findIndex(emp => emp.id === currentEmployee.id);
    if (index !== -1) {
      employees[index] = updatedEmployee;
    }

    // Update current employee and original data
    currentEmployee = updatedEmployee;
    originalEmployeeData = { ...updatedEmployee };
    isEditMode = false;

    // Re-render table and modal
    renderTable();
    populateModal(updatedEmployee, false);
  }

  // Event listeners
  if (btnEdit) {
    btnEdit.addEventListener('click', enterEditMode);
  }

  if (btnSave) {
    btnSave.addEventListener('click', saveEmployee);
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', cancelEdit);
  }

  if (modalClose) {
    modalClose.addEventListener('click', closeEmployeeModal);
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', closeEmployeeModal);
  }

  // Close on ESC key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && employeeModal?.classList.contains('active')) {
      if (isEditMode) {
        cancelEdit();
      } else {
        closeEmployeeModal();
      }
    }
  });

  // Initial render
  renderTable();
});
