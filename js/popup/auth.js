import { getCurrentClassInfo } from './schedule.js'; // Getting the information fron schedule module
import { renderSchedule, showGreeting, debug, showElement, hideElement } from './ui.js'; // Importing all the helpers from ui
import { populateStudentDropdown } from './dropdown.js'; // Importing the dropdown helper

// State variables at module level
let username = "";
let password = "";
let studentName = "";
let activeStudentId = null;

export function setupAuth(apiModule) {
  const loginForm = document.getElementById("loginForm");
  const passwordInput = document.getElementById("password");

  return new Promise(resolve => {
    loginForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      debug("Form submitted");
      
      const username = document.getElementById("username")?.value?.trim() || "";
      const password = document.getElementById("password")?.value || "";

      if (!username || !password) {
        alert("Enter credentials");
        return;
      }

      hideElement(loginForm);
      showElement(document.getElementById("loading"));

      try {
        // Just validate credentials
        const student = await apiModule.getStudentName(username, password);
        if (!student?.name) throw new Error("Invalid credentials");
        
        // Return basic session info - actual data fetch happens in init.js
        resolve({ username, password });
      } catch (err) {
        console.error("Login error:", err);
        alert("Login failed: " + err.message);
        showElement(loginForm, "flex");
      } finally {
        hideElement(document.getElementById("loading"));
      }
    });

    // Handle Enter key
    passwordInput?.addEventListener("keyup", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        loginForm.dispatchEvent(new Event('submit'));
      }
    });

    // Try to restore session
    restoreSession(apiModule, resolve);
  });
}

async function loadUserData() {
  const loadingOverlay = document.getElementById("loading");
  const mainAction = document.getElementById("mainAction");
  const scheduleInfo = document.getElementById("scheduleInfo");

  try {
    debug("Loading user data...");
    showElement(loadingOverlay);
    
    const apiModule = await import('./api.js');
    const userData = await apiModule.fetchAllUserData(username, password, activeStudentId);

    // Process student data
    if (userData.activeStudent?.id && userData.studentList.length > 0) {
      const found = userData.studentList.find(s => s.id === userData.activeStudent.id);
      if (found) {
        debug(`Setting active student: ${found.name} (${found.id})`);
        activeStudentId = found.id;
        studentName = found.name;
        
        showGreeting(found.name);
        updateAvatar(found.name);
        populateStudentDropdown(userData.studentList, found.id, userData.activeStudent.id);
        
        await chrome.storage.local.set({
          activeStudentId: found.id,
          studentName: found.name
        });
      }
    }

    // Render schedule with pre-fetched data
    const classInfo = await getCurrentClassInfo(
      username,
      password,
      null,
      activeStudentId,
      userData.scheduleReport
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

// Replace or update any student switching logic to use switchAndFetchStudentData
async function handleStudentSwitch(newStudentId) {
  const apiModule = await import('./api.js');
  const scheduleInfo = document.getElementById("scheduleInfo");
  
  try {
    const userData = await apiModule.switchAndFetchStudentData(username, password, newStudentId);
    
    // Update UI with new data
    showGreeting(userData.studentInfo.name);
    updateAvatar(userData.studentInfo.name);
    populateStudentDropdown(userData.studentList, newStudentId, userData.activeStudent.id);
    
    const classInfo = await getCurrentClassInfo(
      username,
      password,
      null,
      newStudentId,
      userData.scheduleReport
    );
    renderSchedule(scheduleInfo, classInfo);
    
    // Save to storage
    await chrome.storage.local.set({
      activeStudentId: newStudentId,
      studentName: userData.studentInfo.name
    });

  } catch (err) {
    console.error("Failed to switch student:", err);
    alert("Failed to switch student. Please try again.");
  }
}

// Try to restore session from local storage
function restoreSession(getStudentName, done) {
  chrome.storage.local.get(
    ["username", "password", "loginTime", "studentName", "checkedOut", "startTime", "activeStudentId"],
    async data => {
      // Getting the time we've been logged in for
      const timeout = Date.now() - (data.loginTime || 0);
      // Checking if we have been logged in for less than 30 minutes
      if (data.username && timeout < 30 * 60 * 1000) { // 30 minutes x 60 seconds x 1000 milliseconds
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

// Sets the avatar element in the top left witht he first letter of the name
function updateAvatar(name) {
  const avatarEl = document.getElementById("studentAvatar");
  if (avatarEl && name) {
    const initial = name.charAt(0).toUpperCase();
    avatarEl.innerText = initial;
    avatarEl.style.display = "flex";
    debug(`Updated avatar to: ${initial}`);
  }
}