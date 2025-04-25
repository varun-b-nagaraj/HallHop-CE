// Debug helper function
function debug(...args) {
  console.log("[HallHop API Debug]", ...args);
}

debug("API module loaded");

function formatName(name) {
  if (!name || typeof name !== "string") return name;

  const parts = name.split(",");
  if (parts.length === 2) {
    const last = parts[0].trim();
    const first = parts[1].trim();
    return `${first} ${last}`;
  }

  return name;
}


export async function getStudentName(username, password) {
  const url = "https://hacapi-hh.onrender.com/api/getInfo";
  const payload = { user: username, pass: password };

  debug(`Fetching student name for user: ${username.substring(0,2)}***`);
  debug(`POST URL: ${url}`);
  
  try {
    const startTime = Date.now();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    debug(`API response received in ${Date.now() - startTime}ms, status: ${res.status}`);
    const data = await res.json();
    debug("Student info data:", data);

    return { name: formatName(data?.name || "") };
  } catch (err) {
    console.error("API error:", err);
    debug(`API error details: ${err.message}`, err.stack);
    return null;
  }
}

// Create global object for module functions to make sure they're accessible
window.hallhopModules = window.hallhopModules || {};
window.hallhopModules.api = { getStudentName };

// Add a fallback export in case the module system is having issues
window.hallhopAPI = {
  getStudentName
};
