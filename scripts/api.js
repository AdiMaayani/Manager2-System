const API_CONFIG = {
  baseUrl: "http://localhost:5161/api",
};

function getAuthToken() {
  return localStorage.getItem("manager2_token") || "";
}

function setAuthSession(loginResponse) {
  if (!loginResponse) return;

  localStorage.setItem("manager2_token", loginResponse.token || "");
  localStorage.setItem(
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
  localStorage.removeItem("manager2_token");
  localStorage.removeItem("manager2_user");
}

function getCurrentUser() {
  const rawUser = localStorage.getItem("manager2_user");
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

window.API_CONFIG = API_CONFIG;
window.getAuthToken = getAuthToken;
window.setAuthSession = setAuthSession;
window.clearAuthSession = clearAuthSession;
window.getCurrentUser = getCurrentUser;
window.apiRequest = apiRequest;
window.loginUser = loginUser;
