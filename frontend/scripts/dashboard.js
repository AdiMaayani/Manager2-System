// Dashboard-specific interactions
document.addEventListener('DOMContentLoaded', () => {
  // Modal handling
  const modals = document.querySelectorAll('.modal');
  const modalTriggers = document.querySelectorAll('[data-modal]');
  const modalCloses = document.querySelectorAll('.modal-close, .modal-overlay');

  // Open modal
  modalTriggers.forEach(trigger => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const modalId = trigger.getAttribute('data-modal');
      const modal = document.getElementById(modalId);
      if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  // Close modal
  modalCloses.forEach(close => {
    close.addEventListener('click', (e) => {
      if (e.target === close || close.classList.contains('modal-close')) {
        modals.forEach(modal => {
          modal.classList.remove('active');
        });
        document.body.style.overflow = '';
      }
    });
  });

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modals.forEach(modal => {
        modal.classList.remove('active');
      });
      document.body.style.overflow = '';
    }
  });

  // Report order form submission
  const orderForms = document.querySelectorAll('.order-form');
  orderForms.forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const itemId = form.getAttribute('data-item-id') || 
                     (form.querySelector('[data-item-id]')?.getAttribute('data-item-id'));
      const itemCard = document.querySelector(`[data-item-id="${itemId}"]`);
      
      if (itemCard) {
        // Update status
        const statusBadge = itemCard.querySelector('.action-status');
        if (statusBadge) {
          statusBadge.textContent = 'הוזמן – ממתין למשלוח';
          statusBadge.className = 'action-status badge badge-primary';
        }
        
        // Hide action button
        const actionBtn = itemCard.querySelector('.btn-action');
        if (actionBtn) {
          actionBtn.style.display = 'none';
        }
      }
      
      // Close modal
      const modal = form.closest('.modal');
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
      
      // Reset form
      form.reset();
    });
  });

  // Set item ID on form when modal opens
  modalTriggers.forEach(trigger => {
    if (trigger.getAttribute('data-modal') === 'order-modal') {
      trigger.addEventListener('click', () => {
        const itemId = trigger.getAttribute('data-item-id');
        const form = document.querySelector('.order-form');
        if (form && itemId) {
          form.setAttribute('data-item-id', itemId);
        }
      });
    }
  });

  // Mark as handled
  document.querySelectorAll('.btn-handled').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const card = btn.closest('.action-card');
      if (card && !card.classList.contains('is-handled')) {
        const itemId = card.getAttribute('data-item-id');
        
        // Add handled state
        card.classList.add('is-handled');
        
        // Add handled badge
        const header = card.querySelector('.action-card-header');
        if (header) {
          const existingBadge = header.querySelector('.badge-handled');
          if (!existingBadge) {
            const handledBadge = document.createElement('span');
            handledBadge.className = 'badge badge-handled';
            handledBadge.innerHTML = 'טופל ✅';
            header.insertBefore(handledBadge, header.firstChild);
          }
        }
        
        // Hide the button
        btn.style.display = 'none';
        
        // Checkmark animation
        const checkmark = document.createElement('span');
        checkmark.className = 'checkmark-animation';
        checkmark.innerHTML = '✅';
        card.appendChild(checkmark);
        setTimeout(() => {
          checkmark.remove();
        }, 300);
        
        // Show toast with undo
        showHandledToast(itemId, card);
      }
    });
  });

  // Toast notification with undo
  function showHandledToast(itemId, card) {
    // Remove existing toast if any
    const existingToast = document.getElementById('handled-toast');
    if (existingToast) {
      existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.id = 'handled-toast';
    toast.className = 'handled-toast';
    toast.innerHTML = `
      <span class="toast-message">סומן כטופל ✅</span>
      <button type="button" class="toast-undo" data-item-id="${itemId}">ביטול</button>
    `;
    document.body.appendChild(toast);
    
    // Show toast
    setTimeout(() => {
      toast.classList.add('show');
    }, 10);
    
    // Auto-hide after 7 seconds
    const autoHideTimeout = setTimeout(() => {
      hideToast(toast);
    }, 7000);
    
    // Undo button
    const undoBtn = toast.querySelector('.toast-undo');
    undoBtn.addEventListener('click', () => {
      clearTimeout(autoHideTimeout);
      hideToast(toast);
      
      // Revert card state
      card.classList.remove('is-handled');
      const handledBadge = card.querySelector('.badge-handled');
      if (handledBadge) {
        handledBadge.remove();
      }
      const btn = card.querySelector('.btn-handled');
      if (btn) {
        btn.style.display = '';
      }
    });
  }
  
  function hideToast(toast) {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }

  // Task creation form submission
  const taskCreateForm = document.querySelector('.task-create-form');
  if (taskCreateForm) {
    taskCreateForm.addEventListener('submit', (e) => {
      e.preventDefault();
      // Handle task creation (simplified for demo)
      const modal = document.getElementById('task-create-modal');
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
      taskCreateForm.reset();
      // In real app, would add task to list here
    });
  }

  // Task click to open details modal
  document.querySelectorAll('.task-row[data-task-id]').forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', (e) => {
      if (!e.target.closest('.badge') && !e.target.closest('button') && !e.target.closest('.task-icon')) {
        const taskId = row.getAttribute('data-task-id');
        const modal = document.getElementById('task-details-modal');
        if (modal) {
          const taskTitle = row.querySelector('.task-title')?.textContent || '';
          const taskLabel = row.querySelector('.task-label')?.textContent || '';
          const taskBadge = row.querySelector('.badge')?.cloneNode(true);
          const taskIcon = row.querySelector('.task-icon');
          
          const titleEl = modal.querySelector('#task-details-title');
          const timeEl = modal.querySelector('#task-details-time');
          const urgencyEl = modal.querySelector('#task-details-urgency');
          const typeEl = modal.querySelector('#task-details-type');
          
          if (titleEl) titleEl.textContent = taskTitle;
          if (timeEl) timeEl.textContent = taskLabel;
          if (urgencyEl && taskBadge) {
            urgencyEl.innerHTML = '';
            urgencyEl.appendChild(taskBadge);
          }
          if (typeEl && taskIcon) {
            const iconClass = taskIcon.classList.contains('task-icon-project') ? 'משימת פרויקט' : 'משימת משרד';
            typeEl.textContent = iconClass;
          }
          
          modal.classList.add('active');
          document.body.style.overflow = 'hidden';
        }
      }
    });
  });

  // Alert click to open detail modal
  document.querySelectorAll('.alert-item').forEach(item => {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      const alertId = item.getAttribute('data-alert-id');
      const modal = document.getElementById('alert-modal');
      if (modal) {
        // Populate alert details based on alertId
        const alertText = item.textContent.trim();
        const alertDescription = modal.querySelector('#alert-description');
        const alertAffected = modal.querySelector('#alert-affected');
        const alertResponsible = modal.querySelector('#alert-responsible');
        const alertLinks = modal.querySelector('#alert-links');
        
        if (alertDescription) alertDescription.textContent = alertText;
        if (alertAffected) {
          if (alertId === 'alert-1') {
            alertAffected.textContent = 'פרויקט: בית פרטי חיפה';
          } else if (alertId === 'alert-2') {
            alertAffected.textContent = '5 דיווחי ביצוע';
          } else if (alertId === 'alert-3') {
            alertAffected.textContent = 'פרויקט: משרדי ABC';
          } else if (alertId === 'alert-4') {
            alertAffected.textContent = 'תזרים מזומנים';
          }
        }
        if (alertResponsible) {
          if (alertId === 'alert-1' || alertId === 'alert-3') {
            alertResponsible.textContent = 'יוסי כהן (מנהל פרויקט)';
          } else if (alertId === 'alert-2') {
            alertResponsible.textContent = 'דוד ישראל (טכנאי)';
          } else if (alertId === 'alert-4') {
            alertResponsible.textContent = 'רביב מעיני (מנכ״ל)';
          }
        }
        if (alertLinks) {
          alertLinks.innerHTML = '';
          if (alertId === 'alert-1' || alertId === 'alert-3') {
            const link = document.createElement('a');
            link.href = 'projects.html';
            link.textContent = 'פתח פרויקט';
            link.className = 'btn btn-sm btn-primary';
            alertLinks.appendChild(link);
          } else if (alertId === 'alert-2') {
            const link = document.createElement('a');
            link.href = 'reports.html';
            link.textContent = 'פתח דיווחי ביצוע';
            link.className = 'btn btn-sm btn-primary';
            alertLinks.appendChild(link);
          } else if (alertId === 'alert-4') {
            const link = document.createElement('a');
            link.href = 'cashflow.html';
            link.textContent = 'פתח תזרים מזומנים';
            link.className = 'btn btn-sm btn-primary';
            alertLinks.appendChild(link);
          }
        }
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  // Follow-up details click
  document.querySelectorAll('.btn-followup-details').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const followupId = btn.getAttribute('data-followup-id');
      const row = btn.closest('.task-row');
      const modal = document.getElementById('followup-modal');
      if (modal) {
        const title = row.querySelector('.task-title')?.textContent || '';
        const time = row.querySelector('.task-label')?.textContent || '';
        
        const quoteEl = modal.querySelector('#followup-quote');
        const customerEl = modal.querySelector('#followup-customer');
        const timeEl = modal.querySelector('#followup-time');
        const contextEl = modal.querySelector('#followup-context');
        const nextEl = modal.querySelector('#followup-next');
        
        if (quoteEl) quoteEl.textContent = title.replace('שיחת מעקב – ', '');
        if (timeEl) timeEl.textContent = time;
        
        // Extract customer name from title
        const customerMatch = title.match(/\(([^)]+)\)/);
        if (customerEl && customerMatch) {
          customerEl.textContent = customerMatch[1];
        }
        
        if (contextEl) {
          contextEl.textContent = 'שיחה אוטומטית 24 שעות לאחר שליחת הצעת מחיר';
        }
        if (nextEl) {
          nextEl.textContent = 'לבצע שיחת מעקב עם הלקוח ולעדכן סטטוס הצעה';
        }
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  // View quote button
  document.querySelectorAll('.btn-view-quote').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const quoteId = btn.getAttribute('data-quote-id');
      // Navigate to quote page
      window.location.href = `quotes.html#${quoteId}`;
    });
  });

  // Timeline item clicks
  document.querySelectorAll('.timeline-item[data-entity-id]').forEach(item => {
    item.style.cursor = 'pointer';
    item.addEventListener('click', () => {
      const entityId = item.getAttribute('data-entity-id');
      const entityType = item.getAttribute('data-entity-type');
      // Navigate to relevant page (simplified)
      if (entityType === 'project') {
        window.location.href = 'projects.html';
      } else if (entityType === 'quote') {
        window.location.href = 'quotes.html';
      } else if (entityType === 'service') {
        window.location.href = 'service-calls.html';
      }
    });
  });
});
