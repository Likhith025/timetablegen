import mongoose from "mongoose";
import Timetable from "../model/Timetable_model.js";
import User from "../model/user_model.js";
import { sendTimetableInvitation } from "./userController.js";

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
      userId,
      type
    } = req.body;

    // Validate required data
    if (!classes || !faculty || !grades || !subjects || !timeSlots || !type) {
      return res.status(400).json({
        success: false,
        message: "Missing required timetable data. Please provide classes, faculty, grades, subjects, timeSlots, and type."
      });
    }

    // Validate type
    if (!['organization', 'personal'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be 'organization' or 'personal'."
      });
    }

    // Validate creator ID
    const creatorId = userId || (req.user ? req.user._id : null);
    if (!creatorId || !mongoose.Types.ObjectId.isValid(creatorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid or missing user ID for timetable creator."
      });
    }

    // Verify creator exists
    const creator = await User.findById(creatorId);
    if (!creator) {
      return res.status(404).json({
        success: false,
        message: "Creator user not found."
      });
    }

    // Process faculty data based on type
    let processedFaculty = faculty;
    if (type === 'personal') {
      processedFaculty = faculty.map(({ id, name }) => ({ id, name, mail: '' }));
    } else {
      // Validate email presence and verify faculty emails for organization mode
      if (!faculty.every(f => f.mail && f.mail.trim() !== '')) {
        return res.status(400).json({
          success: false,
          message: "Email IDs are required for all faculty in organization mode."
        });
      }
      const facultyEmails = faculty.map(f => f.mail);
      const users = await User.find({ email: { $in: facultyEmails } });
      const foundEmails = users.map(u => u.email);
      const missingEmails = facultyEmails.filter(email => !foundEmails.includes(email));
      if (missingEmails.length > 0) {
        // Create new users for missing emails with pending status
        for (const email of missingEmails) {
          const newUser = new User({
            email,
            name: email.split("@")[0], // Temporary name
            timetables: [],
          });
          await newUser.save();
          users.push(newUser);
        }
      }
      // Verify faculty IDs in subjects
      const invalidFacultyIds = subjects.flatMap(subject => 
        (subject.facultyIds || []).filter(id => !faculty.some(f => f.id === id))
      );
      if (invalidFacultyIds.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid faculty IDs in subjects: ${invalidFacultyIds.join(', ')}`
        });
      }
    }

    // Create timetable object
    const timetableData = {
      projectName: projectName || "Temporary Timetable",
      multipleBuildings: multipleBuildings || false,
      buildings: buildings || [],
      classes,
      faculty: processedFaculty,
      grades,
      subjects,
      timeSlots,
      createdBy: creatorId,
      type,
      users: [{ userId: creatorId, role: "owner", accepted: "Yes" }], // Add owner to users array
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
        hasGeneratedResults: true,
      });

      // Save to database
      savedTimetable = await newTimetable.save();
      console.log("Timetable saved successfully with ID:", savedTimetable._id);

      // Update creator with timetable reference and owner role
      await User.findByIdAndUpdate(
        creatorId,
        {
          $addToSet: {
            timetables: { timetableId: savedTimetable._id, role: "owner", accepted: "Yes" },
          },
        },
        { new: true }
      );
      console.log("Creator updated with timetable reference and owner role");

      // Send invitation emails to faculty for organization mode and add to users array
      if (type === 'organization') {
        for (const facultyMember of processedFaculty) {
          const user = await User.findOne({ email: facultyMember.mail });
          if (user) {
            // Add user to timetable's users array if not already present
            if (!savedTimetable.users.some(u => u.userId.toString() === user._id.toString())) {
              savedTimetable.users.push({
                userId: user._id,
                role: "educator",
                accepted: "Pending",
              });
            }
            // Update user's timetables array
            await User.findByIdAndUpdate(
              user._id,
              {
                $addToSet: {
                  timetables: {
                    timetableId: savedTimetable._id,
                    role: "educator",
                    accepted: "Pending",
                  },
                },
              },
              { new: true }
            );
            // Send invitation
            const invitationResult = await sendTimetableInvitation(
              facultyMember.mail,
              savedTimetable._id,
              "educator",
              creatorId
            );
            if (!invitationResult.success) {
              console.error(`Failed to send invitation to ${facultyMember.mail}: ${invitationResult.message}`);
            } else {
              console.log(`Invitation sent to ${facultyMember.mail} for timetable ${savedTimetable._id}`);
            }
          }
        }
        // Save timetable with updated users array
        await savedTimetable.save();
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
          saved: false,
        },
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
        timetableId: savedTimetable ? savedTimetable._id : null,
      },
    });
  } catch (error) {
    console.error("Error generating timetable:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate timetable",
      error: error.message,
    });
  }
};

export const updateTimetableu = async (req, res) => {
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
      type
    } = req.body;

    // Validate projectId
    if (!projectId || !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid timetable ID. Please provide a valid projectId.",
      });
    }

    // Validate type if provided
    if (type && !['organization', 'personal'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be 'organization' or 'personal'."
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
    let existingTimetable = await Timetable.findById(projectId);
    if (!existingTimetable) {
      return res.status(404).json({
        success: false,
        message: "Timetable not found.",
      });
    }

    // Ensure creator is in users array
    if (!existingTimetable.users.some(u => u.userId.toString() === creatorId.toString())) {
      existingTimetable.users.push({
        userId: creatorId,
        role: "owner",
        accepted: "Yes",
      });
      await existingTimetable.save();
    }

    // Process faculty data based on type
    let processedFaculty = faculty;
    if (type && faculty !== undefined) {
      if (type === 'personal') {
        processedFaculty = faculty.map(({ id, name }) => ({ id, name, mail: '' }));
      } else if (type === 'organization') {
        processedFaculty = faculty.map(fac => ({
          id: fac.id,
          name: fac.name,
          mail: fac.mail || '',
        }));
        if (faculty.some(f => f.mail && f.mail.trim() !== '')) {
          if (!faculty.every(f => f.mail && f.mail.trim() !== '')) {
            return res.status(400).json({
              success: false,
              message: "Email IDs are required for all faculty in organization mode if any are provided."
            });
          }
          // Validate and add new faculty to users array
          const facultyEmails = faculty.map(f => f.mail);
          const users = await User.find({ email: { $in: facultyEmails } });
          const foundEmails = users.map(u => u.email);
          const missingEmails = facultyEmails.filter(email => !foundEmails.includes(email));
          if (missingEmails.length > 0) {
            for (const email of missingEmails) {
              const newUser = new User({
                email,
                name: email.split("@")[0],
                timetables: [{ timetableId: projectId, role: "educator", accepted: "Pending" }],
              });
              await newUser.save();
              existingTimetable.users.push({
                userId: newUser._id,
                role: "educator",
                accepted: "Pending",
              });
              await sendTimetableInvitation(email, projectId, "educator", creatorId);
              users.push(newUser);
            }
            await existingTimetable.save();
          }
          // Update existing faculty in users array
          for (const facultyMember of processedFaculty) {
            const user = users.find(u => u.email === facultyMember.mail);
            if (user && !existingTimetable.users.some(u => u.userId.toString() === user._id.toString())) {
              existingTimetable.users.push({
                userId: user._id,
                role: "educator",
                accepted: "Pending",
              });
              await User.findByIdAndUpdate(
                user._id,
                {
                  $addToSet: {
                    timetables: {
                      timetableId: projectId,
                      role: "educator",
                      accepted: "Pending",
                    },
                  },
                },
                { new: true }
              );
              await sendTimetableInvitation(facultyMember.mail, projectId, "educator", creatorId);
            }
          }
          await existingTimetable.save();
        }
      }
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
      faculty: processedFaculty !== undefined ? processedFaculty : existingTimetable.faculty,
      grades: grades !== undefined ? grades : existingTimetable.grades,
      subjects: cleanedSubjects !== undefined ? cleanedSubjects : existingTimetable.subjects,
      timeSlots: timeSlots !== undefined ? timeSlots : existingTimetable.timeSlots,
      type: type !== undefined ? type : existingTimetable.type,
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
            generationResultObject.schedules[gradeSection][day] = generatedResult.schedules[gradeSection][day];
          });
        });

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
        if (user && !user.timetables.some(t => t.timetableId.toString() === projectId)) {
          await User.findByIdAndUpdate(
            creatorId,
            {
              $addToSet: {
                timetables: { timetableId: projectId, role: "owner", accepted: "Yes" },
              },
            },
            { new: true }
          );
          console.log("User updated with timetable reference");
        }
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

export const generateTimetableSchedule = (timetableData) => {
  const schedules = {};
  const conflicts = [];

  // Extract unique days from timeSlots
  const days = [...new Set(timetableData.timeSlots.map(slot => slot.day))].sort();
  if (days.length === 0) {
    conflicts.push("No valid days provided in timeSlots.");
    return {
      generatedOn: new Date(),
      generationStatus: "failed",
      conflicts,
      schedules: {},
      algorithm: "genetic-algorithm",
      version: "2.0"
    };
  }

  // Get unique time slots
  const uniqueTimeSlots = [...new Set(
    timetableData.timeSlots.map(slot => `${slot.startTime}-${slot.endTime}`)
  )].sort((a, b) => a.split('-')[0].localeCompare(b.split('-')[0]));

  // Validate input data: Check if enough slots and days exist, and rooms are sufficient
  const slotConflicts = {};
  const dayConflicts = {};
  timetableData.grades.forEach(grade => {
    const gradeSection = `${grade.grade}-${grade.section}`;
    const totalClassesNeeded = timetableData.subjects
      .filter(subject => subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section))
      .reduce((sum, subject) => sum + parseInt(subject.classesWeek), 0);

    const totalAvailableSlots = days.length * uniqueTimeSlots.length;
    if (totalClassesNeeded > totalAvailableSlots) {
      timetableData.subjects
        .filter(subject => subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section))
        .forEach(subject => {
          if (!slotConflicts[gradeSection]) slotConflicts[gradeSection] = [];
          slotConflicts[gradeSection].push(subject.code);
        });
    }

    timetableData.subjects
      .filter(subject => subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section))
      .forEach(subject => {
        const weeklyClasses = parseInt(subject.classesWeek);
        if (weeklyClasses > days.length) {
          if (!dayConflicts[gradeSection]) dayConflicts[gradeSection] = [];
          dayConflicts[gradeSection].push(subject.code);
        }
      });
  });

  Object.entries(slotConflicts).forEach(([gradeSection, subjects]) => {
    conflicts.push(`Telugu classes for ${gradeSection} need more teachers or time slots: ${subjects.join(", ")} require more slots than the ${days.length * uniqueTimeSlots.length} available. Add more time slots or teachers.`);
  });
  Object.entries(dayConflicts).forEach(([gradeSection, subjects]) => {
    conflicts.push(`Telugu classes for ${gradeSection} need more days or teachers: ${subjects.join(", ")} require more days than the ${days.length} available. Add more days or teachers.`);
  });

  // Check for sufficient rooms
  const totalRooms = timetableData.classes.length;
  const gradesNeedingDedicatedRooms = timetableData.grades.filter(g => g.classAssignmentType === "same").length;
  if (gradesNeedingDedicatedRooms > totalRooms) {
    timetableData.grades
      .filter(g => g.classAssignmentType === "same")
      .slice(totalRooms)
      .forEach(grade => {
        const gradeSection = `${grade.grade}-${grade.section}`;
        conflicts.push(`Class ${gradeSection} is fully packed, no available rooms for dedicated assignment. Add more rooms.`);
      });
  }

  // Pre-assign dedicated rooms for each grade-section with classAssignmentType "same"
  const gradeSectionRooms = {};
  const reservedRoomMapping = {};
  timetableData.grades.forEach(grade => {
    const gradeSection = `${grade.grade}-${grade.section}`;
    schedules[gradeSection] = {};
    days.forEach(day => {
      schedules[gradeSection][day] = [];
    });

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
        conflicts.push(`Class ${gradeSection} is fully packed, no available rooms with strength ${grade.strength}. Add more rooms.`);
        gradeSectionRooms[gradeSection] = "Unassigned";
      }
    } else if (grade.classAssignmentType === "any") {
      const availableRooms = timetableData.classes.filter(c => 
        parseInt(c.capacity) >= parseInt(grade.strength)
      );
      gradeSectionRooms[gradeSection] = availableRooms.length > 0 
        ? availableRooms[Math.floor(Math.random() * availableRooms.length)].room 
        : "Unassigned";
      if (gradeSectionRooms[gradeSection] === "Unassigned") {
        conflicts.push(`Class ${gradeSection} is fully packed, no available rooms with strength ${grade.strength}. Add more rooms.`);
      }
    }
  });

  // Helper: Generate a random timetable (individual) with constraints
  const generateRandomTimetable = () => {
    const timetable = {};
    timetableData.grades.forEach(grade => {
      const gradeSection = `${grade.grade}-${grade.section}`;
      timetable[gradeSection] = {};
      days.forEach(day => {
        timetable[gradeSection][day] = [];
      });

      const subjectsForGrade = timetableData.subjects.filter(subject =>
        subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section)
      );

      // Track scheduled subjects per day to enforce once-per-day (unless classesWeek > days.length)
      const dailySubjectAssignments = {};
      days.forEach(day => {
        dailySubjectAssignments[gradeSection] = dailySubjectAssignments[gradeSection] || {};
        dailySubjectAssignments[gradeSection][day] = {};
      });

      // Track grade-section assignments per time slot to avoid overlaps
      const gradeSectionAssignments = {};
      days.forEach(day => {
        gradeSectionAssignments[day] = {};
        uniqueTimeSlots.forEach(timeSlot => {
          gradeSectionAssignments[day][timeSlot] = new Set();
        });
      });

      // Track faculty and room assignments to avoid double-booking
      const facultyAssignments = {};
      const roomAssignments = {};
      days.forEach(day => {
        facultyAssignments[day] = {};
        roomAssignments[day] = {};
        uniqueTimeSlots.forEach(timeSlot => {
          facultyAssignments[day][timeSlot] = new Set();
          roomAssignments[day][timeSlot] = new Set();
        });
      });

      // Track subject counts to ensure classesWeek is met
      const subjectCounts = {};
      subjectsForGrade.forEach(subject => {
        subjectCounts[subject.code] = 0;
      });

      // Check if any subject requires more classes than available days
      const subjectsNeedingSameDayScheduling = new Set();
      subjectsForGrade.forEach(subject => {
        const weeklyClasses = parseInt(subject.classesWeek);
        if (weeklyClasses > days.length) {
          subjectsNeedingSameDayScheduling.add(subject.code);
        }
      });

      // Create a list of all required classes to schedule
      const classesToSchedule = [];
      subjectsForGrade.forEach(subject => {
        const weeklyClasses = parseInt(subject.classesWeek);
        for (let i = 0; i < weeklyClasses; i++) {
          classesToSchedule.push({ 
            subject: subject.code, 
            facultyIds: subject.facultyIds, 
            assignedClasses: subject.assignedClasses 
          });
        }
      });

      // Shuffle classes to randomize assignment
      classesToSchedule.sort(() => Math.random() - 0.5);

      // Create a list of available day-time slot pairs
      let availableSlots = [];
      days.forEach(day => {
        uniqueTimeSlots.forEach((timeSlot, timeSlotIndex) => {
          const slot = timetableData.timeSlots.find(slot => 
            slot.day === day && `${slot.startTime}-${slot.endTime}` === timeSlot
          );
          if (!slot) return;
          const slotApplicableTo = Array.isArray(slot.applicableTo) ? slot.applicableTo : [slot.applicableTo];
          if (slotApplicableTo.some(item => item === gradeSection || item === `${grade.grade} - ${grade.section}`)) {
            availableSlots.push({ day, timeSlot, timeSlotIndex });
          }
        });
      });

      // Shuffle slots to randomize assignment
      availableSlots.sort(() => Math.random() - 0.5);

      // Schedule all required classes
      for (const classToSchedule of classesToSchedule) {
        const subjectCode = classToSchedule.subject;
        const facultyIds = classToSchedule.facultyIds;
        const assignedClasses = classToSchedule.assignedClasses;

        let scheduled = false;
        for (const { day, timeSlot, timeSlotIndex } of availableSlots) {
          // Once-per-day constraint (unless classesWeek > days.length)
          if (dailySubjectAssignments[gradeSection][day][subjectCode] && !subjectsNeedingSameDayScheduling.has(subjectCode)) {
            continue;
          }

          // No overlapping classes
          if (gradeSectionAssignments[day][timeSlot].has(gradeSection)) {
            continue;
          }

          // Select faculty
          const facultyId = facultyIds[Math.floor(Math.random() * facultyIds.length)];
          if (facultyAssignments[day][timeSlot].has(facultyId)) {
            continue;
          }

          // Select room
          let possibleRooms = [];
          if (assignedClasses && assignedClasses.length > 0) {
            possibleRooms = assignedClasses;
          } else if (grade.classAssignmentType === "same") {
            possibleRooms = [gradeSectionRooms[gradeSection]];
          } else {
            possibleRooms = timetableData.classes
              .filter(c => parseInt(c.capacity) >= parseInt(grade.strength))
              .map(c => c.room);
          }

          const availableRooms = possibleRooms.filter(room => 
            room !== "Unassigned" && !roomAssignments[day][timeSlot].has(room)
          );
          if (availableRooms.length === 0) continue;

          const room = availableRooms[Math.floor(Math.random() * availableRooms.length)];

          timetable[gradeSection][day].push({
            timeSlot,
            subject: subjectCode,
            faculty: facultyId,
            room
          });

          dailySubjectAssignments[gradeSection][day][subjectCode] = true;
          gradeSectionAssignments[day][timeSlot].add(gradeSection);
          facultyAssignments[day][timeSlot].add(facultyId);
          roomAssignments[day][timeSlot].add(room);
          subjectCounts[subjectCode]++;
          scheduled = true;
          break;
        }

        if (!scheduled) {
          conflicts.push(`Could not schedule class for ${subjectCode} in ${gradeSection} due to constraints (once-per-day, no overlapping, or faculty/room availability). Add more slots, days, or resources, or relax constraints.`);
        }
      }

      // Fill remaining slots with Free Periods, ensuring no duplicates
      availableSlots.forEach(({ day, timeSlot }) => {
        if (!gradeSectionAssignments[day][timeSlot].has(gradeSection)) {
          const room = grade.classAssignmentType === "same" ? gradeSectionRooms[gradeSection] : timetableData.classes
            .filter(c => parseInt(c.capacity) >= parseInt(grade.strength))
            .map(c => c.room)[0];
          if (room && !roomAssignments[day][timeSlot].has(room)) {
            timetable[gradeSection][day].push({
              timeSlot,
              subject: "Free Period",
              faculty: "",
              room
            });
            gradeSectionAssignments[day][timeSlot].add(gradeSection);
            roomAssignments[day][timeSlot].add(room);
          }
        }
      });
    });
    return timetable;
  };

  // Fitness function: Evaluate a timetable
  const evaluateFitness = (timetable) => {
    let fitness = 0;
    const localConflicts = [];

    // Track subject counts to ensure classesWeek is met
    const subjectCounts = {};
    timetableData.grades.forEach(grade => {
      const gradeSection = `${grade.grade}-${grade.section}`;
      subjectCounts[gradeSection] = {};
      timetableData.subjects
        .filter(subject => subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section))
        .forEach(subject => {
          subjectCounts[gradeSection][subject.code] = 0;
        });
    });

    // Track assignments to detect violations
    const facultyAssignments = {};
    const roomAssignments = {};
    const gradeSectionAssignments = {};
    const dailySubjectAssignments = {};
    const dailySubjectCounts = {};

    days.forEach(day => {
      facultyAssignments[day] = {};
      roomAssignments[day] = {};
      gradeSectionAssignments[day] = {};
      uniqueTimeSlots.forEach(timeSlot => {
        facultyAssignments[day][timeSlot] = new Set();
        roomAssignments[day][timeSlot] = new Set();
        gradeSectionAssignments[day][timeSlot] = new Set();
      });

      timetableData.grades.forEach(grade => {
        const gradeSection = `${grade.grade}-${grade.section}`;
        dailySubjectAssignments[gradeSection] = dailySubjectAssignments[gradeSection] || {};
        dailySubjectAssignments[gradeSection][day] = {};
        dailySubjectCounts[gradeSection] = dailySubjectCounts[gradeSection] || {};
        dailySubjectCounts[gradeSection][day] = {};
      });
    });

    // Check if any subject requires more classes than available days
    const subjectsNeedingSameDayScheduling = new Set();
    timetableData.grades.forEach(grade => {
      const gradeSection = `${grade.grade}-${grade.section}`;
      const subjectsForGrade = timetableData.subjects.filter(subject =>
        subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section)
      );
      subjectsForGrade.forEach(subject => {
        const weeklyClasses = parseInt(subject.classesWeek);
        if (weeklyClasses > days.length) {
          subjectsNeedingSameDayScheduling.add(`${gradeSection}:${subject.code}`);
        }
      });
    });

    // Evaluate constraints
    timetableData.grades.forEach(grade => {
      const gradeSection = `${grade.grade}-${grade.section}`;
      days.forEach(day => {
        const daySchedule = timetable[gradeSection][day];
        daySchedule.sort((a, b) => a.timeSlot.split('-')[0].localeCompare(b.timeSlot.split('-')[0]));

        // Track entries per time slot to detect duplicates and multiple subjects
        const slotEntries = {};
        const slotSubjects = {};
        uniqueTimeSlots.forEach(timeSlot => {
          slotEntries[timeSlot] = [];
          slotSubjects[timeSlot] = new Set();
        });

        for (let i = 0; i < daySchedule.length; i++) {
          const current = daySchedule[i];
          slotEntries[current.timeSlot].push(current);
          if (current.subject !== "Free Period") {
            slotSubjects[current.timeSlot].add(current.subject);
          }
        }

        // Check for duplicates (multiple entries in the same slot)
        for (const timeSlot of uniqueTimeSlots) {
          const entries = slotEntries[timeSlot];
          if (entries.length > 1) {
            fitness -= entries.length * 40; // Heavy penalty for duplicate entries
            localConflicts.push(`Multiple entries scheduled for ${gradeSection} at ${timeSlot} on ${day}.`);
          }

          // Check for multiple subjects in the same slot
          const subjectsInSlot = slotSubjects[timeSlot];
          if (subjectsInSlot.size > 1) {
            fitness -= subjectsInSlot.size * 50; // Heavy penalty for multiple subjects
            localConflicts.push(`Multiple subjects (${Array.from(subjectsInSlot).join(", ")}) scheduled for ${gradeSection} at ${timeSlot} on ${day}.`);
          }
        }

        for (let i = 0; i < daySchedule.length; i++) {
          const current = daySchedule[i];

          // Once-per-day constraint (unless classesWeek > days.length)
          if (current.subject !== "Free Period") {
            dailySubjectCounts[gradeSection][day][current.subject] = (dailySubjectCounts[gradeSection][day][current.subject] || 0) + 1;
            if (dailySubjectAssignments[gradeSection][day][current.subject]) {
              const key = `${gradeSection}:${current.subject}`;
              if (!subjectsNeedingSameDayScheduling.has(key)) {
                fitness -= 30; // Penalty for unnecessary same-day scheduling
                localConflicts.push(`Subject ${current.subject} scheduled multiple times for ${gradeSection} on ${day}, but classesWeek (${timetableData.subjects.find(s => s.code === current.subject).classesWeek}) does not require it.`);
              }
            }
            dailySubjectAssignments[gradeSection][day][current.subject] = true;
          }

          // No overlapping classes
          if (gradeSectionAssignments[day][current.timeSlot].has(gradeSection)) {
            fitness -= 50; // Penalty for overlapping classes
            localConflicts.push(`Grade-section ${gradeSection} scheduled for multiple classes at ${current.timeSlot} on ${day}.`);
          } else {
            gradeSectionAssignments[day][current.timeSlot].add(gradeSection);
          }

          // Faculty and room conflicts
          if (current.subject !== "Free Period") {
            if (facultyAssignments[day][current.timeSlot].has(current.faculty)) {
              fitness -= 20; // Penalty for faculty double-booking
              localConflicts.push(`Faculty ${current.faculty} double-booked at ${current.timeSlot} on ${day}.`);
            } else {
              facultyAssignments[day][current.timeSlot].add(current.faculty);
            }

            if (roomAssignments[day][current.timeSlot].has(current.room)) {
              fitness -= 20; // Penalty for room double-booking
              localConflicts.push(`Room ${current.room} double-booked at ${current.timeSlot} on ${day}.`);
            } else {
              roomAssignments[day][current.timeSlot].add(current.room);
            }
          }

          // Increment subject count
          if (current.subject !== "Free Period") {
            subjectCounts[gradeSection][current.subject] = (subjectCounts[gradeSection][current.subject] || 0) + 1;
          }
        }
      });
    });

    // Check classesWeek requirement
    timetableData.grades.forEach(grade => {
      const gradeSection = `${grade.grade}-${grade.section}`;
      timetableData.subjects
        .filter(subject => subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section))
        .forEach(subject => {
          const required = parseInt(subject.classesWeek);
          const scheduled = subjectCounts[gradeSection][subject.code] || 0;
          if (scheduled < required) {
            fitness -= (required - scheduled) * 30; // Penalty for under-scheduling
            localConflicts.push(`Subject ${subject.code} for ${gradeSection} scheduled ${scheduled} times, requires ${required}. Add more slots or days.`);
          } else if (scheduled > required) {
            fitness -= (scheduled - required) * 20; // Penalty for over-scheduling
            localConflicts.push(`Subject ${subject.code} for ${gradeSection} scheduled ${scheduled} times, exceeds required ${required}. Reduce scheduled classes.`);
          }
        });
    });

    return { fitness, conflicts: localConflicts };
  };

  // Crossover: Combine two parent timetables and fix under-scheduling/violations
  function crossover(parent1, parent2) {
    const child = {};
    timetableData.grades.forEach(grade => {
      const gradeSection = `${grade.grade}-${grade.section}`;
      child[gradeSection] = {};
      days.forEach(day => {
        child[gradeSection][day] = [];
        const schedule1 = parent1[gradeSection][day];
        const schedule2 = parent2[gradeSection][day];
        const mergedSchedule = [...schedule1, ...schedule2];
        const uniqueSlots = [...new Set(mergedSchedule.map(item => item.timeSlot))];

        uniqueSlots.forEach(timeSlot => {
          const entries = mergedSchedule.filter(item => item.timeSlot === timeSlot);
          let selectedEntry = null;
          // Prefer a class over a Free Period, and handle multiple classes
          const classEntries = entries.filter(entry => entry.subject !== "Free Period");
          if (classEntries.length > 1) {
            // If multiple classes, pick one and reschedule the others later
            selectedEntry = classEntries[Math.floor(Math.random() * classEntries.length)];
          } else if (classEntries.length === 1) {
            selectedEntry = classEntries[0];
          } else {
            selectedEntry = entries[0]; // If all are Free Periods, take the first one
          }
          child[gradeSection][day].push(selectedEntry);
        });
      });
    });

    // Fix over-scheduling, under-scheduling, and other violations
    timetableData.grades.forEach(grade => {
      const gradeSection = `${grade.grade}-${grade.section}`;
      const subjectCounts = {};
      timetableData.subjects
        .filter(subject => subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section))
        .forEach(subject => {
          subjectCounts[subject.code] = 0;
        });

      // Track assignments to avoid violations
      const dailySubjectAssignments = {};
      const gradeSectionAssignments = {};
      const facultyAssignments = {};
      const roomAssignments = {};
      days.forEach(day => {
        dailySubjectAssignments[gradeSection] = dailySubjectAssignments[gradeSection] || {};
        dailySubjectAssignments[gradeSection][day] = {};
        gradeSectionAssignments[day] = {};
        facultyAssignments[day] = {};
        roomAssignments[day] = {};
        uniqueTimeSlots.forEach(timeSlot => {
          gradeSectionAssignments[day][timeSlot] = new Set();
          facultyAssignments[day][timeSlot] = new Set();
          roomAssignments[day][timeSlot] = new Set();
        });
      });

      // Check if any subject requires more classes than available days
      const subjectsNeedingSameDayScheduling = new Set();
      const subjectsForGrade = timetableData.subjects.filter(subject =>
        subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section)
      );
      subjectsForGrade.forEach(subject => {
        const weeklyClasses = parseInt(subject.classesWeek);
        if (weeklyClasses > days.length) {
          subjectsNeedingSameDayScheduling.add(subject.code);
        }
      });

      // Count scheduled classes and rebuild assignments
      days.forEach(day => {
        child[gradeSection][day].forEach(entry => {
          if (entry.subject !== "Free Period") {
            subjectCounts[entry.subject]++;
            dailySubjectAssignments[gradeSection][day][entry.subject] = true;
            gradeSectionAssignments[day][entry.timeSlot].add(gradeSection);
            facultyAssignments[day][entry.timeSlot].add(entry.faculty);
            roomAssignments[day][entry.timeSlot].add(entry.room);
          }
        });
      });

      // Fix violations: same subject on same day, faculty/room double-booking
      days.forEach(day => {
        const daySchedule = child[gradeSection][day];
        daySchedule.sort((a, b) => a.timeSlot.split('-')[0].localeCompare(b.timeSlot.split('-')[0]));

        // Track subjects scheduled on this day
        const subjectsThisDay = {};
        for (let i = 0; i < daySchedule.length; i++) {
          const entry = daySchedule[i];
          if (entry.subject === "Free Period") continue;

          // Same subject on same day (only a problem if not necessary)
          if (subjectsThisDay[entry.subject] && !subjectsNeedingSameDayScheduling.has(entry.subject)) {
            daySchedule[i] = {
              timeSlot: entry.timeSlot,
              subject: "Free Period",
              faculty: "",
              room: entry.room
            };
            subjectCounts[entry.subject]--;
            dailySubjectAssignments[gradeSection][day][entry.subject] = false;
            gradeSectionAssignments[day][entry.timeSlot].delete(gradeSection);
            facultyAssignments[day][entry.timeSlot].delete(entry.faculty);
            roomAssignments[day][entry.timeSlot].delete(entry.room);
            continue;
          }
          subjectsThisDay[entry.subject] = true;
        }
      });

      // Fix faculty/room double-booking
      days.forEach(day => {
        const daySchedule = child[gradeSection][day];
        const facultyThisSlot = {};
        const roomThisSlot = {};
        uniqueTimeSlots.forEach(timeSlot => {
          facultyThisSlot[timeSlot] = new Set();
          roomThisSlot[timeSlot] = new Set();
        });

        for (let i = 0; i < daySchedule.length; i++) {
          const entry = daySchedule[i];
          if (entry.subject === "Free Period") continue;

          const timeSlot = entry.timeSlot;
          if (facultyThisSlot[timeSlot].has(entry.faculty)) {
            daySchedule[i] = {
              timeSlot: entry.timeSlot,
              subject: "Free Period",
              faculty: "",
              room: entry.room
            };
            subjectCounts[entry.subject]--;
            dailySubjectAssignments[gradeSection][day][entry.subject] = false;
            gradeSectionAssignments[day][entry.timeSlot].delete(gradeSection);
            roomAssignments[day][timeSlot].delete(entry.room);
            continue;
          }
          facultyThisSlot[timeSlot].add(entry.faculty);

          if (roomThisSlot[timeSlot].has(entry.room)) {
            daySchedule[i] = {
              timeSlot: entry.timeSlot,
              subject: "Free Period",
              faculty: "",
              room: entry.room
            };
            subjectCounts[entry.subject]--;
            dailySubjectAssignments[gradeSection][day][entry.subject] = false;
            gradeSectionAssignments[day][entry.timeSlot].delete(gradeSection);
            facultyAssignments[day][timeSlot].delete(entry.faculty);
            continue;
          }
          roomThisSlot[timeSlot].add(entry.room);
        }
      });

      // Schedule missing classes
      timetableData.subjects
        .filter(subject => subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section))
        .forEach(subject => {
          const required = parseInt(subject.classesWeek);
          const scheduled = subjectCounts[subject.code] || 0;
          let toSchedule = required - scheduled;

          let availableSlots = [];
          days.forEach(day => {
            uniqueTimeSlots.forEach((timeSlot, timeSlotIndex) => {
              const slot = timetableData.timeSlots.find(slot => 
                slot.day === day && `${slot.startTime}-${slot.endTime}` === timeSlot
              );
              if (!slot) return;
              const slotApplicableTo = Array.isArray(slot.applicableTo) ? slot.applicableTo : [slot.applicableTo];
              if (slotApplicableTo.some(item => item === gradeSection || item === `${grade.grade} - ${grade.section}`)) {
                availableSlots.push({ day, timeSlot, timeSlotIndex });
              }
            });
          });

          availableSlots.sort(() => Math.random() - 0.5);

          for (const { day, timeSlot, timeSlotIndex } of availableSlots) {
            if (toSchedule <= 0) break;

            // Once-per-day constraint (unless classesWeek > days.length)
            if (dailySubjectAssignments[gradeSection][day][subject.code] && !subjectsNeedingSameDayScheduling.has(subject.code)) {
              continue;
            }

            // No overlapping classes
            if (gradeSectionAssignments[day][timeSlot].has(gradeSection)) {
              // Try to replace a Free Period
              const existingEntry = child[gradeSection][day].find(entry => entry.timeSlot === timeSlot);
              if (existingEntry && existingEntry.subject === "Free Period") {
                child[gradeSection][day] = child[gradeSection][day].filter(entry => entry !== existingEntry);
                gradeSectionAssignments[day][timeSlot].delete(gradeSection);
                facultyAssignments[day][timeSlot].delete(existingEntry.faculty);
                roomAssignments[day][timeSlot].delete(existingEntry.room);
              } else {
                continue;
              }
            }

            // Randomly select faculty
            const facultyId = subject.facultyIds[Math.floor(Math.random() * subject.facultyIds.length)];
            if (facultyAssignments[day][timeSlot].has(facultyId)) {
              continue;
            }

            // Select room
            let possibleRooms = [];
            if (subject.assignedClasses && subject.assignedClasses.length > 0) {
              possibleRooms = subject.assignedClasses;
            } else if (grade.classAssignmentType === "same") {
              possibleRooms = [gradeSectionRooms[gradeSection]];
            } else {
              possibleRooms = timetableData.classes
                .filter(c => parseInt(c.capacity) >= parseInt(grade.strength))
                .map(c => c.room);
            }

            const availableRooms = possibleRooms.filter(room => 
              room !== "Unassigned" && !roomAssignments[day][timeSlot].has(room)
            );
            if (availableRooms.length === 0) continue;

            const room = availableRooms[Math.floor(Math.random() * availableRooms.length)];

            child[gradeSection][day].push({
              timeSlot,
              subject: subject.code,
              faculty: facultyId,
              room
            });

            toSchedule--;
            subjectCounts[subject.code]++;
            dailySubjectAssignments[gradeSection][day][subject.code] = true;
            gradeSectionAssignments[day][timeSlot].add(gradeSection);
            facultyAssignments[day][timeSlot].add(facultyId);
            roomAssignments[day][timeSlot].add(room);
          }

          if (toSchedule > 0) {
            conflicts.push(`Could not schedule ${toSchedule} remaining classes for ${subject.code} in ${gradeSection} due to constraints (once-per-day, no overlapping, or faculty/room availability). Add more slots, days, or resources, or relax constraints.`);
          }
        });
    });

    return child;
  }

  // Mutation: Randomly alter a timetable and fix under-scheduling/violations
  function mutate(timetable) {
    // Randomly alter existing entries
    timetableData.grades.forEach(grade => {
      const gradeSection = `${grade.grade}-${grade.section}`;
      days.forEach(day => {
        const schedule = timetable[gradeSection][day];
        if (Math.random() < 0.05) {
          if (schedule.length > 0) {
            const index = Math.floor(Math.random() * schedule.length);
            const entry = schedule[index];
            if (entry.subject === "Free Period") return;

            // Check subject counts to prevent over-scheduling
            const subjectCounts = {};
            timetableData.subjects
              .filter(subject => subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section))
              .forEach(subject => {
                subjectCounts[subject.code] = 0;
              });

            days.forEach(d => {
              timetable[gradeSection][d].forEach(e => {
                if (e.subject !== "Free Period") {
                  subjectCounts[e.subject]++;
                }
              });
            });

            const required = parseInt(timetableData.subjects.find(subject => subject.code === entry.subject).classesWeek);
            if (subjectCounts[entry.subject] > required) {
              schedule[index] = {
                timeSlot: entry.timeSlot,
                subject: "Free Period",
                faculty: "",
                room: entry.room
              };
              return;
            }

            const subjects = timetableData.subjects.filter(subject =>
              subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section) &&
              (subjectCounts[subject.code] || 0) < parseInt(subject.classesWeek)
            );
            if (subjects.length === 0) return;

            const newSubject = subjects[Math.floor(Math.random() * subjects.length)];
            const facultyId = newSubject.facultyIds[Math.floor(Math.random() * newSubject.facultyIds.length)];
            let possibleRooms = grade.classAssignmentType === "same" ? [gradeSectionRooms[gradeSection]] : timetableData.classes
              .filter(c => parseInt(c.capacity) >= parseInt(grade.strength))
              .map(c => c.room);
            possibleRooms = possibleRooms.filter(room => room !== "Unassigned");
            const room = possibleRooms[Math.floor(Math.random() * possibleRooms.length)] || "Unassigned";
            if (room !== "Unassigned") {
              entry.subject = newSubject.code;
              entry.faculty = facultyId;
              entry.room = room;
            }
          }
        }
      });
    });

    // Fix under-scheduling and violations
    timetableData.grades.forEach(grade => {
      const gradeSection = `${grade.grade}-${grade.section}`;
      const subjectCounts = {};
      timetableData.subjects
        .filter(subject => subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section))
        .forEach(subject => {
          subjectCounts[subject.code] = 0;
        });

      // Track assignments to avoid violations
      const dailySubjectAssignments = {};
      const gradeSectionAssignments = {};
      const facultyAssignments = {};
      const roomAssignments = {};
      days.forEach(day => {
        dailySubjectAssignments[gradeSection] = dailySubjectAssignments[gradeSection] || {};
        dailySubjectAssignments[gradeSection][day] = {};
        gradeSectionAssignments[day] = {};
        facultyAssignments[day] = {};
        roomAssignments[day] = {};
        uniqueTimeSlots.forEach(timeSlot => {
          gradeSectionAssignments[day][timeSlot] = new Set();
          facultyAssignments[day][timeSlot] = new Set();
          roomAssignments[day][timeSlot] = new Set();
        });
      });

      // Check if any subject requires more classes than available days
      const subjectsNeedingSameDayScheduling = new Set();
      const subjectsForGrade = timetableData.subjects.filter(subject =>
        subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section)
      );
      subjectsForGrade.forEach(subject => {
        const weeklyClasses = parseInt(subject.classesWeek);
        if (weeklyClasses > days.length) {
          subjectsNeedingSameDayScheduling.add(subject.code);
        }
      });

      // Count scheduled classes and rebuild assignments
      days.forEach(day => {
        timetable[gradeSection][day].forEach(entry => {
          if (entry.subject !== "Free Period") {
            subjectCounts[entry.subject]++;
            dailySubjectAssignments[gradeSection][day][entry.subject] = true;
            gradeSectionAssignments[day][entry.timeSlot].add(gradeSection);
            facultyAssignments[day][entry.timeSlot].add(entry.faculty);
            roomAssignments[day][entry.timeSlot].add(entry.room);
          }
        });
      });

      // Fix violations: same subject on same day, faculty/room double-booking
      days.forEach(day => {
        const daySchedule = timetable[gradeSection][day];
        daySchedule.sort((a, b) => a.timeSlot.split('-')[0].localeCompare(b.timeSlot.split('-')[0]));

        // Track subjects scheduled on this day
        const subjectsThisDay = {};
        for (let i = 0; i < daySchedule.length; i++) {
          const entry = daySchedule[i];
          if (entry.subject === "Free Period") continue;

          // Same subject on same day (only a problem if not necessary)
          if (subjectsThisDay[entry.subject] && !subjectsNeedingSameDayScheduling.has(entry.subject)) {
            daySchedule[i] = {
              timeSlot: entry.timeSlot,
              subject: "Free Period",
              faculty: "",
              room: entry.room
            };
            subjectCounts[entry.subject]--;
            dailySubjectAssignments[gradeSection][day][entry.subject] = false;
            gradeSectionAssignments[day][entry.timeSlot].delete(gradeSection);
            facultyAssignments[day][entry.timeSlot].delete(entry.faculty);
            roomAssignments[day][entry.timeSlot].delete(entry.room);
            continue;
          }
          subjectsThisDay[entry.subject] = true;
        }
      });

      // Fix faculty/room double-booking
      days.forEach(day => {
        const daySchedule = timetable[gradeSection][day];
        const facultyThisSlot = {};
        const roomThisSlot = {};
        uniqueTimeSlots.forEach(timeSlot => {
          facultyThisSlot[timeSlot] = new Set();
          roomThisSlot[timeSlot] = new Set();
        });

        for (let i = 0; i < daySchedule.length; i++) {
          const entry = daySchedule[i];
          if (entry.subject === "Free Period") continue;

          const timeSlot = entry.timeSlot;
          if (facultyThisSlot[timeSlot].has(entry.faculty)) {
            daySchedule[i] = {
              timeSlot: entry.timeSlot,
              subject: "Free Period",
              faculty: "",
              room: entry.room
            };
            subjectCounts[entry.subject]--;
            dailySubjectAssignments[gradeSection][day][entry.subject] = false;
            gradeSectionAssignments[day][entry.timeSlot].delete(gradeSection);
            roomAssignments[day][entry.timeSlot].delete(entry.room);
            continue;
          }
          facultyThisSlot[timeSlot].add(entry.faculty);

          if (roomThisSlot[timeSlot].has(entry.room)) {
            daySchedule[i] = {
              timeSlot: entry.timeSlot,
              subject: "Free Period",
              faculty: "",
              room: entry.room
            };
            subjectCounts[entry.subject]--;
            dailySubjectAssignments[gradeSection][day][entry.subject] = false;
            gradeSectionAssignments[day][entry.timeSlot].delete(gradeSection);
            facultyAssignments[day][entry.timeSlot].delete(entry.faculty);
            continue;
          }
          roomThisSlot[timeSlot].add(entry.room);
        }
      });

      // Schedule missing classes
      timetableData.subjects
        .filter(subject => subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section))
        .forEach(subject => {
          const required = parseInt(subject.classesWeek);
          const scheduled = subjectCounts[subject.code] || 0;
          let toSchedule = required - scheduled;

          let availableSlots = [];
          days.forEach(day => {
            uniqueTimeSlots.forEach((timeSlot, timeSlotIndex) => {
              const slot = timetableData.timeSlots.find(slot => 
                slot.day === day && `${slot.startTime}-${slot.endTime}` === timeSlot
              );
              if (!slot) return;
              const slotApplicableTo = Array.isArray(slot.applicableTo) ? slot.applicableTo : [slot.applicableTo];
              if (slotApplicableTo.some(item => item === gradeSection || item === `${grade.grade} - ${grade.section}`)) {
                availableSlots.push({ day, timeSlot, timeSlotIndex });
              }
            });
          });

          availableSlots.sort(() => Math.random() - 0.5);

          for (const { day, timeSlot, timeSlotIndex } of availableSlots) {
            if (toSchedule <= 0) break;

            // Once-per-day constraint (unless classesWeek > days.length)
            if (dailySubjectAssignments[gradeSection][day][subject.code] && !subjectsNeedingSameDayScheduling.has(subject.code)) {
              continue;
            }

            // No overlapping classes
            if (gradeSectionAssignments[day][timeSlot].has(gradeSection)) {
              // Try to replace a Free Period
              const existingEntry = timetable[gradeSection][day].find(entry => entry.timeSlot === timeSlot);
              if (existingEntry && existingEntry.subject === "Free Period") {
                timetable[gradeSection][day] = timetable[gradeSection][day].filter(entry => entry !== existingEntry);
                gradeSectionAssignments[day][timeSlot].delete(gradeSection);
                facultyAssignments[day][timeSlot].delete(existingEntry.faculty);
                roomAssignments[day][timeSlot].delete(existingEntry.room);
              } else {
                continue;
              }
            }

            // Randomly select faculty
            const facultyId = subject.facultyIds[Math.floor(Math.random() * subject.facultyIds.length)];
            if (facultyAssignments[day][timeSlot].has(facultyId)) {
              continue;
            }

            // Select room
            let possibleRooms = [];
            if (subject.assignedClasses && subject.assignedClasses.length > 0) {
              possibleRooms = subject.assignedClasses;
            } else if (grade.classAssignmentType === "same") {
              possibleRooms = [gradeSectionRooms[gradeSection]];
            } else {
              possibleRooms = timetableData.classes
                .filter(c => parseInt(c.capacity) >= parseInt(grade.strength))
                .map(c => c.room);
            }

            const availableRooms = possibleRooms.filter(room => 
              room !== "Unassigned" && !roomAssignments[day][timeSlot].has(room)
            );
            if (availableRooms.length === 0) continue;

            const room = availableRooms[Math.floor(Math.random() * availableRooms.length)];

            timetable[gradeSection][day].push({
              timeSlot,
              subject: subject.code,
              faculty: facultyId,
              room
            });

            toSchedule--;
            subjectCounts[subject.code]++;
            dailySubjectAssignments[gradeSection][day][subject.code] = true;
            gradeSectionAssignments[day][timeSlot].add(gradeSection);
            facultyAssignments[day][timeSlot].add(facultyId);
            roomAssignments[day][timeSlot].add(room);
          }

          if (toSchedule > 0) {
            conflicts.push(`Could not schedule ${toSchedule} remaining classes for ${subject.code} in ${gradeSection} due to constraints (once-per-day, no overlapping, or faculty/room availability). Add more slots, days, or resources, or relax constraints.`);
          }
        });
    });

    return timetable;
  }

  // Genetic Algorithm
  const populationSize = 20;
  const generations = 50;
  let population = Array.from({ length: populationSize }, generateRandomTimetable);

  for (let gen = 0; gen < generations; gen++) {
    // Evaluate fitness of each timetable
    const fitnessScores = population.map(timetable => {
      const { fitness, conflicts: localConflicts } = evaluateFitness(timetable);
      return { timetable, fitness, localConflicts };
    });

    // Sort by fitness (descending)
    fitnessScores.sort((a, b) => b.fitness - a.fitness);

    // Log progress
    console.log(`Generation ${gen + 1}/${generations}: Best Fitness = ${fitnessScores[0].fitness}`);

    // If the best timetable has no conflicts, use it
    if (fitnessScores[0].fitness === 0) {
      conflicts.push(...fitnessScores[0].localConflicts);
      Object.assign(schedules, fitnessScores[0].timetable);
      break;
    }

    // Select the top 20% to survive to the next generation
    const eliteSize = Math.floor(populationSize * 0.2);
    const nextPopulation = fitnessScores.slice(0, eliteSize).map(item => item.timetable);

    // Generate the rest of the population through crossover and mutation
    while (nextPopulation.length < populationSize) {
      const parent1 = fitnessScores[Math.floor(Math.random() * eliteSize)].timetable;
      const parent2 = fitnessScores[Math.floor(Math.random() * eliteSize)].timetable;
      let child = crossover(parent1, parent2);
      if (typeof mutate !== 'function') {
        throw new Error("Mutation function is not defined. Please ensure the 'mutate' function is correctly implemented in the 'generateTimetableSchedule' function. Check the file for missing or misplaced function definitions.");
      }
      child = mutate(child);
      nextPopulation.push(child);
    }

    population = nextPopulation;

    // If last generation, use the best timetable
    if (gen === generations - 1) {
      conflicts.push(...fitnessScores[0].localConflicts);
      Object.assign(schedules, fitnessScores[0].timetable);
    }
  }

  // Final validation: Ensure all subjects meet classesWeek and fix remaining violations
  timetableData.grades.forEach(grade => {
    const gradeSection = `${grade.grade}-${grade.section}`;
    const subjectCounts = {};
    timetableData.subjects
      .filter(subject => subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section))
      .forEach(subject => {
        subjectCounts[subject.code] = 0;
      });

    // Track assignments to avoid violations
    const dailySubjectAssignments = {};
    const gradeSectionAssignments = {};
    const facultyAssignments = {};
    const roomAssignments = {};
    days.forEach(day => {
      dailySubjectAssignments[gradeSection] = dailySubjectAssignments[gradeSection] || {};
      dailySubjectAssignments[gradeSection][day] = {};
      gradeSectionAssignments[day] = {};
      facultyAssignments[day] = {};
      roomAssignments[day] = {};
      uniqueTimeSlots.forEach(timeSlot => {
        gradeSectionAssignments[day][timeSlot] = new Set();
        facultyAssignments[day][timeSlot] = new Set();
        roomAssignments[day][timeSlot] = new Set();
      });
    });

    // Check if any subject requires more classes than available days
    const subjectsNeedingSameDayScheduling = new Set();
    const subjectsForGrade = timetableData.subjects.filter(subject =>
      subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section)
    );
    subjectsForGrade.forEach(subject => {
      const weeklyClasses = parseInt(subject.classesWeek);
      if (weeklyClasses > days.length) {
        subjectsNeedingSameDayScheduling.add(subject.code);
      }
    });

    // Remove duplicates and count scheduled classes
    days.forEach(day => {
      const daySchedule = schedules[gradeSection][day];
      daySchedule.sort((a, b) => a.timeSlot.split('-')[0].localeCompare(b.timeSlot.split('-')[0]));

      // Track entries and subjects per time slot to remove duplicates
      const slotEntries = {};
      const slotSubjects = {};
      uniqueTimeSlots.forEach(timeSlot => {
        slotEntries[timeSlot] = [];
        slotSubjects[timeSlot] = new Set();
      });

      for (let i = 0; i < daySchedule.length; i++) {
        const entry = daySchedule[i];
        slotEntries[entry.timeSlot].push(entry);
        if (entry.subject !== "Free Period") {
          slotSubjects[entry.timeSlot].add(entry.subject);
        }
      }

      // Rebuild daySchedule with exactly one entry per time slot
      schedules[gradeSection][day] = [];
      uniqueTimeSlots.forEach(timeSlot => {
        const entries = slotEntries[timeSlot];
        if (entries.length > 0) {
          const classEntries = entries.filter(entry => entry.subject !== "Free Period");
          let selectedEntry = null;
          if (classEntries.length > 1) {
            // If multiple classes, pick one and reschedule the others later
            selectedEntry = classEntries[0];
            // Update subject counts for the removed classes
            for (let i = 1; i < classEntries.length; i++) {
              const removedEntry = classEntries[i];
              subjectCounts[removedEntry.subject]--;
            }
          } else if (classEntries.length === 1) {
            selectedEntry = classEntries[0];
          } else {
            selectedEntry = entries[0]; // If all are Free Periods, take the first one
          }
          schedules[gradeSection][day].push(selectedEntry);
        }
      });
    });

    // Rebuild assignments after removing duplicates
    days.forEach(day => {
      schedules[gradeSection][day].forEach(entry => {
        if (entry.subject !== "Free Period") {
          subjectCounts[entry.subject]++;
          dailySubjectAssignments[gradeSection][day][entry.subject] = true;
          gradeSectionAssignments[day][entry.timeSlot].add(gradeSection);
          facultyAssignments[day][entry.timeSlot].add(entry.faculty);
          roomAssignments[day][entry.timeSlot].add(entry.room);
        }
      });
    });

    // Fix violations: same subject on same day, faculty/room double-booking
    days.forEach(day => {
      const daySchedule = schedules[gradeSection][day];
      daySchedule.sort((a, b) => a.timeSlot.split('-')[0].localeCompare(b.timeSlot.split('-')[0]));

      // Track subjects scheduled on this day
      const subjectsThisDay = {};
      for (let i = 0; i < daySchedule.length; i++) {
        const entry = daySchedule[i];
        if (entry.subject === "Free Period") continue;

        // Same subject on same day (only a problem if not necessary)
        if (subjectsThisDay[entry.subject] && !subjectsNeedingSameDayScheduling.has(entry.subject)) {
          daySchedule[i] = {
            timeSlot: entry.timeSlot,
            subject: "Free Period",
            faculty: "",
            room: entry.room
          };
          subjectCounts[entry.subject]--;
          dailySubjectAssignments[gradeSection][day][entry.subject] = false;
          gradeSectionAssignments[day][entry.timeSlot].delete(gradeSection);
          facultyAssignments[day][entry.timeSlot].delete(entry.faculty);
          roomAssignments[day][entry.timeSlot].delete(entry.room);
          continue;
        }
        subjectsThisDay[entry.subject] = true;
      }
    });

    // Fix faculty/room double-booking
    days.forEach(day => {
      const daySchedule = schedules[gradeSection][day];
      const facultyThisSlot = {};
      const roomThisSlot = {};
      uniqueTimeSlots.forEach(timeSlot => {
        facultyThisSlot[timeSlot] = new Set();
        roomThisSlot[timeSlot] = new Set();
      });

      for (let i = 0; i < daySchedule.length; i++) {
        const entry = daySchedule[i];
        if (entry.subject === "Free Period") continue;

        const timeSlot = entry.timeSlot;
        if (facultyThisSlot[timeSlot].has(entry.faculty)) {
          daySchedule[i] = {
            timeSlot: entry.timeSlot,
            subject: "Free Period",
            faculty: "",
            room: entry.room
          };
          subjectCounts[entry.subject]--;
          dailySubjectAssignments[gradeSection][day][entry.subject] = false;
          gradeSectionAssignments[day][entry.timeSlot].delete(gradeSection);
          roomAssignments[day][entry.timeSlot].delete(entry.room);
          continue;
        }
        facultyThisSlot[timeSlot].add(entry.faculty);

        if (roomThisSlot[timeSlot].has(entry.room)) {
          daySchedule[i] = {
            timeSlot: entry.timeSlot,
            subject: "Free Period",
            faculty: "",
            room: entry.room
          };
          subjectCounts[entry.subject]--;
          dailySubjectAssignments[gradeSection][day][entry.subject] = false;
          gradeSectionAssignments[day][entry.timeSlot].delete(gradeSection);
          facultyAssignments[day][entry.timeSlot].delete(entry.faculty);
          continue;
        }
        roomThisSlot[timeSlot].add(entry.room);
      }
    });

    // Schedule missing classes
    timetableData.subjects
      .filter(subject => subject.gradeSections.some(gs => gs.grade === grade.grade && gs.section === grade.section))
      .forEach(subject => {
        const required = parseInt(subject.classesWeek);
        const scheduled = subjectCounts[subject.code] || 0;
        let toSchedule = required - scheduled;

        let availableSlots = [];
        days.forEach(day => {
          uniqueTimeSlots.forEach((timeSlot, timeSlotIndex) => {
            const slot = timetableData.timeSlots.find(slot => 
              slot.day === day && `${slot.startTime}-${slot.endTime}` === timeSlot
            );
            if (!slot) return;
            const slotApplicableTo = Array.isArray(slot.applicableTo) ? slot.applicableTo : [slot.applicableTo];
            if (slotApplicableTo.some(item => item === gradeSection || item === `${grade.grade} - ${grade.section}`)) {
              availableSlots.push({ day, timeSlot, timeSlotIndex });
            }
          });
        });

        availableSlots.sort(() => Math.random() - 0.5);

        for (const { day, timeSlot, timeSlotIndex } of availableSlots) {
          if (toSchedule <= 0) break;

          // Once-per-day constraint (unless classesWeek > days.length)
          if (dailySubjectAssignments[gradeSection][day][subject.code] && !subjectsNeedingSameDayScheduling.has(subject.code)) {
            continue;
          }

          // No overlapping classes
          if (gradeSectionAssignments[day][timeSlot].has(gradeSection)) {
            // Try to replace a Free Period
            const existingEntry = schedules[gradeSection][day].find(entry => entry.timeSlot === timeSlot);
            if (existingEntry && existingEntry.subject === "Free Period") {
              schedules[gradeSection][day] = schedules[gradeSection][day].filter(entry => entry !== existingEntry);
              gradeSectionAssignments[day][timeSlot].delete(gradeSection);
              facultyAssignments[day][timeSlot].delete(existingEntry.faculty);
              roomAssignments[day][timeSlot].delete(existingEntry.room);
            } else {
              continue;
            }
          }

          // Randomly select faculty
          const facultyId = subject.facultyIds[Math.floor(Math.random() * subject.facultyIds.length)];
          if (facultyAssignments[day][timeSlot].has(facultyId)) {
            continue;
          }

          // Select room
          let possibleRooms = [];
          if (subject.assignedClasses && subject.assignedClasses.length > 0) {
            possibleRooms = subject.assignedClasses;
          } else if (grade.classAssignmentType === "same") {
            possibleRooms = [gradeSectionRooms[gradeSection]];
          } else {
            possibleRooms = timetableData.classes
              .filter(c => parseInt(c.capacity) >= parseInt(grade.strength))
              .map(c => c.room);
          }

          const availableRooms = possibleRooms.filter(room => 
            room !== "Unassigned" && !roomAssignments[day][timeSlot].has(room)
          );
          if (availableRooms.length === 0) continue;

          const room = availableRooms[Math.floor(Math.random() * availableRooms.length)];

          schedules[gradeSection][day].push({
            timeSlot,
            subject: subject.code,
            faculty: facultyId,
            room
          });

          toSchedule--;
          subjectCounts[subject.code]++;
          dailySubjectAssignments[gradeSection][day][subject.code] = true;
          gradeSectionAssignments[day][timeSlot].add(gradeSection);
          facultyAssignments[day][timeSlot].add(facultyId);
          roomAssignments[day][timeSlot].add(room);
        }

        if (toSchedule > 0) {
          conflicts.push(`Could not schedule ${toSchedule} remaining classes for ${subject.code} in ${gradeSection} due to constraints (once-per-day, no overlapping, or faculty/room availability). Add more slots, days, or resources, or relax constraints.`);
        }
      });

    // Log final counts for debugging
    console.log(`Final subject counts for ${gradeSection}:`, subjectCounts);
  });

  // Log final schedules for debugging
  console.log("Generated Schedules:", schedules);

  return {
    generatedOn: new Date(),
    generationStatus: conflicts.length > 0 ? "partial" : "success",
    conflicts,
    schedules,
    algorithm: "genetic-algorithm",
    version: "2.0"
  };
};

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

    // Convert the schedules object to proper format for MongoDB
    const schedulesObject = {};
    for (const [gradeSection, daySchedules] of Object.entries(generationResults.schedules)) {
      schedulesObject[gradeSection] = {};
      for (const [day, assignments] of Object.entries(daySchedules)) {
        schedulesObject[gradeSection][day] = assignments;
      }
    }
    
    // Update the generationResults with the correctly formatted schedules
    const formattedResult = {
      ...generationResults,
      schedules: schedulesObject
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
    Object.keys(latestResult.schedules).forEach((gradeSection) => {
      formattedResult.schedules[gradeSection] = {};
      Object.keys(latestResult.schedules[gradeSection]).forEach((day) => {
        formattedResult.schedules[gradeSection][day] = latestResult.schedules[gradeSection][day];
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

    const timetable = await Timetable.findById(id)
      .populate({
        path: 'createdBy',
        model: 'User',
        select: 'name email',
      })
      .populate({
        path: 'users.userId',
        model: 'User',
        select: 'name email',
      });

    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found." });
    }

    if (req.user && req.user._id) {
      const userIdStr = req.user._id.toString();
      const isCreator = timetable.createdBy && timetable.createdBy._id.toString() === userIdStr;
      const isAuthorizedUser = timetable.users && timetable.users.some(u => u.userId && u.userId._id.toString() === userIdStr);

      if (!isCreator && !isAuthorizedUser) {
        return res.status(403).json({ message: "You don't have permission to access this timetable." });
      }
    }

    res.status(200).json(timetable);
  } catch (error) {
    console.error("Error fetching timetable by ID:", error);
    if (error.name === 'CastError' && error.kind === 'ObjectId') {
      return res.status(400).json({ message: "Invalid timetable ID format." });
    }
    res.status(500).json({ message: "Internal server error." });
  }
};

export const manageTimetableUsers = async (req, res) => {
  try {
    const { timetableId, action, userEmail, role, userId } = req.body;

    // Validate inputs
    if (!userId) {
      return res.status(400).json({ message: "Requesting user ID is required" });
    }
    if (!timetableId) {
      return res.status(400).json({ message: "Timetable ID is required" });
    }

    // Find timetable
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found" });
    }

    // Check if the requesting user is the owner
    const isOwner = timetable.createdBy.toString() === userId;
    if (!isOwner) {
      return res.status(403).json({ message: "Only the owner can manage users" });
    }

    // Find user by email (if needed for the action)
    const user = userEmail ? await User.findOne({ email: userEmail }) : null;

    switch (action) {
      case "add":
        // Validate inputs for add action
        if (!userEmail || !role) {
          return res.status(400).json({ message: "User email and role are required" });
        }
        if (!user) {
          // Create a new user with pending invitation
          const newUser = new User({
            email: userEmail,
            name: userEmail.split("@")[0], // Temporary name
            timetables: [{ timetableId, role, accepted: "Pending" }],
          });
          await newUser.save();
          timetable.users.push({ userId: newUser._id, role, accepted: "Pending" });
          await timetable.save();
          const invitationResult = await sendTimetableInvitation(userEmail, timetableId, role, userId);
          return res.status(invitationResult.success ? 200 : 400).json({ message: invitationResult.message });
        }
        // Check if user is already associated with the timetable
        if (timetable.users.some((u) => u.userId.toString() === user._id.toString())) {
          return res.status(400).json({ message: "User already associated with timetable" });
        }
        // Add user to timetable and user model
        timetable.users.push({ userId: user._id, role, accepted: "Pending" });
        user.timetables.push({ timetableId, role, accepted: "Pending" });
        await Promise.all([timetable.save(), user.save()]);
        const invitationResult = await sendTimetableInvitation(userEmail, timetableId, role, userId);
        return res.status(invitationResult.success ? 200 : 400).json({ message: invitationResult.message });

      case "remove":
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        // Remove user from timetable and user model
        timetable.users = timetable.users.filter((u) => u.userId.toString() !== user._id.toString());
        user.timetables = user.timetables.filter((t) => t.timetableId.toString() !== timetableId);
        await Promise.all([timetable.save(), user.save()]);
        return res.status(200).json({ message: "User removed from timetable" });

      case "changeRole":
        if (!user || !role) {
          return res.status(400).json({ message: "User and role are required" });
        }
        // Update role in both timetable and user model
        const timetableUser = timetable.users.find((u) => u.userId.toString() === user._id.toString());
        if (!timetableUser) {
          return res.status(404).json({ message: "User not associated with timetable" });
        }
        timetableUser.role = role;
        const userTimetable = user.timetables.find((t) => t.timetableId.toString() === timetableId);
        if (userTimetable) {
          userTimetable.role = role;
        }
        await Promise.all([timetable.save(), user.save()]);
        return res.status(200).json({ message: "User role updated" });

      case "acceptInvitation":
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        // Accept invitation (user must be the one accepting)
        if (user._id.toString() !== userId) {
          return res.status(403).json({ message: "Only the invited user can accept the invitation" });
        }
        const tUser = timetable.users.find((u) => u.userId.toString() === user._id.toString());
        const uTimetable = user.timetables.find((t) => t.timetableId.toString() === timetableId);
        if (!tUser || !uTimetable) {
          return res.status(404).json({ message: "Invitation not found" });
        }
        tUser.accepted = "Yes";
        uTimetable.accepted = "Yes";
        await Promise.all([timetable.save(), user.save()]);
        return res.status(200).json({ message: "Invitation accepted" });

      case "rejectInvitation":
        if (!user) {
          return res.status(404).json({ message: "User not found" });
        }
        // Reject invitation (user must be the one rejecting)
        if (user._id.toString() !== userId) {
          return res.status(403).json({ message: "Only the invited user can reject the invitation" });
        }
        timetable.users = timetable.users.filter((u) => u.userId.toString() !== user._id.toString());
        user.timetables = user.timetables.filter((t) => t.timetableId.toString() !== timetableId);
        await Promise.all([timetable.save(), user.save()]);
        return res.status(200).json({ message: "Invitation rejected" });

      default:
        return res.status(400).json({ message: "Invalid action" });
    }
  } catch (error) {
    console.error("Error managing timetable users:", error);
    res.status(500).json({ message: "Error managing timetable users", error: error.message });
  }
};

//////

import { v4 as uuidv4 } from 'uuid';

/**
 * Process natural language with Mistral API
 * @param {String} message - User's message
 * @returns {Object} - Structured analysis of the request
 */
const processWithNLP = async (message) => {
  try {
    console.log("Making request to Mistral API...");
    
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer dKZeswS1fkyXYvrE7Eoi4jm6NWx7iDna",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": "mistral-small-latest",
        "temperature": 0.2,
        "top_p": 1,
        "max_tokens": 1000,
        "stream": false,
        "messages": [
          {
            "role": "system",
            "content": `You are a timetable assistant that analyzes user messages. You must ONLY respond with a valid JSON object.

For timetable operation requests, extract:
- messageType: "operation"
- operation: "add", "modify", or "delete"
- entityType: "class", "faculty", "subject", "timeSlot", or "grade"
- attributes: all relevant information about the entity

For information queries about timetables, extract:
- messageType: "query"
- queryType: "information", "count", "list", "availability", "schedule"
- entityType: "class", "faculty", "subject", "timeSlot", "grade", or "room"
- filters: include all relevant information such as:
  * teacherName: full name of the teacher
  * subject: subject name or code
  * room: room number
  * grade: grade number
  * section: section letter
  * day: day of the week
  * time: specific time like "14:35"
  * timeSlot: time slot like "08:30-09:30"

For conversational messages (greetings, small talk), respond with:
- messageType: "conversation"
- message: appropriate friendly response`
          },
          {
            "role": "user",
            "content": message
          }
        ],
        "response_format": {
          "type": "json_object"
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("API response error:", errorText);
      throw new Error(`API returned status ${response.status}`);
    }

    const result = await response.json();
    
    if (!result.choices || !result.choices[0] || !result.choices[0].message) {
      throw new Error("Invalid response from API");
    }

    const content = result.choices[0].message.content;
    return JSON.parse(content);
    
  } catch (error) {
    console.error("Error in processWithNLP:", error.message);
    return {
      messageType: 'conversation',
      message: "I'm sorry, I'm having trouble understanding. Could you rephrase that?"
    };
  }
};

/**
 * Process a natural language request and return response
 * @param {Object} req - Request object containing projectId and userMessage
 * @param {Object} res - Response object
 */
export const processRequest = async (req, res) => {
  console.log("Processing request:", req.body);
  
  try {
    const { projectId, userMessage } = req.body;

    if (!projectId || !userMessage) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters"
      });
    }

    // Get timetable data
    const timetable = await Timetable.findById(projectId);
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Timetable not found"
      });
    }

    // Process with Mistral API
    const nlpAnalysis = await processWithNLP(userMessage);
    
    // Handle conversational messages
    if (nlpAnalysis.messageType === 'conversation') {
      return res.status(200).json({
        success: true,
        message: nlpAnalysis.message || "How can I help with your timetable?",
        isConversational: true
      });
    }
    
    // Handle information queries
    if (nlpAnalysis.messageType === 'query') {
      const response = await generateResponse(nlpAnalysis, timetable, userMessage);
      return res.status(200).json({
        success: true,
        message: response,
        isQuery: true
      });
    }
    
    // Handle operations
    if (nlpAnalysis.messageType === 'operation') {
      return res.status(200).json({
        success: true,
        message: `I'll ${nlpAnalysis.operation} that ${nlpAnalysis.entityType} for you. Please confirm the details.`,
        operation: nlpAnalysis.operation,
        entityType: nlpAnalysis.entityType,
        attributes: nlpAnalysis.attributes || {}
      });
    }
    
    // Fallback
    return res.status(200).json({
      success: false,
      message: "I'm not sure what you're asking. Could you rephrase that?"
    });
    
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Sorry, I couldn't process that request. Please try again."
    });
  }
};

/**
 * Generate a response based on NLP analysis and timetable data
 * @param {Object} nlpAnalysis - Analysis from AI
 * @param {Object} timetable - Timetable data
 * @param {String} userMessage - Original user message
 * @returns {String} - Response message
 */
async function generateResponse(nlpAnalysis, timetable, userMessage) {
  if (!timetable.hasGeneratedResults || !timetable.generationResults || timetable.generationResults.length === 0) {
    return "No timetable has been generated yet.";
  }
  
  const schedules = timetable.generationResults[0].schedules;
  const filters = nlpAnalysis.filters || {};
  
  // Room availability query
  if (nlpAnalysis.entityType === 'room' && filters.room) {
    const roomNumber = filters.room;
    const day = filters.day;
    const time = filters.time; // For specific time queries
    
    // Check for specific time query (like "Is Room 105 occupied at 14:35?")
    if (time && day) {
      // Check if room is occupied at that time
      let isOccupied = false;
      let classDetails = null;
      
      // Search all schedules to find if the room is occupied at that time
      for (const gradeSection in schedules) {
        if (!schedules[gradeSection][day]) continue;
        
        for (const slot of schedules[gradeSection][day]) {
          if (slot.room && slot.room.toString() === roomNumber.toString()) {
            // Check if time falls in this slot
            const [startTime, endTime] = slot.timeSlot.split('-');
            if (isTimeInRange(time, startTime, endTime)) {
              isOccupied = true;
              const teacher = timetable.faculty.find(f => f.id === slot.faculty);
              classDetails = {
                subject: slot.subject,
                gradeSection,
                teacher: teacher ? teacher.name : 'Unknown Teacher'
              };
              break;
            }
          }
        }
        if (isOccupied) break;
      }
      
      if (isOccupied && classDetails) {
        return `Yes, Room ${roomNumber} is occupied at ${time} on ${day} with ${classDetails.subject} for ${classDetails.gradeSection} by ${classDetails.teacher}.`;
      } else {
        return `No, Room ${roomNumber} is free at ${time} on ${day}.`;
      }
    }
    
    // General room availability query
    if (day) {
      const occupied = [];
      
      // Find all times the room is occupied on that day
      Object.keys(schedules).forEach(gradeSection => {
        if (!schedules[gradeSection][day]) return;
        
        schedules[gradeSection][day].forEach(slot => {
          if (slot.room && slot.room.toString() === roomNumber.toString()) {
            occupied.push(`${slot.timeSlot}: ${slot.subject}`);
          }
        });
      });
      
      if (occupied.length === 0) {
        return `Room ${roomNumber} is free all day on ${day}.`;
      } else {
        return `Room ${roomNumber} is occupied at: ${occupied.join(', ')}`;
      }
    }
    
    return `Please specify which day you're asking about for Room ${roomNumber}.`;
  }
  
  // Teacher query
  if (filters.teacherName) {
    const teacherName = filters.teacherName;
    const day = filters.day;
    
    // Find teacher in database
    const teacher = timetable.faculty.find(f => 
      f.name.toLowerCase().includes(teacherName.toLowerCase()) ||
      teacherName.toLowerCase().includes(f.name.toLowerCase())
    );
    
    if (!teacher) {
      return `Teacher ${teacherName} not found.`;
    }
    
    // Find classes taught by this teacher
    const classes = [];
    const subjects = new Set();
    
    // Loop through schedules
    Object.keys(schedules).forEach(gradeSection => {
      const daysToCheck = day ? [day] : Object.keys(schedules[gradeSection]);
      
      daysToCheck.forEach(currentDay => {
        if (!schedules[gradeSection][currentDay]) return;
        
        schedules[gradeSection][currentDay].forEach(slot => {
          if (slot.faculty === teacher.id) {
            classes.push({
              day: currentDay,
              time: slot.timeSlot,
              subject: slot.subject,
              gradeSection: gradeSection
            });
            subjects.add(slot.subject);
          }
        });
      });
    });
    
    // No classes found
    if (classes.length === 0) {
      return `${teacher.name} is not teaching any classes${day ? ' on ' + day : ''}.`;
    }
    
    // "What does X teach" query
    if (userMessage.toLowerCase().includes('what') && userMessage.toLowerCase().includes('teach')) {
      return `${teacher.name} teaches ${Array.from(subjects).join(', ')}.`;
    }
    
    // Schedule query
    if (day || userMessage.toLowerCase().includes('schedule')) {
      const schedule = classes
        .filter(c => !day || c.day === day)
        .map(c => `${c.day} ${c.time}: ${c.subject} (${c.gradeSection})`)
        .join(', ');
        
      return `${teacher.name}'s schedule: ${schedule}`;
    }
    
    // General info
    return `${teacher.name} teaches ${Array.from(subjects).join(', ')}.`;
  }
  
  // Grade schedule query
  if (nlpAnalysis.entityType === 'grade' && filters.grade && filters.section && filters.day) {
    const gradeSection = `${filters.grade}-${filters.section}`;
    
    if (!schedules[gradeSection] || !schedules[gradeSection][filters.day]) {
      return `No schedule found for Grade ${filters.grade}-${filters.section} on ${filters.day}.`;
    }
    
    // First class query
    if (userMessage.toLowerCase().includes('first class')) {
      const daySchedule = [...schedules[gradeSection][filters.day]];
      
      // Sort by time
      daySchedule.sort((a, b) => {
        const timeA = a.timeSlot.split('-')[0];
        const timeB = b.timeSlot.split('-')[0];
        return timeA.localeCompare(timeB);
      });
      
      if (daySchedule.length === 0) {
        return `No classes scheduled for Grade ${filters.grade}-${filters.section} on ${filters.day}.`;
      }
      
      const firstClass = daySchedule[0];
      const teacher = timetable.faculty.find(f => f.id === firstClass.faculty);
      
      return `First class for Grade ${filters.grade}-${filters.section} on ${filters.day} is ${firstClass.subject} at ${firstClass.timeSlot} with ${teacher ? teacher.name : 'Unknown Teacher'}.`;
    }
    
    // Full schedule
    const classes = schedules[gradeSection][filters.day].map(slot => {
      const teacher = timetable.faculty.find(f => f.id === slot.faculty);
      return `${slot.timeSlot}: ${slot.subject}${teacher ? ' (' + teacher.name + ')' : ''}`;
    }).join(', ');
    
    return `Grade ${filters.grade}-${filters.section} schedule for ${filters.day}: ${classes}`;
  }
  
  // List teachers
  if (nlpAnalysis.queryType === 'list' && nlpAnalysis.entityType === 'faculty') {
    if (!timetable.faculty || timetable.faculty.length === 0) {
      return "No teachers found in the system.";
    }
    
    return `Teachers: ${timetable.faculty.map(t => t.name).join(', ')}`;
  }
  
  // List subjects
  if (nlpAnalysis.queryType === 'list' && nlpAnalysis.entityType === 'subject') {
    if (!timetable.subjects || timetable.subjects.length === 0) {
      return "No subjects found in the system.";
    }
    
    return `Subjects: ${timetable.subjects.map(s => s.subject || s.name).join(', ')}`;
  }
  
  return "I couldn't find that information. Try asking about teachers, rooms, or classes.";
}

/**
 * Check if a time is within a range
 * @param {String} time - Time to check (e.g., "14:35")
 * @param {String} start - Start time (e.g., "14:30")
 * @param {String} end - End time (e.g., "15:30")
 * @returns {Boolean} - True if time is in range
 */
function isTimeInRange(time, start, end) {
  // Convert all to minutes for comparison
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  
  return timeMinutes >= startMinutes && timeMinutes < endMinutes;
}

/**
 * Convert time to minutes since midnight
 * @param {String} time - Time in format "HH:MM"
 * @returns {Number} - Minutes
 */
function timeToMinutes(time) {
  time = time.replace('.', ':');
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

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