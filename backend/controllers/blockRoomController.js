import BlockRoom from "../model/BlockRoom_model.js";
import Timetable from "../model/Timetable_model.js";

export const createBlockRoom = async (req, res) => {
  try {
    const { timetableId, userId, purpose, date, timeSlot, classRoom } = req.body;

    if (!timetableId || !userId || !purpose || !date || !timeSlot || !classRoom) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found" });
    }

    const userInTimetable = timetable.users.find(
      (u) => u.userId.toString() === userId && u.role === "educator"
    );
    if (!userInTimetable) {
      return res.status(403).json({ message: "User is not an educator in this timetable" });
    }

    // Check for educator's existing class assignments in the timetable's schedules
    const generationResult = timetable.generationResults[timetable.generationResults.length - 1];
    if (generationResult && generationResult.schedules) {
      const dateStr = new Date(date).toISOString().split("T")[0];
      for (const [gradeSection, schedule] of Object.entries(generationResult.schedules)) {
        if (schedule[dateStr]) {
          const assignments = schedule[dateStr][timeSlot];
          if (assignments) {
            for (const assignment of assignments) {
              if (assignment.faculty === userId) {
                return res.status(409).json({
                  message: "Educator already has a class scheduled at this time slot",
                });
              }
            }
          }
        }
      }
    }

    // Check if the room is already blocked for the given time slot and date
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

    const blockRooms = await BlockRoom.find({ timetableId })
      .populate("userId", "name email")
      .populate("timeSlot", "day startTime endTime")
      .populate("classRoom", "room building");

    res.status(200).json(blockRooms);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get a single block room entry by ID
export const getBlockRoomById = async (req, res) => {
  try {
    const { id } = req.params;

    const blockRoom = await BlockRoom.findById(id)
      .populate("userId", "name email")
      .populate("timeSlot", "day startTime endTime")
      .populate("classRoom", "room building");

    if (!blockRoom) {
      return res.status(404).json({ message: "Block room entry not found" });
    }

    res.status(200).json(blockRoom);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Update a block room entry
export const updateBlockRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { purpose, date, timeSlot, classRoom } = req.body;

    const blockRoom = await BlockRoom.findById(id);
    if (!blockRoom) {
      return res.status(404).json({ message: "Block room entry not found" });
    }

    // Check for room conflicts if updating timeSlot, date, or classRoom
    if (timeSlot || date || classRoom) {
      const query = {
        timetableId: blockRoom.timetableId,
        _id: { $ne: id }, // Exclude the current block room
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

    // Check for educator's existing class assignments if updating timeSlot or date
    if (timeSlot || date) {
      const timetable = await Timetable.findById(blockRoom.timetableId);
      const generationResult = timetable.generationResults[timetable.generationResults.length - 1];
      if (generationResult && generationResult.schedules) {
        const dateStr = new Date(date || blockRoom.date).toISOString().split("T")[0];
        for (const [gradeSection, schedule] of Object.entries(generationResult.schedules)) {
          if (schedule[dateStr]) {
            const assignments = schedule[dateStr][timeSlot || blockRoom.timeSlot];
            if (assignments) {
              for (const assignment of assignments) {
                if (assignment.faculty === blockRoom.userId.toString()) {
                  return res.status(409).json({
                    message: "Educator already has a class scheduled at this time slot",
                  });
                }
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

    const blockRooms = await BlockRoom.find({ userId })
      .populate("timetableId", "projectName")
      .populate("timeSlot", "day startTime endTime")
      .populate("classRoom", "room building");

    res.status(200).json(blockRooms);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get available time slots for a timetable, date, and classroom
export const getAvailableSlots = async (req, res) => {
  try {
    const { timetableId } = req.params;
    const { date, classRoom } = req.query;

    if (!date || !classRoom) {
      return res.status(400).json({ message: "Date and classRoom are required" });
    }

    // Find the timetable
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found" });
    }

    // Get all time slots from the timetable
    const allTimeSlots = timetable.timeSlots;

    // Find blocked slots for the given date and classroom
    const blockedSlots = await BlockRoom.find({
      timetableId,
      classRoom,
      date: {
        $gte: new Date(date).setHours(0, 0, 0, 0),
        $lte: new Date(date).setHours(23, 59, 59, 999),
      },
    }).select("timeSlot");

    // Extract blocked time slot IDs
    const blockedTimeSlotIds = blockedSlots.map((slot) => slot.timeSlot.toString());

    // Filter out blocked time slots
    const availableSlots = allTimeSlots.filter(
      (slot) => !blockedTimeSlotIds.includes(slot._id.toString())
    );

    res.status(200).json({
      message: "Available time slots retrieved successfully",
      availableSlots,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};