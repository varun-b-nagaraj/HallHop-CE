import { clearSession } from "./ui.js";
import { showToast, disableUI, redirectToLogin } from "./ui.js";

export const API_BASE = "https://hacapi-hh.onrender.com";
const DEFAULT_TIMEOUT = 30000; // Increased to 30 seconds

let authToken = null;
let loginPromise = null;

function debug(...args) {
  console.log("[HallHop API Debug]", ...args);
}

function formatName(name) {
  if (!name || typeof name !== "string") return name;
  const parts = name.split(",");
  if (parts.length === 2) {
    return `${parts[1].trim()} ${parts[0].trim()}`;
  }
  return name;
}

function isTokenValid(token) {
  if (!token) return false;
  try {
    const [, payloadBase64] = token.split('.');
    if (!payloadBase64) return false;
    const payload = JSON.parse(atob(payloadBase64));
    const nowInSeconds = Date.now() / 1000;
    return payload && payload.exp && nowInSeconds < payload.exp;
  } catch (e) {
    debug("Token validation error:", e);
    return false;
  }
}

async function fetchWithTimeout(resource, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => {
    debug(`Timeout triggered for: ${resource}`);
    controller.abort();
  }, timeout);
  try {
    debug(`Fetching with timeout (${timeout/1000}s): ${resource}`);
    const response = await fetch(resource, { ...options, signal: controller.signal });
    debug(`Fetch completed for: ${resource}, Status: ${response.status}`);
    return response;
  } catch (error) {
    if (error.name === 'AbortError') {
      debug(`Fetch aborted for: ${resource}`, error);
    } else {
      debug(`Fetch error for: ${resource}`, error);
    }
    throw error; // Re-throw the error to be caught by the caller
  }
  finally {
    clearTimeout(id);
  }
}

async function _ensureLoginAndGetToken(username, password, base_url = "https://accesscenter.roundrockisd.org/") {
  if (authToken && isTokenValid(authToken)) {
    return { success: true, token: authToken };
  }
  if (loginPromise) {
    debug("Login already in progress, returning existing promise.");
    return loginPromise;
  }

  const performLogin = async () => {
    const url = `${API_BASE}/api/login`;
    debug(`_ensureLoginAndGetToken: POST ${url} (user=${username ? username.substring(0,2) : 'N/A'}***)`);
    try {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, base_url })
      });
      
      const data = await res.json().catch(() => {
        throw new Error(`Login request failed with status ${res.status} and non-JSON response`);
      });

      if (!res.ok) {
        throw new Error(data.error || `Login failed with status ${res.status}`);
      }
      
      authToken = data.token;
      debug("_ensureLoginAndGetToken success, token stored.");
      return { success: true, token: data.token };
    } catch (err) {
      debug("_ensureLoginAndGetToken error:", err);
      authToken = null; // Clear token on actual login failure, not just promise reuse
      throw err; // Rethrow to ensure loginPromise rejects correctly
    }
  };

  loginPromise = performLogin().finally(() => {
    loginPromise = null;
  });
  return loginPromise;
}

function _getAuthHeaders() {
  if (!authToken || !isTokenValid(authToken)) {
    debug("Auth token is missing, invalid, or expired for _getAuthHeaders.");
    return { "Content-Type": "application/json" };
  }
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${authToken}`
  };
}

async function _handleApiResponse(response, callName = "API Call") {
  let data;
  try {
    // Check if response is empty before trying to parse JSON for certain status codes
    if (response.status === 204 || response.headers.get("content-length") === "0") {
      debug(`${callName} returned ${response.status} with no content.`);
      data = {}; // Or null, if that's more appropriate for no content
    } else {
      data = await response.json();
    }
  } catch (e) {
    if (!response.ok) {
      // If response is not OK and JSON parsing failed, it's a server error with bad format
      throw new Error(`${callName} failed with status ${response.status} and non-JSON response body`);
    }
    // If response was OK but body is not JSON (or empty and not 204), this might be an issue
    debug(`${callName} returned OK status but non-JSON or unexpected empty body. Error: ${e.message}`);
    data = {}; // Default to empty object, or handle as an error if strictness is required
  }

  if (!response.ok) {
    // Use error from parsed data if available, otherwise a generic message
    throw new Error(data?.error || `${callName} failed with status ${response.status}`);
  }
  return data;
}


export async function getStudentName(username, password) {
  const loginResult = await _ensureLoginAndGetToken(username, password);
  if (!loginResult.success) {
    debug("getStudentName: Login failed, cannot get info.");
    return null;
  }

  const url = `${API_BASE}/api/getInfo`;
  debug(`getStudentName (now using /api/getInfo): GET ${url}`);
  try {
    const res = await fetchWithTimeout(url, { method: "GET", headers: _getAuthHeaders() });
    const data = await _handleApiResponse(res, "getStudentName(/api/getInfo)");
    return { name: formatName(data?.name || "") };
  } catch (err) {
    debug("getStudentName (using /api/getInfo) error:", err);
    return null;
  }
}

export async function fetchStudentList(username, password) {
  const loginResult = await _ensureLoginAndGetToken(username, password);
  if (!loginResult.success) {
    debug("fetchStudentList: Login failed, cannot fetch list.");
    return [];
  }

  const url = `${API_BASE}/lookup/students`;
  debug(`fetchStudentList: GET ${url}`);
  try {
    const res = await fetchWithTimeout(url, { method: "GET", headers: _getAuthHeaders() });
    const data = await _handleApiResponse(res, "fetchStudentList");
    return data.students || [];
  } catch (err) {
    debug("fetchStudentList error:", err);
    return [];
  }
}

export function saveActiveStudent(studentId) {
  debug("saveActiveStudent:", studentId);
  return chrome.storage.local.set({ activeStudentId: studentId });
}

export async function logCheckout(payload) {
  if (!authToken || !isTokenValid(authToken)) {
    debug("logCheckout: No valid auth token. Please ensure login has occurred.");
    return { error: "Not authenticated or session expired. Please login again." };
  }
  const url = `${API_BASE}/logs/checkout`;
  debug("logCheckout: POST", url, "payload:", payload);
  try {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: _getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return await _handleApiResponse(res, "logCheckout");
  } catch (err) {
      debug("logCheckout fetch/parse error:", err);
      return { error: err.message || "An unknown error occurred during checkout." };
  }
}

export function saveCheckoutId(id) {
  debug("saveCheckoutId:", id);
  return chrome.storage.local.set({ checkoutId: id });
}

export async function getSavedCheckoutId() {
  const data = await chrome.storage.local.get("checkoutId");
  debug("got checkoutId from storage:", data.checkoutId);
  return data.checkoutId;
}

export async function logCheckin(payload) {
  if (!authToken || !isTokenValid(authToken)) {
    debug("logCheckin: No valid auth token. Please ensure login has occurred.");
    return { error: "Not authenticated or session expired. Please login again." };
  }
  const url = `${API_BASE}/logs/checkin`;
  debug("logCheckin: POST", url, "payload:", payload);
  try {
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: _getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    return await _handleApiResponse(res, "logCheckin");
  } catch (err) {
      debug("logCheckin fetch/parse error:", err);
      return { error: err.message || "An unknown error occurred during checkin." };
  }
}

export async function getCurrentStudent(username, password) {
  const loginResult = await _ensureLoginAndGetToken(username, password);
  if (!loginResult.success) {
    debug("getCurrentStudent: Login failed.");
    return null;
  }

  const url = `${API_BASE}/lookup/current`;
  debug(`getCurrentStudent: GET ${url}`);
  try {
    const res = await fetchWithTimeout(url, { method: "GET", headers: _getAuthHeaders() });
    const data = await _handleApiResponse(res, "getCurrentStudent");
    return data.success ? data.active_student : null;
  } catch (err) {
    debug("getCurrentStudent error:", err);
    return null;
  }
}

export async function fetchScheduleReport(username, password, studentId = null) {
  const loginResult = await _ensureLoginAndGetToken(username, password);
  if (!loginResult.success) {
    debug("fetchScheduleReport: Login failed.");
    return null;
  }

  let url = `${API_BASE}/api/getReport`;
  if (studentId) {
    url += `?student_id=${encodeURIComponent(studentId)}`;
  }
  debug(`fetchScheduleReport URL: GET ${url}`);
  try {
    const res = await fetchWithTimeout(url, { method: "GET", headers: _getAuthHeaders() });
    return await _handleApiResponse(res, "fetchScheduleReport");
  } catch (err) {
    debug(`fetchScheduleReport error:`, err.message);
    return null;
  }
}

export async function fetchAllUserData(username, password, studentId = null) {
  debug(`Fetching all user data in parallel for studentId: ${studentId || 'default'}`);
  
  // Ensure login and token validity before proceeding
  // Note: _ensureLoginAndGetToken itself is now robust against race conditions
  const loginResult = await _ensureLoginAndGetToken(username, password);
  if (!loginResult || !loginResult.success) {
    const errorMessage = loginResult?.error || "Login failed, cannot fetch all user data.";
    debug(`fetchAllUserData: Login check failed. Error: ${errorMessage}`);
    throw new Error(errorMessage);
  }
  debug("fetchAllUserData: Login check successful, proceeding with data fetch.");

  const gracefulCheckResponse = async (response, callName) => {
    let data;
    try {
      // Handle no content responses
      if (response.status === 204 || response.headers.get("content-length") === "0") {
        debug(`${callName} returned ${response.status} with no content.`);
        data = {}; // Or null
      } else {
        data = await response.json();
      }
    } catch (e) {
      // If JSON parsing fails
      if (!response.ok) {
        // If response was not OK and parsing failed, it's a server error with bad format
        debug(`${callName} failed with status ${response.status} and non-JSON response. Error: ${e.message}`);
        // Construct an error object that matches what the backend might send
        data = { error: `${callName} failed with status ${response.status} and non-JSON response body` };
      } else {
        // Response was OK but parsing failed (e.g., empty but not 204, or malformed JSON)
        debug(`${callName} returned OK status but non-JSON or malformed body. Error: ${e.message}`);
        data = { error: `Malformed JSON response for ${callName}` }; // Treat as an error
      }
    }
    
    if (!response.ok) {
      const known404Messages = [
        "No active student found",
        "No students found",
        "Failed to retrieve report"
      ];
      // Check if the error message from data (if it exists) is one of the known 404s
      if (response.status === 404 && data && data.error && known404Messages.includes(data.error)) {
        debug(`fetchAllUserData: Gracefully handled 404 for ${callName}: ${data.error}`);
        return data; // Return error object for graceful handling
      }
      // For other errors or unhandled 404s, throw
      const errorMessage = data?.error || `${callName} failed with status ${response.status}`;
      debug(`fetchAllUserData: Unhandled error for ${callName}: ${errorMessage}`);
      throw new Error(errorMessage);
    }
    return data;
  };

  try {
    let reportUrl = `${API_BASE}/api/getReport`;
    if (studentId) {
      reportUrl += `?student_id=${encodeURIComponent(studentId)}`;
    }
    debug(`fetchAllUserData: URLs configured. Report URL: ${reportUrl}`);

    const fetchOptions = { method: "GET", headers: _getAuthHeaders() };

    // The AbortError is likely coming from one of these fetches timing out.
    const [infoResponse, reportResponse, activeResponse, studentsResponse] = await Promise.all([
      fetchWithTimeout(`${API_BASE}/api/getInfo`, fetchOptions, DEFAULT_TIMEOUT),
      fetchWithTimeout(reportUrl, fetchOptions, DEFAULT_TIMEOUT),
      fetchWithTimeout(`${API_BASE}/lookup/current`, fetchOptions, DEFAULT_TIMEOUT),
      fetchWithTimeout(`${API_BASE}/lookup/students`, fetchOptions, DEFAULT_TIMEOUT)
    ]);
    debug("fetchAllUserData: All parallel fetches completed.");

    const [info, reportResult, activeResult, studentsResult] = await Promise.all([
      _handleApiResponse(infoResponse, "/api/getInfo"),
      gracefulCheckResponse(reportResponse, reportUrl),
      gracefulCheckResponse(activeResponse, `${API_BASE}/lookup/current`),
      gracefulCheckResponse(studentsResponse, `${API_BASE}/lookup/students`)
    ]);
    debug("fetchAllUserData: All responses processed.");

    return {
      studentInfo: { name: formatName(info?.name || "") },
      scheduleReport: (reportResult && !reportResult.error) ? reportResult : null,
      activeStudent: (activeResult && activeResult.success) ? activeResult.active_student : null,
      studentList: (studentsResult && studentsResult.students) ? studentsResult.students : []
    };

  } catch (err) {
    // This catch will now primarily handle AbortErrors from fetchWithTimeout,
    // or errors thrown by _handleApiResponse/_gracefulCheckResponse for unrecoverable issues.
    debug(`Error in fetchAllUserData's main try block (outer catch): ${err.name} - ${err.message}`, err);
    throw err; // Re-throw the original error for the caller to handle
  }
}

export async function switchAndFetchStudentData(username, password, newStudentId) {
  debug("Switching and fetching new student data for studentId:", newStudentId);
  
  // Ensure login. If this fails, it will throw, and the function will exit.
  await _ensureLoginAndGetToken(username, password); 
  debug("switchAndFetchStudentData: Login check successful.");

  try {
    const switchUrl = `${API_BASE}/lookup/switch`;
    debug(`Switching student: POST ${switchUrl} with student_id: ${newStudentId}`);
    const switchRes = await fetchWithTimeout(switchUrl, {
      method: "POST",
      headers: _getAuthHeaders(),
      body: JSON.stringify({ student_id: newStudentId })
    }, DEFAULT_TIMEOUT); // Apply timeout to switch call as well

    const switchData = await _handleApiResponse(switchRes, "switchStudent");
    if (!switchData.success) {
      // Backend indicated switch failed
      throw new Error(switchData.error || "Failed to switch student (backend error)");
    }
    debug("Student switch successful:", switchData.message);

    debug("Proceeding to fetchAllUserData after successful switch.");
    return await fetchAllUserData(username, password, newStudentId);

  } catch (err) {
    // Catches errors from fetchWithTimeout (like AbortError if switch call times out)
    // or errors from _handleApiResponse, or the explicit throw for switch failure.
    debug(`Error in switchAndFetchStudentData: ${err.name} - ${err.message}`, err);
    // Re-throw the error to be handled by the UI or calling function
    throw err; 
  }
}
export async function logoutUser() {
  const token = localStorage.getItem("authToken");

  if (token) {
    try {
      await fetch(`${API_BASE}/api/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
    } catch (err) {
      console.warn("Logout API failed:", err);
    }
  }

  // Clear in-memory state
  authToken = null;
  loginPromise = null;

  // Set logout flag and clear storage
  await chrome.storage.local.set({ wasLoggedOut: true });
  await chrome.storage.local.remove([
    "username", "password", "loginTime", "studentName",
    "checkedOut", "startTime", "activeStudentId", "checkoutId"
  ]);
  localStorage.removeItem("authToken");
  sessionStorage.clear();

  showToast("Logged out!");
  disableUI();

  setTimeout(() => {
    window.location.reload();
  }, 1000);
}



export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("authToken");

  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  try {
    const response = await fetch(endpoint, { ...options, headers });

    if (response.status === 401) {
      console.warn("🔒 Session expired or unauthorized. Logging out.");
      await logoutUser();
      return null;
    }

    return response;
  } catch (error) {
    console.error("API request failed:", error);
    return null;
  }
}

window.hallhopAPI = window.hallhopAPI || {};
window.hallhopAPI.api = {
  getStudentName,
  fetchStudentList,
  saveActiveStudent,
  logCheckout,
  saveCheckoutId,
  getSavedCheckoutId,
  logCheckin,
  getCurrentStudent,
  fetchScheduleReport,
  fetchAllUserData,
  switchAndFetchStudentData
};

debug("API module loaded with increased timeout and refined error handling.");