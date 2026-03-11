// Unified mock data for ManageR² Contacts
// Single source of truth for contacts-related entities

window.CONTACTS_MOCK_DATA = {
  // Customers (extended from existing data, but kept here for contacts context)
  CUSTOMERS: [
    {
      id: 'CUST-001',
      name: 'חברת ABC בע״מ',
      type: 'עסקי',
      city: 'תל אביב',
      phone: '03-1234567',
      email: 'info@abc.co.il',
      status: 'פעיל'
    },
    {
      id: 'CUST-002',
      name: 'וילה רמת אביב',
      type: 'פרטי',
      city: 'רמת אביב',
      phone: '050-9876543',
      email: 'villa@example.com',
      status: 'פעיל'
    },
    {
      id: 'CUST-003',
      name: 'מלון דן תל אביב',
      type: 'מוסדי',
      city: 'תל אביב',
      phone: '03-5202520',
      email: 'contact@danhotels.com',
      status: 'פעיל'
    },
    {
      id: 'CUST-004',
      name: 'שרה לוי',
      type: 'פרטי',
      city: 'חיפה',
      phone: '052-1234567',
      email: 'sara@example.com',
      status: 'פעיל'
    },
    {
      id: 'CUST-005',
      name: 'דוד כהן',
      type: 'פרטי',
      city: 'רמת גן',
      phone: '050-1111111',
      email: 'david@example.com',
      status: 'פעיל'
    },
    {
      id: 'CUST-006',
      name: 'מלון אורכידאה תל אביב',
      type: 'מוסדי',
      city: 'תל אביב',
      phone: '03-7778888',
      email: 'info@orchid-hotel.co.il',
      status: 'פעיל'
    }
  ],

  // Contacts array
  CONTACTS: [
    // לקוחות (Customers) - 6 contacts
    {
      id: 'CONT-001',
      fullName: 'יוסי כהן',
      role: 'מנהל IT',
      companyId: 'CUST-001',
      companyName: 'חברת ABC בע״מ',
      segment: 'לקוחות',
      email: 'yossi.cohen@abc.co.il',
      phone: '03-1234567',
      city: 'תל אביב',
      notes: '',
      preferredChannel: 'מייל',
      updatedAt: '18/01/2025 14:30',
      status: 'פעיל',
      projectId: 'PRJ-004',
      serviceCallId: '2456'
    },
    {
      id: 'CONT-002',
      fullName: 'דוד כהן',
      role: 'בעלים',
      companyId: 'CUST-002',
      companyName: 'וילה רמת אביב',
      segment: 'לקוחות',
      email: 'david.cohen@villa.co.il',
      phone: '050-9876543',
      city: 'רמת אביב',
      notes: '',
      preferredChannel: 'טלפון',
      updatedAt: '17/01/2025 10:15',
      status: 'פעיל',
      projectId: 'PRJ-001',
      serviceCallId: '2455'
    },
    {
      id: 'CONT-003',
      fullName: 'שרה דוד',
      role: 'מנהלת תחזוקה',
      companyId: 'CUST-003',
      companyName: 'מלון דן תל אביב',
      segment: 'לקוחות',
      email: 'sara.david@danhotels.com',
      phone: '03-5202520',
      city: 'תל אביב',
      notes: '',
      preferredChannel: 'מייל',
      updatedAt: '16/01/2025 16:20',
      status: 'פעיל',
      projectId: 'PRJ-002',
      serviceCallId: '2453'
    },
    {
      id: 'CONT-004',
      fullName: 'שרה לוי',
      role: 'בעלים',
      companyId: 'CUST-004',
      companyName: 'שרה לוי',
      segment: 'לקוחות',
      email: 'sara@example.com',
      phone: '052-1234567',
      city: 'חיפה',
      notes: '',
      preferredChannel: 'וואטסאפ',
      updatedAt: '15/01/2025 09:00',
      status: 'פעיל'
    },
    {
      id: 'CONT-005',
      fullName: 'דוד כהן',
      role: 'בעלים',
      companyId: 'CUST-005',
      companyName: 'דוד כהן',
      segment: 'לקוחות',
      email: 'david@example.com',
      phone: '050-1111111',
      city: 'רמת גן',
      notes: '',
      preferredChannel: 'טלפון',
      updatedAt: '14/01/2025 11:45',
      status: 'פעיל'
    },
    {
      id: 'CONT-006',
      fullName: 'רותם כהן',
      role: 'מנהל כללי',
      companyId: 'CUST-006',
      companyName: 'מלון אורכידאה תל אביב',
      segment: 'לקוחות',
      email: 'rotem.cohen@orchid-hotel.co.il',
      phone: '03-7778888',
      city: 'תל אביב',
      notes: '',
      preferredChannel: 'מייל',
      updatedAt: '19/01/2025 08:30',
      status: 'פעיל',
      projectId: 'PRJ-003'
    },

    // נציגי לקוחות (Customer Reps) - 8 contacts
    {
      id: 'CONT-007',
      fullName: 'מיכל רוזן',
      role: 'נציגת שירות',
      companyId: 'CUST-001',
      companyName: 'חברת ABC בע״מ',
      segment: 'נציגי לקוחות',
      email: 'michal.rozen@abc.co.il',
      phone: '050-2222222',
      city: 'תל אביב',
      notes: 'נציגת שירות ראשית',
      preferredChannel: 'מייל',
      updatedAt: '18/01/2025 12:00',
      status: 'פעיל'
    },
    {
      id: 'CONT-008',
      fullName: 'אורן לוי',
      role: 'מנהל פרויקטים',
      companyId: 'CUST-001',
      companyName: 'חברת ABC בע״מ',
      segment: 'נציגי לקוחות',
      email: 'oren.levi@abc.co.il',
      phone: '052-3333333',
      city: 'תל אביב',
      notes: '',
      preferredChannel: 'טלפון',
      updatedAt: '17/01/2025 15:20',
      status: 'פעיל'
    },
    {
      id: 'CONT-009',
      fullName: 'נועה כהן',
      role: 'מנהלת חשבונות',
      companyId: 'CUST-002',
      companyName: 'וילה רמת אביב',
      segment: 'נציגי לקוחות',
      email: 'noa.cohen@villa.co.il',
      phone: '050-4444444',
      city: 'רמת אביב',
      notes: '',
      preferredChannel: 'מייל',
      updatedAt: '16/01/2025 10:10',
      status: 'פעיל'
    },
    {
      id: 'CONT-010',
      fullName: 'אבי דוד',
      role: 'מנהל תפעול',
      companyId: 'CUST-003',
      companyName: 'מלון דן תל אביב',
      segment: 'נציגי לקוחות',
      email: 'avi.david@danhotels.com',
      phone: '052-5555555',
      city: 'תל אביב',
      notes: '',
      preferredChannel: 'טלפון',
      updatedAt: '15/01/2025 14:45',
      status: 'פעיל'
    },
    {
      id: 'CONT-011',
      fullName: 'טל ישראלי',
      role: 'מנהלת שירות לקוחות',
      companyId: 'CUST-003',
      companyName: 'מלון דן תל אביב',
      segment: 'נציגי לקוחות',
      email: 'tal.israeli@danhotels.com',
      phone: '050-6666666',
      city: 'תל אביב',
      notes: '',
      preferredChannel: 'מייל',
      updatedAt: '14/01/2025 11:30',
      status: 'פעיל'
    },
    {
      id: 'CONT-012',
      fullName: 'עמית כהן',
      role: 'מנהל IT',
      companyId: 'CUST-006',
      companyName: 'מלון אורכידאה תל אביב',
      segment: 'נציגי לקוחות',
      email: 'amit.cohen@orchid-hotel.co.il',
      phone: '052-7777777',
      city: 'תל אביב',
      notes: '',
      preferredChannel: 'מייל',
      updatedAt: '19/01/2025 09:15',
      status: 'פעיל'
    },
    {
      id: 'CONT-013',
      fullName: 'ליאור לוי',
      role: 'מנהלת תחזוקה',
      companyId: 'CUST-006',
      companyName: 'מלון אורכידאה תל אביב',
      segment: 'נציגי לקוחות',
      email: 'lior.levi@orchid-hotel.co.il',
      phone: '050-8888888',
      city: 'תל אביב',
      notes: '',
      preferredChannel: 'טלפון',
      updatedAt: '18/01/2025 13:20',
      status: 'פעיל'
    },
    {
      id: 'CONT-014',
      fullName: 'דנה רוזן',
      role: 'מנהלת אירועים',
      companyId: 'CUST-006',
      companyName: 'מלון אורכידאה תל אביב',
      segment: 'נציגי לקוחות',
      email: 'dana.rozen@orchid-hotel.co.il',
      phone: '052-9999999',
      city: 'תל אביב',
      notes: '',
      preferredChannel: 'מייל',
      updatedAt: '17/01/2025 16:00',
      status: 'פעיל'
    },

    // ספקים (Suppliers) - 6 contacts
    {
      id: 'CONT-015',
      fullName: 'רן כהן',
      role: 'מנהל מכירות',
      companyId: null,
      companyName: 'ספק מערכות חשמל בע״מ',
      segment: 'ספקים',
      email: 'ran.cohen@elec-supplier.co.il',
      phone: '03-1111111',
      city: 'חולון',
      notes: 'ספק מועדף למערכות חשמל',
      preferredChannel: 'טלפון',
      updatedAt: '19/01/2025 10:00',
      status: 'פעיל'
    },
    {
      id: 'CONT-016',
      fullName: 'יעל דוד',
      role: 'מנהלת שיווק',
      companyId: null,
      companyName: 'חברת תקשורת מתקדמת',
      segment: 'ספקים',
      email: 'yael.david@comm-advanced.co.il',
      phone: '04-2222222',
      city: 'חיפה',
      notes: '',
      preferredChannel: 'מייל',
      updatedAt: '18/01/2025 11:30',
      status: 'פעיל'
    },
    {
      id: 'CONT-017',
      fullName: 'יובל לוי',
      role: 'מנהל פרויקטים',
      companyId: null,
      companyName: 'ספק ציוד תעשייתי',
      segment: 'ספקים',
      email: 'yuval.levi@industrial-equip.co.il',
      phone: '09-3333333',
      city: 'נתניה',
      notes: '',
      preferredChannel: 'טלפון',
      updatedAt: '17/01/2025 14:15',
      status: 'מושהה'
    },
    {
      id: 'CONT-018',
      fullName: 'מור כהן',
      role: 'מנהלת רכש',
      companyId: null,
      companyName: 'חברת אבטחה וסייבר',
      segment: 'ספקים',
      email: 'mor.cohen@security-cyber.co.il',
      phone: '03-4444444',
      city: 'רמת גן',
      notes: '',
      preferredChannel: 'מייל',
      updatedAt: '16/01/2025 09:45',
      status: 'פעיל'
    },
    {
      id: 'CONT-019',
      fullName: 'אורית ישראלי',
      role: 'מנהלת שירות',
      companyId: null,
      companyName: 'ספק מערכות מיזוג אוויר',
      segment: 'ספקים',
      email: 'orit.israeli@hvac-supplier.co.il',
      phone: '04-5555555',
      city: 'חיפה',
      notes: '',
      preferredChannel: 'טלפון',
      updatedAt: '15/01/2025 13:20',
      status: 'פעיל'
    },
    {
      id: 'CONT-020',
      fullName: 'רונן רוזן',
      role: 'מנהל מכירות',
      companyId: null,
      companyName: 'חברת תאורה מקצועית',
      segment: 'ספקים',
      email: 'ronen.rozen@lighting-pro.co.il',
      phone: '09-6666666',
      city: 'נתניה',
      notes: '',
      preferredChannel: 'מייל',
      updatedAt: '14/01/2025 08:30',
      status: 'פעיל'
    },

    // שותפים עסקיים (Business Partners) - 4 contacts
    {
      id: 'CONT-021',
      fullName: 'עמית כהן',
      role: 'שותף עסקי',
      companyId: null,
      companyName: 'חברת ייעוץ ופיתוח',
      segment: 'שותפים עסקיים',
      email: 'amit.cohen@consult-dev.co.il',
      phone: '03-7777777',
      city: 'תל אביב',
      notes: 'שותף אסטרטגי',
      preferredChannel: 'מייל',
      updatedAt: '19/01/2025 15:00',
      status: 'פעיל'
    },
    {
      id: 'CONT-022',
      fullName: 'שירה דוד',
      role: 'מנהלת שותפויות',
      companyId: null,
      companyName: 'חברת טכנולוגיה מתקדמת',
      segment: 'שותפים עסקיים',
      email: 'shira.david@tech-advanced.co.il',
      phone: '04-8888888',
      city: 'חיפה',
      notes: '',
      preferredChannel: 'טלפון',
      updatedAt: '18/01/2025 12:45',
      status: 'פעיל'
    },
    {
      id: 'CONT-023',
      fullName: 'תומר לוי',
      role: 'שותף עסקי',
      companyId: null,
      companyName: 'חברת ייעוץ הנדסי',
      segment: 'שותפים עסקיים',
      email: 'tomer.levi@eng-consult.co.il',
      phone: '09-9999999',
      city: 'נתניה',
      notes: '',
      preferredChannel: 'מייל',
      updatedAt: '17/01/2025 10:20',
      status: 'מושהה'
    },
    {
      id: 'CONT-024',
      fullName: 'נעמה כהן',
      role: 'מנהלת פיתוח עסקי',
      companyId: null,
      companyName: 'חברת ייעוץ אסטרטגי',
      segment: 'שותפים עסקיים',
      email: 'naama.cohen@strategy-consult.co.il',
      phone: '03-1010101',
      city: 'תל אביב',
      notes: '',
      preferredChannel: 'מייל',
      updatedAt: '16/01/2025 14:10',
      status: 'פעיל'
    }
  ],

  // Projects array
  PROJECTS: [
    {
      id: 'PRJ-001',
      name: 'פרויקט וילה רמת אביב',
      customerId: 'CUST-002'
    },
    {
      id: 'PRJ-002',
      name: 'פרויקט מלון דן תל אביב',
      customerId: 'CUST-003'
    },
    {
      id: 'PRJ-003',
      name: 'פרויקט מלון אורכידאה',
      customerId: 'CUST-006'
    },
    {
      id: 'PRJ-004',
      name: 'פרויקט חברת ABC',
      customerId: 'CUST-001'
    }
  ],

  // Service Calls array
  SERVICE_CALLS: [
    {
      id: '2456',
      title: 'בעיה בלוח בקרה מרכזי',
      customerId: 'CUST-001',
      status: 'בטיפול',
      projectId: 'PRJ-004'
    },
    {
      id: '2457',
      title: 'בדיקת תקינות מערכת האבטחה',
      customerId: 'CUST-001',
      status: 'בטיפול'
    },
    {
      id: '2455',
      title: 'רמקול בחדר השינה לא פועל',
      customerId: 'CUST-002',
      status: 'פתוח',
      projectId: 'PRJ-001'
    },
    {
      id: '2453',
      title: 'מצלמה בקומה 3 מנותקת',
      customerId: 'CUST-003',
      status: 'בטיפול',
      projectId: 'PRJ-002'
    }
  ]
};

// Inventory mock data for ManageR²
window.INVENTORY_MOCK_DATA = [
  {
    sku: 'ELC-001',
    name: 'לוח בקרה מרכזי SmartHome',
    category: 'בקרי חשמל',
    quantity: 5,
    location: 'מחסן A-3',
    minQty: 2
  },
  {
    sku: 'CAM-042',
    name: 'מצלמת IP 4MP',
    category: 'מצלמות',
    quantity: 3,
    location: 'מחסן B-1',
    minQty: 5
  },
  {
    sku: 'SPK-128',
    name: 'רמקול קיר 8 אינץ׳',
    category: 'רמקולים',
    quantity: 25,
    location: 'מחסן A-5',
    minQty: 10
  },
  {
    sku: 'SW-205',
    name: 'מתג חכם WiFi',
    category: 'מתגים',
    quantity: 45,
    location: 'מחסן C-2',
    minQty: 20
  },
  {
    sku: 'CBL-CAT6-500',
    name: 'כבל Cat6 500 מטר',
    category: 'כבלים',
    quantity: 2,
    location: 'מחסן D-1',
    minQty: 5
  },
  {
    sku: 'RACK-19-42U',
    name: 'ארון תקשורת 19״ 42U',
    category: 'ארונות תקשורת',
    quantity: 8,
    location: 'מחסן E-1',
    minQty: 3
  },
  {
    sku: 'CAM-045',
    name: 'מצלמת IP 8MP PTZ',
    category: 'מצלמות',
    quantity: 4,
    location: 'מחסן B-1',
    minQty: 5
  },
  {
    sku: 'SEN-LIGHT-01',
    name: 'חיישן תאורה PIR',
    category: 'בקרי חשמל',
    quantity: 1,
    location: 'מחסן A-3',
    minQty: 5
  }
];

/* Execution report mock data */
window.MOCK_PROJECTS = [
  { id: 'PRJ-001', name: 'פרויקט וילה רמת אביב', customerName: 'וילה רמת אביב' },
  { id: 'PRJ-002', name: 'פרויקט מלון דן תל אביב', customerName: 'מלון דן תל אביב' },
  { id: 'PRJ-003', name: 'פרויקט מלון אורכידאה', customerName: 'מלון אורכידאה תל אביב' },
  { id: 'PRJ-004', name: 'פרויקט חברת ABC', customerName: 'חברת ABC בע״מ' }
];

window.MOCK_EMPLOYEES = [
  {
    id: 'EMP-001',
    fullName: 'רביב מעיני',
    positionTitle: 'בעלים',
    hats: ['שיווק', 'פיננסים', 'משאבי אנוש', 'ניהול תפעול', 'ניהול תחום מתח נמוך מאוד'],
    defaultHat: 'בעלים',
    domain: 'בעלים',
    phone: '050-1000001',
    email: 'raviv.meany@manager2.co.il'
  },
  {
    id: 'EMP-002',
    fullName: 'רונן כץ',
    positionTitle: 'בעלים',
    hats: ['ניהול טכני', 'יחסי חו"ל', 'שירות והתקנות'],
    defaultHat: 'בעלים',
    domain: 'בעלים',
    phone: '050-1000002',
    email: 'ronen.katz@manager2.co.il'
  },
  {
    id: 'EMP-003',
    fullName: 'אלון לוי',
    positionTitle: 'מנהל תחום מולטימדיה',
    hats: ['ניהול תחום מולטימדיה', 'ניהול מכירות'],
    defaultHat: 'ניהול תחום מולטימדיה',
    domain: 'מולטימדיה',
    phone: '050-1000003',
    email: 'alon.levi@manager2.co.il'
  },
  {
    id: 'EMP-004',
    fullName: 'אבי כהן',
    positionTitle: 'מנהל מכירות',
    hats: ['ניהול מכירות'],
    defaultHat: 'ניהול מכירות',
    domain: 'מולטימדיה',
    phone: '050-1000004',
    email: 'avi.cohen@manager2.co.il'
  },
  {
    id: 'EMP-005',
    fullName: 'נחום דוד',
    positionTitle: 'מנהל תחום חשמל חכם',
    hats: ['ניהול תחום חשמל חכם', 'ניהול מכירות'],
    defaultHat: 'ניהול תחום חשמל חכם',
    domain: 'חשמל חכם',
    phone: '050-1000005',
    email: 'nahum.david@manager2.co.il'
  },
  {
    id: 'EMP-006',
    fullName: 'רותם ישראל',
    positionTitle: 'ראש צוות',
    hats: ['ראש צוות חשמל חכם ומולטימדיה', 'מנהל פרויקט', 'שירות והתקנות'],
    defaultHat: 'ראש צוות חשמל חכם ומולטימדיה',
    domain: 'שירות התקנות ופרויקטים',
    phone: '050-1000006',
    email: 'rotem.israel@manager2.co.il'
  },
  {
    id: 'EMP-007',
    fullName: 'יובל כהן',
    positionTitle: 'ראש צוות',
    hats: ['ראש צוות מתח נמוך מאוד', 'מנהל פרויקט', 'שירות והתקנות'],
    defaultHat: 'ראש צוות מתח נמוך מאוד',
    domain: 'שירות התקנות ופרויקטים',
    phone: '050-1000007',
    email: 'yuval.cohen@manager2.co.il'
  },
  {
    id: 'EMP-008',
    fullName: 'איתן לוי',
    positionTitle: 'מתקין',
    hats: ['התקנות', 'שירות והתקנות', 'מתקין'],
    defaultHat: 'מתקין',
    domain: 'צוות מתקינים',
    phone: '050-1000008',
    email: 'eitan.levi@manager2.co.il'
  },
  {
    id: 'EMP-009',
    fullName: 'עופר דוד',
    positionTitle: 'מתקין',
    hats: ['התקנות', 'שירות והתקנות', 'מתקין'],
    defaultHat: 'מתקין',
    domain: 'צוות מתקינים',
    phone: '050-1000009',
    email: 'ofer.david@manager2.co.il'
  },
  {
    id: 'EMP-010',
    fullName: 'ליאור כץ',
    positionTitle: 'מתקין',
    hats: ['התקנות', 'שירות והתקנות', 'מתקין'],
    defaultHat: 'מתקין',
    domain: 'צוות מתקינים',
    phone: '050-1000010',
    email: 'lior.katz@manager2.co.il'
  }
];

// Unified mock data structure - derived from MOCK_EMPLOYEES for consistency
window.MOCK_DATA = window.MOCK_DATA || {};
window.MOCK_DATA.employees = window.MOCK_EMPLOYEES.map(function(emp) {
  // Map hats to roles based on employee structure (as specified in requirements)
  var rolesMap = {
    'EMP-001': ['שיווק', 'פיננסים', 'משאבי אנוש', 'ניהול תפעול', 'ניהול תחום מתח נמוך מאוד'],
    'EMP-002': ['ניהול טכני', 'יחסי חו"ל', 'ניהול שירות והתקנות'],
    'EMP-003': ['ניהול תחום מולטימדיה', 'ניהול מכירות'],
    'EMP-004': ['ניהול מכירות'],
    'EMP-005': ['ניהול תחום חשמל חכם', 'ניהול מכירות'],
    'EMP-006': ['ראש צוות חשמל חכם ומולטימדיה', 'ניהול פרויקטים', 'שירות והתקנות'],
    'EMP-007': ['ראש צוות מתח נמוך מאוד', 'ניהול פרויקטים', 'שירות והתקנות'],
    'EMP-008': ['מתקין'],
    'EMP-009': ['מתקין'],
    'EMP-010': ['מתקין']
  };
  
  var primaryRoleMap = {
    'EMP-001': 'בעלים',
    'EMP-002': 'בעלים',
    'EMP-003': 'ניהול תחום מולטימדיה',
    'EMP-004': 'ניהול מכירות',
    'EMP-005': 'ניהול תחום חשמל חכם',
    'EMP-006': 'ראש צוות חשמל חכם ומולטימדיה',
    'EMP-007': 'ראש צוות מתח נמוך מאוד',
    'EMP-008': 'מתקין',
    'EMP-009': 'מתקין',
    'EMP-010': 'מתקין'
  };
  
  var primaryRole = primaryRoleMap[emp.id] || emp.defaultHat;
  
  return {
    id: emp.id,
    fullName: emp.fullName,
    role: primaryRole, // Keep for backward compatibility, equals primaryRole
    primaryRole: primaryRole,
    roles: rolesMap[emp.id] || [primaryRole],
    phone: emp.phone,
    email: emp.email,
    status: 'זמין',
    notes: ''
  };
});

window.MOCK_SYSTEMS = [
  'חשמל חכם',
  'מערכות בקרה',
  'תקשורת ורשת',
  'אבטחה ומצלמות',
  'מולטימדיה',
  'בקרת כניסה',
  'אינטרקום',
  'תשתיות'
];

window.MOCK_PRODUCTS = [
  { id: 'P001', name: 'לוח בקרה מרכזי SmartHome' },
  { id: 'P002', name: 'מצלמת IP 4MP' },
  { id: 'P003', name: 'רמקול קיר 8 אינץ׳' },
  { id: 'P004', name: 'מתג חכם WiFi' },
  { id: 'P005', name: 'כבל Cat6 500 מטר' },
  { id: 'P006', name: 'ארון תקשורת 19״ 42U' },
  { id: 'P007', name: 'מצלמת IP 8MP PTZ' },
  { id: 'P008', name: 'חיישן תאורה PIR' }
];

/* Recent execution reports – list + view modal */
window.MOCK_RECENT_REPORTS = [
  {
    id: 'RPT-001',
    reportNumber: '1001',
    date: '2025-01-22',
    projectName: 'פרויקט וילה רמת אביב',
    customerName: 'וילה רמת אביב',
    reporterName: 'רביב מעיני',
    status: 'הוגש',
    transferredToAccounting: false,
    site: 'וילה רמת אביב – קומת קרקע',
    role: 'מתקין',
    start: '08:00',
    end: '14:00',
    summary: 'התקנת מצלמות בסלון ובמרפסת.',
    systems: ['אבטחה ומצלמות', 'אינטרקום'],
    products: [
      { productName: 'מצלמת IP 4MP', qty: 2, location: 'סלון', notes: '', billable: true },
      { productName: 'כבל Cat6 500 מטר', qty: 1, location: '', notes: 'חיתוך 50מ׳', billable: true }
    ],
    notes: '',
    followup: false,
    followupReason: ''
  },
  {
    id: 'RPT-002',
    reportNumber: '1002',
    date: '2025-01-21',
    projectName: 'פרויקט מלון דן תל אביב',
    customerName: 'מלון דן תל אביב',
    reporterName: 'יוסי כהן',
    status: 'הועבר להנה״ח',
    transferredToAccounting: true,
    site: 'מלון דן – קומה 3',
    role: 'טכנאי',
    start: '09:00',
    end: '16:00',
    summary: 'תיקון מצלמה מנותקת, החלפת כבל.',
    systems: ['אבטחה ומצלמות', 'תקשורת ורשת'],
    products: [
      { productName: 'כבל Cat6 500 מטר', qty: 1, location: 'קומה 3', notes: '', billable: true }
    ],
    notes: '',
    followup: true,
    followupReason: 'בדיקת תמונה לאחר 48 שעות'
  },
  {
    id: 'RPT-003',
    reportNumber: '1003',
    date: '2025-01-20',
    projectName: 'פרויקט חברת ABC',
    customerName: 'חברת ABC בע״מ',
    reporterName: 'שרה לוי',
    status: 'טיוטה',
    transferredToAccounting: false,
    site: 'משרד ראשי – לוח בקרה',
    role: 'מנהל פרויקט',
    start: '10:00',
    end: '12:30',
    summary: 'התקנת לוח בקרה מרכזי.',
    systems: ['מערכות בקרה', 'בקרת כניסה', 'אינטרקום'],
    products: [
      { productName: 'לוח בקרה מרכזי SmartHome', qty: 1, location: 'לובי', notes: '', billable: true }
    ],
    notes: 'הדרכה לצוות האבטחה.',
    followup: false,
    followupReason: ''
  }
];
