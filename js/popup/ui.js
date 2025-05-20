export const DEBUG = true;

// Generic debug logger
export function debug(...args) {
  if (DEBUG) {
    console.log("[HallHop Debug]", ...args);
  }
}
// UI event handlers, header gradient, as well as ripple effects
export function setupUI() {
  debug("Setting up UI…");

  // header mousemove → gradient
  document.addEventListener("mousemove", updateHeaderColor);

  // card hover gradient
  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("mousemove", updateCardGradient);
    card.addEventListener("mouseleave", () => {
      card.style.setProperty("--x", "0px");
      card.style.setProperty("--y", "0px");
    });
  });

  // ripple on every button
  document.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", createRippleEffect);
  });
}
  
/**
 * Update the greeting text (e.g., "Hey, Name")
 * @param {string} name
 */
export function showGreeting(name) {
  const el = document.getElementById("greeting");
  if (el) {
    el.innerText = `Hey, ${name}`;
    debug(`Greeting set to Hey, ${name}`);
  }
}
  
/**
 * Update the checkout button label
 * @param {string} text
 */
export function updateCheckoutButton(text) {
  const btn = document.getElementById("actionBtn");
  if (btn) {
    btn.innerText = text;
    debug(`Checkout button text updated to: ${text}`);
  }
}

/**
 * Render the current class info into the schedule container.
 * @param {HTMLElement} containerEl - the container element
 * @param {object} classInfo - the data from getCurrentClassInfo
 */
export function renderSchedule(containerEl, classInfo) {
  if (!containerEl) {
    debug("renderSchedule: no container provided");
    return;
  }

  // no data
  if (!classInfo) {
    containerEl.innerHTML = `<p>No schedule information available</p>`;
    return;
  }

  // message override (weekend / error)
  if (classInfo.message) {
    containerEl.innerHTML = `<p>${classInfo.message}</p>`;
    return;
  }

  // build HTML
  const html = `
    <div class="schedule-heading">
      <div class="schedule-badge">${classInfo.abDay} Day</div>
      <div class="schedule-date">${classInfo.date}</div>
    </div>
    <div class="class-info">
      <div class="period-badge">${classInfo.period}</div>
      <div class="class-details">
        <div class="class-name">${classInfo.className}</div>
        <div class="class-location">
          ${classInfo.teacher || "N/A"} — Room ${classInfo.room || "N/A"}
          ${classInfo.lunch ? `<span class="lunch-badge">Lunch ${classInfo.lunch}</span>` : ""}
        </div>
      </div>
    </div>
  `;

  containerEl.innerHTML = html;
  debug("Schedule rendered");
}
  
  /**
 * Show loading overlay with custom message
 * @param {string} message Optional loading message
 */
export function showLoading(message = 'Loading...') {
  const overlay = document.getElementById('loading');
  const text = overlay?.querySelector('.loading-text');
  if (text) {
    text.textContent = message;
  }
  showElement(overlay);
}

// Hide loading overlay
export function hideLoading() {
  hideElement(document.getElementById('loading'));
}

// Rupple effect for buttons
export function createRippleEffect(e) {
  const btn = e.currentTarget;
  btn.classList.remove("ripple");
  const rect = btn.getBoundingClientRect();
  btn.style.setProperty("--x", `${e.clientX - rect.left}px`);
  btn.style.setProperty("--y", `${e.clientY - rect.top}px`);
  void btn.offsetWidth; // trigger reflow
  btn.classList.add("ripple");
}

// Show an element, with special handling for modals/loading overlays
export function showElement(elem, displayType = "block") {
  if (!elem) return;
  if (
    elem.classList.contains("loading-overlay") ||
    elem.classList.contains("modal-overlay")
  ) {
    elem.classList.add("visible");
  } else {
    elem.style.display = displayType;
    void elem.offsetWidth; // enable transitions
    elem.classList.add("showing");
  }
}

// Hide an element, with special handling for modals/loading overlays
export function hideElement(elem) {
  if (!elem) return;
  if (
    elem.classList.contains("loading-overlay") ||
    elem.classList.contains("modal-overlay")
  ) {
    elem.classList.remove("visible");
  } else {
    elem.classList.remove("showing");
    setTimeout(() => {
      elem.style.display = "none";
    }, 400); // match your CSS transition
  }
}

// Hide the modal
export function hideModal(modalElem) {
  if (modalElem) {
    modalElem.classList.remove("visible");
    debug("Hiding modal");
  }
}

// Follow the mouse position to update the header gradient
export function updateHeaderColor(e) {
  const header = document.querySelector(".app-header");
  if (!header) return;
  const rect = header.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
    header.style.setProperty("--x", `${x}px`);
    header.style.setProperty("--y", `${y}px`);
    const hue = Math.floor((x / rect.width) * 30) + 210;
    header.style.setProperty("--hue", hue);
    header.style.setProperty("--opacity", "1");
  } else {
    header.style.setProperty("--opacity", "0");
  }
}

// Cursor gradient effect on center info screen
export function updateCardGradient(e) {
  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  card.style.setProperty("--x", `${x}px`);
  card.style.setProperty("--y", `${y}px`);
}

// Additional debug statements for dropdown visibility
export function checkDropdownVisibility() {
  const dropdown = document.getElementById("studentDropdown");
  if (!dropdown) {
    debug("DROPDOWN CHECK: Element not found");
    return;
  }
  const style = window.getComputedStyle(dropdown);
  debug(
    "DROPDOWN CHECK:",
    "Opacity:", style.opacity,
    "Max-height:", style.maxHeight,
    "Display:", style.display,
    "Visibility:", style.visibility,
    "Classes:", dropdown.className,
    "Size:", style.width, style.height,
    "Position:", style.position,
    "Z-index:", style.zIndex
  );
}

