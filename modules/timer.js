// Debug helper function
function debug(...args) {
    console.log("[HallHop Timer Debug]", ...args);
  }
  
  debug("Timer module loaded");
  
  let intervalId = null;
  let globalStart = null;
  
  export function startTimer(onTick, resumeStartTime = null) {
    debug(`Starting timer${resumeStartTime ? ' (resuming)' : ''}`);
    globalStart = resumeStartTime || Date.now();
    debug(`Start time: ${new Date(globalStart).toLocaleTimeString()}`);
  
    intervalId = setInterval(() => {
      const duration = Date.now() - globalStart;
      if (duration % 10000 < 1000) { // Log every 10 seconds
        debug(`Timer running: ${formatDuration(duration)}`);
      }
      onTick(duration);
    }, 1000);
  
    debug("Timer interval created");
    return () => {
      debug("Timer stop function called");
      clearInterval(intervalId);
    };
  }
  
  export function stopTimer(clearFn) {
    debug("Stopping timer");
    clearFn();
    const end = Date.now();
    const duration = end - globalStart;
    debug(`Timer stopped at ${new Date(end).toLocaleTimeString()}`);
    debug(`Total duration: ${formatDuration(duration)}`);
    return duration;
  }
  
  export function formatDuration(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  }
  
  // Add a fallback export in case the module system is having issues
  window.hallhopTimer = {
    startTimer,
    stopTimer,
    formatDuration
  };
  