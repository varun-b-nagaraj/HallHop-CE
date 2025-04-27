// Debug helper function
function debug(...args) {
    console.log("[HallHop Schedule Debug]", ...args);
  }
  
  debug("Schedule module loaded");
  
  export async function getCurrentClassInfo(username, password, customNow = null, studentId = null) {
      debug(`Getting class info for student ID: ${studentId || 'default student'}`);
      
      const link = "https://accesscenter.roundrockisd.org/";
      const url = `https://hacapi-hh.onrender.com/api/getReport?user=${encodeURIComponent(username)}&pass=${encodeURIComponent(password)}&link=${encodeURIComponent(link)}${studentId ? `&student_id=${encodeURIComponent(studentId)}` : ''}`;
      
      debug(`Schedule API URL: ${url}`);
      debug(`StudentID included in URL: ${studentId ? 'YES' : 'NO'}`);
    
      try {
        const startTime = Date.now();
        const res = await fetch(url);
        debug(`API response received in ${Date.now() - startTime}ms, status: ${res.status}`);
        
        const report = await res.json();
        debug(`Report data received:`, report);
      
        if (!report || !report.data) {
          debug("No data received from schedule API");
          return { message: "Could not retrieve your schedule." };
        }
      
        // Log report data structure
        debug(`Report structure: has data: ${!!report.data}, data length: ${report.data?.length || 0}`);
        debug(`Student name from report: ${report.name || 'Not available'}`);
        
        // Create a date object safely - handle null case
        let now;
        try {
          // If customNow is provided, use it; otherwise create a new Date
          now = customNow || new Date();
          debug(`Using date for schedule calculation: ${now}`);
        } catch (err) {
          console.error("Error creating date:", err);
          debug(`Date creation error: ${err.message}`, err.stack);
          // Fallback to a safe date in case of error
          now = new Date();
          debug(`Using fallback date: ${now}`);
        }
        
        const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
        debug(`Day of week: ${dayOfWeek} (0=Sunday, 6=Saturday)`);
      
        // Return early on weekends.
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          debug("Weekend detected, returning early");
          return { message: "It's the weekend! No school today." };
        }
        
        // Determine A/B Day based on date
        // Known reference: April 16, 2025 is an A day.
        const referenceDate = new Date("2025-04-23");
        const referenceDayType = "A";
      
        // Count school (weekday) days between reference and today.
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
        // If reference day is A, even school day differences are A days.
        const abDay = (referenceDayType === "A")
          ? (schoolDaysDiff % 2 === 0 ? "A" : "B")
          : (schoolDaysDiff % 2 === 0 ? "B" : "A");
  
        debug(`Today is ${abDay} Day`);
        
        // Get current hour and minute for time check
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        // Create an array of all periods from the report
        const allPeriods = report.data.map(row => {
          return {
            period: row[2].replace(/^0+/, ''), // Remove leading zeros
            className: row[1],
            teacher: row[3],
            room: row[4]
          };
        });
        
        debug("All periods from report:", allPeriods);
        
        // Always determine current period based on time
        debug("Determining current period based on time");
        
        // Define school schedule
        const schedule = {
          // A Day schedule (periods 1-4)
          A: [
            { start: { hour: 8, minute: 45 }, end: { hour: 10, minute: 35 }, period: "1" },
            { start: { hour: 10, minute: 40 }, end: { hour: 12, minute: 30 }, period: "2" },
            { start: { hour: 12, minute: 35 }, end: { hour: 14, minute: 25 }, period: "3" },
            { start: { hour: 14, minute: 30 }, end: { hour: 16, minute: 20 }, period: "4" }
          ],
          // B Day schedule (periods 5-8)
          B: [
            { start: { hour: 8, minute: 45 }, end: { hour: 10, minute: 35 }, period: "5" },
            { start: { hour: 10, minute: 40 }, end: { hour: 12, minute: 30 }, period: "6" },
            { start: { hour: 12, minute: 35 }, end: { hour: 14, minute: 25 }, period: "7" },
            { start: { hour: 14, minute: 30 }, end: { hour: 16, minute: 20 }, period: "8" }
          ]
        };
        
        // Convert current time to minutes for easy comparison
        const currentTimeInMinutes = currentHour * 60 + currentMinute;
        
        // Find the current period based on time
        let currentPeriod = null;
        let daySchedule = schedule[abDay];
        for (const timeSlot of daySchedule) {
          const startTimeInMinutes = timeSlot.start.hour * 60 + timeSlot.start.minute;
          const endTimeInMinutes = timeSlot.end.hour * 60 + timeSlot.end.minute;
          
          if (currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes) {
            currentPeriod = timeSlot.period;
            debug(`Current period based on time: ${currentPeriod}`);
            break;
          }
        }
        
        // Default to first period of the day if outside school hours
        if (!currentPeriod) {
          currentPeriod = abDay === "A" ? "1" : "5";
          debug(`Outside school hours, defaulting to period ${currentPeriod}`);
        }
        
        debug(`Final current period determination: ${currentPeriod}`);
        
        // Get the current class based on the current period
        let currentClass = allPeriods.find(p => p.period === currentPeriod);
        
        // If no current class is found, use the first period as a fallback
        if (!currentClass && allPeriods.length > 0) {
          debug(`No class found for period ${currentPeriod}, using first period as fallback`);
          currentClass = allPeriods[0];
        }
        
        if (!currentClass) {
          debug("No class information found");
          return { 
            message: "No class information available",
            abDay,
            allPeriods
          };
        }
        
        debug(`Selected class: ${currentClass.className} (Period ${currentClass.period})`);
        
        // Check if this is a lunch period (periods 3 or 7)
        const isMidDayPeriod = currentClass.period === "3" || currentClass.period === "7";
        let lunchDesignation = null;
        
        if (isMidDayPeriod && currentClass.room) {
          // Determine lunch based on room number
          const roomStr = String(currentClass.room).trim();
          
          // A Lunch: Buildings 200, 700, 900, 1000
          if (roomStr.startsWith("200") || roomStr.startsWith("700") || 
              roomStr.startsWith("900") || roomStr.startsWith("1000")) {
            lunchDesignation = "A";
          }
          // B Lunch: Buildings 100, 1300
          else if (roomStr.startsWith("100") || roomStr.startsWith("1300")) {
            lunchDesignation = "B";
          }
          // C Lunch: Buildings 600, 2200, 2300
          else if (roomStr.startsWith("600") || roomStr.startsWith("2200") || roomStr.startsWith("2300")) {
            lunchDesignation = "C";
          }
          // D Lunch: Buildings 400, 500, 1100, 1400/2400, 1500/2500
          else if (roomStr.startsWith("400") || roomStr.startsWith("500") || 
                  roomStr.startsWith("1100") || roomStr.startsWith("1400") || 
                  roomStr.startsWith("2400") || roomStr.startsWith("1500") || 
                  roomStr.startsWith("2500")) {
            lunchDesignation = "D";
          }
          else {
            // Default lunch if no match is found
            lunchDesignation = "D";
          }
          
          debug(`Assigned ${lunchDesignation} lunch based on room ${roomStr}`);
        }
        
        // Return the full class info
        const result = {
          name: report.name || "Student",
          date: now.toLocaleDateString(),
          abDay,
          period: currentClass.period,
          className: currentClass.className,
          teacher: currentClass.teacher,
          room: currentClass.room,
          allPeriods: allPeriods // Keep all periods for reference, but no UI selector
        };
        
        // If this is a mid-day period, include the lunch assignment
        if (lunchDesignation) {
          result.lunch = lunchDesignation;
        }
        
        debug(`Final class info result:`, result);
        return result;
        
      } catch (err) {
        console.error("Error in getCurrentClassInfo:", err);
        debug(`Error details: ${err.message}`, err.stack);
        return { message: "An error occurred while retrieving your schedule." };
      }
  }
  
  // Create global object for module functions to make sure they're accessible
  window.hallhopModules = window.hallhopModules || {};
  window.hallhopModules.schedule = { getCurrentClassInfo };
  
  // Add a fallback export in case the module system is having issues
  window.hallhopSchedule = {
    getCurrentClassInfo
  };