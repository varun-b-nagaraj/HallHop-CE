import { fetchScheduleReport } from './api.js';

// Debug helper
function debug(...args) {
  console.log("[HallHop Schedule Debug]", ...args);
}

export async function getCurrentClassInfo(username, password, customNow = null, studentId = null, prefetchedReport = null) {
  debug(`Getting class info for student ID: ${studentId || 'default student'}`);

  try {
    // Use prefetched report or fetch new one
    const report = prefetchedReport || await fetchScheduleReport(username, password, studentId);

    if (!report || !report.data) {
      debug("No data received from schedule API");
      return { message: "Could not retrieve your schedule." };
    }

    debug("Report structure:", report);

    // Create a date object safely
    let now;
    try {
      now = customNow || new Date();
      debug(`Using date for schedule calculation: ${now}`);
    } catch (err) {
      console.error("Error creating date:", err);
      now = new Date();
      debug(`Using fallback date: ${now}`);
    }

    const dayOfWeek = now.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      debug("Weekend detected, returning early");
      return { message: "It's the weekend! No school today." };
    }

    // Determine A/B Day based
    const referenceDate = new Date("2025-04-23");
    const referenceDayType = "A";
    function countSchoolDays(start, end) {
      let count = 0;
      const current = new Date(start);
      current.setHours(0, 0, 0, 0);
      const endDate = new Date(end);
      endDate.setHours(0, 0, 0, 0);
      while (current <= endDate) {
        const d = current.getDay();
        if (d !== 0 && d !== 6) count++;
        current.setDate(current.getDate() + 1);
      }
      return count;
    }

    const schoolDaysDiff = countSchoolDays(referenceDate, now);
    const abDay = (referenceDayType === "A")
      ? (schoolDaysDiff % 2 === 0 ? "A" : "B")
      : (schoolDaysDiff % 2 === 0 ? "B" : "A");

    debug(`Today is ${abDay} Day`);

    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    const allPeriods = report.data.map(row => ({
      period: row[2].replace(/^0+/, ''),
      className: row[1],
      teacher: row[3],
      room: row[4]
    }));

    const schedule = {
      A: [
        { start: { hour: 8, minute: 45 }, end: { hour: 10, minute: 35 }, period: "1" },
        { start: { hour: 10, minute: 40 }, end: { hour: 12, minute: 30 }, period: "2" },
        { start: { hour: 12, minute: 35 }, end: { hour: 14, minute: 25 }, period: "3" },
        { start: { hour: 14, minute: 30 }, end: { hour: 16, minute: 20 }, period: "4" }
      ],
      B: [
        { start: { hour: 8, minute: 45 }, end: { hour: 10, minute: 35 }, period: "5" },
        { start: { hour: 10, minute: 40 }, end: { hour: 12, minute: 30 }, period: "6" },
        { start: { hour: 12, minute: 35 }, end: { hour: 14, minute: 25 }, period: "7" },
        { start: { hour: 14, minute: 30 }, end: { hour: 16, minute: 20 }, period: "8" }
      ]
    };

    let currentPeriod = null;
    for (const timeSlot of schedule[abDay]) {
      const start = timeSlot.start.hour * 60 + timeSlot.start.minute;
      const end = timeSlot.end.hour * 60 + timeSlot.end.minute;
      if (currentTimeInMinutes >= start && currentTimeInMinutes <= end) {
        currentPeriod = timeSlot.period;
        break;
      }
    }

    if (!currentPeriod) {
      currentPeriod = abDay === "A" ? "1" : "5";
    }

    let currentClass = allPeriods.find(p => p.period === currentPeriod) || allPeriods[0];

    if (!currentClass) {
      debug("No class information found");
      return { message: "No class information available", abDay, allPeriods };
    }

    debug(`Selected class: ${currentClass.className} (Period ${currentClass.period})`);

    let lunchDesignation = null;
    if (["3", "7"].includes(currentClass.period) && currentClass.room) {
      const roomStr = String(currentClass.room).trim();
      const buildingNum = parseInt(roomStr.match(/^\d{1,3}/)?.[0] || '0');

      if ([200, 700, 900, 1000].some(b => buildingNum >= b && buildingNum < b + 100)) lunchDesignation = "A";
      else if ([100, 1300].some(b => buildingNum >= b && buildingNum < b + 100)) lunchDesignation = "B";
      else if ([600, 2200, 2300].some(b => buildingNum >= b && buildingNum < b + 100)) lunchDesignation = "C";
      else if ([400, 500, 1100, 1400, 2400, 1500, 2500].some(b => buildingNum >= b && buildingNum < b + 100)) lunchDesignation = "D";
      else lunchDesignation = "D";
    }

    const result = {
      name: report.name || "Student",
      date: now.toLocaleDateString(),
      abDay,
      period: currentClass.period,
      className: currentClass.className,
      teacher: currentClass.teacher,
      room: currentClass.room,
      allPeriods
    };

    if (lunchDesignation) {
      result.lunch = lunchDesignation;
    }

    debug("Final class info result:", result);
    return result;

  } catch (err) {
    console.error("Error in getCurrentClassInfo:", err);
    debug(`Error details: ${err.message}`, err.stack);
    return { message: "An error occurred while retrieving your schedule." };
  }
}

// Make global
window.hallhopModules = window.hallhopModules || {};
window.hallhopModules.schedule = { getCurrentClassInfo };

window.hallhopSchedule = { getCurrentClassInfo };
