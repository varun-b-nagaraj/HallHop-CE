function debug(...args) {
  console.log("[HallHop Background Debug]", ...args);
}

debug("Background script loaded");

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

chrome.runtime.onInstalled.addListener(() => {
  debug("Extension installed or updated");
});

chrome.runtime.onStartup.addListener(() => {
  debug("Extension startup detected, checking previous state");
  chrome.storage.local.get(["checkedOut", "studentName", "startTime"], (data) => {
    debug("Previous state retrieved:", data);
    if (data.checkedOut && data.startTime) {
      debug(`${data.studentName || 'Student'} is still checked out from a previous session`);
      debug(`Checkout started at: ${new Date(data.startTime).toLocaleString()}`);
      const duration = Date.now() - data.startTime;
      debug(`Duration so far: ${Math.floor(duration/1000/60)}m ${Math.floor(duration/1000) % 60}s`);
    } else {
      debug("No active checkout found");
    }
  });
});
  