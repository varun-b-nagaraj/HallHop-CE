import * as api from './api.js';
import * as timer from '../../modules/timer.js';
import * as scheduleModule from './schedule.js';
import { setupAuth } from './auth.js';
import { setupDropdown, populateStudentDropdown } from './dropdown.js';
import { setupCheckout } from './checkout.js';
import { setupUI, renderSchedule, showGreeting, updateCheckoutButton, debug, showElement, hideElement } from './ui.js';


/**
 * Primary entrypoint for popup.
 * Initializes authentication, UI animations, dropdowns, schedule rendering,
 * and checkout/check-in behavior in the correct order.
 */
async function init() {
  debug("HallHop initializing...");

  const loginForm = document.getElementById("loginForm");
  const mainAction = document.getElementById("mainAction");
  const loadingOverlay = document.getElementById("loading");
  const scheduleContainer = document.getElementById('scheduleInfo');

  hideElement(loadingOverlay);
  hideElement(mainAction);
  showElement(loginForm, "flex");

  try {
    // Get credentials from auth
    const session = await setupAuth(api);
    if (!session?.username || !session?.password) {
      throw new Error("No valid session");
    }

    // Show loading state
    showElement(loadingOverlay);
    hideElement(loginForm);

    // Fetch all user data in parallel
    const userData = await api.fetchAllUserData(session.username, session.password);
    if (!userData) throw new Error("Failed to fetch user data");

    // Process student data
    const currentStudent = userData.activeStudent?.id ? 
      userData.studentList.find(s => s.id === userData.activeStudent.id) : 
      userData.studentList[0];

    if (!currentStudent) throw new Error("No student data available");

    // Set up UI and display data
    setupUI();
    showGreeting(currentStudent.name);
    
    // Initialize avatar with current student
    const studentAvatar = document.getElementById("studentAvatar");
    if (studentAvatar && currentStudent.name) {
      studentAvatar.innerText = currentStudent.name.charAt(0).toUpperCase();
    }
    
    // Setup dropdown with all required data
    setupDropdown(
      userData.studentList,
      currentStudent.id,
      userData.activeStudent?.id || currentStudent.id,
      async (newStudentId) => {
        showElement(loadingOverlay);
        try {
          const newUserData = await api.switchAndFetchStudentData(
            session.username, 
            session.password, 
            newStudentId
          );
          
          // Update UI with new data
          const newStudent = newUserData.studentList.find(s => s.id === newStudentId);
          if (newStudent) {
            showGreeting(newStudent.name);
            document.getElementById("studentAvatar").innerText = newStudent.name.charAt(0).toUpperCase();
          }
          
          // Update schedule
          const classInfo = await scheduleModule.getCurrentClassInfo(
            session.username,
            session.password,
            null,
            newStudentId,
            newUserData.scheduleReport
          );
          renderSchedule(scheduleContainer, classInfo);

          // Save state
          await chrome.storage.local.set({
            activeStudentId: newStudentId,
            studentName: newStudent?.name || ''
          });

          // Update dropdown UI to reflect new active student
          const dropdown = document.getElementById("studentDropdown");
          if (dropdown) {
            dropdown.querySelectorAll('.student-option').forEach(opt => {
              opt.classList.remove('active', 'current', 'highlighted');
              if (opt.dataset.id === newStudentId) {
                opt.classList.add('active', 'current', 'highlighted');
              }
            });
          }

        } catch (err) {
          console.error("Switch failed:", err);
          alert("Failed to switch student. Please try again.");
        } finally {
          hideElement(loadingOverlay);
        }
      }
    );

    // Save initial state
    await chrome.storage.local.set({
      username: session.username,
      password: session.password,
      activeStudentId: currentStudent.id,
      studentName: currentStudent.name,
      loginTime: Date.now()
    });

    // Show initial schedule
    const classInfo = await scheduleModule.getCurrentClassInfo(
      session.username,
      session.password,
      null,
      currentStudent.id,
      userData.scheduleReport
    );
    renderSchedule(scheduleContainer, classInfo);

    // Setup checkout with current class info and send to database
    setupCheckout(
      { startButtonId: "actionBtn", statusMessageId: "statusMessage" },
      {
        onCheckout: async () => {
          const record = await api.logCheckout({
            studentName: currentStudent.name,
            className: classInfo.className,
            period: parseInt(classInfo.period, 10),
            room: classInfo.room,
            teacher: classInfo.teacher,
            checkoutTime: new Date().toISOString(),
          });
          await api.saveCheckoutId(record.id);
        },
        onCheckin: async durationMs => {
          const checkoutId = await api.getSavedCheckoutId();
          await api.logCheckin({
            checkoutId,
            checkinTime: new Date().toISOString(),
            durationSec: Math.floor(durationMs / 1000),
          });
        }
      },
      api,
      timer,
      updateCheckoutButton
    );

    // Setup logout handler
    const logoutBtn = document.getElementById("logoutBtn");
    logoutBtn?.addEventListener("click", async () => {
      showElement(loadingOverlay);
      try {
        await chrome.storage.local.clear();
        window.location.reload();
      } catch (err) {
        hideElement(loadingOverlay);
        alert("Failed to log out. Please try again.");
      }
    });

    // Show main UI
    hideElement(loadingOverlay);
    showElement(mainAction, "flex");

    debug("Initialization complete");

  } catch (err) {
    console.error("Initialization error:", err);
    debug("Stack trace:", err.stack);
    hideElement(loadingOverlay);
    showElement(loginForm, "flex");
  }
}

// Kick off once the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log("setupDropdown is", setupDropdown);