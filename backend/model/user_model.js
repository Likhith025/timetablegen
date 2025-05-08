import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: function() { return this.loginType === "Email"; } },
    userId: { type: String },
    loginType: { type: String, enum: ["Google", "Email"] },
    role: { type: String, enum: ["admin", "user"], default: "user", required: true },
    timetables: [
        {
            timetableId: { type: mongoose.Schema.Types.ObjectId, ref: "Timetable" },
            role: { type: String, enum: ["owner", "admin", "educator"], required: true }
        }
    ],
    pendingInvitations: [
        {
            timetableId: { type: mongoose.Schema.Types.ObjectId, ref: "Timetable" },
            role: { type: String, enum: ["admin", "educator"], required: true },
            invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            invitedAt: { type: Date, default: Date.now },
            token: { type: String, required: true }
        }
    ]
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;