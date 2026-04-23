const API_CONFIG = {
  baseUrl: "http://localhost:5161/api",
};

function getAuthToken() {
  return sessionStorage.getItem("manager2_token") || "";
}

function setAuthSession(loginResponse) {
  if (!loginResponse) return;

  sessionStorage.setItem("manager2_token", loginResponse.token || "");
  sessionStorage.setItem(
    "manager2_user",
    JSON.stringify({
      userId: loginResponse.userId,
      employeeId: loginResponse.employeeId,
      username: loginResponse.username,
      email: loginResponse.email,
      isActive: loginResponse.isActive,
      roles: Array.isArray(loginResponse.roles) ? loginResponse.roles : [],
      departments: Array.isArray(loginResponse.departments)
        ? loginResponse.departments
        : [],
    }),
  );
}

function clearAuthSession() {
  sessionStorage.removeItem("manager2_token");
  sessionStorage.removeItem("manager2_user");
}

function setReturnUrl(returnUrl) {
  if (!returnUrl) return;
  sessionStorage.setItem("manager2_return_url", returnUrl);
}

function getReturnUrl() {
  return sessionStorage.getItem("manager2_return_url") || "";
}

function clearReturnUrl() {
  sessionStorage.removeItem("manager2_return_url");
}

function isTokenExpired(token) {
  if (!token) return true;

  try {
    const tokenParts = token.split(".");
    if (tokenParts.length < 2) {
      return true;
    }

    const payload = JSON.parse(atob(tokenParts[1]));
    if (!payload.exp) {
      return true;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    return payload.exp <= nowInSeconds;
  } catch (error) {
    clearAuthSession();
    return true;
  }
}

function ensureValidToken() {
  const token = getAuthToken();

  if (!token || isTokenExpired(token)) {
    clearAuthSession();
    return false;
  }

  return true;
}

function redirectToLoginWithReturnUrl() {
  const currentPath = window.location.pathname || "";
  const currentSearch = window.location.search || "";
  const currentUrl = `${currentPath}${currentSearch}`;

  if (
    currentPath &&
    !currentPath.endsWith("/pages/login.html") &&
    currentPath !== "/pages/login.html"
  ) {
    setReturnUrl(currentUrl);
  }

  clearAuthSession();
  window.location.href = "/pages/login.html";
}

function requireAuthOrRedirect() {
  if (!ensureValidToken()) {
    redirectToLoginWithReturnUrl();
    return false;
  }

  return true;
}

let sessionGuardIntervalId = null;
let sessionExpiredHandled = false;

function handleExpiredSession() {
  if (sessionExpiredHandled) {
    return;
  }

  sessionExpiredHandled = true;

  alert("פג תוקף ההתחברות. יש להתחבר מחדש.");

  redirectToLoginWithReturnUrl();
}

function startSessionGuard() {
  if (sessionGuardIntervalId) {
    return;
  }

  sessionExpiredHandled = false;

  sessionGuardIntervalId = window.setInterval(() => {
    const token = getAuthToken();

    if (!token || isTokenExpired(token)) {
      stopSessionGuard();
      handleExpiredSession();
    }
  }, 5000);
}

function stopSessionGuard() {
  if (!sessionGuardIntervalId) {
    return;
  }

  window.clearInterval(sessionGuardIntervalId);
  sessionGuardIntervalId = null;
}

function bootProtectedPage(initCallback) {
  if (!requireAuthOrRedirect()) {
    return;
  }

  startSessionGuard();

  if (typeof initCallback === "function") {
    initCallback();
  }
}

function getCurrentUser() {
  const rawUser = sessionStorage.getItem("manager2_user");
  if (!rawUser) return null;

  try {
    return JSON.parse(rawUser);
  } catch (error) {
    clearAuthSession();
    return null;
  }
}

async function apiRequest(path, options = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_CONFIG.baseUrl}${path}`, {
    ...options,
    headers,
  });

  let responseBody = null;
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    responseBody = await response.json();
  } else {
    const textBody = await response.text();
    responseBody = textBody || null;
  }

  if (!response.ok) {
    const message =
      typeof responseBody === "object" &&
      responseBody !== null &&
      "message" in responseBody
        ? responseBody.message
        : `Request failed with status ${response.status}`;

    const isLoginRequest = path === "/Users/login";

    if (response.status === 401 && !isLoginRequest) {
      redirectToLoginWithReturnUrl();
    }

    const error = new Error(message);
    error.status = response.status;
    error.responseBody = responseBody;
    throw error;
  }

  return responseBody;
}

async function loginUser(email, password) {
  return apiRequest("/Users/login", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });
}

// =====================
// Config
// =====================
window.API_CONFIG = API_CONFIG;

// =====================
// Auth Core
// =====================
window.getAuthToken = getAuthToken;
window.setAuthSession = setAuthSession;
window.clearAuthSession = clearAuthSession;

// =====================
// Return URL
// =====================
window.setReturnUrl = setReturnUrl;
window.getReturnUrl = getReturnUrl;
window.clearReturnUrl = clearReturnUrl;

// =====================
// Token / Session Validation
// =====================
window.isTokenExpired = isTokenExpired;
window.ensureValidToken = ensureValidToken;
window.redirectToLoginWithReturnUrl = redirectToLoginWithReturnUrl;

// =====================
// Session Guard
// =====================
window.startSessionGuard = startSessionGuard;
window.stopSessionGuard = stopSessionGuard;
window.handleExpiredSession = handleExpiredSession;
window.bootProtectedPage = bootProtectedPage;

// =====================
// User
// =====================
window.getCurrentUser = getCurrentUser;

// =====================
// API
// =====================
window.apiRequest = apiRequest;
window.loginUser = loginUser;
