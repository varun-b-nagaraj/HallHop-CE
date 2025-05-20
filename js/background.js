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

// Schedule a repeating alarm on install/startup
chrome.runtime.onInstalled.addListener(() => {
  debug('Extension installed; setting up ping alarm');
  chrome.alarms.create('pingMonitor', {
    delayInMinutes: 1,    // first fire 1 minute from now
    periodInMinutes: 1    // then every minute
  });
});

// Listen for the alarm and call pingAPI()
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'pingMonitor') {
    debug('Ping monitor alarm fired; calling pingAPI()');
    pingAPI();
  }
});
  
debug('Background script loaded');