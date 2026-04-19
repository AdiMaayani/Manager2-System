document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("login-form");
  const emailInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  if (!loginForm || !emailInput || !passwordInput) {
    return;
  }

  let errorBox = document.getElementById("login-error-message");
  if (!errorBox) {
    errorBox = document.createElement("div");
    errorBox.id = "login-error-message";
    errorBox.style.display = "none";
    errorBox.style.backgroundColor = "#fee2e2";
    errorBox.style.color = "#991b1b";
    errorBox.style.border = "1px solid #fecaca";
    errorBox.style.borderRadius = "8px";
    errorBox.style.padding = "12px";
    errorBox.style.marginBottom = "16px";
    errorBox.style.fontSize = "14px";
    loginForm.insertBefore(errorBox, loginForm.firstChild);
  }

  const submitButton = loginForm.querySelector('button[type="submit"]');

  function showError(message) {
    errorBox.textContent = message;
    errorBox.style.display = "block";
  }

  function hideError() {
    errorBox.textContent = "";
    errorBox.style.display = "none";
  }

  function setLoadingState(isLoading) {
    if (!submitButton) return;

    submitButton.disabled = isLoading;
    submitButton.textContent = isLoading ? "מתחבר..." : "התחבר";
  }

  const existingUser = window.getCurrentUser ? window.getCurrentUser() : null;
  const existingToken = window.getAuthToken ? window.getAuthToken() : "";
  const hasValidToken = window.ensureValidToken
    ? window.ensureValidToken()
    : false;

  if (existingUser && existingToken && hasValidToken) {
    const returnUrl = window.getReturnUrl ? window.getReturnUrl() : "";

    if (returnUrl) {
      window.clearReturnUrl();
      window.location.href = returnUrl;
      return;
    }

      window.setAuthSession(loginResponse);

      const returnUrl = window.getReturnUrl ? window.getReturnUrl() : "";

      if (returnUrl) {
        window.clearReturnUrl();
        window.location.href = returnUrl;
        return;
      }

      window.location.href = "../index.html";

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    hideError();

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (!email) {
      showError("יש להזין אימייל.");
      return;
    }

    if (!password) {
      showError("יש להזין סיסמה.");
      return;
    }

    try {
      setLoadingState(true);

      const loginResponse = await window.loginUser(email, password);

      if (!loginResponse || !loginResponse.token) {
        throw new Error("התחברות נכשלה. לא התקבל טוקן מהשרת.");
      }

      window.setAuthSession(loginResponse);
<<<<<<< Updated upstream:frontend/scripts/login.js
      window.location.href = "index.html";
=======

      const returnUrl = window.getReturnUrl ? window.getReturnUrl() : "";

      if (returnUrl) {
        window.clearReturnUrl();
        window.location.href = returnUrl;
        return;
      }

      window.location.href = "../index.html";
>>>>>>> Stashed changes:scripts/login.js
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        showError("אימייל או סיסמה שגויים.");
      } else if (error.status === 400) {
        showError(error.message || "הבקשה אינה תקינה.");
      } else {
        showError("אירעה שגיאה בעת ההתחברות. נסה שוב.");
      }
    } finally {
      setLoadingState(false);
    }
  });
});
