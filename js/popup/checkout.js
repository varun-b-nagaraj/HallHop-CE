import { debug } from "./ui.js";

export function setupCheckout(
  { startButtonId, statusMessageId },
  { onCheckout, onCheckin },
  apiModule,
  timerModule,
  updateCheckoutButton
) {
  const btn = document.getElementById(startButtonId);
  const status = document.getElementById(statusMessageId);
  let checkedOut = false;
  let timerStopper = null;

  // Add debug logging to track state
  debug("Setting up checkout with:", {
    checkedOut,
    hasBtn: !!btn,
    hasStatus: !!status,
    hasOnCheckout: !!onCheckout,
    hasTimer: !!timerModule
  });

  if (!btn || !status) {
    debug("setupCheckout: missing button or status element");
    return;
  }

  btn.addEventListener("click", async () => {
    // First check if it's a weekend
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Check for weekend
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      debug("Attempted checkout on weekend");
      btn.innerText = "It's the weekend!";
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
      status.innerText = "Checkouts are not available on weekends.";
      return;
    }

    // Check for after school hours (after 4:20 PM)
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    if (currentHour > 16 || (currentHour === 16 && currentMinute >= 20)) {
      debug("Attempted checkout after school hours");
      btn.innerText = "School day is over!";
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
      status.innerText = "School day is over - no checkouts needed.";
      return;
    }

    // Also check for before school hours (before 8:45 AM)
    if (currentHour < 8 || (currentHour === 8 && currentMinute < 45)) {
      debug("Attempted checkout before school hours");
      btn.innerText = "School hasn't started!";
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
      status.innerText = "School day hasn't started yet.";
      return;
    }

    if (!checkedOut) {
      // CHECK OUT
      // onCheckout and onCheckin are defined in init.js
      if (typeof onCheckout !== "function") {
        debug("onCheckout is not a function!", onCheckout);
        return;
      }

      debug("Starting checkout process");
      checkedOut = true;

      // Update UI first and logging how many seconds they have been checked out for
      btn.style.backgroundColor = "var(--danger)";
      updateCheckoutButton("Checked Out (0m 0s)");
      timerStopper = timerModule.startTimer(ms =>
        updateCheckoutButton(`Checked Out (${timerModule.formatDuration(ms)})`)
      );

      try {
        debug("Calling onCheckout handler...");
        await onCheckout();
        debug("Checkout successfully logged to database");
      } catch (err) {
        debug("Error during checkout:", err);
        // Reset state on error
        checkedOut = false;
        // Stop the timer
        if (timerStopper) timerStopper();
        updateCheckoutButton("Check Out");
        btn.style.backgroundColor = "var(--success)";
        alert("Failed to log checkout. Please try again.");
      }

    } else {
      // Ensuring that onCheckin is defined
      if (typeof onCheckin !== "function") {
        debug("onCheckin is not a function!", onCheckin);
        return;
      }

      debug("Starting checkin process");
      // Disabling checkout and stopping the timer
      checkedOut = false;

      const duration = timerModule.stopTimer(timerStopper);
      updateCheckoutButton("Check Out");
      btn.style.backgroundColor = "var(--success)";
      // Printing duration to the screen
      status.innerText = `You've been out for ${timerModule.formatDuration(duration)}.`;

      try {
        debug("Calling onCheckin handler with duration:", duration);
        await onCheckin(duration);
        debug("Checkin successfully logged to database");
      } catch (err) {
        debug("Error during checkin:", err);
        alert("Failed to log check-in. Please try again.");
      }
    }
  });

  // Check if already checked out from storage
  chrome.storage.local.get(["checkedOut", "startTime"], data => {
    if (data.checkedOut && data.startTime) {
      // Also check if it's weekend
      const now = new Date();
      const dayOfWeek = now.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        debug("Weekend detected during checkout restore");
        btn.innerText = "It's the weekend!";
        btn.disabled = true;
        btn.style.opacity = "0.5";
        // Don't alllow checkin on weekends or checkout
        btn.style.cursor = "not-allowed";
        return;
      }

      debug("Restoring checkout state from storage");
      checkedOut = true;
      btn.style.backgroundColor = "var(--danger)";
      timerStopper = timerModule.startTimer(
        ms => updateCheckoutButton(`Checked Out (${timerModule.formatDuration(ms)})`),
        data.startTime
      );
    }
  });
}
