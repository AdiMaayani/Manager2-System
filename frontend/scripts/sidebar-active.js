// Set active sidebar link based on current page
document.addEventListener('DOMContentLoaded', () => {
  const currentPath = window.location.pathname;
  const currentPage = currentPath.split('/').pop() || 'index.html';
  
  // Remove active class from all links
  document.querySelectorAll('.sidebar-nav-link').forEach(link => {
    link.classList.remove('active');
  });
  
  // Map page names to sidebar links
  const pageMap = {
    'index.html': 'index.html',
    'workplan.html': 'workplan.html',
    'projects.html': 'projects.html',
    'service-calls.html': 'service-calls.html',
    'customers.html': 'customers.html',
    'contacts.html': 'contacts.html',
    'quotes.html': 'quotes.html',
    'inventory.html': 'inventory.html',
    'reports.html': 'reports.html',
    'employees.html': 'employees.html',
    'cashflow.html': 'cashflow.html',
    'settings.html': 'settings.html'
  };
  
  // Find and activate the matching link
  const targetPage = pageMap[currentPage];
  if (targetPage) {
    document.querySelectorAll('.sidebar-nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href && (href.endsWith(targetPage) || href.endsWith('/' + targetPage) || href.endsWith('../' + targetPage))) {
        link.classList.add('active');
      }
    });
  }
});
