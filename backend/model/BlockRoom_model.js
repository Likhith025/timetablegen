import mongoose from "mongoose";

const blockRoomSchema = new mongoose.Schema({
  timetableId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Timetable",
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  purpose: {
    type: String,
    required: true,
    trim: true
  },
  date: {
    type: Date,
    required: true
  },
  timeSlot: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Timetable.timeSlots",
    required: true
  },
  classRoom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Timetable.classes",
    required: true
  },
  gradeSection: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Timetable.grades",
    required: true
  }
}, { timestamps: true });

const BlockRoom = mongoose.models.BlockRoom || mongoose.model("BlockRoom", blockRoomSchema);

export default BlockRoom;