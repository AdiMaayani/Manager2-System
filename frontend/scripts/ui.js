// Shared mock data for ManageR²
window.MANAGER2_DATA = {
  customers: [
    {
      id: 'CUST-001',
      name: 'חברת ABC בע״מ',
      type: 'עסקי',
      status: 'בביצוע',
      contactPerson: 'יוסי כהן',
      contactRole: 'מנהל IT',
      phone: '03-1234567',
      email: 'info@abc.co.il',
      region: 'מרכז',
      manager: 'שרה לוי',
      projectsCount: 1
    },
    {
      id: 'CUST-002',
      name: 'וילה רמת אביב',
      type: 'פרטי',
      status: 'בביצוע',
      contactPerson: 'דוד כהן',
      contactRole: 'בעלים',
      phone: '050-9876543',
      email: 'villa@example.com',
      region: 'מרכז',
      manager: 'שרה לוי',
      projectsCount: 1
    },
    {
      id: 'CUST-003',
      name: 'מלון דן תל אביב',
      type: 'מוסדי',
      status: 'תחת חוזה',
      contactPerson: 'שרה דוד',
      contactRole: 'מנהלת תחזוקה',
      phone: '03-5202520',
      email: 'contact@danhotels.com',
      region: 'מרכז',
      manager: 'רביב',
      projectsCount: 0
    },
    {
      id: 'CUST-004',
      name: 'שרה לוי',
      type: 'פרטי',
      status: 'בביצוע',
      contactPerson: 'שרה לוי',
      contactRole: 'בעלים',
      phone: '052-1234567',
      email: 'sara@example.com',
      region: 'צפון',
      manager: 'שרה לוי',
      projectsCount: 0
    },
    {
      id: 'CUST-005',
      name: 'דוד כהן',
      type: 'פרטי',
      status: 'בביצוע',
      contactPerson: 'דוד כהן',
      contactRole: 'בעלים',
      phone: '050-1111111',
      email: 'david@example.com',
      region: 'מרכז',
      manager: 'שרה לוי',
      projectsCount: 0
    }
  ],
  serviceCalls: [
    {
      id: '2456',
      customerId: 'CUST-001',
      number: '#2456',
      subject: 'בעיה בלוח בקרה מרכזי - לא מגיב לפקודות',
      status: 'בטיפול',
      priority: 'דחוף',
      openedAt: '15/01/2025',
      updatedAt: '18/01/2025 11:15',
      type: 'לא תחת חוזה (בתשלום)',
      description: 'בעיה בלוח בקרה מרכזי - לא מגיב לפקודות'
    },
    {
      id: '2457',
      customerId: 'CUST-001',
      number: '#2457',
      subject: 'בדיקת תקינות מערכת האבטחה',
      status: 'בטיפול',
      priority: 'גבוה',
      openedAt: '10/01/2025',
      updatedAt: '16/01/2025 16:20',
      type: 'תחת חוזה / אחריות',
      description: 'בדיקת תקינות מערכת האבטחה'
    },
    {
      id: '2455',
      customerId: 'CUST-002',
      number: '#2455',
      subject: 'רמקול בחדר השינה לא פועל',
      status: 'פתוח',
      priority: 'רגיל',
      openedAt: '18/01/2025',
      updatedAt: '18/01/2025 09:00',
      type: 'במהלך פרויקט',
      description: 'רמקול בחדר השינה לא פועל'
    },
    {
      id: '2454',
      customerId: 'CUST-004',
      number: '#2454',
      subject: 'חיישן תאורה לא מגיב',
      status: 'הושלם',
      priority: 'רגיל',
      openedAt: '10/01/2025',
      updatedAt: '12/01/2025 14:30',
      type: 'לא תחת חוזה (בתשלום)',
      description: 'חיישן תאורה לא מגיב'
    },
    {
      id: '2453',
      customerId: 'CUST-003',
      number: '#2453',
      subject: 'מצלמה בקומה 3 מנותקת',
      status: 'בטיפול',
      priority: 'גבוה',
      openedAt: '12/01/2025',
      updatedAt: '16/01/2025 16:20',
      type: 'תחת חוזה / אחריות',
      description: 'מצלמה בקומה 3 מנותקת'
    },
    {
      id: '2452',
      customerId: 'CUST-005',
      number: '#2452',
      subject: 'תקלה במתג חכם - לא נדלק',
      status: 'הושלם',
      priority: 'רגיל',
      openedAt: '05/01/2025',
      updatedAt: '08/01/2025 10:00',
      type: 'לא תחת חוזה (בתשלום)',
      description: 'תקלה במתג חכם - לא נדלק'
    }
  ]
};

// Shared UI utilities
document.addEventListener('DOMContentLoaded', () => {
  // Dropdown menus
  document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = toggle.nextElementSibling;
      const isActive = menu.classList.contains('active');
      
      // Close all dropdowns
      document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
      
      // Toggle current dropdown
      if (!isActive) {
        menu.classList.add('active');
      }
    });
  });

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown')) {
      document.querySelectorAll('.dropdown-menu').forEach(menu => {
        menu.classList.remove('active');
      });
    }
    if (!e.target.closest('.filter-dropdown')) {
      document.querySelectorAll('.filter-dropdown-menu').forEach(menu => {
        menu.classList.remove('active');
      });
    }
  });

  // Filter dropdowns
  document.querySelectorAll('.filter-dropdown-toggle').forEach(toggle => {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = toggle.nextElementSibling;
      const isActive = menu.classList.contains('active');
      
      // Close all filter dropdowns
      document.querySelectorAll('.filter-dropdown-menu').forEach(m => m.classList.remove('active'));
      
      // Toggle current dropdown
      if (!isActive) {
        menu.classList.add('active');
      }
    });
  });

  // Filter chips
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      // Remove active from siblings if they're in the same container
      const container = chip.closest('.filters');
      if (container) {
        container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      }
      chip.classList.add('active');
    });
  });

  // Close details panel when clicking outside (if overlay exists)
  document.addEventListener('click', (e) => {
    const detailsPanel = document.querySelector('.details-panel.active');
    if (detailsPanel && !e.target.closest('.details-panel') && !e.target.closest('[data-customer-id], [data-project-id], [data-contact-id]')) {
      detailsPanel.classList.remove('active');
      document.querySelectorAll('.table tbody tr').forEach(r => r.classList.remove('selected'));
    }
  });

  // Quotes page specific functionality
  if (document.querySelector('.quote-row')) {
    const quoteDrawerOverlay = document.getElementById('quote-drawer-overlay');
    const quoteDrawer = document.getElementById('quote-details');
    const quoteCloseBtn = document.getElementById('quote-close');
    const quoteBackdrop = quoteDrawerOverlay?.querySelector('.quote-drawer-backdrop');
    const quoteMaximizeBtn = document.getElementById('quote-maximize');

    // Quote line items with pricing (consistent with existing projects/customers)
    const quoteLineItems = {
      '1234': [
        { description: 'בקר מרכזי למערכת בית חכם', quantity: 1, unit: 'יח׳', unitPrice: 8500, notes: 'ארון תקשורת ראשי' },
        { description: 'מתגים חכמים', quantity: 30, unit: 'יח׳', unitPrice: 450, notes: 'חלוקה לפי חדרים' },
        { description: 'חיישני תאורה', quantity: 15, unit: 'יח׳', unitPrice: 320, notes: 'מסדרונות וחצר' },
        { description: 'מצלמות IP', quantity: 8, unit: 'יח׳', unitPrice: 1200, notes: 'כניסה/חצר/סלון' },
        { description: 'מקליט NVR', quantity: 1, unit: 'יח׳', unitPrice: 3500, notes: 'הקלטה 30 יום' },
        { description: 'התקנה והדרכה', quantity: 1, unit: 'פרויקט', unitPrice: 8500, notes: 'כולל הדרכת שימוש' }
      ],
      '1235': [
        { description: 'בקר מרכזי למערכת בית חכם', quantity: 1, unit: 'יח׳', unitPrice: 8500, notes: 'ארון תקשורת ראשי' },
        { description: 'מתגים חכמים', quantity: 25, unit: 'יח׳', unitPrice: 450, notes: 'חלוקה לפי חדרים' },
        { description: 'מצלמות IP', quantity: 6, unit: 'יח׳', unitPrice: 1200, notes: 'כניסה/חצר' },
        { description: 'התקנה והדרכה', quantity: 1, unit: 'פרויקט', unitPrice: 6500, notes: 'כולל הדרכת שימוש' }
      ],
      '1236': [
        { description: 'בקר מרכזי למערכת בית חכם', quantity: 1, unit: 'יח׳', unitPrice: 8500, notes: 'ארון תקשורת ראשי' },
        { description: 'מתגים חכמים', quantity: 20, unit: 'יח׳', unitPrice: 450, notes: 'חלוקה לפי חדרים' },
        { description: 'התקנה והדרכה', quantity: 1, unit: 'פרויקט', unitPrice: 5500, notes: 'כולל הדרכת שימוש' }
      ],
      '1200': [
        { description: 'בקר מרכזי למערכת בית חכם', quantity: 1, unit: 'יח׳', unitPrice: 8500, notes: 'ארון תקשורת ראשי' },
        { description: 'מתגים חכמים', quantity: 15, unit: 'יח׳', unitPrice: 450, notes: 'חלוקה לפי חדרים' },
        { description: 'מצלמות IP', quantity: 4, unit: 'יח׳', unitPrice: 1200, notes: 'כניסה/חצר' },
        { description: 'התקנה והדרכה', quantity: 1, unit: 'פרויקט', unitPrice: 5000, notes: 'כולל הדרכת שימוש' }
      ],
      '1180': [
        { description: 'מצלמות IP', quantity: 12, unit: 'יח׳', unitPrice: 1200, notes: 'קומות 1-3' },
        { description: 'מקליט NVR', quantity: 1, unit: 'יח׳', unitPrice: 4500, notes: 'הקלטה 60 יום' },
        { description: 'התקנה ותחזוקה', quantity: 1, unit: 'פרויקט', unitPrice: 6000, notes: 'כולל תחזוקה שנתית' }
      ]
    };

    // Quote metadata and customer details
    const quoteMetadata = {
      '1234': { 
        created: '10/01/2025', 
        customerId: 'CUST-001',
        contact: 'יוסי כהן',
        phone: '03-1234567',
        email: 'info@abc.co.il',
        internalNumber: 'QUO-2025-001',
        associationType: 'project',
        associationId: 'P-24018',
        associationTitle: 'משרדי חברת ABC'
      },
      '1235': { 
        created: '08/01/2025',
        customerId: 'CUST-002',
        contact: 'דוד כהן',
        phone: '050-9876543',
        email: 'villa@example.com',
        internalNumber: 'QUO-2025-002',
        associationType: 'project',
        associationId: 'P-24031',
        associationTitle: 'וילה רמת אביב'
      },
      '1236': { 
        created: '15/01/2025',
        customerId: 'CUST-004',
        contact: 'שרה לוי',
        phone: '052-1234567',
        email: 'sara@example.com',
        internalNumber: 'QUO-2025-003',
        associationType: 'service',
        associationId: '2454',
        associationTitle: 'קריאת שירות #2454'
      },
      '1200': { 
        created: '12/12/2024',
        customerId: 'CUST-005',
        contact: 'דוד כהן',
        phone: '050-1111111',
        email: 'david@example.com',
        internalNumber: 'QUO-2024-120',
        associationType: 'service',
        associationId: '2455',
        associationTitle: 'קריאת שירות #2455'
      },
      '1180': { 
        created: '25/10/2024',
        customerId: 'CUST-003',
        contact: 'שרה דוד',
        phone: '03-5202520',
        email: 'contact@danhotels.com',
        internalNumber: 'QUO-2024-118',
        associationType: 'service',
        associationId: '2456',
        associationTitle: 'קריאת שירות #2456'
      }
    };

    function getStatusBadgeClass(status) {
      if (!status) return 'badge-neutral';
      const statusLower = status.toLowerCase();
      if (statusLower.includes('טיוטה')) return 'badge-neutral';
      if (statusLower.includes('נשלח')) return 'badge-primary';
      if (statusLower.includes('במעקב')) return 'badge-warning';
      if (statusLower.includes('אושר')) return 'badge-success';
      if (statusLower.includes('נדחה')) return 'badge-danger';
      return 'badge-neutral';
    }

    function formatCurrency(amount) {
      return new Intl.NumberFormat('he-IL', { 
        style: 'currency', 
        currency: 'ILS',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(amount);
    }

    function openQuoteModal(row) {
      const quoteId = row.getAttribute('data-quote-id');
      const quoteNumber = row.getAttribute('data-quote-number');
      const customer = row.getAttribute('data-customer');
      const status = row.getAttribute('data-status');
      const updated = row.getAttribute('data-updated');
      const associationType = row.getAttribute('data-association-type');
      const associationId = row.getAttribute('data-association-id');
      const associationTitle = row.getAttribute('data-association-title');
      const metadata = quoteMetadata[quoteId] || { 
        created: updated, 
        customerId: '',
        contact: '',
        phone: '',
        email: '',
        internalNumber: '',
        associationType: associationType || '',
        associationId: associationId || '',
        associationTitle: associationTitle || ''
      };
      const lineItems = quoteLineItems[quoteId] || [];

      // Update modal title
      const titleEl = document.getElementById('quote-modal-title');
      if (titleEl) titleEl.textContent = `הצעת מחיר ${quoteNumber}`;

      // Document header
      const docNumberEl = document.getElementById('quote-doc-number');
      if (docNumberEl) docNumberEl.textContent = quoteNumber;

      const docDateEl = document.getElementById('quote-doc-date');
      if (docDateEl) docDateEl.textContent = metadata.created;

      const docStatusEl = document.getElementById('quote-doc-status');
      if (docStatusEl) {
        docStatusEl.innerHTML = `<span class="badge ${getStatusBadgeClass(status)}">${status}</span>`;
      }

      // Parties block - Customer details
      const partyCustomerEl = document.getElementById('quote-party-customer');
      if (partyCustomerEl) partyCustomerEl.textContent = customer;

      const contactRow = document.getElementById('quote-party-contact-row');
      const contactEl = document.getElementById('quote-party-contact');
      if (metadata.contact) {
        if (contactRow) contactRow.style.display = 'flex';
        if (contactEl) contactEl.textContent = metadata.contact;
      } else {
        if (contactRow) contactRow.style.display = 'none';
      }

      const phoneRow = document.getElementById('quote-party-phone-row');
      const phoneEl = document.getElementById('quote-party-phone');
      if (metadata.phone) {
        if (phoneRow) phoneRow.style.display = 'flex';
        if (phoneEl) phoneEl.textContent = metadata.phone;
      } else {
        if (phoneRow) phoneRow.style.display = 'none';
      }

      const emailRow = document.getElementById('quote-party-email-row');
      const emailEl = document.getElementById('quote-party-email');
      if (metadata.email) {
        if (emailRow) emailRow.style.display = 'flex';
        if (emailEl) emailEl.textContent = metadata.email;
      } else {
        if (emailRow) emailRow.style.display = 'none';
      }

      // Parties block - Quote details (association)
      const partyAssociationEl = document.getElementById('quote-party-association');
      if (partyAssociationEl) {
        if (metadata.associationType === 'project') {
          partyAssociationEl.textContent = `פרויקט: ${metadata.associationTitle}`;
        } else if (metadata.associationType === 'service') {
          partyAssociationEl.textContent = `קריאת שירות: ${metadata.associationTitle}`;
        } else {
          partyAssociationEl.textContent = '-';
        }
      }

      // Show/hide BOQ button based on association
      const openBOQBtn = document.getElementById('quote-open-boq');
      if (openBOQBtn) {
        if (metadata.associationType === 'project' || metadata.associationType === 'service') {
          openBOQBtn.style.display = 'inline-flex';
          openBOQBtn.setAttribute('data-association-type', metadata.associationType);
          openBOQBtn.setAttribute('data-association-id', metadata.associationId);
        } else {
          openBOQBtn.style.display = 'none';
        }
      }

      const internalRow = document.getElementById('quote-party-internal-row');
      const internalEl = document.getElementById('quote-party-internal');
      if (metadata.internalNumber) {
        if (internalRow) internalRow.style.display = 'flex';
        if (internalEl) internalEl.textContent = metadata.internalNumber;
      } else {
        if (internalRow) internalRow.style.display = 'none';
      }

      // Line items table
      const itemsBody = document.getElementById('quote-items-body');
      let subtotal = 0;
      
      if (itemsBody && lineItems.length > 0) {
        itemsBody.innerHTML = '';
        lineItems.forEach(item => {
          const total = item.quantity * item.unitPrice;
          subtotal += total;
          
          const row = document.createElement('tr');
          
          const descCell = document.createElement('td');
          descCell.innerHTML = `<div class="quote-item-description">${item.description}</div>${item.notes ? `<div class="quote-item-notes">${item.notes}</div>` : ''}`;
          row.appendChild(descCell);

          const qtyCell = document.createElement('td');
          qtyCell.className = 'quote-col-qty';
          qtyCell.textContent = item.quantity;
          row.appendChild(qtyCell);

          const unitCell = document.createElement('td');
          unitCell.className = 'quote-col-unit';
          unitCell.textContent = item.unit;
          row.appendChild(unitCell);

          const priceCell = document.createElement('td');
          priceCell.className = 'quote-col-price';
          priceCell.textContent = formatCurrency(item.unitPrice);
          row.appendChild(priceCell);

          const totalCell = document.createElement('td');
          totalCell.className = 'quote-col-total';
          totalCell.textContent = formatCurrency(total);
          row.appendChild(totalCell);

          itemsBody.appendChild(row);
        });
      } else {
        if (itemsBody) itemsBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--color-neutral-500); padding: var(--spacing-xl);">אין פריטים בהצעה</td></tr>';
      }

      // Pricing summary
      const vatRate = 0.17;
      const vat = subtotal * vatRate;
      const total = subtotal + vat;

      const subtotalEl = document.getElementById('quote-subtotal');
      if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);

      const vatEl = document.getElementById('quote-vat');
      if (vatEl) vatEl.textContent = formatCurrency(vat);

      const totalEl = document.getElementById('quote-total');
      if (totalEl) totalEl.textContent = formatCurrency(total);

      // Show modal
      if (quoteDrawerOverlay && quoteDrawer) {
        quoteDrawerOverlay.classList.add('is-open');
        document.body.classList.add('drawer-open');
        document.body.style.overflow = 'hidden';
        // Reset maximize state when opening
        quoteDrawer.classList.remove('is-maximized');
        if (quoteMaximizeBtn) {
          updateQuoteMaximizeButtonState();
        }
      }
    }

    function closeQuoteModal() {
      if (quoteDrawerOverlay) {
        quoteDrawerOverlay.classList.remove('is-open');
        document.body.classList.remove('drawer-open');
        document.body.style.overflow = '';
      }
    }

    // Maximize/minimize functionality
    function updateQuoteMaximizeButtonState() {
      if (!quoteMaximizeBtn || !quoteDrawer) return;
      const isMaximized = quoteDrawer.classList.contains('is-maximized');
      const labelEl = quoteMaximizeBtn.querySelector('.modal-max-label');
      
      if (isMaximized) {
        quoteMaximizeBtn.setAttribute('aria-label', 'הקטן מסך');
        quoteMaximizeBtn.setAttribute('title', 'הקטן מסך');
        if (labelEl) labelEl.textContent = 'הקטן מסך';
      } else {
        quoteMaximizeBtn.setAttribute('aria-label', 'הגדל מסך');
        quoteMaximizeBtn.setAttribute('title', 'הגדל מסך');
        if (labelEl) labelEl.textContent = 'הגדל מסך';
      }
    }

    // Row click handler
    document.querySelectorAll('.quote-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't open modal if clicking on kebab menu
        if (e.target.closest('.quote-row-dropdown')) {
          return;
        }
        openQuoteModal(row);
      });
    });

    // Kebab menu handlers (use existing dropdown system)
    document.querySelectorAll('.quote-row-kebab').forEach(kebab => {
      kebab.addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = kebab.nextElementSibling;
        if (menu && menu.classList.contains('dropdown-menu')) {
          const isActive = menu.classList.contains('active');
          
          // Close all dropdowns
          document.querySelectorAll('.dropdown-menu').forEach(m => m.classList.remove('active'));
          
          // Toggle current dropdown
          if (!isActive) {
            menu.classList.add('active');
          }
        }
      });
    });

    // Kebab menu action handlers
    document.querySelectorAll('.quote-row-dropdown .dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-action');
        const row = item.closest('.quote-row');
        const menu = item.closest('.dropdown-menu');
        
        // Close dropdown
        if (menu) {
          menu.classList.remove('active');
        }

        if (action === 'view' && row) {
          openQuoteModal(row);
        } else if (action === 'edit') {
          // TODO: Implement edit
          console.log('Edit quote', row?.getAttribute('data-quote-id'));
        } else if (action === 'duplicate') {
          // TODO: Implement duplicate
          console.log('Duplicate quote', row?.getAttribute('data-quote-id'));
        } else if (action === 'delete') {
          // TODO: Implement delete
          if (confirm('האם אתה בטוח שברצונך למחוק הצעה זו?')) {
            console.log('Delete quote', row?.getAttribute('data-quote-id'));
          }
        }
      });
    });

    // Close modal handlers
    if (quoteCloseBtn) {
      quoteCloseBtn.addEventListener('click', closeQuoteModal);
    }
    if (quoteBackdrop) {
      quoteBackdrop.addEventListener('click', closeQuoteModal);
    }

    // Maximize button handler
    if (quoteMaximizeBtn && quoteDrawer) {
      quoteMaximizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        quoteDrawer.classList.toggle('is-maximized');
        updateQuoteMaximizeButtonState();
      });
    }

    // Open BOQ button handler
    const openBOQBtn = document.getElementById('quote-open-boq');
    if (openBOQBtn) {
      openBOQBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const associationType = openBOQBtn.getAttribute('data-association-type');
        const associationId = openBOQBtn.getAttribute('data-association-id');
        
        if (!associationType || !associationId) return;

        // Close quote modal first
        closeQuoteModal();

        // Navigate to appropriate page with hash to open entity and BOQ tab
        if (associationType === 'project') {
          // Map project IDs: P-24018 -> p2, P-24031 -> p1, etc.
          // This mapping should match the data-project-id in projects.html
          const projectIdMap = {
            'P-24018': 'p2',
            'P-24031': 'p1',
            'P-24022': 'p3'
          };
          const projectRowId = projectIdMap[associationId] || associationId.toLowerCase();
          window.location.href = `projects.html#open=${projectRowId}&tab=boq`;
        } else if (associationType === 'service') {
          // Service call ID is already in the format used in service-calls.html
          window.location.href = `service-calls.html#open=${associationId}&tab=boq`;
        }
      });
    }

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && quoteDrawerOverlay?.classList.contains('is-open')) {
        closeQuoteModal();
      }
    });

    // Quotes segment chip handlers
    document.querySelectorAll('.quotes-segment-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        // Remove active from siblings
        document.querySelectorAll('.quotes-segment-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        // TODO: Filter quotes by status
      });
    });
  }

  // Inventory filtering functionality
  if (document.getElementById('inventory-table-body')) {
    const inventoryTableBody = document.getElementById('inventory-table-body');
    const inventorySearchInput = document.getElementById('inventory-search');
    let currentCategory = 'all';
    let currentSearch = '';

    // Render inventory table
    function renderInventoryTable() {
      if (!window.INVENTORY_MOCK_DATA) return;

      let filteredData = [...window.INVENTORY_MOCK_DATA];

      // Apply category filter
      if (currentCategory !== 'all') {
        if (currentCategory === 'מתחת למינימום') {
          filteredData = filteredData.filter(item => item.quantity < item.minQty);
        } else {
          filteredData = filteredData.filter(item => item.category === currentCategory);
        }
      }

      // Apply search filter
      if (currentSearch.trim()) {
        const searchLower = currentSearch.trim().toLowerCase();
        filteredData = filteredData.filter(item => {
          const skuMatch = item.sku.toLowerCase().includes(searchLower);
          const nameMatch = item.name.toLowerCase().includes(searchLower);
          return skuMatch || nameMatch;
        });
      }

      // Render table rows
      inventoryTableBody.innerHTML = '';
      if (filteredData.length === 0) {
        inventoryTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: var(--spacing-xl); color: var(--color-neutral-500);">לא נמצאו פריטים</td></tr>';
        return;
      }

      filteredData.forEach(item => {
        const row = document.createElement('tr');
        row.setAttribute('data-sku', item.sku);
        row.innerHTML = `
          <td>${item.sku}</td>
          <td>${item.name}</td>
          <td>${item.category}</td>
          <td>${item.quantity}</td>
          <td>${item.location}</td>
          <td>${item.minQty}</td>
        `;
        row.addEventListener('click', () => openInventoryDrawer(item.sku));
        inventoryTableBody.appendChild(row);
      });
    }

    // Category filter chip handlers
    document.querySelectorAll('.filters .filter-chip[data-category]').forEach(chip => {
      chip.addEventListener('click', () => {
        // Remove active from siblings in the same filters container
        const container = chip.closest('.filters');
        if (container) {
          container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        }
        chip.classList.add('active');
        currentCategory = chip.getAttribute('data-category') || 'all';
        renderInventoryTable();
      });
    });

    // Search input handler
    if (inventorySearchInput) {
      inventorySearchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        renderInventoryTable();
      });
    }

    // Initial render
    renderInventoryTable();

    // Inventory drawer functionality
    const inventoryDrawerOverlay = document.getElementById('inventory-drawer-overlay');
    const inventoryDrawer = document.getElementById('inventory-details');
    const inventoryCloseBtn = document.getElementById('inventory-close');
    const inventoryBackdrop = document.querySelector('.inventory-drawer-backdrop');
    let currentItemSku = null;
    let isEditMode = false;

    function openInventoryDrawer(sku) {
      if (!window.INVENTORY_MOCK_DATA) return;
      
      const item = window.INVENTORY_MOCK_DATA.find(i => i.sku === sku);
      if (!item) return;

      currentItemSku = sku;
      isEditMode = false;

      // Populate drawer
      document.getElementById('inventory-item-name').textContent = item.name;
      document.getElementById('inventory-item-sku').textContent = item.sku;
      document.getElementById('inventory-item-category').textContent = item.category;
      document.getElementById('inventory-item-quantity-display').textContent = item.quantity;
      document.getElementById('inventory-item-location-display').textContent = item.location;
      document.getElementById('inventory-item-min-display').textContent = item.minQty;

      // Reset edit mode
      exitEditMode();

      // Show drawer
      if (inventoryDrawerOverlay) {
        inventoryDrawerOverlay.classList.add('is-open');
        document.body.classList.add('drawer-open');
      }
    }

    function closeInventoryDrawer() {
      // If in edit mode, cancel changes
      if (isEditMode) {
        exitEditMode();
      }
      
      if (inventoryDrawerOverlay) {
        inventoryDrawerOverlay.classList.remove('is-open');
        document.body.classList.remove('drawer-open');
      }
      currentItemSku = null;
      isEditMode = false;
    }

    function exitEditMode() {
      if (!currentItemSku) return;
      const item = window.INVENTORY_MOCK_DATA.find(i => i.sku === currentItemSku);
      if (!item) return;

      isEditMode = false;
      const locationEl = document.getElementById('inventory-item-location-display');
      const minEl = document.getElementById('inventory-item-min-display');
      
      // Restore display from item data (which may have been updated)
      if (locationEl) {
        locationEl.innerHTML = '';
        locationEl.textContent = item.location;
      }
      if (minEl) {
        minEl.innerHTML = '';
        minEl.textContent = item.minQty;
      }
      
      document.getElementById('inventory-edit-btn').textContent = 'עריכה';
    }

    function enterEditMode() {
      if (!currentItemSku) return;
      const item = window.INVENTORY_MOCK_DATA.find(i => i.sku === currentItemSku);
      if (!item) return;

      isEditMode = true;

      // Make location editable
      const locationEl = document.getElementById('inventory-item-location-display');
      const locationInput = document.createElement('input');
      locationInput.type = 'text';
      locationInput.value = item.location;
      locationEl.innerHTML = '';
      locationEl.appendChild(locationInput);

      // Make minQty editable
      const minEl = document.getElementById('inventory-item-min-display');
      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.value = item.minQty;
      minInput.min = '0';
      minEl.innerHTML = '';
      minEl.appendChild(minInput);

      document.getElementById('inventory-edit-btn').textContent = 'שמור שינויים';
    }

    function saveEditChanges() {
      if (!currentItemSku) return;
      const item = window.INVENTORY_MOCK_DATA.find(i => i.sku === currentItemSku);
      if (!item) return;

      const locationInput = document.getElementById('inventory-item-location-display').querySelector('input');
      const minInput = document.getElementById('inventory-item-min-display').querySelector('input');

      if (locationInput) {
        item.location = locationInput.value.trim();
      }
      if (minInput) {
        const newMin = parseInt(minInput.value, 10);
        if (!isNaN(newMin) && newMin >= 0) {
          item.minQty = newMin;
        }
      }

      exitEditMode();
      renderInventoryTable();
    }

    function updateQuantity() {
      if (!currentItemSku) return;
      const item = window.INVENTORY_MOCK_DATA.find(i => i.sku === currentItemSku);
      if (!item) return;

      const newQty = prompt(`עדכן כמות עבור ${item.name}:\nכמות נוכחית: ${item.quantity}`, item.quantity);
      if (newQty === null) return;

      const qtyNum = parseInt(newQty, 10);
      if (isNaN(qtyNum) || qtyNum < 0) {
        alert('אנא הזן כמות תקינה (מספר שלם חיובי)');
        return;
      }

      item.quantity = qtyNum;
      document.getElementById('inventory-item-quantity-display').textContent = item.quantity;
      renderInventoryTable();
    }

    function deleteItem() {
      if (!currentItemSku) return;
      const item = window.INVENTORY_MOCK_DATA.find(i => i.sku === currentItemSku);
      if (!item) return;

      if (!confirm(`האם אתה בטוח שברצונך למחוק את הפריט "${item.name}"?`)) {
        return;
      }

      const index = window.INVENTORY_MOCK_DATA.findIndex(i => i.sku === currentItemSku);
      if (index !== -1) {
        window.INVENTORY_MOCK_DATA.splice(index, 1);
      }

      closeInventoryDrawer();
      renderInventoryTable();
    }

    // Edit button handler
    const inventoryEditBtn = document.getElementById('inventory-edit-btn');
    if (inventoryEditBtn) {
      inventoryEditBtn.addEventListener('click', () => {
        if (isEditMode) {
          saveEditChanges();
        } else {
          enterEditMode();
        }
      });
    }

    // Update quantity button handler
    const inventoryUpdateQtyBtn = document.getElementById('inventory-update-qty-btn');
    if (inventoryUpdateQtyBtn) {
      inventoryUpdateQtyBtn.addEventListener('click', updateQuantity);
    }

    // Delete button handler
    const inventoryDeleteBtn = document.getElementById('inventory-delete-btn');
    if (inventoryDeleteBtn) {
      inventoryDeleteBtn.addEventListener('click', deleteItem);
    }

    // Close handlers
    if (inventoryCloseBtn) {
      inventoryCloseBtn.addEventListener('click', closeInventoryDrawer);
    }
    if (inventoryBackdrop) {
      inventoryBackdrop.addEventListener('click', closeInventoryDrawer);
    }

    // ESC key handler
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && inventoryDrawerOverlay?.classList.contains('is-open')) {
        closeInventoryDrawer();
      }
    });
  }
});
