import mongoose from "mongoose";
import Timetable from "../model/Timetable_model.js"; // Adjust path as needed
import User from "../model/user_model.js"; // Adjust path as needed

export const generateTimetableDirectly = async (req, res) => {
  try {
    const {
      projectName,
      multipleBuildings,
      buildings,
      classes,
      faculty,
      grades,
      subjects,
      timeSlots,
      userId
    } = req.body;
    
    // Validate that all required data is present
    if (!classes || !faculty || !grades || !subjects || !timeSlots) {
      return res.status(400).json({
        success: false,
        message: "Missing required timetable data. Please provide classes, faculty, grades, subjects, and timeSlots."
      });
    }

    // Get user ID
    const defaultUserId = new mongoose.Types.ObjectId();
    const creatorId = userId || (req.user ? req.user._id : defaultUserId);

    // Create timetable object
    const timetableData = {
      projectName: projectName || "Temporary Timetable",
      multipleBuildings: multipleBuildings || false,
      buildings: buildings || [],
      classes,
      faculty,
      grades,
      subjects,
      timeSlots,
      createdBy: creatorId
    };

    // Generate timetable schedule
    const generatedResult = generateTimetableSchedule(timetableData);
    
    // Save results
    let savedTimetable = null;
    
    try {
      const generationResultObject = {
        generatedOn: generatedResult.generatedOn,
        generationStatus: generatedResult.generationStatus,
        conflicts: generatedResult.conflicts,
        algorithm: generatedResult.algorithm || "standard",
        version: generatedResult.version || "1.0",
        schedules: {}
      };
      
      Object.keys(generatedResult.schedules).forEach(gradeSection => {
        generationResultObject.schedules[gradeSection] = {};
        Object.keys(generatedResult.schedules[gradeSection]).forEach(day => {
          generationResultObject.schedules[gradeSection][day] = generatedResult.schedules[gradeSection][day];
        });
      });
      
      const newTimetable = new Timetable({
        ...timetableData,
        generationResults: [generationResultObject],
        latestGeneration: generatedResult.generatedOn,
        hasGeneratedResults: true
      });

      // Save to database
      savedTimetable = await newTimetable.save();
      console.log("Timetable saved successfully with ID:", savedTimetable._id);

      // Update user with timetable reference if user ID exists
      if (userId || req.user) {
        const updatedUser = await User.findByIdAndUpdate(
          creatorId,
          { $push: { timetables: savedTimetable._id } },
          { new: true }
        );
        console.log("User updated with timetable reference:", updatedUser ? "Success" : "Failed");
      } else {
        console.log("Timetable saved with default ObjectId (no user association)");
      }
    } catch (saveError) {
      console.error("Error saving timetable to database:", saveError);
      return res.status(200).json({
        success: true,
        message: "Timetable generated successfully but couldn't be saved to database",
        error: saveError.message,
        data: {
          input: timetableData,
          result: generatedResult,
          saved: false
        }
      });
    }

    // Send response
    res.status(200).json({
      success: true,
      message: savedTimetable ? "Timetable generated and saved successfully" : "Timetable generated successfully (not saved)",
      data: {
        input: timetableData,
        result: generatedResult,
        saved: savedTimetable !== null,
        timetableId: savedTimetable ? savedTimetable._id : null
      }
    });
  } catch (error) {
    console.error("Error generating timetable:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate timetable",
      error: error.message
    });
  }
};

export const updateTimetable = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      projectName,
      multipleBuildings,
      buildings,
      classes,
      faculty,
      grades,
      subjects,
      timeSlots,
      userId,
    } = req.body;

    // Validate projectId
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid timetable ID. Please provide a valid projectId.",
      });
    }

    // Validate that required data is present if provided
    if (
      classes !== undefined && (!Array.isArray(classes) || classes.length === 0) ||
      faculty !== undefined && (!Array.isArray(faculty) || faculty.length === 0) ||
      grades !== undefined && (!Array.isArray(grades) || grades.length === 0) ||
      subjects !== undefined && (!Array.isArray(subjects) || subjects.length === 0) ||
      timeSlots !== undefined && (!Array.isArray(timeSlots) || timeSlots.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid timetable data. Provided arrays (classes, faculty, grades, subjects, timeSlots) must be non-empty.",
      });
    }

    // Get user ID
    const defaultUserId = new mongoose.Types.ObjectId();
    const creatorId = userId || (req.user ? req.user._id : defaultUserId);

    // Find the existing timetable
    const existingTimetable = await Timetable.findById(projectId);
    if (!existingTimetable) {
      return res.status(404).json({
        success: false,
        message: "Timetable not found.",
      });
    }

    // Clean $ from gradeSections in subjects
    let cleanedSubjects = subjects;
    if (subjects !== undefined) {
      cleanedSubjects = subjects.map((subject) => ({
        ...subject,
        gradeSections: subject.gradeSections.map((gs) => ({
          grade: gs.grade.replace(/\$/g, ""),
          section: gs.section.replace(/\$/g, ""),
        })),
      }));
    }

    // Create updated timetable data
    const timetableData = {
      projectName: projectName !== undefined ? projectName : existingTimetable.projectName,
      multipleBuildings: multipleBuildings !== undefined ? multipleBuildings : existingTimetable.multipleBuildings,
      buildings: buildings !== undefined ? buildings : existingTimetable.buildings,
      classes: classes !== undefined ? classes : existingTimetable.classes,
      faculty: faculty !== undefined ? faculty : existingTimetable.faculty,
      grades: grades !== undefined ? grades : existingTimetable.grades,
      subjects: cleanedSubjects !== undefined ? cleanedSubjects : existingTimetable.subjects,
      timeSlots: timeSlots !== undefined ? timeSlots : existingTimetable.timeSlots,
      createdBy: creatorId,
      updatedAt: new Date(),
    };

    // Generate new schedule if relevant fields are updated
    let generatedResult = null;
    if (
      classes !== undefined ||
      faculty !== undefined ||
      grades !== undefined ||
      subjects !== undefined ||
      timeSlots !== undefined
    ) {
      generatedResult = generateTimetableSchedule(timetableData);
    }

    // Save updated timetable
    let updatedTimetable = null;
    try {
      const updateData = {
        ...timetableData,
        updatedAt: new Date(),
      };

      if (generatedResult) {
        const generationResultObject = {
          generatedOn: generatedResult.generatedOn,
          generationStatus: generatedResult.generationStatus,
          conflicts: generatedResult.conflicts,
          algorithm: generatedResult.algorithm || "standard",
          version: generatedResult.version || "1.0",
          schedules: {},
        };

        Object.keys(generatedResult.schedules).forEach((gradeSection) => {
          generationResultObject.schedules[gradeSection] = {};
          Object.keys(generatedResult.schedules[gradeSection]).forEach((day) => {
            generationResultObject.schedules[gradeSection][day] =
              generatedResult.schedules[gradeSection][day];
          });
        });

        // Replace generationResults with only the new schedule
        updateData.generationResults = [generationResultObject];
        updateData.latestGeneration = generatedResult.generatedOn;
        updateData.hasGeneratedResults = true;
      }

      updatedTimetable = await Timetable.findByIdAndUpdate(
        projectId,
        { $set: updateData },
        { new: true, runValidators: true }
      );

      console.log("Timetable updated successfully with ID:", updatedTimetable._id);

      // Update user with timetable reference if not already included
      if (userId || req.user) {
        const user = await User.findById(creatorId);
        if (user && !user.timetables.includes(projectId)) {
          const updatedUser = await User.findByIdAndUpdate(
            creatorId,
            { $addToSet: { timetables: projectId } },
            { new: true }
          );
          console.log("User updated with timetable reference:", updatedUser ? "Success" : "Failed");
        } else {
          console.log("Timetable already associated with user or user not found.");
        }
      } else {
        console.log("Timetable updated with default ObjectId (no user association)");
      }
    } catch (saveError) {
      console.error("Error updating timetable in database:", saveError);
      return res.status(200).json({
        success: true,
        message: "Timetable updated successfully but schedule couldn't be saved to database",
        error: saveError.message,
        data: {
          input: timetableData,
          result: generatedResult,
          saved: false,
          timetableId: projectId,
        },
      });
    }

    // Send response
    res.status(200).json({
      success: true,
      message: updatedTimetable
        ? "Timetable updated and saved successfully"
        : "Timetable updated successfully (not saved)",
      data: {
        input: timetableData,
        result: generatedResult,
        saved: updatedTimetable !== null,
        timetableId: updatedTimetable ? updatedTimetable._id : projectId,
      },
    });
  } catch (error) {
    console.error("Error updating timetable:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update timetable",
      error: error.message,
    });
  }
};

function generateTimetableSchedule(timetableData) {
  const schedules = {};
  const conflicts = [];
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  
  // Track subject assignments per grade-section to respect classesWeek
  const subjectAssignmentCount = {};
  // Track subjects scheduled per day for each grade-section with counts
  const dailySubjectAssignments = {};
  // Track faculty assignments per time slot to avoid double-booking
  const facultyAssignments = {};
  // Track room assignments per time slot to avoid double-booking
  const roomAssignments = {};
  
  // Pre-assign dedicated rooms for each grade-section with classAssignmentType "same"
  const gradeSectionRooms = {};
  const reservedRoomMapping = {}; // Maps room -> grade-section
  
  // Track consistent time slot assignments for grade-sections
  const timeSlotGradeSections = {}; // Maps timeSlot -> grade-section

  // Track grade-section assignments per time slot to avoid double-booking
  const gradeSectionAssignments = {};
  // Track grade-sections scheduled per room per time slot to avoid double-booking
  const roomGradeSectionAssignments = {};

  // Get unique time slots
  const uniqueTimeSlots = [];
  timetableData.timeSlots.forEach(slot => {
    const timeSlot = `${slot.startTime}-${slot.endTime}`;
    if (!uniqueTimeSlots.includes(timeSlot)) {
      uniqueTimeSlots.push(timeSlot);
    }
  });
  
  // Sort time slots chronologically
  uniqueTimeSlots.sort((a, b) => {
    const timeA = a.split('-')[0];
    const timeB = b.split('-')[0];
    return timeA.localeCompare(timeB);
  });
  
  // Initialize timeSlotGradeSections for all unique time slots
  uniqueTimeSlots.forEach(timeSlot => {
    timeSlotGradeSections[timeSlot] = [];
  });

  // Validate input data: Check if enough slots exist
  timetableData.grades.forEach(grade => {
    const gradeSection = `${grade.grade}-${grade.section}`;
    const totalClassesNeeded = timetableData.subjects
      .filter(subject => subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section))
      .reduce((sum, subject) => sum + parseInt(subject.classesWeek), 0);

    const totalAvailableSlots = days.length * uniqueTimeSlots.length;
    if (totalClassesNeeded > totalAvailableSlots) {
      conflicts.push(
        `Insufficient time slots for ${gradeSection}: ${totalClassesNeeded} classes needed, but only ${totalAvailableSlots} slots available`
      );
    }
  });

  // Initialize tracking structures
  days.forEach(day => {
    gradeSectionAssignments[day] = {};
    roomGradeSectionAssignments[day] = {};
    
    uniqueTimeSlots.forEach(timeSlot => {
      gradeSectionAssignments[day][timeSlot] = new Set();
      roomGradeSectionAssignments[day][timeSlot] = {};
    });
  });
  
  // Initialize schedules and assignment tracking
  timetableData.grades.forEach(grade => {
    const gradeSection = `${grade.grade}-${grade.section}`;
    schedules[gradeSection] = {};
    subjectAssignmentCount[gradeSection] = {};
    dailySubjectAssignments[gradeSection] = {};

    // Initialize subject assignment counts
    timetableData.subjects
      .filter(subject => 
        subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section)
      )
      .forEach(subject => {
        subjectAssignmentCount[gradeSection][subject.code] = 0;
      });

    // Initialize daily subject assignments with counts
    days.forEach(day => {
      schedules[gradeSection][day] = [];
      dailySubjectAssignments[gradeSection][day] = {};
    });

    // Assign a dedicated room for grade-section when classAssignmentType is "same"
    if (grade.classAssignmentType === "same") {
      const availableRooms = timetableData.classes.filter(c => 
        parseInt(c.capacity) >= parseInt(grade.strength) &&
        !reservedRoomMapping[c.room]
      );

      if (availableRooms.length > 0) {
        const assignedRoom = availableRooms[0].room;
        gradeSectionRooms[gradeSection] = assignedRoom;
        reservedRoomMapping[assignedRoom] = gradeSection;
      } else {
        conflicts.push(`No suitable available room for ${gradeSection} with strength ${grade.strength}`);
        gradeSectionRooms[gradeSection] = "Unassigned";
      }
    } else if (grade.classAssignmentType === "any") {
      const availableRooms = timetableData.classes.filter(c => 
        parseInt(c.capacity) >= parseInt(grade.strength)
      );
      
      gradeSectionRooms[gradeSection] = availableRooms.length > 0 
        ? availableRooms[Math.floor(Math.random() * availableRooms.length)].room 
        : "Unassigned";
    }
  });

  // Initialize faculty and room assignments for each time slot
  timetableData.timeSlots.forEach(slot => {
    const timeSlotKey = `${slot.day}_${slot.startTime}-${slot.endTime}`;
    facultyAssignments[timeSlotKey] = new Set();
    roomAssignments[timeSlotKey] = new Set();
  });

  // STEP 1: Create an assignment map for faculty to consistently teach the same grade-sections at the same time slots
  const facultySubjects = {};
  timetableData.subjects.forEach(subject => {
    (subject.facultyIds || []).forEach(facultyId => {
      if (!facultySubjects[facultyId]) {
        facultySubjects[facultyId] = [];
      }
      facultySubjects[facultyId].push(subject);
    });
  });
  
  Object.entries(facultySubjects).forEach(([facultyId, subjects]) => {
    uniqueTimeSlots.forEach(timeSlot => {
      const applicableGradeSections = [];
      
      subjects.forEach(subject => {
        subject.gradeSections.forEach(gs => {
          const gradeSection = `${gs.grade}-${gs.section}`;
          
          const isApplicable = timetableData.timeSlots.some(slot => {
            if (`${slot.startTime}-${slot.endTime}` !== timeSlot) return false;
            
            const slotApplicableTo = Array.isArray(slot.applicableTo) 
              ? slot.applicableTo 
              : [slot.applicableTo];
              
            return slotApplicableTo.some(item => 
              item === gradeSection || 
              item === `${gs.grade} - ${gs.section}`
            );
          });
          
          if (isApplicable && !applicableGradeSections.some(item => item.gradeSection === gradeSection)) {
            applicableGradeSections.push({
              gradeSection,
              subject: subject.code,
              faculty: facultyId
            });
          }
        });
      });
      
      if (applicableGradeSections.length > 0) {
        applicableGradeSections.sort((a, b) => {
          const subjectA = timetableData.subjects.find(s => s.code === a.subject);
          const subjectB = timetableData.subjects.find(s => s.code === b.subject);
          if (!subjectA || !subjectB) return 0;
          
          const classesA = parseInt(subjectA.classesWeek);
          const classesB = parseInt(subjectB.classesWeek);
          return classesB - classesA;
        });
        
        const selected = applicableGradeSections[0];
        
        if (!timeSlotGradeSections[timeSlot].some(item => 
            item.gradeSection === selected.gradeSection && 
            item.faculty === selected.faculty)) {
          timeSlotGradeSections[timeSlot].push({
            gradeSection: selected.gradeSection,
            subject: selected.subject,
            faculty: selected.faculty
          });
        }
      }
    });
  });

  // STEP 1.5: Ensure all subjects get scheduled
  timetableData.subjects.forEach(subject => {
    const weeklyClasses = parseInt(subject.classesWeek);
    if (weeklyClasses <= 0) return;
    
    subject.gradeSections.forEach(gs => {
      const gradeSection = `${gs.grade}-${gs.section}`;
      let assignedCount = 0;
      
      uniqueTimeSlots.forEach(timeSlot => {
        assignedCount += timeSlotGradeSections[timeSlot].filter(
          assignment => 
            assignment.gradeSection === gradeSection && 
            assignment.subject === subject.code
        ).length;
      });
      
      if (assignedCount < weeklyClasses) {
        let availableTimeSlots = uniqueTimeSlots.filter(timeSlot => {
          const isApplicable = timetableData.timeSlots.some(slot => {
            if (`${slot.startTime}-${slot.endTime}` !== timeSlot) return false;
            const slotApplicableTo = Array.isArray(slot.applicableTo) 
              ? slot.applicableTo 
              : [slot.applicableTo];
            return slotApplicableTo.some(item => 
              item === gradeSection || 
              item === `${gs.grade} - ${gs.section}`
            );
          });
          return isApplicable;
        });
        
        // Create a shuffled copy
        const shuffledTimeSlots = [...availableTimeSlots].sort(() => Math.random() - 0.5);
        
        for (const timeSlot of shuffledTimeSlots) {
          if (assignedCount >= weeklyClasses) break;
          
          const existingAssignment = timeSlotGradeSections[timeSlot].find(
            assignment => assignment.gradeSection === gradeSection
          );
          
          if (existingAssignment) {
            const existingSubject = timetableData.subjects.find(s => s.code === existingAssignment.subject);
            if (!existingSubject) continue;
            
            let existingSubjectCount = 0;
            uniqueTimeSlots.forEach(ts => {
              existingSubjectCount += timeSlotGradeSections[ts].filter(
                assignment => 
                  assignment.gradeSection === gradeSection && 
                  assignment.subject === existingAssignment.subject
              ).length;
            });
            
            if (existingSubjectCount > parseInt(existingSubject.classesWeek)) {
              existingAssignment.subject = subject.code;
              existingAssignment.faculty = subject.facultyIds && subject.facultyIds.length > 0 ? subject.facultyIds[0] : "";
              assignedCount++;
            }
          } else {
            timeSlotGradeSections[timeSlot].push({
              gradeSection,
              subject: subject.code,
              faculty: subject.facultyIds && subject.facultyIds.length > 0 ? subject.facultyIds[0] : ""
            });
            assignedCount++;
          }
        }
        
        if (assignedCount < weeklyClasses) {
          conflicts.push(`Could not schedule all ${weeklyClasses} classes for ${subject.code} in ${gradeSection}`);
        }
      }
    });
  });

  // STEP 2: Schedule subjects based on the consistent faculty-grade-section assignments
  days.forEach(day => {
    const daySlots = timetableData.timeSlots
      .filter(slot => slot.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    
    daySlots.forEach(slot => {
      const timeSlot = `${slot.startTime}-${slot.endTime}`;
      const timeSlotKey = `${day}_${timeSlot}`;
      
      const timeSlotAssignments = timeSlotGradeSections[timeSlot] || [];
      
      timeSlotAssignments.forEach(assignment => {
        const { gradeSection, subject: preferredSubject, faculty } = assignment;
        
        const slotApplicableTo = Array.isArray(slot.applicableTo) 
          ? slot.applicableTo 
          : [slot.applicableTo];
        
        const [gradeNum, section] = gradeSection.split('-');
        const isApplicable = slotApplicableTo.some(item => 
          item === gradeSection || item === `${gradeNum} - ${section}`
        );
        
        if (!isApplicable) return;
        
        const grade = timetableData.grades.find(g => g.grade === gradeNum && g.section === section);
        if (!grade) return;
        
        const assignedRoom = gradeSectionRooms[gradeSection];
        
        const subjectObj = timetableData.subjects.find(s => s.code === preferredSubject);
        
        let availableSubjects = [];
        if (subjectObj && 
            subjectObj.facultyIds.includes(faculty) &&
            subjectAssignmentCount[gradeSection][preferredSubject] < parseInt(subjectObj.classesWeek) &&
            !dailySubjectAssignments[gradeSection][day][preferredSubject]) {
          availableSubjects = [subjectObj];
        } else {
          availableSubjects = timetableData.subjects
            .filter(subject => 
              subject.gradeSections.some(gs => gs.grade === gradeNum && gs.section === section) &&
              subject.facultyIds.includes(faculty) &&
              subjectAssignmentCount[gradeSection][subject.code] < parseInt(subject.classesWeek) &&
              !dailySubjectAssignments[gradeSection][day][subject.code]
            )
            .sort((a, b) => 
              (parseInt(b.classesWeek) - subjectAssignmentCount[gradeSection][b.code]) - 
              (parseInt(a.classesWeek) - subjectAssignmentCount[gradeSection][a.code])
            );
        }
        
        if (availableSubjects.length > 0) {
          let scheduledSubject = false;
          
          for (const subject of availableSubjects) {
            for (const faculty of subject.facultyIds) {
              if (facultyAssignments[timeSlotKey].has(faculty)) continue;
              
              let possibleRooms = [];
              if (subject.assignedClasses && subject.assignedClasses.length > 0) {
                possibleRooms = subject.assignedClasses;
              } else if (grade.classAssignmentType === "same") {
                possibleRooms = [assignedRoom];
              } else {
                possibleRooms = timetableData.classes
                  .filter(c => parseInt(c.capacity) >= parseInt(grade.strength))
                  .map(c => c.room);
              }
              
              const availableRooms = possibleRooms.filter(room => {
                if (roomAssignments[timeSlotKey].has(room)) return false;
                if (reservedRoomMapping[room] && reservedRoomMapping[room] !== gradeSection) return false;
                return room !== "Unassigned";
              });
              
              if (availableRooms.length > 0) {
                if (gradeSectionAssignments[day][timeSlot].has(gradeSection)) {
                  conflicts.push(`Grade-section ${gradeSection} already scheduled on ${day} at ${timeSlot}`);
                  continue;
                }
                
                const selectedRoom = availableRooms[0];
                
                if (roomGradeSectionAssignments[day][timeSlot][selectedRoom]) {
                  if (roomGradeSectionAssignments[day][timeSlot][selectedRoom] === gradeSection) {
                    schedules[gradeSection][day] = schedules[gradeSection][day].filter(
                      item => item.timeSlot !== timeSlot || item.room !== selectedRoom
                    );
                  } else {
                    conflicts.push(
                      `Room ${selectedRoom} already occupied by ${roomGradeSectionAssignments[day][timeSlot][selectedRoom]} on ${day} at ${timeSlot}`
                    );
                    continue;
                  }
                }
                
                subjectAssignmentCount[gradeSection][subject.code]++;
                dailySubjectAssignments[gradeSection][day][subject.code] = 1;
                facultyAssignments[timeSlotKey].add(faculty);
                roomAssignments[timeSlotKey].add(selectedRoom);
                gradeSectionAssignments[day][timeSlot].add(gradeSection);
                roomGradeSectionAssignments[day][timeSlot][selectedRoom] = gradeSection;
                
                schedules[gradeSection][day].push({
                  timeSlot: timeSlot,
                  subject: subject.code,
                  faculty: faculty,
                  room: selectedRoom
                });
                
                scheduledSubject = true;
                break;
              }
            }
            if (scheduledSubject) break;
          }
          
          if (!scheduledSubject) {
            if (assignedRoom !== "Unassigned" && !roomGradeSectionAssignments[day][timeSlot][assignedRoom]) {
              roomGradeSectionAssignments[day][timeSlot][assignedRoom] = gradeSection;
              schedules[gradeSection][day].push({
                timeSlot: timeSlot,
                subject: "Free Period",
                faculty: "",
                room: assignedRoom
              });
            }
            conflicts.push(`No available room/faculty for ${gradeSection} on ${day} at ${timeSlot}`);
          }
        } else {
          if (assignedRoom !== "Unassigned" && !roomGradeSectionAssignments[day][timeSlot][assignedRoom]) {
            roomGradeSectionAssignments[day][timeSlot][assignedRoom] = gradeSection;
            schedules[gradeSection][day].push({
              timeSlot: timeSlot,
              subject: "Free Period",
              faculty: "",
              room: assignedRoom
            });
          }
          conflicts.push(`No available subjects for ${gradeSection} on ${day} at ${timeSlot}`);
        }
      });
    });
  });

  // STEP 2.5: Fill gaps for subjects not fully scheduled
  timetableData.grades.forEach(grade => {
    const gradeSection = `${grade.grade}-${grade.section}`;
    const assignedRoom = gradeSectionRooms[gradeSection];

    timetableData.subjects
      .filter(subject => subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section))
      .forEach(subject => {
        const requiredClasses = parseInt(subject.classesWeek);
        let assignedClasses = subjectAssignmentCount[gradeSection][subject.code] || 0;

        if (assignedClasses < requiredClasses) {
          days.forEach(day => {
            const freePeriods = schedules[gradeSection][day].filter(
              item => item.subject === "Free Period" && item.timeSlot
            );

            for (const freePeriod of freePeriods) {
              if (assignedClasses >= requiredClasses) break;

              const timeSlot = freePeriod.timeSlot;
              const timeSlotKey = `${day}_${timeSlot}`;

              const availableFaculty = subject.facultyIds.find(
                faculty => !facultyAssignments[timeSlotKey].has(faculty)
              );

              if (!availableFaculty) continue;

              const possibleRooms = subject.assignedClasses && subject.assignedClasses.length > 0
                ? subject.assignedClasses
                : [assignedRoom].filter(room => room !== "Unassigned");

              const availableRooms = possibleRooms.filter(
                room => !roomAssignments[timeSlotKey].has(room) &&
                        (!reservedRoomMapping[room] || reservedRoomMapping[room] === gradeSection)
              );

              if (availableRooms.length === 0) continue;

              const selectedRoom = availableRooms[0];
              schedules[gradeSection][day] = schedules[gradeSection][day].filter(
                item => item !== freePeriod
              );

              subjectAssignmentCount[gradeSection][subject.code]++;
              dailySubjectAssignments[gradeSection][day][subject.code] = 1;
              facultyAssignments[timeSlotKey].add(availableFaculty);
              roomAssignments[timeSlotKey].add(selectedRoom);
              gradeSectionAssignments[day][timeSlot].add(gradeSection);
              roomGradeSectionAssignments[day][timeSlot][selectedRoom] = gradeSection;

              schedules[gradeSection][day].push({
                timeSlot: timeSlot,
                subject: subject.code,
                faculty: availableFaculty,
                room: selectedRoom
              });

              assignedClasses++;
            }
          });

          if (assignedClasses < requiredClasses) {
            conflicts.push(
              `Could not schedule ${requiredClasses - assignedClasses} remaining classes for ${subject.code} in ${gradeSection}`
            );
          }
        }
      });
  });

  // STEP 3: Sort schedules by time slot and remove duplicates
  timetableData.grades.forEach(grade => {
    const gradeSection = `${grade.grade}-${grade.section}`;
    
    days.forEach(day => {
      const filteredSchedule = [];
      const processedTimeSlots = new Set();
      
      schedules[gradeSection][day].sort((a, b) => {
        const timeA = a.timeSlot.split('-')[0];
        const timeB = b.timeSlot.split('-')[0];
        return timeA.localeCompare(timeB);
      });
      
      schedules[gradeSection][day].forEach(item => {
        if (item.subject === "Free Period") {
          if (!processedTimeSlots.has(item.timeSlot) && 
              (!item.room || 
               item.room === "" || 
               !roomGradeSectionAssignments[day][item.timeSlot] || 
               roomGradeSectionAssignments[day][item.timeSlot][item.room] === gradeSection)) {
            filteredSchedule.push(item);
            processedTimeSlots.add(item.timeSlot);
          }
        } else {
          filteredSchedule.push(item);
          processedTimeSlots.add(item.timeSlot);
        }
      });
      
      schedules[gradeSection][day] = filteredSchedule;
    });
  });

  return {
    generatedOn: new Date(),
    generationStatus: conflicts.length > 0 ? "partial" : "success",
    conflicts,
    schedules,
    algorithm: "consistent-grade-section",
    version: "1.0"
  };
}

export const saveGenerationResults = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const generationResults = req.body;
    const userId = req.user?._id || req.body.userId;

    // Validate input
    if (!timetableId || !generationResults || !generationResults.schedules) {
      return res.status(400).json({
        success: false,
        message: "Missing required data. Please provide timetableId and valid generation results."
      });
    }

    // Find the timetable
    const timetable = await Timetable.findOne({
      _id: timetableId,
      createdBy: userId
    });

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Timetable not found or you don't have permission to update it"
      });
    }

    // Add timestamp if not provided
    if (!generationResults.generatedOn) {
      generationResults.generatedOn = new Date();
    }

    // Convert the schedules object to proper format for MongoDB Map
    const schedulesMap = new Map();
    
    for (const [gradeSection, daySchedules] of Object.entries(generationResults.schedules)) {
      const dayScheduleMap = new Map();
      
      for (const [day, assignments] of Object.entries(daySchedules)) {
        dayScheduleMap.set(day, assignments);
      }
      
      schedulesMap.set(gradeSection, dayScheduleMap);
    }
    
    // Update the generationResults with the correctly formatted schedules
    const formattedResult = {
      ...generationResults,
      schedules: schedulesMap
    };

    // Update the timetable with the new generation results
    const updatedTimetable = await Timetable.findByIdAndUpdate(
      timetableId,
      { 
        $push: { generationResults: formattedResult },
        $set: { 
          latestGeneration: formattedResult.generatedOn,
          hasGeneratedResults: true 
        }
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Generation results saved successfully",
      data: {
        timetableId: updatedTimetable._id,
        projectName: updatedTimetable.projectName,
        latestGeneration: updatedTimetable.latestGeneration
      }
    });
  } catch (error) {
    console.error("Error saving generation results:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save generation results",
      error: error.message
    });
  }
};

// Get all timetables with generated results for a user
export const getTimetablesWithResults = async (req, res) => {
  try {
    const userId = req.user?._id || req.query.userId;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Find timetables with generation results
    const timetables = await Timetable.find({
      createdBy: userId,
      hasGeneratedResults: true
    }).select("projectName createdAt latestGeneration");

    res.status(200).json({
      success: true,
      count: timetables.length,
      data: timetables
    });
  } catch (error) {
    console.error("Error fetching timetables:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch timetables",
      error: error.message
    });
  }
};

// Get the latest generation result for a specific timetable
export const getLatestGenerationResult = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const userId = req.user?._id || req.query.userId;

    // Find the timetable
    const timetable = await Timetable.findOne({
      _id: timetableId,
      createdBy: userId
    });

    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Timetable not found or you don't have permission to view it"
      });
    }

    if (!timetable.hasGeneratedResults || !timetable.generationResults || timetable.generationResults.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No generation results found for this timetable"
      });
    }

    // Get the latest generation result
    const latestResult = timetable.generationResults[timetable.generationResults.length - 1];
    
    // Convert Maps back to objects for the response
    const formattedResult = {
      ...latestResult.toObject(),
      schedules: {}
    };
    
    // Convert the schedules Map to a plain object
    latestResult.schedules.forEach((daySchedules, gradeSection) => {
      formattedResult.schedules[gradeSection] = {};
      
      daySchedules.forEach((assignments, day) => {
        formattedResult.schedules[gradeSection][day] = assignments;
      });
    });

    res.status(200).json({
      success: true,
      data: {
        timetableId: timetable._id,
        projectName: timetable.projectName,
        latestGeneration: timetable.latestGeneration,
        result: formattedResult
      }
    });
  } catch (error) {
    console.error("Error fetching generation result:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch generation result",
      error: error.message
    });
  }
};


export const getTimetablesByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required." });
    }

    // Only select projectName and _id
    const timetables = await Timetable.find({ createdBy: userId })
      .select("projectName")
      .sort({ createdAt: -1 });

    if (timetables.length === 0) {
      return res.status(404).json({ message: "No timetables found for this user." });
    }

    res.status(200).json(timetables);
  } catch (error) {
    console.error("Error fetching timetables by user:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

export const getTimetableById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Timetable ID is required." });
    }

    // Use populate to get the creator's name from the User model
    const timetable = await Timetable.findById(id).populate({
      path: 'createdBy',
      model: 'User',
      select: 'name' // Only get the name field from User model
    });

    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found." });
    }

    // Only check permissions if authentication is being used
    // and req.user exists with an _id property
    if (req.user && req.user._id && timetable.createdBy && timetable.createdBy._id) {
      if (timetable.createdBy._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "You don't have permission to access this timetable." });
      }
    }

    res.status(200).json(timetable);
  } catch (error) {
    console.error("Error fetching timetable by ID:", error);
    
    // Check if error is due to invalid ID format
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return res.status(400).json({ message: "Invalid timetable ID format." });
    }
    
    res.status(500).json({ message: "Internal server error." });
  }
};


//////

import { v4 as uuidv4 } from 'uuid';

/**
 * Process a natural language request and return proposed changes
 * @param {Object} req - Request object containing projectId and userMessage
 * @param {Object} res - Response object
 */
export const processRequest = async (req, res) => {
  try {
    const { projectId, userMessage } = req.body;

    if (!projectId || !userMessage) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: projectId and userMessage are required."
      });
    }

    // 1. Fetch the current timetable data
    const timetable = await Timetable.findById(projectId);
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Timetable project not found"
      });
    }

    // 2. Process the natural language request using pattern matching
    const requestAnalysis = analyzeRequest(userMessage, timetable);
    
    if (!requestAnalysis.success) {
      return res.status(400).json({ 
        success: false, 
        message: requestAnalysis.message 
      });
    }

    // 3. Generate proposed changes based on the request analysis
    const proposedChanges = generateProposedChanges(requestAnalysis, timetable);
    
    // 4. Return the proposed changes for frontend approval
    return res.status(200).json({
      success: true,
      message: requestAnalysis.response,
      proposedChanges: proposedChanges,
      changeId: uuidv4() // Unique ID to track this change request
    });
  } catch (error) {
    console.error("Error processing timetable request:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to process your request. Please try again.",
      error: error.message
    });
  }
};

/**
 * Apply approved changes to the timetable
 * @param {Object} req - Request object containing projectId, changeId, and approvedChanges
 * @param {Object} res - Response object
 */
export const applyChanges = async (req, res) => {
  try {
    const { projectId, changeId, approvedChanges } = req.body;

    if (!projectId || !changeId || !approvedChanges) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: projectId, changeId, and approvedChanges are required."
      });
    }

    // 1. Fetch the current timetable data
    const timetable = await Timetable.findById(projectId);
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Timetable project not found"
      });
    }
    
    // 2. Apply the database operation based on the change
    const { changeType, entityType, collectionPath, currentState, newState } = approvedChanges;
    
    let updateOperation = {};
    let updateResult = null;
    
    switch (changeType) {
      case 'add':
        // Add a new item to the collection
        updateOperation = { 
          $push: { [collectionPath]: newState } 
        };
        break;
        
      case 'modify':
        // Find and update the existing item
        if (!currentState || !currentState._id) {
          return res.status(400).json({ 
            success: false, 
            message: `Cannot find ${entityType} to update` 
          });
        }
        
        // For each field in newState, create an update operation
        updateOperation = { $set: {} };
        Object.entries(newState).forEach(([key, value]) => {
          if (key !== '_id') {
            updateOperation.$set[`${collectionPath}.$[elem].${key}`] = value;
          }
        });
        
        updateResult = await Timetable.updateOne(
          { _id: projectId },
          updateOperation,
          { 
            arrayFilters: [{ "elem._id": currentState._id }],
            new: true 
          }
        );
        break;
        
      case 'delete':
        // Remove the item from the collection
        if (!currentState || !currentState._id) {
          return res.status(400).json({ 
            success: false, 
            message: `Cannot find ${entityType} to delete` 
          });
        }
        
        updateOperation = { 
          $pull: { [collectionPath]: { _id: currentState._id } } 
        };
        break;
        
      default:
        return res.status(400).json({ 
          success: false, 
          message: "Invalid change type" 
        });
    }
    
    // If we haven't executed an update yet (for 'add' and 'delete' operations)
    if (!updateResult) {
      updateResult = await Timetable.updateOne(
        { _id: projectId },
        updateOperation
      );
    }
    
    if (updateResult.modifiedCount === 0) {
      return res.status(200).json({
        success: false,
        message: "No changes were applied to the timetable",
        details: updateResult
      });
    }
    
    // 3. Retrieve the updated timetable data
    const updatedTimetable = await Timetable.findById(projectId);
    
    // 4. Generate a new timetable schedule if necessary
    let generatedResult = null;
    if (shouldRegenerateSchedule(entityType, changeType)) {
      try {
        // Note: This function should be imported from your timetable generation module
        // For now, we'll just note that regeneration would happen here
        console.log("Would regenerate timetable schedule here");
        // generatedResult = generateTimetableSchedule(updatedTimetable);
      } catch (generationError) {
        console.error("Error regenerating timetable schedule:", generationError);
        // Continue with the response, but note the generation error
      }
    }
    
    // 5. Return success response with before/after details
    return res.status(200).json({
      success: true,
      message: `Successfully ${changeType === 'add' ? 'added' : changeType === 'modify' ? 'updated' : 'deleted'} the ${entityType}`,
      details: {
        before: timetable,
        after: updatedTimetable,
        changeType,
        entityType,
        changeId,
        scheduleRegenerated: generatedResult !== null,
        generationResult: generatedResult
      }
    });
  } catch (error) {
    console.error("Error applying timetable changes:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to apply changes to the timetable.", 
      error: error.message 
    });
  }
};

/**
 * Determine if schedule should be regenerated based on entity type and change type
 * @param {String} entityType - Type of entity changed
 * @param {String} changeType - Type of change made
 * @returns {Boolean} - Whether schedule should be regenerated
 */
const shouldRegenerateSchedule = (entityType, changeType) => {
  // Schedule should be regenerated for most changes except minor cosmetic ones
  if (changeType === 'add' || changeType === 'delete') {
    return true;
  }
  
  // For modifications, regenerate only if they impact scheduling
  if (entityType === 'timeSlot' || entityType === 'subject' || entityType === 'grade') {
    return true;
  }
  
  return false;
};

/**
 * Analyze the user's natural language request using pattern matching
 * @param {String} message - User's message
 * @param {Object} timetable - Current timetable data
 * @returns {Object} - Analysis of the request
 */
const analyzeRequest = (message, timetable) => {
  const lowercaseMsg = message.toLowerCase();
  
  // Detect operation type (add, update, delete)
  let changeType = '';
  if (lowercaseMsg.includes('add') || lowercaseMsg.includes('create') || lowercaseMsg.includes('new')) {
    changeType = 'add';
  } else if (lowercaseMsg.includes('change') || lowercaseMsg.includes('update') || lowercaseMsg.includes('modify')) {
    changeType = 'modify';
  } else if (lowercaseMsg.includes('delete') || lowercaseMsg.includes('remove')) {
    changeType = 'delete';
  } else {
    return { 
      success: false, 
      message: "I couldn't determine if you want to add, modify, or delete something. Please be more specific." 
    };
  }
  
  // Detect entity type (class, faculty, subject, timeSlot, grade)
  let entityType = '';
  if (lowercaseMsg.includes('class') || lowercaseMsg.includes('room')) {
    entityType = 'class';
  } else if (lowercaseMsg.includes('teacher') || lowercaseMsg.includes('faculty')) {
    entityType = 'faculty';
  } else if (lowercaseMsg.includes('subject') || lowercaseMsg.includes('course')) {
    entityType = 'subject';
  } else if (lowercaseMsg.includes('time') || lowercaseMsg.includes('slot') || lowercaseMsg.includes('schedule')) {
    entityType = 'timeSlot';
  } else if (lowercaseMsg.includes('grade') || lowercaseMsg.includes('section')) {
    entityType = 'grade';
  } else {
    return { 
      success: false, 
      message: "I couldn't determine what you want to modify (class, faculty, subject, time slot, or grade). Please be more specific." 
    };
  }
  
  // Extract entity identifier and changes
  const entityInfo = extractEntityInfo(message, entityType, changeType, timetable);
  if (!entityInfo.success) {
    return entityInfo;
  }
  
  // Generate human-readable response
  const response = `I understand you want to ${changeType} a ${entityType}: ${entityInfo.description}. Please review the changes before confirming.`;
  
  return {
    success: true,
    changeType,
    entityType,
    entityIdentifier: entityInfo.identifier,
    changes: entityInfo.changes,
    potentialConflicts: detectPotentialConflicts(entityType, entityInfo.changes, timetable),
    response,
    description: entityInfo.description
  };
};

/**
 * Extract entity information from the message
 * @param {String} message - User message
 * @param {String} entityType - Type of entity
 * @param {String} changeType - Type of change
 * @param {Object} timetable - Timetable data
 * @returns {Object} - Entity identifier and changes
 */
const extractEntityInfo = (message, entityType, changeType, timetable) => {
  const words = message.split(/\s+/);
  
  switch (entityType) {
    case 'class':
      return extractClassInfo(message, words, changeType, timetable);
    
    case 'faculty':
      return extractFacultyInfo(message, words, changeType, timetable);
    
    case 'subject':
      return extractSubjectInfo(message, words, changeType, timetable);
    
    case 'timeSlot':
      return extractTimeSlotInfo(message, words, changeType, timetable);
    
    case 'grade':
      return extractGradeInfo(message, words, changeType, timetable);
    
    default:
      return { 
        success: false, 
        message: "Unable to extract the necessary information. Please provide more details." 
      };
  }
};

/**
 * Extract class information
 */
const extractClassInfo = (message, words, changeType, timetable) => {
  // Extract room number
  const roomMatch = message.match(/room\s+([A-Za-z0-9-]+)/i);
  const roomIdentifier = roomMatch ? roomMatch[1] : null;
  
  // Extract building
  const buildingMatch = message.match(/building\s+([A-Za-z0-9-]+)/i);
  const building = buildingMatch ? buildingMatch[1] : null;
  
  // Extract capacity
  const capacityMatch = message.match(/capacity\s+(\d+)/i);
  const capacity = capacityMatch ? capacityMatch[1] : null;
  
  if (changeType === 'add' && (!roomIdentifier || !capacity)) {
    return {
      success: false,
      message: "To add a class, please specify both room number and capacity."
    };
  }
  
  if ((changeType === 'modify' || changeType === 'delete') && !roomIdentifier) {
    return {
      success: false,
      message: "Please specify which room you want to modify or delete."
    };
  }
  
  // For modify and delete, check if the class exists
  if ((changeType === 'modify' || changeType === 'delete') && roomIdentifier) {
    const classExists = timetable.classes.some(c => c.room === roomIdentifier);
    if (!classExists) {
      return {
        success: false,
        message: `Room ${roomIdentifier} doesn't exist in the timetable.`
      };
    }
  }
  
  // Prepare changes object
  const changes = {};
  if (building) changes.building = building;
  if (capacity) changes.capacity = capacity;
  if (roomIdentifier) changes.room = roomIdentifier;
  
  // Create description
  let description = '';
  if (changeType === 'add') {
    description = `Add room ${roomIdentifier}${building ? ' in ' + building : ''}${capacity ? ' with capacity ' + capacity : ''}`;
  } else if (changeType === 'modify') {
    description = `Update room ${roomIdentifier}${building ? ' to building ' + building : ''}${capacity ? ' with new capacity ' + capacity : ''}`;
  } else {
    description = `Delete room ${roomIdentifier}`;
  }
  
  return {
    success: true,
    identifier: roomIdentifier,
    changes,
    description
  };
};

/**
 * Extract faculty information
 */
const extractFacultyInfo = (message, words, changeType, timetable) => {
  // Extract faculty name
  const nameMatch = message.match(/name\s+([A-Za-z\s.]+)(?:,|\s|$)/i);
  const name = nameMatch ? nameMatch[1].trim() : null;
  
  // Extract faculty ID
  const idMatch = message.match(/id\s+([A-Za-z0-9-]+)/i);
  const id = idMatch ? idMatch[1] : null;
  
  // Extract email
  const emailMatch = message.match(/(?:email|mail)\s+([^\s,]+@[^\s,]+)/i);
  const email = emailMatch ? emailMatch[1] : null;
  
  if (changeType === 'add' && (!name || !id)) {
    return {
      success: false,
      message: "To add a faculty member, please specify both name and ID."
    };
  }
  
  if ((changeType === 'modify' || changeType === 'delete') && (!name && !id)) {
    return {
      success: false,
      message: "Please specify which faculty member you want to modify or delete by name or ID."
    };
  }
  
  // For modify and delete, check if the faculty exists
  if ((changeType === 'modify' || changeType === 'delete') && (name || id)) {
    const facultyExists = timetable.faculty.some(f => 
      (name && f.name === name) || (id && f.id === id)
    );
    
    if (!facultyExists) {
      return {
        success: false,
        message: `Faculty member ${name || id} doesn't exist in the timetable.`
      };
    }
  }
  
  // Prepare changes object
  const changes = {};
  if (name) changes.name = name;
  if (id) changes.id = id;
  if (email) changes.mail = email;
  
  // Create description
  let description = '';
  if (changeType === 'add') {
    description = `Add faculty ${name || ''} with ID ${id || ''}${email ? ' and email ' + email : ''}`;
  } else if (changeType === 'modify') {
    description = `Update faculty ${name || id}${email ? ' with new email ' + email : ''}`;
  } else {
    description = `Delete faculty ${name || id}`;
  }
  
  return {
    success: true,
    identifier: name || id,
    changes,
    description
  };
};

/**
 * Extract subject information
 */
const extractSubjectInfo = (message, words, changeType, timetable) => {
  // Extract subject code
  const codeMatch = message.match(/code\s+([A-Za-z0-9-]+)/i);
  const code = codeMatch ? codeMatch[1] : null;
  
  // Extract subject name
  const subjectMatch = message.match(/subject\s+([A-Za-z\s0-9]+)(?:,|\s|$)/i);
  const subject = subjectMatch ? subjectMatch[1].trim() : null;
  
  // Extract classes per week
  const classesWeekMatch = message.match(/classes\s+per\s+week\s+(\d+)/i);
  const classesWeek = classesWeekMatch ? classesWeekMatch[1] : null;
  
  // Extract if combined
  const isCombined = message.toLowerCase().includes('combined');
  
  if (changeType === 'add' && (!code || !subject)) {
    return {
      success: false,
      message: "To add a subject, please specify both code and subject name."
    };
  }
  
  if ((changeType === 'modify' || changeType === 'delete') && (!code && !subject)) {
    return {
      success: false,
      message: "Please specify which subject you want to modify or delete by code or name."
    };
  }
  
  // For modify and delete, check if the subject exists
  if ((changeType === 'modify' || changeType === 'delete') && (code || subject)) {
    const subjectExists = timetable.subjects.some(s => 
      (code && s.code === code) || (subject && s.subject === subject)
    );
    
    if (!subjectExists) {
      return {
        success: false,
        message: `Subject ${subject || code} doesn't exist in the timetable.`
      };
    }
  }
  
  // Prepare changes object
  const changes = {};
  if (code) changes.code = code;
  if (subject) changes.subject = subject;
  if (classesWeek) changes.classesWeek = classesWeek;
  if (message.includes('combined')) changes.isCombined = true;
  
  // For add operation, initialize gradeSections as empty array
  if (changeType === 'add') {
    changes.gradeSections = [];
    changes.facultyIds = [];
    changes.assignedClasses = [];
  }
  
  // Create description
  let description = '';
  if (changeType === 'add') {
    description = `Add subject ${subject || ''} with code ${code || ''}${classesWeek ? ', ' + classesWeek + ' classes per week' : ''}${isCombined ? ', combined' : ''}`;
  } else if (changeType === 'modify') {
    description = `Update subject ${subject || code}${classesWeek ? ' to have ' + classesWeek + ' classes per week' : ''}${isCombined ? ', set as combined' : ''}`;
  } else {
    description = `Delete subject ${subject || code}`;
  }
  
  return {
    success: true,
    identifier: code || subject,
    changes,
    description
  };
};

/**
 * Extract time slot information
 */
const extractTimeSlotInfo = (message, words, changeType, timetable) => {
  // Extract day
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  let day = null;
  
  for (const possibleDay of days) {
    if (message.toLowerCase().includes(possibleDay)) {
      day = possibleDay.charAt(0).toUpperCase() + possibleDay.slice(1);
      break;
    }
  }
  
  // Extract start time
  const startTimeMatch = message.match(/(?:start|from)\s+(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)/i);
  let startTime = startTimeMatch ? startTimeMatch[1] : null;
  
  // Extract end time
  const endTimeMatch = message.match(/(?:end|to)\s+(\d{1,2}(?::\d{2})?(?:\s*[ap]m)?)/i);
  let endTime = endTimeMatch ? endTimeMatch[1] : null;
  
  // Extract applicable to (grades/sections)
  const applicableToMatch = message.match(/applicable\s+to\s+([A-Za-z0-9,-\s]+)/i);
  const applicableTo = applicableToMatch ? 
    applicableToMatch[1].split(',').map(item => item.trim()) : 
    [];
  
  if (changeType === 'add' && (!day || !startTime || !endTime)) {
    return {
      success: false,
      message: "To add a time slot, please specify day, start time, and end time."
    };
  }
  
  if ((changeType === 'modify' || changeType === 'delete') && (!day || (!startTime && !endTime))) {
    return {
      success: false,
      message: "Please specify which time slot you want to modify or delete with day and at least start or end time."
    };
  }
  
  // Standardize time format if needed
  if (startTime) {
    // Convert to 24-hour format if needed
    if (startTime.toLowerCase().includes('pm') && !startTime.startsWith('12')) {
      const hourPart = parseInt(startTime.split(':')[0]);
      startTime = `${hourPart + 12}:${startTime.includes(':') ? startTime.split(':')[1].replace(/[ap]m/i, '') : '00'}`;
    } else {
      startTime = startTime.replace(/[ap]m/i, '');
      if (!startTime.includes(':')) {
        startTime = `${startTime}:00`;
      }
    }
  }
  
  if (endTime) {
    // Convert to 24-hour format if needed
    if (endTime.toLowerCase().includes('pm') && !endTime.startsWith('12')) {
      const hourPart = parseInt(endTime.split(':')[0]);
      endTime = `${hourPart + 12}:${endTime.includes(':') ? endTime.split(':')[1].replace(/[ap]m/i, '') : '00'}`;
    } else {
      endTime = endTime.replace(/[ap]m/i, '');
      if (!endTime.includes(':')) {
        endTime = `${endTime}:00`;
      }
    }
  }
  
  // For modify and delete, check if the time slot exists
  if ((changeType === 'modify' || changeType === 'delete') && day) {
    const timeSlotExists = timetable.timeSlots.some(t => 
      t.day === day && 
      ((startTime && t.startTime === startTime) || (endTime && t.endTime === endTime))
    );
    
    if (!timeSlotExists) {
      return {
        success: false,
        message: `Time slot for ${day} at ${startTime || endTime} doesn't exist in the timetable.`
      };
    }
  }
  
  // Prepare changes object
  const changes = {};
  if (day) changes.day = day;
  if (startTime) changes.startTime = startTime;
  if (endTime) changes.endTime = endTime;
  if (applicableTo.length > 0) changes.applicableTo = applicableTo;
  
  // Create identifier for timeSlot (day + time)
  const identifier = `${day} ${startTime}-${endTime}`;
  
  // Create description
  let description = '';
  if (changeType === 'add') {
    description = `Add time slot on ${day} from ${startTime} to ${endTime}${applicableTo.length > 0 ? ' applicable to ' + applicableTo.join(', ') : ''}`;
  } else if (changeType === 'modify') {
    description = `Update time slot on ${day}${startTime ? ' starting at ' + startTime : ''}${endTime ? ' ending at ' + endTime : ''}${applicableTo.length > 0 ? ' to be applicable to ' + applicableTo.join(', ') : ''}`;
  } else {
    description = `Delete time slot on ${day}${startTime ? ' starting at ' + startTime : ''}${endTime ? ' ending at ' + endTime : ''}`;
  }
  
  return {
    success: true,
    identifier,
    changes,
    description
  };
};

/**
 * Extract grade information
 */
const extractGradeInfo = (message, words, changeType, timetable) => {
  // Extract grade
  const gradeMatch = message.match(/grade\s+([A-Za-z0-9-]+)/i);
  const grade = gradeMatch ? gradeMatch[1] : null;
  
  // Extract section
  const sectionMatch = message.match(/section\s+([A-Za-z0-9-]+)/i);
  const section = sectionMatch ? sectionMatch[1] : null;
  
  // Extract strength
  const strengthMatch = message.match(/strength\s+(\d+)/i);
  const strength = strengthMatch ? strengthMatch[1] : null;
  
  // Extract class assignment type
  const classAssignmentType = message.toLowerCase().includes('same class') ? 'same' : 
                             message.toLowerCase().includes('any class') ? 'any' : null;
  
  if (changeType === 'add' && (!grade || !section)) {
    return {
      success: false,
      message: "To add a grade, please specify both grade and section."
    };
  }
  
  if ((changeType === 'modify' || changeType === 'delete') && (!grade || !section)) {
    return {
      success: false,
      message: "Please specify which grade-section you want to modify or delete."
    };
  }
  
  // For modify and delete, check if the grade exists
  if ((changeType === 'modify' || changeType === 'delete') && grade && section) {
    const gradeExists = timetable.grades.some(g => 
      g.grade === grade && g.section === section
    );
    
    if (!gradeExists) {
      return {
        success: false,
        message: `Grade ${grade} section ${section} doesn't exist in the timetable.`
      };
    }
  }
  
  // Prepare changes object
  const changes = {};
  if (grade) changes.grade = grade;
  if (section) changes.section = section;
  if (strength) changes.strength = strength;
  if (classAssignmentType) changes.classAssignmentType = classAssignmentType;
  
  // Create identifier
  const identifier = `${grade}-${section}`;
  
  // Create description
  let description = '';
  if (changeType === 'add') {
    description = `Add grade ${grade} section ${section}${strength ? ' with strength ' + strength : ''}${classAssignmentType ? ' using ' + classAssignmentType + ' class assignment' : ''}`;
  } else if (changeType === 'modify') {
    description = `Update grade ${grade} section ${section}${strength ? ' to strength ' + strength : ''}${classAssignmentType ? ' using ' + classAssignmentType + ' class assignment' : ''}`;
  } else {
    description = `Delete grade ${grade} section ${section}`;
  }
  
  return {
    success: true,
    identifier,
    changes,
    description
  };
};

/**
 * Generate proposed changes based on analysis
 * @param {Object} analysis - Analysis from pattern matching
 * @param {Object} timetable - Current timetable
 * @returns {Object} - Detailed proposed changes
 */
const generateProposedChanges = (analysis, timetable) => {
  const { changeType, entityType, entityIdentifier, changes } = analysis;
  
  // Deep clone the relevant part of the timetable to show changes
  let currentState = null;
  let newState = null;
  let collectionPath = '';
  
  switch (entityType) {
    case 'class':
      collectionPath = 'classes';
      currentState = timetable.classes.find(c => c.room === entityIdentifier);
      break;
    case 'faculty':
      collectionPath = 'faculty';
      currentState = timetable.faculty.find(f => 
        f.id === entityIdentifier || f.name === entityIdentifier
      );
      break;
    case 'subject':
      collectionPath = 'subjects';
      currentState = timetable.subjects.find(s => 
        s.code === entityIdentifier || s.subject === entityIdentifier
      );
      break;
    case 'timeSlot':
      collectionPath = 'timeSlots';
      const [day, times] = entityIdentifier.split(' ');
      const [startTime, endTime] = times ? times.split('-') : [null, null];
      
      currentState = timetable.timeSlots.find(t => 
        t.day === day && 
        (startTime ? t.startTime === startTime : true) && 
        (endTime ? t.endTime === endTime : true)
      );
      break;
    case 'grade':
      collectionPath = 'grades';
      const [grade, section] = entityIdentifier.split('-');
      currentState = timetable.grades.find(g => 
        g.grade === grade && g.section === section
      );
      break;
  }
  
  // Create new state based on change type
  if (changeType === 'add') {
    newState = changes;
  } else if (changeType === 'modify' && currentState) {
    newState = { ...JSON.parse(JSON.stringify(currentState)), ...changes };
  } 
  // For 'delete', newState remains null
  
  return {
    changeType,
    entityType,
    entityIdentifier,
    collectionPath,
    currentState,
    newState,
    potentialConflicts: analysis.potentialConflicts || [],
    databaseOperation: generateDatabaseOperation(
      changeType, 
      entityType, 
      entityIdentifier, 
      changes, 
      collectionPath,
      currentState
    )
  };
};

/**
 * Generate the actual database operation for the changes
 * @param {String} changeType - Type of change (add, modify, delete)
 * @param {String} entityType - Type of entity being changed
 * @param {String} entityIdentifier - Identifier for the entity
 * @param {Object} changes - The changes to apply
 * @param {String} collectionPath - Path to the collection in the timetable
 * @param {Object} currentState - Current state of the entity (if exists)
 * @returns {Object} - Database operation details
 */
const generateDatabaseOperation = (changeType, entityType, entityIdentifier, changes, collectionPath, currentState) => {
  // Create the appropriate MongoDB update operation
  switch (changeType) {
    case 'add':
      return {
        operation: 'updateOne',
        query: { _id: 'PLACEHOLDER_FOR_PROJECT_ID' },
        update: { $push: { [collectionPath]: changes } }
      };
    
    case 'modify':
      let query = { _id: 'PLACEHOLDER_FOR_PROJECT_ID' };
      let updateFields = {};
      
      // Build the update fields based on entity type
      switch (entityType) {
        case 'class':
          query[`${collectionPath}.room`] = entityIdentifier;
          Object.entries(changes).forEach(([key, value]) => {
            updateFields[`${collectionPath}.$.${key}`] = value;
          });
          break;
          
        case 'faculty':
          if (entityIdentifier.includes('@')) {
            query[`${collectionPath}.mail`] = entityIdentifier;
          } else if (/^\d+$/.test(entityIdentifier)) {
            query[`${collectionPath}.id`] = entityIdentifier;
          } else {
            query[`${collectionPath}.name`] = entityIdentifier;
          }
          Object.entries(changes).forEach(([key, value]) => {
            updateFields[`${collectionPath}.$.${key}`] = value;
          });
          break;
          
        case 'subject':
          if (/^[A-Z]+\d+$/.test(entityIdentifier)) {
            query[`${collectionPath}.code`] = entityIdentifier;
          } else {
            query[`${collectionPath}.subject`] = entityIdentifier;
          }
          Object.entries(changes).forEach(([key, value]) => {
            updateFields[`${collectionPath}.$.${key}`] = value;
          });
          break;
          
        case 'timeSlot':
          const [day, times] = entityIdentifier.split(' ');
          const [startTime, endTime] = times ? times.split('-') : [null, null];
          
          query[`${collectionPath}.day`] = day;
          if (startTime) query[`${collectionPath}.startTime`] = startTime;
          if (endTime) query[`${collectionPath}.endTime`] = endTime;
          
          Object.entries(changes).forEach(([key, value]) => {
            updateFields[`${collectionPath}.$.${key}`] = value;
          });
          break;
          
        case 'grade':
          const [grade, section] = entityIdentifier.split('-');
          query[`${collectionPath}.grade`] = grade;
          query[`${collectionPath}.section`] = section;
          
          Object.entries(changes).forEach(([key, value]) => {
            updateFields[`${collectionPath}.$.${key}`] = value;
          });
          break;
      }
      
      // If currentState has an _id, use it for a more precise update
      if (currentState && currentState._id) {
        query = { _id: 'PLACEHOLDER_FOR_PROJECT_ID' };
        updateFields = {};
        Object.entries(changes).forEach(([key, value]) => {
          updateFields[`${collectionPath}.$[elem].${key}`] = value;
        });
        
        return {
          operation: 'updateOne',
          query,
          update: { $set: updateFields },
          options: {
            arrayFilters: [{ "elem._id": currentState._id }]
          }
        };
      }
      
      return {
        operation: 'updateOne',
        query,
        update: { $set: updateFields }
      };
      
    case 'delete':
      if (currentState && currentState._id) {
        return {
          operation: 'updateOne',
          query: { _id: 'PLACEHOLDER_FOR_PROJECT_ID' },
          update: { 
            $pull: { 
              [collectionPath]: { _id: currentState._id } 
            } 
          }
        };
      }
      
      return {
        operation: 'updateOne',
        query: { _id: 'PLACEHOLDER_FOR_PROJECT_ID' },
        update: { 
          $pull: { 
            [collectionPath]: buildPullCriteria(entityType, entityIdentifier) 
          } 
        }
      };
      
    default:
      return null;
  }
};

/**
 * Build criteria for $pull operation in MongoDB
 * @param {String} entityType - Type of entity
 * @param {String} entityIdentifier - Identifier of entity
 * @returns {Object} - Criteria for $pull
 */
const buildPullCriteria = (entityType, entityIdentifier) => {
  switch (entityType) {
    case 'class':
      return { room: entityIdentifier };
      
    case 'faculty':
      // Check if identifier is email, ID, or name
      if (entityIdentifier.includes('@')) {
        return { mail: entityIdentifier };
      } else if (/^\d+$/.test(entityIdentifier)) {
        return { id: entityIdentifier };
      } else {
        return { name: entityIdentifier };
      }
      
    case 'subject':
      // Check if identifier is code or name
      if (/^[A-Z]+\d+$/.test(entityIdentifier)) {
        return { code: entityIdentifier };
      } else {
        return { subject: entityIdentifier };
      }
      
    case 'timeSlot':
      const [day, times] = entityIdentifier.split(' ');
      const [startTime, endTime] = times ? times.split('-') : [null, null];
      
      const criteria = { day };
      if (startTime) criteria.startTime = startTime;
      if (endTime) criteria.endTime = endTime;
      return criteria;
      
    case 'grade':
      const [grade, section] = entityIdentifier.split('-');
      return { grade, section };
      
    default:
      return {};
  }
};

/**
 * Detect potential conflicts with the proposed changes
 * @param {String} entityType - Type of entity
 * @param {Object} changes - Proposed changes
 * @param {Object} timetable - Current timetable
 * @returns {Array} - List of potential conflicts
 */
const detectPotentialConflicts = (entityType, changes, timetable) => {
  const conflicts = [];
  
  switch (entityType) {
    case 'class':
      // Check for duplicate room numbers
      if (changes.room && timetable.classes.some(c => c.room === changes.room)) {
        conflicts.push(`Room ${changes.room} already exists`);
      }
      
      // Check if room is already assigned in schedules
      if (timetable.hasGeneratedResults && timetable.generationResults && timetable.generationResults.length > 0) {
        const latestResult = timetable.generationResults[0];
        let isRoomUsed = false;
        
        Object.values(latestResult.schedules).forEach(gradeSchedule => {
          Object.values(gradeSchedule).forEach(daySchedule => {
            daySchedule.forEach(slot => {
              if (slot.room === changes.room) {
                isRoomUsed = true;
              }
            });
          });
        });
        
        if (isRoomUsed) {
          conflicts.push(`Room ${changes.room} is currently used in the generated schedule. Changes may require regeneration.`);
        }
      }
      break;
      
    case 'faculty':
      // Check for duplicate faculty IDs
      if (changes.id && timetable.faculty.some(f => f.id === changes.id)) {
        conflicts.push(`Faculty ID ${changes.id} already exists`);
      }
      
      // Check if faculty is assigned to subjects
      const facultyAssignedSubjects = timetable.subjects.filter(s => 
        s.facultyIds && s.facultyIds.includes(changes.id)
      );
      
      if (facultyAssignedSubjects.length > 0) {
        conflicts.push(`Faculty is assigned to ${facultyAssignedSubjects.length} subjects: ${facultyAssignedSubjects.map(s => s.subject).join(', ')}`);
      }
      
      // Check if faculty is in current schedules
      if (timetable.hasGeneratedResults && timetable.generationResults && timetable.generationResults.length > 0) {
        const latestResult = timetable.generationResults[0];
        let isFacultyScheduled = false;
        
        Object.values(latestResult.schedules).forEach(gradeSchedule => {
          Object.values(gradeSchedule).forEach(daySchedule => {
            daySchedule.forEach(slot => {
              if (slot.faculty === changes.id) {
                isFacultyScheduled = true;
              }
            });
          });
        });
        
        if (isFacultyScheduled) {
          conflicts.push(`Faculty is currently scheduled in the timetable. Changes may require regeneration.`);
        }
      }
      break;
      
    case 'subject':
      // Check for duplicate subject codes
      if (changes.code && timetable.subjects.some(s => s.code === changes.code)) {
        conflicts.push(`Subject code ${changes.code} already exists`);
      }
      
      // Check if changing classes per week will affect scheduling
      if (changes.classesWeek && timetable.hasGeneratedResults) {
        conflicts.push(`Changing the number of weekly classes will require regenerating the schedule`);
      }
      break;
      
    case 'timeSlot':
      // Check for overlapping time slots
      if (changes.day && changes.startTime && changes.endTime) {
        timetable.timeSlots.forEach(slot => {
          if (slot.day === changes.day) {
            const existingStart = slot.startTime;
            const existingEnd = slot.endTime;
            const newStart = changes.startTime;
            const newEnd = changes.endTime;
            
            // Check if the new time slot overlaps with existing ones
            if ((newStart >= existingStart && newStart < existingEnd) ||
                (newEnd > existingStart && newEnd <= existingEnd) ||
                (newStart <= existingStart && newEnd >= existingEnd)) {
              conflicts.push(`Time slot overlaps with existing slot: ${slot.day} ${slot.startTime}-${slot.endTime}`);
            }
          }
        });
      }
      
      // Check if time slot is used in current schedules
      if (timetable.hasGeneratedResults) {
        conflicts.push(`Changing time slots will require regenerating the schedule`);
      }
      break;
      
    case 'grade':
      // Check for duplicate grade-section
      if (changes.grade && changes.section) {
        const gradeSection = `${changes.grade}-${changes.section}`;
        const existingGrade = timetable.grades.find(g => 
          g.grade === changes.grade && g.section === changes.section
        );
        
        if (existingGrade) {
          conflicts.push(`Grade ${gradeSection} already exists`);
        }
      }
      
      // Check if changing strength will affect room assignments
      if (changes.strength) {
        // Find rooms that would no longer be suitable
        const suitableRooms = timetable.classes.filter(c => 
          parseInt(c.capacity) >= parseInt(changes.strength)
        );
        
        if (suitableRooms.length === 0) {
          conflicts.push(`No rooms have capacity for ${changes.strength} students`);
        }
      }
      
      // Check if grade is used in subject assignments
      const subjectsForGrade = timetable.subjects.filter(s => 
        s.gradeSections && s.gradeSections.some(gs => 
          gs.grade === changes.grade && gs.section === changes.section
        )
      );
      
      if (subjectsForGrade.length > 0) {
        conflicts.push(`Grade is assigned to ${subjectsForGrade.length} subjects: ${subjectsForGrade.map(s => s.subject).join(', ')}`);
      }
      break;
  }
  
  return conflicts;
};

/**
 * Process messages from the chatbot interface
 * @param {Object} req - Request object containing projectId and message
 * @param {Object} res - Response object
 */
export const processChatbotMessage = async (req, res) => {
  try {
    const { projectId, message } = req.body;

    if (!projectId || !message) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: projectId and message are required."
      });
    }

    // 1. Check if this is a confirmation message for previous changes
    if (message.toLowerCase().includes('confirm') || message.toLowerCase().includes('approve') || 
        message.toLowerCase().includes('yes') || message.toLowerCase().includes('accept')) {
      
      // Look for the changeId in the message or from session/previous request
      const changeIdMatch = message.match(/change(?:\s+id)?[:\s]+([a-f0-9-]+)/i);
      const changeId = changeIdMatch ? changeIdMatch[1] : req.body.changeId;
      
      if (!changeId) {
        return res.status(400).json({
          success: false,
          message: "Could not identify which changes to apply. Please provide a change ID or retry your request."
        });
      }
      
      // Retrieve the proposed changes from session or previous state
      // In a real implementation, you might store these in a database or cache
      const proposedChanges = req.body.proposedChanges;
      
      if (!proposedChanges) {
        return res.status(400).json({
          success: false,
          message: "Could not find the proposed changes to apply. Please make your request again."
        });
      }
      
      // Apply the changes
      const result = await applyChangesInternal(projectId, changeId, proposedChanges);
      
      return res.status(result.success ? 200 : 400).json({
        ...result,
        message: result.success ? 
          "Changes have been applied successfully." : 
          "Failed to apply changes: " + result.message
      });
    }
    
    // 2. Check if this is a rejection/cancel message
    if (message.toLowerCase().includes('reject') || message.toLowerCase().includes('cancel') || 
        message.toLowerCase().includes('no') || message.toLowerCase().includes('don\'t apply')) {
      
      return res.status(200).json({
        success: true,
        message: "Changes have been cancelled. No modifications were made to the timetable."
      });
    }
    
    // 3. Otherwise, process as a new request
    const result = await processRequestInternal(projectId, message);
    
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Error processing chatbot message:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing your message. Please try again.",
      error: error.message
    });
  }
};

/**
 * Internal function to process requests (to be used by processChatbotMessage)
 * @param {String} projectId - The ID of the timetable project
 * @param {String} userMessage - Natural language request from user
 * @returns {Object} - Proposed changes and response
 */
const processRequestInternal = async (projectId, userMessage) => {
  try {
    // 1. Fetch the current timetable data
    const timetable = await Timetable.findById(projectId);
    if (!timetable) {
      return { success: false, message: "Timetable project not found" };
    }

    // 2. Process the natural language request using pattern matching
    const requestAnalysis = analyzeRequest(userMessage, timetable);
    
    if (!requestAnalysis.success) {
      return { 
        success: false, 
        message: requestAnalysis.message 
      };
    }

    // 3. Generate proposed changes based on the request analysis
    const proposedChanges = generateProposedChanges(requestAnalysis, timetable);
    
    // 4. Return the proposed changes for frontend approval
    return {
      success: true,
      message: requestAnalysis.response,
      proposedChanges: proposedChanges,
      changeId: uuidv4() // Unique ID to track this change request
    };
  } catch (error) {
    console.error("Error processing timetable request:", error);
    return { 
      success: false, 
      message: "Failed to process your request. Please try again.",
      error: error.message
    };
  }
};

/**
 * Internal function to apply changes (to be used by processChatbotMessage)
 * @param {String} projectId - The ID of the timetable project
 * @param {String} changeId - The unique ID of the change request
 * @param {Object} approvedChanges - The changes approved by the user
 * @returns {Object} - Result of applying changes
 */
const applyChangesInternal = async (projectId, changeId, approvedChanges) => {
  try {
    // 1. Fetch the current timetable data
    const timetable = await Timetable.findById(projectId);
    if (!timetable) {
      return { success: false, message: "Timetable project not found" };
    }
    
    // 2. Apply the database operation based on the change
    const { changeType, entityType, collectionPath, currentState, newState } = approvedChanges;
    
    let updateOperation = {};
    let updateResult = null;
    
    switch (changeType) {
      case 'add':
        // Add a new item to the collection
        updateOperation = { 
          $push: { [collectionPath]: newState } 
        };
        break;
        
      case 'modify':
        // Find and update the existing item
        if (!currentState || (!currentState._id && !approvedChanges.entityIdentifier)) {
          return { 
            success: false, 
            message: `Cannot find ${entityType} to update` 
          };
        }
        
        // For each field in newState, create an update operation
        updateOperation = { $set: {} };
        
        if (currentState && currentState._id) {
          // If we have the _id, use it for precise update
          Object.entries(newState).forEach(([key, value]) => {
            if (key !== '_id') {
              updateOperation.$set[`${collectionPath}.$[elem].${key}`] = value;
            }
          });
          
          updateResult = await Timetable.updateOne(
            { _id: projectId },
            updateOperation,
            { 
              arrayFilters: [{ "elem._id": currentState._id }],
              new: true 
            }
          );
        } else {
          // Otherwise use the identifier for the update
          const query = { _id: projectId };
          const filter = buildPullCriteria(entityType, approvedChanges.entityIdentifier);
          
          Object.keys(filter).forEach(key => {
            query[`${collectionPath}.${key}`] = filter[key];
          });
          
          Object.entries(newState).forEach(([key, value]) => {
            updateOperation.$set[`${collectionPath}.$.${key}`] = value;
          });
          
          updateResult = await Timetable.updateOne(
            query,
            updateOperation
          );
        }
        break;
        
      case 'delete':
        // Remove the item from the collection
        if (currentState && currentState._id) {
          updateOperation = { 
            $pull: { [collectionPath]: { _id: currentState._id } } 
          };
        } else if (approvedChanges.entityIdentifier) {
          updateOperation = { 
            $pull: { 
              [collectionPath]: buildPullCriteria(entityType, approvedChanges.entityIdentifier) 
            } 
          };
        } else {
          return { 
            success: false, 
            message: `Cannot find ${entityType} to delete` 
          };
        }
        break;
        
      default:
        return { 
          success: false, 
          message: "Invalid change type" 
        };
    }
    
    // If we haven't executed an update yet (for 'add' and 'delete' operations)
    if (!updateResult) {
      updateResult = await Timetable.updateOne(
        { _id: projectId },
        updateOperation
      );
    }
    
    if (updateResult.modifiedCount === 0 && updateResult.matchedCount > 0) {
      return {
        success: true,
        message: "No changes were needed (item already matches requested state)",
        details: updateResult
      };
    } else if (updateResult.matchedCount === 0) {
      return {
        success: false,
        message: "Could not find the timetable or specific item to update",
        details: updateResult
      };
    }
    
    // 3. Retrieve the updated timetable data
    const updatedTimetable = await Timetable.findById(projectId);
    
    // 4. Return success response with before/after details
    return {
      success: true,
      message: `Successfully ${changeType === 'add' ? 'added' : changeType === 'modify' ? 'updated' : 'deleted'} the ${entityType}`,
      details: {
        before: timetable,
        after: updatedTimetable,
        changeType,
        entityType,
        changeId
      }
    };
  } catch (error) {
    console.error("Error applying timetable changes:", error);
    return { 
      success: false, 
      message: "Failed to apply changes to the timetable.", 
      error: error.message 
    };
  }
};