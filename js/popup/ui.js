import {
    debug,
    createRippleEffect,
    updateHeaderColor,
    updateCardGradient,
    showElement,
    hideElement
  } from "./utils.js";
  
  /**
   * Wire up all purely UI-related event handlers:
   *  - header gradient follow
   *  - card gradient follow
   *  - ripple effect on buttons
   */
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

/**
 * Hide loading overlay
 */
export function hideLoading() {
  hideElement(document.getElementById('loading'));
}
