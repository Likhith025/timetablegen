import mongoose from "mongoose";

// GRADE-SECTION REFERENCE
const gradeSectionSchema = new mongoose.Schema({
  grade: { type: String },
  section: { type: String }
});

// CLASSES SCHEMA
const classSchema = new mongoose.Schema({
  room: { type: String },
  capacity: { type: String },
  building: { type: String }
});

// FACULTY SCHEMA
const facultySchema = new mongoose.Schema({
  id: { type: String },
  name: { type: String },
  mail: { type: String }
});

// GRADE SCHEMA
const gradeSchema = new mongoose.Schema({
  grade: { type: String },
  section: { type: String },
  strength: { type: String },
  classAssignmentType: {
    type: String,
    enum: ["same", "any"],
    default: "same",
    required: true
  }
});

// SUBJECT SCHEMA
const subjectSchema = new mongoose.Schema({
  code: { type: String },
  subject: { type: String },
  facultyIds: [{ type: String }],
  gradeSections: [gradeSectionSchema],
  classesWeek: { type: String },
  isCombined: { type: Boolean, default: false },
  assignedClasses: [{ type: String }]
});

// TIME SLOT SCHEMA
const timeSlotSchema = new mongoose.Schema({
  day: { type: String },
  startTime: { type: String },
  endTime: { type: String },
  applicableTo: [{ type: String }]
});

// CLASS ASSIGNMENT SCHEMA (for storing individual class assignments in schedule)
const classAssignmentSchema = new mongoose.Schema({
  timeSlot: { type: String },
  subject: { type: String },
  faculty: { type: String },
  room: { type: String }
});

// GENERATION RESULT SCHEMA - Updated to use plain objects instead of Maps
const generationResultSchema = new mongoose.Schema({
  generatedOn: { type: Date, default: Date.now },
  generationStatus: {
    type: String,
    enum: ['success', 'partial', 'failed'],
    default: 'success'
  },
  conflicts: [{ type: String }],
  schedules: {
    type: mongoose.Schema.Types.Mixed,  // This allows us to store any structure
    default: {}
  },
  algorithm: { type: String, default: 'standard' },
  generationTimeMs: { type: Number },
  version: { type: String, default: '1.0' }
}, { _id: false });

// TIMETABLE SCHEMA
const timetableSchema = new mongoose.Schema({
  projectName: { type: String, required: true },
  multipleBuildings: { type: Boolean, default: false },
  buildings: [{ type: String }],
  classes: [classSchema],
  faculty: [facultySchema],
  grades: [gradeSchema],
  subjects: [subjectSchema],
  timeSlots: [timeSlotSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type:{type:String, required:true},
  // Adding generation results
  generationResults: [generationResultSchema],
  latestGeneration: { type: Date },
  hasGeneratedResults: { type: Boolean, default: false },
  // Auto-save related fields
  lastAutoSave: { type: Date },
  autoSaveEnabled: { type: Boolean, default: true },
  autoSaveInterval: { type: Number, default: 60000 },
  users: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      role: { type: String, enum: ["owner", "admin", "educator"], required: true },
      accepted: {type: String, enum:["Yes","No","Pending"]},
    },
  ],
}, { timestamps: true });

const Timetable = mongoose.models.Timetable || mongoose.model("Timetable", timetableSchema);

export default Timetable;