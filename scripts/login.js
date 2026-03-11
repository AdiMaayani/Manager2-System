// Login form handler
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Front-end only - no real authentication
      // Redirect to dashboard
      window.location.href = '../index.html';
    });
  }
});
