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

// Function to ping the API
function pingAPI() {
    const apiUrl = 'https://hacapi-hh.onrender.com'; // Your API endpoint

    fetch(apiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            console.log('Ping successful:', data);
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
        });
}

// Set an interval to ping the API every minute
setInterval(pingAPI, 60000); // 60000 milliseconds = 1 minute
  
debug('Background script loaded');