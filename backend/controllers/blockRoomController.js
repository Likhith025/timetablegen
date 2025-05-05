import Timetable from "../model/Timetable_model.js";
import BlockRoom from "../model/BlockRoom_model.js";
import User from "../model/user_model.js";
import mongoose from "mongoose";

// Create a new block room entry
export const createBlockRoom = async (req, res) => {
  try {
    const { timetableId, userId, purpose, date, timeSlot, classRoom, gradeSection } = req.body;

    // Validate required fields
    if (!timetableId || !userId || !purpose || !date || !timeSlot || !classRoom || !gradeSection) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if the timetable exists
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found" });
    }

    // Validate gradeSection
    const gradeSectionExists = timetable.grades.find(g => g._id.toString() === gradeSection);
    if (!gradeSectionExists) {
      return res.status(400).json({ message: "Invalid grade-section ID" });
    }

    // Check for conflicts (educator or grade-section already scheduled)
    const generationResult = timetable.generationResults[timetable.generationResults.length - 1];
    if (generationResult && generationResult.schedules) {
      const dateStr = new Date(date).toISOString().split("T")[0];
      for (const [gradeSectionKey, schedule] of Object.entries(generationResult.schedules)) {
        if (schedule[dateStr] && schedule[dateStr][timeSlot]) {
          const assignments = schedule[dateStr][timeSlot];
          for (const assignment of assignments) {
            if (assignment.faculty === userId || gradeSectionKey === gradeSectionExists.grade + '-' + gradeSectionExists.section) {
              return res.status(409).json({
                message: "Educator or grade-section already has a class scheduled at this time slot",
              });
            }
          }
        }
      }
    }

    // Check if the room is already blocked
    const existingBlock = await BlockRoom.findOne({
      timetableId,
      classRoom,
      timeSlot,
      date: {
        $gte: new Date(date).setHours(0, 0, 0, 0),
        $lte: new Date(date).setHours(23, 59, 59, 999),
      },
    });
    if (existingBlock) {
      return res.status(409).json({ message: "Room is already blocked for this time slot" });
    }

    const blockRoom = new BlockRoom({
      timetableId,
      userId,
      purpose,
      date,
      timeSlot,
      classRoom,
      gradeSection,
    });

    await blockRoom.save();
    res.status(201).json({ message: "Room blocked successfully", blockRoom });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all block room entries for a timetable
export const getBlockRooms = async (req, res) => {
  try {
    const { timetableId } = req.params;

    // Fetch block rooms
    const blockRooms = await BlockRoom.find({ timetableId });

    // Fetch the timetable
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found" });
    }

    // Map block rooms to include project name, role, time slot, classroom, and grade-section
    const enrichedBlockRooms = blockRooms.map(room => {
      // Skip rooms with invalid userId
      if (!room.userId) {
        console.warn(`BlockRoom ${room._id} has no userId`);
        return {
          ...room._doc,
          projectName: timetable.projectName || "Unknown Timetable",
          userRole: "Unknown",
          timeSlot: { day: "Unknown", startTime: "N/A", endTime: "N/A" },
          classRoom: { room: "Unknown", building: "" },
          gradeSection: { _id: null, grade: "Unknown", section: "Unknown" },
        };
      }

      const timeSlotDetails = timetable.timeSlots && Array.isArray(timetable.timeSlots)
        ? timetable.timeSlots.find(slot => slot._id && slot._id.toString() === (room.timeSlot ? room.timeSlot.toString() : null))
        : null;

      const classRoomDetails = timetable.classes && Array.isArray(timetable.classes)
        ? timetable.classes.find(cls => cls._id && cls._id.toString() === (room.classRoom ? room.classRoom.toString() : null))
        : null;

      const gradeSectionDetails = timetable.grades && Array.isArray(timetable.grades)
        ? timetable.grades.find(g => g._id && g._id.toString() === (room.gradeSection ? room.gradeSection.toString() : null))
        : null;

      return {
        ...room._doc,
        projectName: timetable.projectName || "Unknown Timetable",
        userRole: "Unknown", // Since authorization is removed, userRole is not determined
        timeSlot: timeSlotDetails
          ? { day: timeSlotDetails.day, startTime: timeSlotDetails.startTime, endTime: timeSlotDetails.endTime }
          : { day: "Unknown", startTime: "N/A", endTime: "N/A" },
        classRoom: classRoomDetails
          ? { room: classRoomDetails.room, building: classRoomDetails.building }
          : { room: "Unknown", building: "" },
        gradeSection: gradeSectionDetails
          ? { _id: room.gradeSection, grade: gradeSectionDetails.grade, section: gradeSectionDetails.section }
          : { _id: null, grade: "Unknown", section: "Unknown" },
      };
    });

    res.status(200).json(enrichedBlockRooms);
  } catch (error) {
    console.error('Error in getBlockRooms:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get a single block room entry by ID
export const getBlockRoomById = async (req, res) => {
  try {
    const { id } = req.params;

    const blockRoom = await BlockRoom.findById(id);
    if (!blockRoom) {
      return res.status(404).json({ message: "Block room entry not found" });
    }

    // Fetch the timetable
    const timetable = await Timetable.findById(blockRoom.timetableId);
    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found" });
    }

    const timeSlotDetails = timetable.timeSlots && Array.isArray(timetable.timeSlots)
      ? timetable.timeSlots.find(slot => slot._id && slot._id.toString() === (blockRoom.timeSlot ? blockRoom.timeSlot.toString() : null))
      : null;

    const classRoomDetails = timetable.classes && Array.isArray(timetable.classes)
      ? timetable.classes.find(cls => cls._id && cls._id.toString() === (blockRoom.classRoom ? blockRoom.classRoom.toString() : null))
      : null;

    const gradeSectionDetails = timetable.grades && Array.isArray(timetable.grades)
      ? timetable.grades.find(g => g._id && g._id.toString() === (blockRoom.gradeSection ? room.gradeSection.toString() : null))
      : null;

    const enrichedBlockRoom = {
      ...blockRoom._doc,
      projectName: timetable.projectName || "Unknown Timetable",
      userRole: "Unknown", // Since authorization is removed, userRole is not determined
      timeSlot: timeSlotDetails
        ? { day: timeSlotDetails.day, startTime: timeSlotDetails.startTime, endTime: timeSlotDetails.endTime }
        : { day: "Unknown", startTime: "N/A", endTime: "N/A" },
      classRoom: classRoomDetails
        ? { room: classRoomDetails.room, building: classRoomDetails.building }
        : { room: "Unknown", building: "" },
      gradeSection: gradeSectionDetails
        ? { _id: blockRoom.gradeSection, grade: gradeSectionDetails.grade, section: gradeSectionDetails.section }
        : { _id: null, grade: "Unknown", section: "Unknown" },
    };

    res.status(200).json(enrichedBlockRoom);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update a block room entry
export const updateBlockRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { purpose, date, timeSlot, classRoom, gradeSection } = req.body;

    const blockRoom = await BlockRoom.findById(id);
    if (!blockRoom) {
      return res.status(404).json({ message: "Block room entry not found" });
    }

    // Check if the timetable exists
    const timetable = await Timetable.findById(blockRoom.timetableId);
    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found" });
    }

    // Validate gradeSection if provided
    if (gradeSection) {
      const gradeSectionExists = timetable.grades.find(g => g._id.toString() === gradeSection);
      if (!gradeSectionExists) {
        return res.status(400).json({ message: "Invalid grade-section ID" });
      }
    }

    // Check for room conflicts
    if (timeSlot || date || classRoom) {
      const query = {
        timetableId: blockRoom.timetableId,
        _id: { $ne: id },
        classRoom: classRoom || blockRoom.classRoom,
        timeSlot: timeSlot || blockRoom.timeSlot,
        date: date
          ? {
              $gte: new Date(date).setHours(0, 0, 0, 0),
              $lte: new Date(date).setHours(23, 59, 59, 999),
            }
          : blockRoom.date,
      };

      const existingBlock = await BlockRoom.findOne(query);
      if (existingBlock) {
        return res.status(409).json({ message: "Room is already blocked for this time slot" });
      }
    }

    // Check for educator or grade-section conflicts
    if (timeSlot || date || gradeSection) {
      const generationResult = timetable.generationResults[timetable.generationResults.length - 1];
      if (generationResult && generationResult.schedules) {
        const dateStr = new Date(date || blockRoom.date).toISOString().split("T")[0];
        for (const [gradeSectionKey, schedule] of Object.entries(generationResult.schedules)) {
          if (schedule[dateStr] && schedule[dateStr][timeSlot || blockRoom.timeSlot]) {
            const assignments = schedule[dateStr][timeSlot || blockRoom.timeSlot];
            for (const assignment of assignments) {
              const targetGradeSection = gradeSection
                ? timetable.grades.find(g => g._id.toString() === gradeSection)
                : timetable.grades.find(g => g._id.toString() === blockRoom.gradeSection);
              if (assignment.faculty === blockRoom.userId.toString() ||
                  (targetGradeSection && gradeSectionKey === `${targetGradeSection.grade}-${targetGradeSection.section}`)) {
                return res.status(409).json({
                  message: "Educator or grade-section already has a class scheduled at this time slot",
                });
              }
            }
          }
        }
      }
    }

    // Update fields
    if (purpose) blockRoom.purpose = purpose;
    if (date) blockRoom.date = date;
    if (timeSlot) blockRoom.timeSlot = timeSlot;
    if (classRoom) blockRoom.classRoom = classRoom;
    if (gradeSection) blockRoom.gradeSection = gradeSection;

    await blockRoom.save();
    res.status(200).json({ message: "Block room updated successfully", blockRoom });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Delete a block room entry
export const deleteBlockRoom = async (req, res) => {
  try {
    const { id } = req.params;

    const blockRoom = await BlockRoom.findById(id);
    if (!blockRoom) {
      return res.status(404).json({ message: "Block room entry not found" });
    }

    await BlockRoom.deleteOne({ _id: id });
    res.status(200).json({ message: "Block room entry deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get all block room entries for a specific user
export const getBlockRoomsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const blockRooms = await BlockRoom.find({ userId });
    const timetableIds = [...new Set(blockRooms.map(room => room.timetableId.toString()))];
    const timetables = await Timetable.find({ _id: { $in: timetableIds } });

    const enrichedBlockRooms = blockRooms.map(room => {
      const timetable = timetables.find(t => t._id.toString() === room.timetableId.toString());

      const timeSlotDetails = timetable?.timeSlots.find(
        (slot) => slot._id.toString() === room.timeSlot.toString()
      ) || { day: "Unknown", startTime: "N/A", endTime: "N/A" };

      const classRoomDetails = timetable?.classes.find(
        (cls) => cls._id.toString() === room.classRoom.toString()
      ) || { room: "Unknown", building: "" };

      const gradeSectionDetails = timetable?.grades.find(
        (g) => g._id.toString() === room.gradeSection.toString()
      ) || { grade: "Unknown", section: "Unknown" };

      return {
        ...room._doc,
        projectName: timetable ? timetable.projectName : "Unknown Timetable",
        userRole: "Unknown", // Since authorization is removed, userRole is not determined
        timeSlot: {
          day: timeSlotDetails.day,
          startTime: timeSlotDetails.startTime,
          endTime: timeSlotDetails.endTime,
        },
        classRoom: classRoomDetails,
        gradeSection: {
          _id: room.gradeSection,
          grade: gradeSectionDetails.grade,
          section: gradeSectionDetails.section
        },
      };
    });

    res.status(200).json(enrichedBlockRooms);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get available classrooms for a specific date, time slot, and grade-section
export const getAvailableClassrooms = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const { date, timeSlot, gradeSection } = req.query;

    // Validate required query parameters
    if (!date || !timeSlot || !gradeSection) {
      return res.status(400).json({ message: "Date, timeSlot, and gradeSection are required" });
    }

    // Validate date format
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // Find the timetable
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found" });
    }

    // Validate gradeSection
    const gradeSectionDetails = timetable.grades.find(g => g._id.toString() === gradeSection);
    if (!gradeSectionDetails) {
      return res.status(400).json({ message: "Invalid grade-section ID" });
    }

    // Validate timeSlot and ensure it matches the day
    const timeSlotDetails = timetable.timeSlots.find(slot => slot._id.toString() === timeSlot);
    if (!timeSlotDetails) {
      return res.status(400).json({ message: "Invalid time slot ID" });
    }

    const dayOfWeekLong = selectedDate.toLocaleString('en-US', { weekday: 'long' });
    const dayMap = {
      Monday: ['Monday', 'Mon'],
      Tuesday: ['Tuesday', 'Tue'],
      Wednesday: ['Wednesday', 'Wed'],
      Thursday: ['Thursday', 'Thu'],
      Friday: ['Friday', 'Fri'],
      Saturday: ['Saturday', 'Sat'],
      Sunday: ['Sunday', 'Sun'],
    };
    const validDays = Object.keys(dayMap).find((key) =>
      dayMap[key].includes(dayOfWeekLong)
    ) ? dayMap[dayOfWeekLong] : [dayOfWeekLong];

    if (!validDays.includes(timeSlotDetails.day)) {
      return res.status(400).json({ message: "Time slot is not valid for the selected date's day" });
    }

    // Check if grade-section has a scheduled class
    const generationResult = timetable.generationResults && timetable.generationResults.length > 0
      ? timetable.generationResults[timetable.generationResults.length - 1]
      : null;
    if (generationResult && generationResult.schedules) {
      const dateStr = new Date(date).toISOString().split('T')[0];
      const gradeSectionKey = `${gradeSectionDetails.grade}-${gradeSectionDetails.section}`;
      if (generationResult.schedules[gradeSectionKey] && 
          generationResult.schedules[gradeSectionKey][dateStr] && 
          generationResult.schedules[gradeSectionKey][dateStr][timeSlot]) {
        return res.status(409).json({
          message: `Grade-section ${gradeSectionKey} has a class scheduled at this time slot`
        });
      }
    }

    // Get all classrooms from the timetable
    const allClassrooms = timetable.classes || [];

    // Find blocked classrooms for the given date and time slot
    const blockedClassrooms = await BlockRoom.find({
      timetableId,
      timeSlot,
      date: {
        $gte: new Date(date).setHours(0, 0, 0, 0),
        $lte: new Date(date).setHours(23, 59, 59, 999),
      },
    }).select('classRoom');

    const blockedClassroomIds = blockedClassrooms
      .map((block) => block.classRoom && block.classRoom.toString())
      .filter(Boolean);

    // Check assigned classrooms in the latest generation result
    const assignedClassroomIds = [];
    if (generationResult && generationResult.schedules) {
      const dateStr = new Date(date).toISOString().split('T')[0];
      for (const [gradeSectionKey, schedule] of Object.entries(generationResult.schedules)) {
        if (schedule[dateStr] && schedule[dateStr][timeSlot]) {
          const assignments = schedule[dateStr][timeSlot];
          if (Array.isArray(assignments)) {
            assignments.forEach((assignment) => {
              if (assignment.room && assignment.room.toString()) {
                assignedClassroomIds.push(assignment.room.toString());
              }
            });
          }
        }
      }
    }

    // Filter out blocked and assigned classrooms
    const availableClassrooms = allClassrooms.filter(
      (classroom) =>
        classroom._id &&
        !blockedClassroomIds.includes(classroom._id.toString()) &&
        !assignedClassroomIds.includes(classroom._id.toString())
    );

    // Format response to include only necessary classroom details
    const formattedClassrooms = availableClassrooms.map(classroom => ({
      _id: classroom._id,
      room: classroom.room,
      building: classroom.building,
      capacity: classroom.capacity
    }));

    res.status(200).json({
      message: "Available classrooms retrieved successfully",
      availableClassrooms: formattedClassrooms,
    });
  } catch (error) {
    console.error('Error in getAvailableClassrooms:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get available time slots for a specific date and grade-section (classRoom is optional)
export const getAvailableTimeSlots = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const { date, gradeSection, classRoom } = req.query;

    // Validate required query parameters
    if (!date || !gradeSection) {
      return res.status(400).json({ message: "Date and gradeSection are required" });
    }

    // Validate date format
    const selectedDate = new Date(date);
    if (isNaN(selectedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // Find the timetable
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found" });
    }

    // Validate gradeSection
    const gradeSectionDetails = timetable.grades.find(g => g._id.toString() === gradeSection);
    if (!gradeSectionDetails) {
      return res.status(400).json({ message: "Invalid grade-section ID" });
    }

    // Validate classRoom if provided
    if (classRoom) {
      const classRoomDetails = timetable.classes.find(cls => cls._id.toString() === classRoom);
      if (!classRoomDetails) {
        return res.status(400).json({ message: "Invalid classroom ID" });
      }
    }

    // Determine the day of the week for the selected date
    const dayOfWeekLong = selectedDate.toLocaleString('en-US', { weekday: 'long' });
    const dayMap = {
      Monday: ['Monday', 'Mon'],
      Tuesday: ['Tuesday', 'Tue'],
      Wednesday: ['Wednesday', 'Wed'],
      Thursday: ['Thursday', 'Thu'],
      Friday: ['Friday', 'Fri'],
      Saturday: ['Saturday', 'Sat'],
      Sunday: ['Sunday', 'Sun'],
    };
    const validDays = Object.keys(dayMap).find((key) =>
      dayMap[key].includes(dayOfWeekLong)
    ) ? dayMap[dayOfWeekLong] : [dayOfWeekLong];

    // Get all time slots for the day
    const possibleTimeSlots = timetable.timeSlots.filter(slot => validDays.includes(slot.day));

    // Find blocked time slots for the given date (and classroom if provided)
    const blockedTimeSlotsQuery = {
      timetableId,
      date: {
        $gte: new Date(date).setHours(0, 0, 0, 0),
        $lte: new Date(date).setHours(23, 59, 59, 999),
      },
    };
    if (classRoom) {
      blockedTimeSlotsQuery.classRoom = classRoom;
    }
    const blockedTimeSlots = await BlockRoom.find(blockedTimeSlotsQuery).select('timeSlot');

    const blockedTimeSlotIds = blockedTimeSlots
      .map(block => block.timeSlot && block.timeSlot.toString())
      .filter(Boolean);

    // Check assigned time slots in the latest generation result
    const generationResult = timetable.generationResults && timetable.generationResults.length > 0
      ? timetable.generationResults[timetable.generationResults.length - 1]
      : null;

    const assignedTimeSlotIds = new Set();
    if (generationResult && generationResult.schedules) {
      const dateStr = new Date(date).toISOString().split('T')[0];
      for (const [gradeSectionKey, schedule] of Object.entries(generationResult.schedules)) {
        if (schedule[dateStr]) {
          for (const [ts, assignments] of Object.entries(schedule[dateStr])) {
            if (Array.isArray(assignments)) {
              assignments.forEach(assignment => {
                if (classRoom && assignment.room === classRoom) {
                  assignedTimeSlotIds.add(ts);
                }
                if (gradeSectionKey === `${gradeSectionDetails.grade}-${gradeSectionDetails.section}`) {
                  assignedTimeSlotIds.add(ts);
                }
              });
            }
          }
        }
      }
    }

    // Filter out blocked and assigned time slots
    const availableTimeSlots = possibleTimeSlots.filter(
      slot => !blockedTimeSlotIds.includes(slot._id.toString()) && !assignedTimeSlotIds.has(slot._id.toString())
    );

    // Format response
    const formattedTimeSlots = availableTimeSlots.map(slot => ({
      _id: slot._id,
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime,
    }));

    res.status(200).json({
      message: "Available time slots retrieved successfully",
      availableTimeSlots: formattedTimeSlots,
    });
  } catch (error) {
    console.error('Error in getAvailableTimeSlots:', error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};