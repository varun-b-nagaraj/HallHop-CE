(function() {
  'use strict';
  
  // DEBUG MODE
  const DEBUG = true;
  
  function debug(...args) {
    if (DEBUG) {
      console.log("[HallHop Debug]", ...args);
    }
  }
  
  debug("Script loaded");
  const API_BASE = "https://hacapi-hh.onrender.com";
  /**
 * Try POST first; if that fails, fall back to GET.
 */
  async function fetchStudentName(username, password) {
    const postUrl = "https://hacapi-hh.onrender.com/api/getInfo";
    const getUrl  = postUrl +
      `?user=${encodeURIComponent(username)}` +
      `&pass=${encodeURIComponent(password)}`;
  
    // Try POST first
    try {
      const postRes = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: username, pass: password })
      });
      if (!postRes.ok) throw new Error(`POST ${postRes.status}`);
      const data = await postRes.json();
      return { name: data?.name || null };
    } catch (postErr) {
      debug("POST failed, falling back to GET:", postErr);
  
      // Fallback to GET
      const getRes = await fetch(getUrl);
      if (!getRes.ok) throw new Error(`GET ${getRes.status}`);
      const data = await getRes.json();
      return { name: data?.name || null };
    }
  }
  
  
  // Fix for module loading issue
  async function loadModules() {
    try {
      debug("Attempting to load modules...");
      
      // First try to import from window.hallhopModules if available
      if (window.hallhopModules?.api?.getStudentName) {
        debug("Using pre-loaded API module");
        return window.hallhopModules;
      }
      
      // If there's a global fallback for the API, use it
      if (window.hallhopAPI?.getStudentName) {
        debug("Using global API fallback");
        return {
          api: window.hallhopAPI,
          timer: { startTimer, stopTimer, formatDuration },
          schedule: { getCurrentClassInfo }
        };
      }
      
      // Otherwise try dynamic import
      debug("Attempting dynamic import of ./api.js");
      const apiModule = await import("./api.js");
      debug("API module loaded via import:", apiModule);
      
      const timerModule = await import("./timer.js");
      const scheduleModule = await import("./schedule.js");
      
      return {
        api: apiModule,
        timer: timerModule,
        schedule: scheduleModule
      };
    } catch (err) {
      console.error("Failed to load modules:", err);
      debug("Module loading error:", err.message, err.stack);
      
      // Last resort fallbacks
      return {
        api: {
          getStudentName: fetchStudentName
        },
        timer: { startTimer, stopTimer, formatDuration },
        schedule: { getCurrentClassInfo }
      };
    }
  }
  
  // Original module imports - keeping these as stubs until we load modules properly
  let getStudentName;
  let startTimer, stopTimer, formatDuration;
  let getCurrentClassInfo;
  
  // Constants
  // State variables
let username, password;
let activeStudentId = null;
let studentName = "";
  let students = [];
let classInfo = null;
let pendingId = null, pendingName = "";
let checkedOut = false;
let timerStopper = null;
  let isDropdownOpen = false;

  // Main initialization - with module loading first
  async function init() {
    try {
      debug("HallHop initializing...");
      
      // Load modules first
      const modules = await loadModules();
      getStudentName = modules.api.getStudentName;
      startTimer = modules.timer.startTimer;
      stopTimer = modules.timer.stopTimer;
      formatDuration = modules.timer.formatDuration;
      getCurrentClassInfo = modules.schedule.getCurrentClassInfo;
      
      debug("Modules loaded successfully");
      
      // Make sure avatar is visible
      const studentAvatar = document.getElementById("studentAvatar");
      if (studentAvatar) {
        studentAvatar.style.display = "flex";
        debug("Made student avatar visible");
      }
      
      // Hide main UI until logged in
      const mainAction = document.getElementById("mainAction");
      if (mainAction) {
        mainAction.style.display = "none";
      }
      
      // Make sure login form is visible initially
      const loginForm = document.getElementById("loginForm");
      if (loginForm) {
        loginForm.style.display = "flex";
        
        // Add form submission event to allow Enter key to work
        loginForm.addEventListener("submit", function(e) {
          e.preventDefault();
          handleLogin();
        });
      }
      
      // Add dropdown default HTML
      populateDefaultDropdown();
      
      // Setup UI and event listeners
      setupUI();
      setupEventListeners();
      
      // Restore session if valid
      restoreSession();
      
    } catch (err) {
      console.error("Initialization error:", err);
      debug("Stack trace:", err.stack);
    }
  }
  
  // Create a default dropdown with placeholder items to ensure the structure exists
  function populateDefaultDropdown() {
    const dropdown = document.getElementById("studentDropdown");
    if (!dropdown) {
      debug("Student dropdown element not found");
      return;
    }
    
    // If the dropdown is empty, add placeholder elements
    if (!dropdown.innerHTML.trim()) {
      dropdown.innerHTML = `
        <div class="student-option placeholder">No additional students</div>
      `;
    }
    
    debug("Added default content to student dropdown");
  }
  
  // Setup UI elements
  function setupUI() {
    // Add cursor tracking for animations
    document.addEventListener('mousemove', updateHeaderColor);
    
    // Setup card hover effects
    document.querySelectorAll('.card').forEach(card => {
      card.addEventListener('mousemove', updateCardGradient);
      card.addEventListener('mouseleave', () => {
        card.style.setProperty('--x', '0px');
        card.style.setProperty('--y', '0px');
      });
    });
    
    // Add ripple effect to buttons
    document.querySelectorAll('button').forEach(button => {
      button.addEventListener('click', createRippleEffect);
    });
  }
  
  // Set up all event listeners
  function setupEventListeners() {
    // Login button
    const checkBtn = document.getElementById("checkBtn");
    if (checkBtn) {
      checkBtn.addEventListener("click", handleLogin);
    }
    
    // Username/password fields - listen for Enter key
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    
    if (usernameInput) {
      usernameInput.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (passwordInput) passwordInput.focus();
        }
      });
    }
    
    if (passwordInput) {
      passwordInput.addEventListener("keypress", function(e) {
        if (e.key === "Enter") {
          e.preventDefault();
          handleLogin();
        }
      });
    }
    
    // Student avatar for dropdown
    const studentAvatar = document.getElementById("studentAvatar");
    if (studentAvatar) {
      studentAvatar.addEventListener("click", toggleStudentDropdown);
      
      // Make sure the avatar is visible
      if (studentName) {
        studentAvatar.style.display = "flex";
      }
    }
    
    // Checkout/checkin button
    const actionBtn = document.getElementById("actionBtn");
    if (actionBtn) {
      actionBtn.addEventListener("click", handleCheckoutCheckin);
    }
    
    // Logout button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        debug("Logging out");
        chrome.storage.local.clear();
        window.location.reload();
      });
    }
    
    // Confirm buttons in modal
    const confirmOk = document.getElementById("confirmOk");
    const confirmCancel = document.getElementById("confirmCancel");
    const confirmModal = document.getElementById("confirmModal");
    
    if (confirmOk) {
      confirmOk.addEventListener("click", () => {
        debug("Student switch confirmed");
        handleStudentSwitch();
      });
    }
    
    if (confirmCancel) {
      confirmCancel.addEventListener("click", () => {
        debug("Student switch cancelled");
        hideModal(confirmModal);
      });
    }
    
    // Close modal when clicking outside
    if (confirmModal) {
      confirmModal.addEventListener("click", (e) => {
        // Check if the click was directly on the modal overlay (not on the modal content)
        if (e.target === confirmModal) {
          debug("Clicked outside of modal content, closing modal");
          hideModal(confirmModal);
        }
      });
    }
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const studentAvatar = document.getElementById("studentAvatar");
      const studentDropdown = document.getElementById("studentDropdown");
      
      if (studentAvatar && studentDropdown) {
        if (!studentAvatar.contains(e.target) && !studentDropdown.contains(e.target)) {
          closeStudentDropdown();
        }
      }
    });
  }
  
  // Toggle student dropdown
  function toggleStudentDropdown(e) {
    if (e) e.stopPropagation(); // Prevent event bubbling
    
    const dropdown = document.getElementById("studentDropdown");
    const studentAvatar = document.getElementById("studentAvatar");
    
    if (!dropdown || !studentAvatar) {
      debug("Could not find dropdown or student avatar elements");
      return;
    }
    
    // Check if the dropdown is open
    const isOpen = dropdown.classList.contains('show');
    
    debug(`Toggle dropdown. Current state: ${isOpen ? 'open' : 'closed'}`);
    
    if (isOpen) {
      // Close the dropdown
      studentAvatar.classList.remove('active');
      dropdown.classList.remove('show');
      debug("Student dropdown closed");
    } else {
      // Open the dropdown
      studentAvatar.classList.add('active');
      dropdown.classList.add('show');
      debug("Student dropdown opened");
    }
  }
  
  function closeStudentDropdown() {
    const dropdown = document.getElementById("studentDropdown");
    const studentAvatar = document.getElementById("studentAvatar");
    
    if (!dropdown || !studentAvatar) return;
    
    studentAvatar.classList.remove('active');
    dropdown.classList.remove('show');
    debug("Student dropdown closed");
  }
  
  // Populate student dropdown with correct HTML structure
  function populateStudentDropdown() {
    const dropdown = document.getElementById("studentDropdown");
    if (!dropdown) {
      debug("Dropdown element not found");
      return;
    }
    
    if (students.length === 0) {
      debug("No students available for dropdown");
      dropdown.innerHTML = '<div class="student-option placeholder">No additional students</div>';
      // Still add logout option even if no students
      dropdown.innerHTML += `
        <div class="student-option logout" data-action="logout">
          <span class="student-name">Logout</span>
        </div>
      `;
      return;
    }
    
    debug(`Populating dropdown with ${students.length} students`);
    
    const options = students.map(student => {
      const isActive = student.id === activeStudentId;
      const firstLetter = student.name.charAt(0).toUpperCase();
      return `
        <div class="student-option ${isActive ? 'active' : ''}" data-id="${student.id}" data-name="${student.name}">
          <span class="student-initial">${firstLetter}</span>
          <span class="student-name">${student.name}</span>
        </div>
      `;
    }).join('');
    
    // Add logout option to dropdown
    const logoutOption = `
      <div class="student-option logout" data-action="logout">
        <span class="student-name">Logout</span>
      </div>
    `;
    
    dropdown.innerHTML = options + logoutOption;
    debug("Dropdown HTML updated with options and logout");
    
    // Add click handlers to options
    dropdown.querySelectorAll('.student-option:not(.placeholder)').forEach(option => {
      option.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent event bubbling
        
        // Handle logout action
        if (option.dataset.action === "logout") {
          debug("Logging out from dropdown");
          chrome.storage.local.clear();
          window.location.reload();
          return;
        }
        
        const targetId = option.dataset.id;
        const targetName = option.dataset.name;
        
        if (targetId !== activeStudentId) {
          pendingId = targetId;
          pendingName = targetName;
          showConfirmStudentSwitch();
        } else {
          closeStudentDropdown();
        }
      });
    });
    
    debug("Student dropdown populated and event handlers attached");
  }
  
  // Update the active student in dropdown
  function updateActiveStudentInDropdown() {
    const dropdown = document.getElementById("studentDropdown");
    if (!dropdown) return;
    
    dropdown.querySelectorAll('.student-option').forEach(option => {
      if (option.dataset.id === activeStudentId) {
        option.classList.add('active');
      } else {
        option.classList.remove('active');
      }
    });
  }
  
  // Show confirm student switch modal
  function showConfirmStudentSwitch() {
    const confirmMessage = document.getElementById("confirmMessage");
    const confirmModal = document.getElementById("confirmModal");
    
    if (!confirmMessage || !confirmModal) return;
    
    confirmMessage.innerText = `Switch to ${pendingName}?`;
    confirmModal.classList.add('visible');
    closeStudentDropdown();
    
    debug("Showing student switch confirmation modal");
  }
  
  // Animation functions
  function updateHeaderColor(e) {
    const header = document.querySelector('.app-header');
    if (!header) return;
    
    const rect = header.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      header.style.setProperty('--x', `${x}px`);
      header.style.setProperty('--y', `${y}px`);
      
      // Calculate hue based on mouse position - keep the effect small and subtle
      const hue = Math.floor((x / rect.width) * 30) + 210; // Much smaller range: 210-240 for blue hues
      header.style.setProperty('--hue', hue);
      header.style.setProperty('--opacity', '1');
    } else {
      header.style.setProperty('--opacity', '0');
    }
  }
  
  function updateCardGradient(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    card.style.setProperty('--x', `${x}px`);
    card.style.setProperty('--y', `${y}px`);
  }
  
  function createRippleEffect(e) {
    const button = e.currentTarget;
    button.classList.remove('ripple');
    
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    button.style.setProperty('--x', `${x}px`);
    button.style.setProperty('--y', `${y}px`);
    
    // Trigger reflow
    void button.offsetWidth;
    button.classList.add('ripple');
  }
  
  // Utility functions with enhanced transitions
  function showElement(elem, displayType = 'block') {
    if (elem) {
      if (elem.classList.contains('loading-overlay') || 
          elem.classList.contains('modal-overlay')) {
        elem.classList.add('visible');
      } else if (elem.id === 'mainAction') {
        // Apply animation for main UI
        elem.style.display = displayType === 'flex' ? 'flex' : displayType;
        // Trigger reflow
        void elem.offsetWidth;
        elem.classList.add('showing');
        elem.classList.add('page-transition-out');
      } else if (elem.id === 'loginForm') {
        // Apply animation for login form
        elem.style.display = displayType === 'flex' ? 'flex' : displayType;
        // Remove hiding class if present
        elem.classList.remove('hiding');
        elem.classList.add('page-transition-in');
      } else {
        elem.style.display = displayType === 'flex' ? 'flex' : displayType;
      }
    }
  }
  
  function hideElement(elem) {
    if (elem) {
      if (elem.classList.contains('loading-overlay') || 
          elem.classList.contains('modal-overlay')) {
        elem.classList.remove('visible');
      } else if (elem.id === 'loginForm') {
        // Animate login form out
        elem.classList.add('hiding');
        // Set a timeout to actually hide it after animation completes
        setTimeout(() => {
          if (elem.classList.contains('hiding')) {
            elem.style.display = 'none';
          }
        }, 400); // Match the CSS transition time
      } else if (elem.id === 'mainAction') {
        // Remove showing class first
        elem.classList.remove('showing');
        // Then hide after animation completes
        setTimeout(() => {
          if (!elem.classList.contains('showing')) {
            elem.style.display = 'none';
          }
        }, 400); // Match the CSS transition time
      } else {
        elem.style.display = 'none';
      }
    }
  }
  
  // Restore session from storage
  function restoreSession() {
    const actionBtn = document.getElementById("actionBtn");
    const loginForm = document.getElementById("loginForm");
    const mainAction = document.getElementById("mainAction");
    const studentAvatar = document.getElementById("studentAvatar");
    
    debug("Checking for saved session...");
    
  chrome.storage.local.get(
      ["username","password","loginTime","activeStudentId","checkedOut","startTime", "studentName"],
    data => {
        debug("Session data retrieved:", Object.keys(data));
        
        if (data.username && Date.now() - data.loginTime < 30*60*1000) {
          debug(`Valid session found for student ID: ${data.activeStudentId}`);
        username = data.username;
        password = data.password;
        activeStudentId = data.activeStudentId;
          studentName = data.studentName || "";
        checkedOut = data.checkedOut || false;

          // Hide login form and show main UI
          hideElement(loginForm);
          showElement(mainAction, 'flex');
          
          // Set avatar letter
          if (studentAvatar && studentName) {
            const firstLetter = studentName.charAt(0).toUpperCase();
            studentAvatar.innerText = firstLetter;
            studentAvatar.style.display = "flex";
            debug(`Restored avatar with first letter: ${firstLetter}`);
          }

          // Resume timer if checked out
          if (checkedOut && data.startTime && actionBtn) {
            debug("Resuming checkout timer");
          timerStopper = startTimer(d => {
              actionBtn.innerText = `Checked Out (${formatDuration(d)})`;
          }, data.startTime);
            actionBtn.style.backgroundColor = "var(--danger)";
          }

          loadUserData();
        } else {
          debug("No valid session found or session expired");
          showLoginForm();
        }
      }
    );
  }
  
  function showLoginForm() {
    const loginForm = document.getElementById("loginForm");
    const mainAction = document.getElementById("mainAction");
    
    // Hide main UI
    hideElement(mainAction);
    
    // Show login form
    showElement(loginForm, 'flex');
  }
  
  // Handle login
  async function handleLogin() {
    const loginForm = document.getElementById("loginForm");
    const loadingOverlay = document.getElementById("loading");
    const mainAction = document.getElementById("mainAction");
    const studentAvatar = document.getElementById("studentAvatar");
    
    debug("Login attempt started");
    
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    
    username = usernameInput?.value?.trim() || "";
    password = passwordInput?.value || "";
    debug(`Login with username: ${username.substring(0, 2)}***`);
    
    if (!username || !password) { 
      debug("Missing credentials");
      alert("Enter credentials"); 
      return;
    }

    hideElement(loginForm);
    showElement(loadingOverlay);

    try {
      debug("Fetching student name from API");
      debug("getStudentName is a function:", typeof getStudentName === 'function');
      
      if (typeof getStudentName !== 'function') {
        throw new Error("getStudentName is not available - module loading failure");
      }
      
      const res = await getStudentName(username, password);
      debug("API response:", res);
      
      if (!res?.name) {
        throw new Error("Login failed - no name returned");
      }
      
    studentName = res.name;
      debug(`Login successful for: ${studentName}`);
      chrome.storage.local.set({ username, password, loginTime: Date.now(), studentName });
      
      // Set avatar letter
      if (studentAvatar && studentName) {
        const firstLetter = studentName.charAt(0).toUpperCase();
        studentAvatar.innerText = firstLetter;
        studentAvatar.style.display = "flex";
        debug(`Updated avatar with first letter: ${firstLetter}`);
      }
      
      // Show main UI after successful login
      showElement(mainAction, 'flex');
      loadUserData();
      
    } catch (err) {
      console.error("Login error:", err);
      debug("Login error details:", err.message);
      alert("Login failed: " + err.message);
      hideElement(loadingOverlay);
      showElement(loginForm, 'flex');
    }
  }
  
  // Load user data after login
  async function loadUserData() {
    const greeting = document.getElementById("greeting");
    const loadingOverlay = document.getElementById("loading");
    const mainAction = document.getElementById("mainAction");
    const scheduleInfo = document.getElementById("scheduleInfo");
    const studentAvatar = document.getElementById("studentAvatar");
    
    try {
      debug("Loading user data started");
      showElement(loadingOverlay);
      
      // 1. Get schedule data
      try {
        debug(`Fetching schedule for student ID: ${activeStudentId}`);
    classInfo = await getCurrentClassInfo(
          username, password, null, activeStudentId
    );
        debug("Schedule info received:", classInfo);
      } catch (err) {
        console.error("Error fetching schedule:", err);
        debug("Schedule fetch error:", err.message);
      }

      // 2. Update greeting and avatar
      if (greeting) {
    greeting.innerText = `Hey, ${studentName}`;
        debug(`Updated greeting for: ${studentName}`);
      }
      
      // Update avatar with first letter of name
      if (studentAvatar && studentName) {
        const firstLetter = studentName.charAt(0).toUpperCase();
        studentAvatar.innerText = firstLetter;
        debug(`Updated avatar with first letter: ${firstLetter}`);
      }
      
      // 3. Fetch student list
      try {
        debug("Fetching student list");
    const listRes = await fetch(`${API_BASE}/lookup/students`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        username, password,
            base_url: "https://accesscenter.roundrockisd.org"
      })
    });
        
        const studentData = await listRes.json();
        debug("Student list retrieved:", studentData);
        students = studentData.students || [];
        debug(`Found ${students.length} students`);
        
        // Populate student dropdown
        populateStudentDropdown();
        
        // 4. Get current active student
        debug("Fetching current active student");
    const curRes = await fetch(`${API_BASE}/lookup/current`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        username, password,
            base_url: "https://accesscenter.roundrockisd.org"
      })
    });
        
        const activeData = await curRes.json();
        debug("Active student data:", activeData);
        const { active={} } = activeData;
        
        if (active.name && students.length > 0) {
          debug(`Found active student: ${active.name}`);
          const found = students.find(s => s.name === active.name);
          if (found) {
            debug(`Setting active student ID to: ${found.id}`);
        activeStudentId = found.id;
            if (greeting) {
        greeting.innerText = `Hey, ${found.name}`;
              studentName = found.name;
              debug(`Updated greeting to: ${found.name}`);
            }
            chrome.storage.local.set({ activeStudentId, studentName });
            
            // Update active student in dropdown
            updateActiveStudentInDropdown();
          } else {
            debug(`Active student not found in list`);
          }
        } else {
          debug("No active student found or student list empty");
        }
      } catch (err) {
        console.error("Error fetching student data:", err);
        debug("Student data error:", err.message, err.stack);
      }

      // 5. Render schedule
      debug("Rendering schedule");
      renderSchedule(scheduleInfo);
      
      // 6. Show main UI
      hideElement(loadingOverlay);
      showElement(mainAction, 'flex');
      debug("Main action area displayed");
      
    } catch (err) {
      console.error("Error loading user data:", err);
      debug("User data error details:", err.message, err.stack);
      hideElement(loadingOverlay);
      alert("Failed to load your data. Please try again.");
    }
  }
  
  // Handle checkout/checkin
  async function handleCheckoutCheckin() {
    const actionBtn = document.getElementById("actionBtn");
    const statusMessage = document.getElementById("statusMessage");
    
    if (!actionBtn || !statusMessage || !classInfo) {
      debug("Missing required elements for checkout/checkin");
      return;
    }

    if (!checkedOut) {
      // CHECKOUT
      debug("Starting checkout process");
      debug("Current class info:", classInfo);
      
      checkedOut = true;
      actionBtn.style.backgroundColor = "var(--danger)";
      timerStopper = startTimer(duration => {
        actionBtn.innerText = `Checked Out (${formatDuration(duration)})`;
      });
      statusMessage.innerText = "";

      try {
      const payload = {
        student_name: studentName,
          class_name: classInfo.className || "Unknown",
          period: parseInt(classInfo.period) || 0,
          room: classInfo.room || "Unknown",
          teacher: classInfo.teacher || "Unknown",
        checkout_time: new Date().toISOString()
      };
        
        debug("Checkout payload:", payload);
        
      const resp = await fetch(`${API_BASE}/logs/checkout`, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
        body: JSON.stringify(payload)
      });
        
      const record = await resp.json();
        debug("Checkout record created:", record);
        
      chrome.storage.local.set({
        checkoutId: record.id,
          startTime: Date.now(),
        checkedOut: true
      });
        debug("Checkout state saved");
      } catch (err) {
        console.error("Checkout error:", err);
        debug("Checkout error details:", err.message, err.stack);
      }
    } else {
      // CHECKIN
      debug("Starting checkin process");
      
      checkedOut = false;
      const duration = stopTimer(timerStopper);
      actionBtn.innerText = "Check Out";
      actionBtn.style.backgroundColor = "var(--success)";
      statusMessage.innerText = `You've been out for ${formatDuration(duration)}.`;
      debug(`Check-in after duration: ${duration}ms`);

      chrome.storage.local.get(["checkoutId"], async ({ checkoutId }) => {
        if (!checkoutId) {
          debug("No checkoutId found for checkin");
          return;
        }
        
        debug(`Processing check-in for checkout ID: ${checkoutId}`);
        
        const payload = {
          checkout_id: checkoutId,
          checkin_time: new Date().toISOString(),
          duration_sec: Math.floor(duration/1000)
        };
        
        debug("Checkin payload:", payload);
        
        try {
          const resp = await fetch(`${API_BASE}/logs/checkin`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
          body: JSON.stringify(payload)
        });
          
          const result = await resp.json();
          debug("Checkin result:", result);
          
        chrome.storage.local.remove("checkoutId");
          debug("Removed checkoutId from storage");
        } catch (err) {
          console.error("Checkin error:", err);
          debug("Checkin error details:", err.message, err.stack);
        }
      });

      chrome.storage.local.set({ checkedOut: false });
      debug("Updated checkedOut state to false");
    }
  }
  
  // Render schedule
  function renderSchedule(scheduleInfo) {
    if (!scheduleInfo) {
      debug("scheduleInfo element not found, can't render schedule");
      return;
    }
    
    if (!classInfo) {
      debug("No class info available to render");
      scheduleInfo.innerHTML = `<p>No schedule information available</p>`;
      return;
    }

    debug("Rendering schedule with data:", classInfo);
    
    if (classInfo.message) {
      debug(`Showing schedule message: ${classInfo.message}`);
      scheduleInfo.innerHTML = `<p>${classInfo.message}</p>`;
      return;
    }

    debug(`Rendering schedule for ${classInfo.abDay} day, period ${classInfo.period}`);
    
    // Modern schedule display
    let scheduleHtml = `
      <div class="schedule-heading">
        <div class="schedule-badge">${classInfo.abDay} Day</div>
        <div class="schedule-date">${classInfo.date}</div>
      </div>
      
      <div class="class-info">
        <div class="period-badge">${classInfo.period}</div>
        <div class="class-details">
          <div class="class-name">${classInfo.className}</div>
          <div class="class-location">
            ${classInfo.teacher || 'N/A'} — Room ${classInfo.room || 'N/A'}
            ${classInfo.lunch ? `<span class="lunch-badge">Lunch ${classInfo.lunch}</span>` : ''}
          </div>
        </div>
      </div>
    `;

    scheduleInfo.innerHTML = scheduleHtml;
    debug("Schedule rendering complete");
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    debug("Document still loading, waiting for DOMContentLoaded");
    document.addEventListener('DOMContentLoaded', init);
  } else {
    debug("Document already loaded, initializing immediately");
    init();
  }
  
  // Add debug checker to monitor dropdown state
  function checkDropdownVisibility() {
    const dropdown = document.getElementById("studentDropdown");
    if (dropdown) {
      const computedStyle = window.getComputedStyle(dropdown);
      debug("DROPDOWN CHECK:");
      debug("- Opacity:", computedStyle.opacity);
      debug("- Max-height:", computedStyle.maxHeight);
      debug("- Display:", computedStyle.display);
      debug("- Visibility:", computedStyle.visibility);
      debug("- Classes:", dropdown.className);
      debug("- Width/Height:", computedStyle.width, computedStyle.height);
      debug("- Position:", computedStyle.position);
      debug("- Z-index:", computedStyle.zIndex);
    } else {
      debug("DROPDOWN CHECK: Element not found");
    }
  }
  
  // Add a direct event listener on document load to ensure avatar click works
  document.addEventListener('DOMContentLoaded', function() {
    debug("DOM fully loaded - setting up additional event listeners");
    
    const studentAvatar = document.getElementById("studentAvatar");
    const studentDropdown = document.getElementById("studentDropdown");
    
    // Log elements to verify they exist
    debug("Student avatar element:", studentAvatar);
    debug("Student dropdown element:", studentDropdown);
    
    if (studentAvatar) {
      debug("Adding direct click event listener to avatar");
      studentAvatar.addEventListener('click', function(e) {
        debug("AVATAR CLICKED - Direct event handler");
        
        // Force toggle the dropdown with classes
        if (studentDropdown) {
          const isVisible = studentDropdown.classList.contains('visible');
          debug(`Dropdown is currently ${isVisible ? 'visible' : 'hidden'}`);
          
          if (isVisible) {
            studentDropdown.classList.remove('visible');
            debug("Manually HIDING dropdown with class removal");
          } else {
            studentDropdown.classList.add('visible');
            debug("Manually SHOWING dropdown with class addition");
          }
          
          // Check dropdown visibility after toggle
          setTimeout(checkDropdownVisibility, 100);
        }
      });
      
      // Set initial display style
      studentAvatar.style.display = "flex";
      debug("Set avatar display to flex");
    }
    
    // Manually populate dropdown with default content if it exists
    if (studentDropdown) {
      debug("Ensuring dropdown has initial content");
      if (!studentDropdown.innerHTML.trim()) {
        studentDropdown.innerHTML = `
          <div class="student-option">
            <span class="student-name">Dropdown initialized</span>
          </div>
          <div class="student-option logout" data-action="logout">
            <span class="student-name">Logout</span>
          </div>
        `;
        debug("Added default content to dropdown");
      }
      
      // Add direct event listeners to any logout options
      const logoutOptions = studentDropdown.querySelectorAll('.student-option[data-action="logout"]');
      logoutOptions.forEach(option => {
        option.addEventListener('click', () => {
          debug("Logout option clicked directly");
    chrome.storage.local.clear();
    window.location.reload();
  });
});
    }
    
    // Check initial dropdown visibility
    checkDropdownVisibility();
    
    // Add direct button to show dropdown for testing
    const actionBtn = document.getElementById("actionBtn");
    if (actionBtn && studentDropdown) {
      actionBtn.addEventListener('dblclick', function() {
        debug("Action button double-clicked, showing dropdown as fallback");
        studentDropdown.classList.add('visible');
        checkDropdownVisibility();
      });
    }
  });

  // Hide modal function
  function hideModal(modalElement) {
    if (modalElement) {
      modalElement.classList.remove('visible');
      debug("Hiding modal");
    }
  }

  // Handle student switch
  async function handleStudentSwitch() {
    const confirmModal = document.getElementById("confirmModal");
    const loadingOverlay = document.getElementById("loading");
    const greeting = document.getElementById("greeting");
    const scheduleInfo = document.getElementById("scheduleInfo");
    const studentAvatar = document.getElementById("studentAvatar");
    
    debug("Starting student switch");
    debug(`Switching from ID ${activeStudentId} to ID ${pendingId}`);
    
    hideModal(confirmModal);
    showElement(loadingOverlay);

    try {
      // Switch the student
      debug(`Sending switch request to API for student ID: ${pendingId}`);
      const switchRes = await fetch(`${API_BASE}/lookup/switch`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          username, password,
          base_url: "https://accesscenter.roundrockisd.org",
          student_id: pendingId
        })
      });
      
      const switchData = await switchRes.json();
      debug("Switch API response:", switchData);
      const { success=false } = switchData;
      
      if (!success) {
        throw new Error("Switch API returned success=false");
      }

      // Update state
      debug(`Updating state - old student ID: ${activeStudentId}, new student ID: ${pendingId}`);
      debug(`Old name: ${studentName}, new name: ${pendingName}`);
      activeStudentId = pendingId;
      studentName = pendingName;
      
      chrome.storage.local.set({ activeStudentId, studentName });
      debug("State saved to storage");
      
      if (greeting) {
        greeting.innerText = `Hey, ${studentName}`;
        debug("Greeting updated");
      }
      
      // Update avatar with first letter of new name
      if (studentAvatar && studentName) {
        const firstLetter = studentName.charAt(0).toUpperCase();
        studentAvatar.innerText = firstLetter;
        debug(`Updated avatar with first letter: ${firstLetter}`);
      }
      
      // Update active student in dropdown
      updateActiveStudentInDropdown();

      // Wait for backend to process the switch
      debug("Waiting for backend to process student switch...");
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Get updated schedule
      debug("Fetching updated schedule for new student");
      const oldClassInfo = JSON.stringify(classInfo);
      classInfo = await getCurrentClassInfo(
        username, password, null, activeStudentId
      );
      debug("Old class info:", oldClassInfo);
      debug("New class info:", JSON.stringify(classInfo));
      
      // Compare old and new class info
      if (oldClassInfo === JSON.stringify(classInfo)) {
        debug("WARNING: Class info hasn't changed after student switch!");
      } else {
        debug("Class info successfully updated for new student");
      }

      // Update UI
      debug("Rendering updated schedule");
      renderSchedule(scheduleInfo);
      debug("Student switch completed successfully");
      
    } catch (err) {
      console.error("Student switch error:", err);
      debug("Student switch failure details:", err.message, err.stack);
      alert("Failed to switch student. Please try again.");
    } finally {
      hideElement(loadingOverlay);
      debug("Switch process completed (success or failure)");
    }
  }
})();
