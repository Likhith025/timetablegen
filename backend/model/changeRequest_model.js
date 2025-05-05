import mongoose from "mongoose";

const changeRequestSchema = new mongoose.Schema({
  timetableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Timetable",
    required: true,
  },
  requesterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  classId: {
    type: String, // Identifier for the class to change (e.g., from timetable schedule)
    required: true,
  },
  currentTimeSlot: {
    type: String, // Current time slot of the class
    required: true,
  },
  proposedTimeSlot: {
    type: String, // Proposed new time slot
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  adminResponse: {
    type: String, // Optional response from admin/owner
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const ChangeRequest = mongoose.models.ChangeRequest || mongoose.model("ChangeRequest", changeRequestSchema);

export default ChangeRequest;