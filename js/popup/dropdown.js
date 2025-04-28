import { debug, hideModal } from "./ui.js";

let activeStudentId = null;
let pendingId = null;
let pendingName = null;

/**
 * Populate the dropdown menu DOM with student options + logout.
 * @param {Array<{id:string,name:string}>} students
 * @param {string} activeId
 * @param {string} currentId - Currently selected student in HAC
 */
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
      // Logout?
      if (opt.dataset.action === "logout") {
        debug("Dropdown: logout clicked");
        chrome.storage.local.clear();
        window.location.reload();
        return;
      }
      // Switch student
      const id   = opt.dataset.id;
      const name = opt.dataset.name;
      if (id !== activeStudentId) {
        pendingId   = id;
        pendingName = name;
        showConfirmStudentSwitch();
      } else {
        closeStudentDropdown();
      }
    });
  });

  // Add immediate highlight check
  requestAnimationFrame(() => {
    const currentOption = dropdown.querySelector(`.student-option[data-id="${currentId}"]`);
    if (currentOption) {
      currentOption.classList.add('active', 'current', 'highlighted');
      debug(`Highlighted current student: ${currentOption.dataset.name}`);
    } else {
      debug(`Failed to find student option for ID: ${currentId}`);
    }
  });
}

// Add this helper function
export function highlightCurrentStudent(studentId) {
  const dropdown = document.getElementById("studentDropdown");
  if (!dropdown) return;

  debug(`Highlighting student: ${studentId}`);
  dropdown.querySelectorAll('.student-option').forEach(opt => {
    opt.classList.remove('active', 'current', 'highlighted');
    if (opt.dataset.id === studentId) {
      opt.classList.add('active', 'current', 'highlighted');
      debug(`Highlighted student: ${opt.dataset.name}`);
    }
  });
}

/**
 * Wire up the avatar toggle, outside-click close, and confirm modal buttons.
 * @param {() => void} handleStudentSwitch  Called when “Switch” is confirmed.
 */
export function setupDropdownHandlers(handleStudentSwitch) {
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

  // Prevent dropdown clicks from bubbling
  dropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // Student option clicks
  dropdown.querySelectorAll(".student-option").forEach(opt => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      
      // Logout handling
      if (opt.dataset.action === "logout") {
        debug("Logout option clicked");
        chrome.storage.local.clear();
        window.location.reload();
        return;
      }

      // Switch student handling
      const id = opt.dataset.id;
      const name = opt.dataset.name;
      if (id && id !== activeStudentId) {
        debug(`Student option clicked: ${name} (${id})`);
        pendingId = id;
        pendingName = name;
        showConfirmStudentSwitch();
      } else {
        closeStudentDropdown();
      }
    });
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
  setTimeout(() => {
    if (isOpen) {
      closeStudentDropdown();
    } else {
      avatar.classList.add("active");
      dropdown.classList.add("show");
      debug("Dropdown opened");
    }
  }, 0);
}

/** Close the student dropdown */
export function closeStudentDropdown() {
  const avatar   = document.getElementById("studentAvatar");
  const dropdown = document.getElementById("studentDropdown");
  if (avatar && dropdown) {
    avatar.classList.remove("active");
    dropdown.classList.remove("show");
  }
}

// Update dropdown highlighting
export function updateActiveStudentInDropdown(newActiveId) {
  const dropdown = document.getElementById("studentDropdown");
  if (!dropdown) return;

  debug(`Updating active student in dropdown: ${newActiveId}`);
  
  dropdown.querySelectorAll('.student-option').forEach(opt => {
    opt.classList.remove('active');
    if (opt.dataset.id === newActiveId) {
      opt.classList.add('active');
      debug(`Set active class on student: ${opt.dataset.name}`);
    }
  });
}

// --- Internal helper ---

/** Show the “Are you sure?” modal for switching students */
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

/**
 * Convenience: populate + handlers in one call
 */
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

