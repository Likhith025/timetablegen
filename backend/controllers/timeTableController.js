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