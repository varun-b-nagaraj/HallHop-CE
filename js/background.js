const DEBUG = true;

function debug(...args) {
  if (DEBUG) console.log('[HallHop Background]:', ...args);
}

// Initialize on install
chrome.runtime.onInstalled.addListener((details) => {
  debug('Extension installed:', details.reason);
});

// Handle messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debug('Received message:', message);
  return false; // Don't keep message channel open
});


chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkoutMonitor') {
    debug('Checking for abandoned checkouts...');
  }
});

debug('Background script loaded');