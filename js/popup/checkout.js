import { debug } from "./utils.js";

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
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      debug("Attempted checkout on weekend");
      btn.innerText = "It's the weekend!";
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
      status.innerText = "Checkouts are not available on weekends.";
      return;
    }

    if (!checkedOut) {
      // CHECK OUT
      if (typeof onCheckout !== "function") {
        debug("onCheckout is not a function!", onCheckout);
        return;
      }

      debug("Starting checkout process");
      checkedOut = true;

      // Update UI first
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
        if (timerStopper) timerStopper();
        updateCheckoutButton("Check Out");
        btn.style.backgroundColor = "var(--success)";
        alert("Failed to log checkout. Please try again.");
      }

    } else {
      // CHECK IN
      if (typeof onCheckin !== "function") {
        debug("onCheckin is not a function!", onCheckin);
        return;
      }

      debug("Starting checkin process");
      checkedOut = false;

      const duration = timerModule.stopTimer(timerStopper);
      updateCheckoutButton("Check Out");
      btn.style.backgroundColor = "var(--success)";
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
