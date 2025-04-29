// All API calls will be made here
export const API_BASE = "https://hacapi-hh.onrender.com"; // Api base URL - We append fetch calls to this

function debug(...args) {
  console.log("[HallHop API Debug]", ...args); // Ignore all debug messages - can view them in console
}

// Turning "Last name, First name" to "First Last"
function formatName(name) {
  if (!name || typeof name !== "string") return name;
  const parts = name.split(","); // Split by comma
  if (parts.length === 2) {
    return `${parts[1].trim()} ${parts[0].trim()}`;
  }
  return name;
}

debug("API module loaded");

// Logging in to get student name
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

// Looking up students to populate the student switching dropdown
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

// Saving the currently selected student ID to highlight it in the dropdown
export function saveActiveStudent(studentId) {
  debug("saveActiveStudent:", studentId);
  return chrome.storage.local.set({ activeStudentId: studentId });
}

// Logging a checkout and sending to backend to upload to server
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

// Saving checkout ID to local storage - used to make sure we close the correct checkout in the backend
export function saveCheckoutId(id) {
  debug("saveCheckoutId:", id);
  return chrome.storage.local.set({ checkoutId: id });
}

export async function getSavedCheckoutId() {
  const data = await chrome.storage.local.get("checkoutId");
  debug("got checkoutId from storage:", data.checkoutId);
  return data.checkoutId;
}

// Logging a checkin
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

// Getting the currently active student from HAC
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

// Getting the student schedule report
export async function fetchScheduleReport(username, password, studentId = null) {
  const link = "https://accesscenter.roundrockisd.org/";
  const url = `${API_BASE}/api/getReport?user=${encodeURIComponent(username)}&pass=${encodeURIComponent(password)}&link=${encodeURIComponent(link)}${studentId ? `&student_id=${encodeURIComponent(studentId)}` : ''}`;
  
  debug(`fetchScheduleReport URL: ${url}`);
  
  try {
    const res = await fetch(url);
    debug(`fetchScheduleReport status: ${res.status}`);
    const report = await res.json();
    debug(`fetchScheduleReport payload:`, report);
    return report;
  } catch (err) {
    debug(`fetchScheduleReport error:`, err.message);
    return null;
  }
}

export async function fetchAllUserData(username, password, studentId = null) {
  debug("Fetching all user data in parallel");
  
  const baseUrl = "https://accesscenter.roundrockisd.org/";
  const hacPayload = {
    username,
    password,
    base_url: baseUrl
  };

  try {
    // Make all requests in parallel
    const [infoResponse, reportResponse, activeResponse, studentsResponse] = await Promise.all([
      // Get student info
      fetch(`${API_BASE}/api/getInfo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: username, pass: password })
      }),
      
      // Get schedule report
      fetch(`${API_BASE}/api/getReport?user=${encodeURIComponent(username)}&pass=${encodeURIComponent(password)}&link=${encodeURIComponent(baseUrl)}${studentId ? `&student_id=${encodeURIComponent(studentId)}` : ''}`, {
        method: "GET"
      }),
      
      // Get active student
      fetch(`${API_BASE}/lookup/current`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hacPayload)
      }),
      
      // Get student list
      fetch(`${API_BASE}/lookup/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hacPayload)
      })
    ]);

    // Parse all responses in parallel
    const [info, report, active, students] = await Promise.all([
      infoResponse.json(),
      reportResponse.json(),
      activeResponse.json(),
      studentsResponse.json()
    ]);

    return {
      studentInfo: { name: formatName(info?.name || "") },
      scheduleReport: report,
      activeStudent: active.active,
      studentList: students.students || []
    };

  } catch (err) {
    debug("Error fetching user data:", err);
    throw new Error("Failed to fetch user data");
  }
}

// Add a new function for switching students
export async function switchAndFetchStudentData(username, password, newStudentId) {
  debug("Switching and fetching new student data in parallel");
  
  const baseUrl = "https://accesscenter.roundrockisd.org/";
  const hacPayload = {
    username,
    password,
    base_url: baseUrl,
    student_id: newStudentId
  };

  try {
    // Run all requests in parallel, including the switch request
    const [switchData, infoResponse, reportResponse, activeResponse, studentsResponse] = await Promise.all([
      // Switch student
      fetch(`${API_BASE}/lookup/switch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hacPayload)
      }).then(r => r.json()),

      // Get student info
      fetch(`${API_BASE}/api/getInfo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: username, pass: password })
      }),
      
      // Get schedule report
      fetch(`${API_BASE}/api/getReport?user=${encodeURIComponent(username)}&pass=${encodeURIComponent(password)}&link=${encodeURIComponent(baseUrl)}&student_id=${encodeURIComponent(newStudentId)}`, {
        method: "GET"
      }),
      
      // Get active student
      fetch(`${API_BASE}/lookup/current`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hacPayload)
      }),
      
      // Get student list
      fetch(`${API_BASE}/lookup/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hacPayload)
      })
    ]);

    if (!switchData.success) {
      throw new Error(switchData.error || "Failed to switch student");
    }

    // Parse remaining responses in parallel
    const [info, report, active, students] = await Promise.all([
      infoResponse.json(),
      reportResponse.json(),
      activeResponse.json(),
      studentsResponse.json()
    ]);

    return {
      studentInfo: { name: formatName(info?.name || "") },
      scheduleReport: report,
      activeStudent: active.active,
      studentList: students.students || []
    };

  } catch (err) {
    debug("Error switching student:", err);
    throw new Error("Failed to switch student");
  }
}

// Creates a hallhopModules object to store all API functions if not already created
window.hallhopAPI = window.hallhopAPI || {};

// Creates an api object to store all API functions - grouping them all together
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