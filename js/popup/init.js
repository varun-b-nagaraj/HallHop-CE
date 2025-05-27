import * as api from './api.js';
import * as timer from '../../modules/timer.js';
import * as scheduleModule from './schedule.js';
import { setupAuth } from './auth.js';
import { setupCheckout } from './checkout.js';
import { setupDropdown, populateStudentDropdown } from './dropdown.js';
import { 
  setupUI, renderSchedule, showGreeting, updateCheckoutButton, 
  debug, showElement, hideElement, checkConsent, showConsentModal 
} from './ui.js';

/**
 * Primary entrypoint for popup.
 * Initializes authentication, UI animations, dropdowns, schedule rendering,
 * and checkout/check-in behavior in the correct order.
 */
async function init() {
  debug("HallHop initializing...");
  const consent = await checkConsent();

  if (!consent) {
    showConsentModal();
    return; // Stop init until consent is given
  }

  const loginForm = document.getElementById("loginForm");
  const mainAction = document.getElementById("mainAction");
  const loadingOverlay = document.getElementById("loading");
  const scheduleContainer = document.getElementById('scheduleInfo');

  hideElement(loadingOverlay);
  hideElement(mainAction);
  showElement(loginForm, "flex");

  try {
    const session = await setupAuth(api);
    if (!session?.username || !session?.password) {
      throw new Error("No valid session");
    }

    showElement(loadingOverlay);
    hideElement(loginForm);

    const userData = await api.fetchAllUserData(session.username, session.password);
    if (!userData) throw new Error("Failed to fetch user data");

    const currentStudent = userData.activeStudent?.id ?
      userData.studentList.find(s => s.id === userData.activeStudent.id) :
      userData.studentList[0];

    if (!currentStudent) throw new Error("No student data available");

    setupUI();
    showGreeting(currentStudent.name);

    const studentAvatar = document.getElementById("studentAvatar");
    if (studentAvatar && currentStudent.name) {
      studentAvatar.innerText = currentStudent.name.charAt(0).toUpperCase();
    }

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

          const newStudent = newUserData.studentList.find(s => s.id === newStudentId);
          if (newStudent) {
            showGreeting(newStudent.name);
            document.getElementById("studentAvatar").innerText = newStudent.name.charAt(0).toUpperCase();
          }

          const classInfo = await scheduleModule.getCurrentClassInfo(
            session.username,
            session.password,
            null,
            newStudentId,
            newUserData.scheduleReport
          );
          renderSchedule(scheduleContainer, classInfo);

          await chrome.storage.local.set({
            activeStudentId: newStudentId,
            studentName: newStudent?.name || ''
          });

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

    await chrome.storage.local.set({
      username: session.username,
      password: session.password,
      activeStudentId: currentStudent.id,
      studentName: currentStudent.name,
      loginTime: Date.now()
    });

    const classInfo = await scheduleModule.getCurrentClassInfo(
      session.username,
      session.password,
      null,
      currentStudent.id,
      userData.scheduleReport
    );
    renderSchedule(scheduleContainer, classInfo);

setupCheckout(
  { startButtonId: "actionBtn", statusMessageId: "statusMessage" },
  {
    onCheckout: async () => {
      const record = await api.logCheckout({
        student_id: parseInt(currentStudent.id),
        student_name: currentStudent.name,
        class_name: classInfo.className,
        period: parseInt(classInfo.period, 10),
        room: classInfo.room,
        teacher: classInfo.teacher,
        checkout_time: new Date().toISOString()
      });

      if (record?.id) {
        await api.saveCheckoutId(record.id);
      } else {
        console.warn("⚠️ Could not save checkoutId. Insert failed.");
      }
    },

    onCheckin: async (durationMs) => {
      const checkoutId = await api.getSavedCheckoutId();

      await api.logCheckin({
        checkout_id: checkoutId,
        checkin_time: new Date().toISOString(),
        duration_sec: Math.floor(durationMs / 1000)
      });
    }
  },
  api,
  timer,
  updateCheckoutButton
);


    // Logout: Dropdown + Button trigger logoutUser() from API
    const logoutBtn = document.getElementById("logoutBtn");
    const dropdownLogout = document.querySelector('.student-option.logout');

    const logoutHandler = async () => {
      showElement(loadingOverlay);
      try {
        await api.logoutUser(); // Centralized logout logic
      } catch (err) {
        console.error("Logout error:", err);
        alert("Failed to log out. Please try again.");
        hideElement(loadingOverlay);
      }
    };

    logoutBtn?.addEventListener("click", logoutHandler);
    dropdownLogout?.addEventListener("click", logoutHandler);

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

// DOM Ready kickoff
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

console.log("setupDropdown is", setupDropdown);
