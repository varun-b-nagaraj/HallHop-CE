import { debug, showElement, hideElement } from './utils.js';
import { API_BASE } from './api.js';
import { getCurrentClassInfo } from './schedule.js';
import { renderSchedule, showGreeting } from './ui.js';
import { populateStudentDropdown } from './dropdown.js';

// State variables at module level
let username = "";
let password = "";
let studentName = "";
let activeStudentId = null;

export function setupAuth(apiModule) {
  const loginForm = document.getElementById("loginForm");
  const passwordInput = document.getElementById("password");

  return new Promise(resolve => {
    // Handle form submission
    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      debug("Form submitted");
      await handleLogin(apiModule.getStudentName);
      resolve({ username, password, studentName, activeStudentId });
    });

    // Handle Enter key in password field
    passwordInput?.addEventListener("keyup", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loginForm.dispatchEvent(new Event('submit'));
      }
    });

    // Try to restore existing session
    restoreSession(apiModule.getStudentName, resolve);
  });
}

async function handleLogin(getStudentName) {
  const loginForm = document.getElementById("loginForm");
  const loadingOverlay = document.getElementById("loading");
  const mainAction = document.getElementById("mainAction");
  
  // Get values directly from form inputs
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  
  // Set the values in this scope
  username = usernameInput?.value?.trim() || "";
  password = passwordInput?.value || "";

  debug(`Login attempt with username: ${username.substring(0,2)}***`);

  if (!username || !password) {
    alert("Enter credentials");
    return;
  }

  // Show loading after credentials entered
  hideElement(loginForm);
  showElement(loadingOverlay);

  try {
    debug("Logging in...");
    const res = await getStudentName(username, password);
    if (!res?.name) throw new Error("Invalid credentials");
    studentName = res.name;
    chrome.storage.local.set({
      username,
      password,
      loginTime: Date.now(),
      studentName
    });
    // update avatar
    updateAvatar(studentName);

    // show the main UI and load the rest
    showElement(mainAction, "flex");
    await loadUserData();
  } catch (err) {
    console.error("Login error:", err);
    alert("Login failed: " + err.message);
  } finally {
    hideElement(loadingOverlay);
  }
}

/**
 * Attempts to restore a session; if successful, loads data and resolves.
 * Otherwise shows the login form and waits for user to submit.
 */
function restoreSession(getStudentName, done) {
  chrome.storage.local.get(
    ["username", "password", "loginTime", "studentName", "checkedOut", "startTime", "activeStudentId"],
    async data => {
      const age = Date.now() - (data.loginTime || 0);
      if (data.username && age < 30 * 60 * 1000) {
        debug("Restoring session for", data.studentName);
        username = data.username;
        password = data.password;
        studentName = data.studentName;
        activeStudentId = data.activeStudentId;

        // show main UI first
        hideElement(document.getElementById("loginForm"));
        showElement(document.getElementById("mainAction"), "flex");

        // restore avatar
        updateAvatar(studentName);

        // resume timer if needed
        if (data.checkedOut && data.startTime) {
          const actionBtn = document.getElementById("actionBtn");
          const timerModule = await import("../../modules/timer.js");
          timerModule.startTimer(ms => {
            actionBtn.innerText = `Checked Out (${timerModule.formatDuration(ms)})`;
          }, data.startTime);
          actionBtn.style.backgroundColor = "var(--danger)";
        }

        // Only load user data once
        await loadUserData();
        
        // Resolve back to init
        done({ username, password, studentName, activeStudentId });
      } else {
        debug("No valid session, showing login form");
        showLoginForm();
      }
    }
  );
}

function showLoginForm() {
  hideElement(document.getElementById("mainAction"));
  showElement(document.getElementById("loginForm"), "flex");
}

function updateAvatar(name) {
  const avatarEl = document.getElementById("studentAvatar");
  if (avatarEl && name) {
    const initial = name.charAt(0).toUpperCase();
    avatarEl.innerText = initial;
    avatarEl.style.display = "flex";
    debug(`Updated avatar to: ${initial}`);
  }
}

async function loadUserData() {
  const loadingOverlay = document.getElementById("loading");
  const mainAction = document.getElementById("mainAction");
  const scheduleInfo = document.getElementById("scheduleInfo");

  try {
    debug("Loading user data...");
    showElement(loadingOverlay);

    // Sequential loading for reliability
    debug("1. Getting current active student");
    const curRes = await fetch(`${API_BASE}/lookup/current`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        base_url: "https://accesscenter.roundrockisd.org"
      })
    });

    const activeData = await curRes.json();
    debug("Current student response:", activeData);

    debug("2. Getting student list");
    const listRes = await fetch(`${API_BASE}/lookup/students`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        password,
        base_url: "https://accesscenter.roundrockisd.org"
      })
    });

    const studentData = await listRes.json();
    const students = studentData.students || [];
    debug(`Found ${students.length} students`);

    // Set default student if none active
    if (!activeData.active?.id && students.length > 0) {
      activeData.active = students[0];
      debug("No active student, using first student as default");
    }

    if (activeData.active?.id && students.length > 0) {
      const found = students.find(s => s.id === activeData.active.id);
      if (found) {
        debug(`Setting active student: ${found.name} (${found.id})`);
        activeStudentId = found.id;
        studentName = found.name;
        
        // Update all UI elements
        showGreeting(found.name);
        updateAvatar(found.name);
        populateStudentDropdown(students, found.id, activeData.active.id);
        
        // Save to storage
        await chrome.storage.local.set({
          activeStudentId: found.id,
          studentName: found.name
        });
      }
    }

    debug("3. Getting schedule");
    const classInfo = await getCurrentClassInfo(
      username,
      password,
      null,
      activeStudentId
    );
    renderSchedule(scheduleInfo, classInfo);

  } catch (err) {
    console.error("Failed to load data:", err);
    debug("Error details:", err.message);
    alert("Failed to load your data. Please try again.");
  } finally {
    hideElement(loadingOverlay);
    showElement(mainAction, "flex");
  }
}