export const API_BASE = "https://hacapi-hh.onrender.com";

function debug(...args) {
  console.log("[HallHop API Debug]", ...args);
}

// Normalize "Last, First" → "First Last"
function formatName(name) {
  if (!name || typeof name !== "string") return name;
  const parts = name.split(",");
  if (parts.length === 2) {
    return `${parts[1].trim()} ${parts[0].trim()}`;
  }
  return name;
}

debug("API module loaded");

/**
 * 1) Login: fetch student display name
 */
export async function getStudentName(username, password) {
  const url = `${API_BASE}/api/getInfo`;
  debug(`getStudentName: POST ${url} (user=${username.substring(0,2)}***)`);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: username, pass: password })
    });
    debug("status:", res.status);
    const data = await res.json();
    debug("payload:", data);
    return { name: formatName(data?.name || "") };
  } catch (err) {
    debug("getStudentName error:", err);
    return null;
  }
}

/**
 * 2) Lookup all students for the dropdown
 */
export async function fetchStudentList(username, password) {
  const url = `${API_BASE}/lookup/students`;
  debug("fetchStudentList: POST", url);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      password,
      base_url: "https://accesscenter.roundrockisd.org"
    })
  });
  const data = await res.json();
  debug("students:", data.students);
  return data.students || [];
}

/**
 * 3) Save the active student ID locally
 */
export function saveActiveStudent(studentId) {
  debug("saveActiveStudent:", studentId);
  return chrome.storage.local.set({ activeStudentId: studentId });
}

/**
 * 4) Log a checkout, return the record (including its ID)
 */
export async function logCheckout(payload) {
  const url = `${API_BASE}/logs/checkout`;
  debug("logCheckout:", payload);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const record = await res.json();
  debug("checkout record:", record);
  return record;
}

/**
 * 5) Persist checkoutId for later check‐in
 */
export function saveCheckoutId(id) {
  debug("saveCheckoutId:", id);
  return chrome.storage.local.set({ checkoutId: id });
}

export async function getSavedCheckoutId() {
  const data = await chrome.storage.local.get("checkoutId");
  debug("got checkoutId from storage:", data.checkoutId);
  return data.checkoutId;
}

/**
 * 6) Log a check‐in
 */
export async function logCheckin(payload) {
  const url = `${API_BASE}/logs/checkin`;
  debug("logCheckin:", payload);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await res.json();
  debug("checkin result:", result);
  return result;
}

/**
 * Get currently active student from HAC
 */
export async function getCurrentStudent(username, password) {
  const url = `${API_BASE}/lookup/current`;
  debug("getCurrentStudent: POST", url);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        base_url: "https://accesscenter.roundrockisd.org"
      })
    });
    const data = await res.json();
    debug("Current student response:", data);
    return data.active || null;
  } catch (err) {
    debug("getCurrentStudent error:", err);
    return null;
  }
}

// ———————————————————————————————————————————————————————
// Expose for any legacy or global usage
// ———————————————————————————————————————————————————————

window.hallhopModules = window.hallhopModules || {};
window.hallhopModules.api = {
  getStudentName,
  fetchStudentList,
  saveActiveStudent,
  logCheckout,
  saveCheckoutId,
  getSavedCheckoutId,
  logCheckin,
  getCurrentStudent,
};

window.hallhopAPI = { ...window.hallhopModules.api };
