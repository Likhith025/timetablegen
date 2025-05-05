import ChangeRequest from "../model/changeRequest_model.js";
import Timetable from "../model/Timetable_model.js";

export const submitChangeRequest = async (req, res) => {
  try {
    const { timetableId, classId, currentTimeSlot, proposedTimeSlot } = req.body;
    const requesterId = req.user._id;

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) return res.status(404).json({ message: "Timetable not found" });

    const changeRequest = new ChangeRequest({
      timetableId,
      requesterId,
      classId,
      currentTimeSlot,
      proposedTimeSlot,
    });
    await changeRequest.save();

    res.status(201).json({ message: "Change request submitted", requestId: changeRequest._id });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const approveChangeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminId = req.user._id;

    const changeRequest = await ChangeRequest.findById(requestId).populate('timetableId');
    if (!changeRequest) return res.status(404).json({ message: "Change request not found" });

    const timetable = changeRequest.timetableId;
    if (!timetable.users.some(u => u.userId.equals(adminId) && (u.role === "admin" || u.role === "owner"))) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const [gradeSection, day] = changeRequest.classId.split('-').slice(0, 2);
    const latestGenIndex = timetable.generationResults.length - 1;
    const schedule = timetable.generationResults[latestGenIndex].schedules[gradeSection][day];
    const slotIndex = schedule.findIndex(s => s.timeSlot === changeRequest.currentTimeSlot);

    if (slotIndex === -1) return res.status(400).json({ message: "Class not found in schedule" });

    const updatePath = `generationResults.${latestGenIndex}.schedules.${gradeSection}.${day}.${slotIndex}.timeSlot`;
    await Timetable.updateOne(
      { _id: timetable._id },
      { $set: { [updatePath]: changeRequest.proposedTimeSlot } }
    );

    changeRequest.status = "approved";
    await changeRequest.save();

    res.status(200).json({ message: "Change request approved and applied" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const rejectChangeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminId = req.user._id;

    const changeRequest = await ChangeRequest.findById(requestId).populate('timetableId');
    if (!changeRequest) return res.status(404).json({ message: "Change request not found" });

    const timetable = changeRequest.timetableId;
    if (!timetable.users.some(u => u.userId.equals(adminId) && (u.role === "admin" || u.role === "owner"))) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    changeRequest.status = "rejected";
    await changeRequest.save();

    res.status(200).json({ message: "Change request rejected" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
};