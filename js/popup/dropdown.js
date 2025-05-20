// Code for the student switching dropdownå
import { debug, hideModal } from "./ui.js";

let activeStudentId = null;
let pendingId = null;
let pendingName = null;

/**
 * Populate the dropdown menu DOM with student options + logout.
 * @param {Array<{id:string,name:string}>} students - List of students is expected as an array with id(no s) and name
 * @param {string} activeId - A local ID of the active student specific to the extension
 * @param {string} currentId - Currently selected student in HAC
 */

// takes the list of students, as well as the active and current IDs
export function populateStudentDropdown(students, initialActiveId, initialCurrentId) {
  const dropdown = document.getElementById("studentDropdown");
  if (!dropdown) return;

  // Make IDs mutable
  let activeId = initialActiveId;
  let currentId = initialCurrentId;

  // If no current/active ID is set, use first student
  if (!currentId && !activeId && students.length > 0) {
    currentId = students[0].id;
    activeId = students[0].id;
    debug(`No active student, using first student: ${students[0].name} (${students[0].id})`);
  }
  // Building the list of students for the dropdown menu
  const options = students.map(student => {
    const isSelected = student.id === (currentId || activeId);
    const initial = student.name.charAt(0).toUpperCase();

    return `
      <div class="student-option ${isSelected ? 'active selected' : ''}"
           data-id="${student.id}"
           data-name="${student.name}">
        <span class="student-initial">${initial}</span>
        <span class="student-name">${student.name}</span>
      </div>
    `;
  }).join('');

  // Add logout option
  dropdown.innerHTML = options + `
    <div class="student-option logout" data-action="logout">
      <span class="student-name">Logout</span>
    </div>
  `;

  // Attach click handlers
  dropdown.querySelectorAll(".student-option").forEach(opt => {
    opt.addEventListener("click", e => {
      e.stopPropagation();
      // When logout is clicked, clear local storeage as well as reload the page
      if (opt.dataset.action === "logout") {
        debug("Dropdown: logout clicked");
        chrome.storage.local.clear();
        window.location.reload();
        return;
      }
      // Switch student to the selected option within the dropdown
      // Stored name and ID as attributes on .student-option element
      const id   = opt.dataset.id;
      const name = opt.dataset.name;
      // If user selects a different ID, showing confirmation modal to ensure they want to switch
      if (id !== activeStudentId) {
        pendingId   = id;
        pendingName = name;
        showConfirmStudentSwitch();
      } else {
        // If selecting the same ID, just close the dropdown to save redundancy
        closeStudentDropdown();
      }
    });
  });
}

  // Highlight the active student
export function highlightCurrentStudent(studentId) {
  const dropdown = document.getElementById("studentDropdown");
  if (!dropdown) return;

  debug(`Highlighting student: ${studentId}`);

  // Remove existing highlight from all options
  dropdown.querySelectorAll('.student-option').forEach(opt => {
    opt.classList.remove('active', 'current', 'highlighted');
  });

  // Find and highlight the active student
  const currentOption = dropdown.querySelector(`.student-option[data-id="${studentId}"]`);
  if (currentOption) {
    currentOption.classList.add('active', 'current', 'highlighted');
    debug(`Highlighted current student: ${currentOption.dataset.name}`);

    // Update avatar when highlighting new student
    const studentAvatar = document.getElementById("studentAvatar");
    if (studentAvatar && currentOption.dataset.name) {
      studentAvatar.innerText = currentOption.dataset.name.charAt(0).toUpperCase();
    }
  } else {
    debug(`Failed to find student option for ID: ${studentId}`);
  }
}

/*
 * Wire up the avatar toggle, outside-click close, and confirm modal buttons.
 * @param {() => void} handleStudentSwitch  Called when “Switch” is confirmed.
 */
export function setupDropdownHandlers(handleStudentSwitch) {
  // Initializing elements
  const avatar = document.getElementById("studentAvatar");
  const dropdown = document.getElementById("studentDropdown");
  const confirmOk = document.getElementById("confirmOk");
  const confirmCancel = document.getElementById("confirmCancel");
  const confirmModal = document.getElementById("confirmModal");

  if (!avatar || !dropdown) {
    debug("Critical elements missing for dropdown");
    return;
  }

  debug("Setting up dropdown handlers");

  // Avatar opens/closes with proper event handling
  avatar.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    debug("Avatar clicked, toggling dropdown");
    toggleStudentDropdown();
  });

  // Modify outside click handler to check target more carefully
  document.addEventListener("click", (e) => {
    // Don't close if clicking the avatar or within the dropdown
    if (avatar.contains(e.target) || dropdown.contains(e.target)) {
      return;
    }
    debug("Click outside, closing dropdown");
    closeStudentDropdown();
  });

  // Prevent dropdown clicks from bubbling - moving up the DOM
  dropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Confirm switch
  if (confirmOk && confirmModal) {
    confirmOk.addEventListener("click", async () => {
      try {
        debug("Starting student switch");
        hideModal(confirmModal);
        closeStudentDropdown();

        // Call handler with pending student info
        await handleStudentSwitch(pendingId, pendingName);

        // Clear pending state
        pendingId = null;
        pendingName = null;

      } catch (err) {
        console.error("Switch error:", err);
        alert("Failed to switch student. Please try again.");
      }
    });
  }

  // Cancel switch
  if (confirmCancel && confirmModal) {
    confirmCancel.addEventListener("click", () => {
      debug("Switch cancelled");
      hideModal(confirmModal);
      closeStudentDropdown();
    });
  }
}

// Toggle the student dropdown
export function toggleStudentDropdown() {
  const avatar = document.getElementById("studentAvatar");
  const dropdown = document.getElementById("studentDropdown");

  if (!avatar || !dropdown) {
    debug("Missing elements for toggle");
    return;
  }

  const isOpen = dropdown.classList.contains("show");
  debug(`Toggling dropdown: ${isOpen ? 'closing' : 'opening'}`);

  // Add a small delay to ensure classes are toggled properly
  if (isOpen) {
    closeStudentDropdown();
  } else {
    avatar.classList.add("active");
    dropdown.classList.add("show");
    debug("Dropdown opened");
  }
}

// Close the student dropdown
export function closeStudentDropdown() {
  const avatar   = document.getElementById("studentAvatar");
  const dropdown = document.getElementById("studentDropdown");
  if (avatar && dropdown) {
    avatar.classList.remove("active");
    dropdown.classList.remove("show");
  }
}

// Showing the “Are you sure?” modal for switching students
function showConfirmStudentSwitch() {
  const confirmModal   = document.getElementById("confirmModal");
  const confirmMessage = document.getElementById("confirmMessage");
  if (!confirmModal || !confirmMessage) {
    debug("showConfirmStudentSwitch: missing modal elements");
    return;
  }
  confirmMessage.innerText = `Switch to ${pendingName}?`;
  confirmModal.classList.add("visible");
  closeStudentDropdown();
}

// Populate + handlers in one call
export function setupDropdown(students, activeId, currentId, handleStudentSwitch) {
  debug(`Setting up dropdown - Active: ${activeId}, Current: ${currentId}`);
  populateStudentDropdown(students, activeId, currentId);
  setupDropdownHandlers(handleStudentSwitch);

  // Add final highlight check
  setTimeout(() => {
    highlightCurrentStudent(currentId || activeId);
    debug('Performed final highlight check after setup');
  }, 200);
}