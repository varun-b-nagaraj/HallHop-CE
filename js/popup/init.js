import * as api from './api.js';
import * as timer from '../../modules/timer.js';
import * as scheduleModule from './schedule.js';
import { setupAuth } from './auth.js';
import { setupDropdown, populateStudentDropdown } from './dropdown.js';
import { setupCheckout } from './checkout.js';
import { setupUI, renderSchedule, showGreeting, updateCheckoutButton, debug, showElement, hideElement } from './ui.js';


/**
 * Primary entrypoint for HallHop popup.
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
    // 1. Wait for auth before doing anything else
    const session = await setupAuth(api);
    if (!session?.username || !session?.password) {
      throw new Error("No valid session");
    }

    // 2. Show loading state
    showElement(loadingOverlay);
    hideElement(loginForm);

    // 3. Fetch all initial data in parallel
    const userData = await api.fetchAllUserData(session.username, session.password);
    if (!userData) throw new Error("Failed to fetch user data");

    // 4. Process student data
    const currentStudent = userData.activeStudent?.id ? 
      userData.studentList.find(s => s.id === userData.activeStudent.id) : 
      userData.studentList[0];

    if (!currentStudent) throw new Error("No student data available");

    // 5. Set up UI and display data
    setupUI();
    showGreeting(currentStudent.name);
    
    // 6. Setup dropdown with all required data
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
          showGreeting(newUserData.studentInfo.name);
          
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
            studentName: newUserData.studentInfo.name
          });
        } catch (err) {
          console.error("Switch failed:", err);
          alert("Failed to switch student. Please try again.");
        } finally {
          hideElement(loadingOverlay);
        }
      }
    );

    // 7. Save initial state
    await chrome.storage.local.set({
      username: session.username,
      password: session.password,
      activeStudentId: currentStudent.id,
      studentName: currentStudent.name,
      loginTime: Date.now()
    });

    // 8. Show initial schedule
    const classInfo = await scheduleModule.getCurrentClassInfo(
      session.username,
      session.password,
      null,
      currentStudent.id,
      userData.scheduleReport
    );
    renderSchedule(scheduleContainer, classInfo);

    // 9. Setup checkout with current class info
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

    // 10. Setup logout handler
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

    // 11. Show main UI
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