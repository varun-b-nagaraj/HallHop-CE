import { debug, showElement, hideElement } from './utils.js';
import * as api from './api.js';
import * as timer from '../../modules/timer.js';
import * as scheduleModule from './schedule.js';
import { setupAuth } from './auth.js';
import { setupDropdown, populateStudentDropdown } from './dropdown.js';
import { setupCheckout } from './checkout.js';
import {
  setupUI,
  renderSchedule,
  showGreeting,
  updateCheckoutButton
} from './ui.js';


/**
 * Primary entrypoint for HallHop popup.
 * Initializes authentication, UI animations, dropdowns, schedule rendering,
 * and checkout/check-in behavior in the correct order.
 */
async function init() {
  debug("HallHop initializing...");

  // Only show the login form initially
    const loginForm = document.getElementById("loginForm");
    const mainAction = document.getElementById("mainAction");
    const loadingOverlay = document.getElementById("loading");

  // Make sure loading overlay is hidden by default
    hideElement(loadingOverlay);
    hideElement(mainAction);
    showElement(loginForm, "flex");

  try {
    // 1. Authentication & session restore
    const session = await setupAuth(api);
    let { username, password, studentName, activeStudentId } = session;  // Changed from const to let

    // 2. Apply the general UI polish
    setupUI();

    // 3. Show greeting & avatar
    showGreeting(studentName);

    // 4. Load and render the current class schedule
    const classInfo = await scheduleModule.getCurrentClassInfo(
      username,
      password,
      null,
      activeStudentId
    );
    const scheduleContainer = document.getElementById('scheduleInfo');
    renderSchedule(scheduleContainer, classInfo);

    // Disable checkout button on weekends
    const actionBtn = document.getElementById("actionBtn");
    if (actionBtn && classInfo.message && classInfo.message.includes("weekend")) {
      actionBtn.disabled = true;
      actionBtn.style.opacity = "0.5";
      actionBtn.style.cursor = "not-allowed";
      actionBtn.title = "Checkouts are not available on weekends";
      actionBtn.innerText = "It's the weekend!";
      debug("Set weekend state for checkout button");
    }

    // 5. Wire up the "switch student" dropdown with loading states
    const students = await api.fetchStudentList(username, password);
    
    try {
      // Get current student before setting up dropdown
      const currentStudentRes = await fetch(`${api.API_BASE}/lookup/current`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          base_url: "https://accesscenter.roundrockisd.org"
        })
      });
      
      const currentData = await currentStudentRes.json();
      debug("Current student data:", currentData);

      // Add error checking for currentData
      if (!currentData?.active?.id) {
        debug("No active student ID found in response");
        // Use first student as fallback
        if (students.length > 0) {
          const defaultStudent = students[0];
          activeStudentId = defaultStudent.id;
          debug(`Using first student as default: ${defaultStudent.name} (${defaultStudent.id})`);
          populateStudentDropdown(students, defaultStudent.id, defaultStudent.id);
        }
      } else {
        const currentStudent = students.find(s => s.id === currentData.active.id);
        debug("Found current student:", currentStudent);
        
        if (currentStudent) {
          activeStudentId = currentStudent.id;
          debug(`Setting active student to: ${currentStudent.name} (${currentStudent.id})`);
          populateStudentDropdown(students, currentStudent.id, currentStudent.id);
        }
      }

      setupDropdown(
        students,
        activeStudentId,
        currentData.active?.id || null,
        async (newStudentId, newStudentName) => {
          if (loadingOverlay) {
            showElement(loadingOverlay);
          }
          
          try {
            debug(`Switching to student ${newStudentName} (${newStudentId})`);
            
            // Validate student ID
            if (!newStudentId) {
              throw new Error('Invalid student ID');
            }

            // Validate student exists in list
            const studentExists = students.some(s => s.id === newStudentId);
            if (!studentExists) {
              throw new Error(`Student ID ${newStudentId} not found`);
            }

            const switchRes = await fetch(`${api.API_BASE}/lookup/switch`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                username,
                password,
                base_url: "https://accesscenter.roundrockisd.org",
                student_id: newStudentId  // Changed to match API expectation
              })
            });

            const switchData = await switchRes.json();
            debug("Switch response:", switchData);
            
            if (!switchData.success) {
              throw new Error(switchData.error || "Failed to switch student in HAC");
            }

            // Update UI after successful switch
            showGreeting(newStudentName);
            const avatarEl = document.getElementById("studentAvatar");
            if (avatarEl) {
              avatarEl.innerText = newStudentName.charAt(0).toUpperCase();
            }
            
            // Update dropdown and save state
            populateStudentDropdown(students, newStudentId, newStudentId);
            await chrome.storage.local.set({ 
              activeStudentId: newStudentId,
              studentName: newStudentName 
            });

            // Update schedule display
            const updated = await scheduleModule.getCurrentClassInfo(
              username,
              password,
              null,
              newStudentId
            );
            renderSchedule(scheduleContainer, updated);

          } catch (err) {
            console.error("Failed to switch student:", err);
            debug("Switch error details:", err);
            alert(err.message || "Failed to switch student. Please try again.");
          } finally {
            if (loadingOverlay) {
              hideElement(loadingOverlay);
            }
          }
        }
      );

    } catch (err) {
      console.error("Error getting current student:", err);
      setupDropdown(students, activeStudentId, null, async (newStudentId, newStudentName) => {
        // Show loading during switch
        if (loadingOverlay) {
          showElement(loadingOverlay);
          debug("Showing loading overlay");
        }

        try {
          // Save new active student
          await api.saveActiveStudent(newStudentId);
          showGreeting(newStudentName);

          // Re-fetch & render schedule for the new student
          const updated = await scheduleModule.getCurrentClassInfo(
            username,
            password,
            null,
            newStudentId
          );
          renderSchedule(scheduleContainer, updated);
        } catch (err) {
          console.error("Failed to switch student:", err);
          alert("Failed to switch student. Please try again.");
        } finally {
    if (loadingOverlay) {
      hideElement(loadingOverlay);
            debug("Hiding loading overlay");
    }
  }
      });
}

    // 6. Wire up checkout/check-in button & timer
    setupCheckout(
      { startButtonId: "actionBtn", statusMessageId: "statusMessage" },
      {
          onCheckout: async () => {
          const record = await api.logCheckout({
              studentName,
              className: classInfo.className,
              period:    parseInt(classInfo.period, 10),
              room:      classInfo.room,
              teacher:   classInfo.teacher,
              checkoutTime: new Date().toISOString(),
          });
          await api.saveCheckoutId(record.id);
          },
          onCheckin: async durationMs => {
          const checkoutId = await api.getSavedCheckoutId();
          await api.logCheckin({
              checkoutId,
              checkinTime:  new Date().toISOString(),
              durationSec:  Math.floor(durationMs / 1000),
          });
          }
      },
      api,
      timer,
      updateCheckoutButton
      );

    const logoutBtn = document.getElementById("logoutBtn");
    logoutBtn?.addEventListener("click", async () => {
      debug("Logging out");
      showElement(loadingOverlay);
      try {
        await chrome.storage.local.clear();
        // Small delay to ensure storage is cleared
        await new Promise(resolve => setTimeout(resolve, 500));
        window.location.reload();
      } catch (err) {
        debug("Logout error:", err);
        hideElement(loadingOverlay);
        alert("Failed to log out. Please try again.");
      }
    });

    debug("Initialization steps complete");
    // Add a small delay to ensure all UI updates are complete
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Add these lines at the end of init
    const currentStudentOption = document.querySelector(`.student-option[data-id="${activeStudentId}"]`);
    if (currentStudentOption) {
      currentStudentOption.classList.add('active', 'current', 'highlighted');
      debug(`Highlighted current student option: ${currentStudentOption.dataset.name}`);
    } else {
      debug('Could not find current student option to highlight');
    }

    debug("Initialization complete with current student highlighted");

  } catch (err) {
    console.error("Initialization error:", err);
    debug("Stack trace:", err.stack);
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