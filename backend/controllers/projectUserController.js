import Timetable from "../models/Timetable_model.js";
import User from "../models/user_model.js";
import mongoose from "mongoose";
import crypto from "crypto";
import { sendTimetableInvitation } from "../utils/emailService.js"; // Hypothetical email service

export const addUserToTimetable = async (req, res) => {
  try {
    const { timetableId, userEmail, role, invitedBy } = req.body;

    // Validate input
    if (!timetableId || !userEmail || !role) {
      return res.status(400).json({ message: "timetableId, userEmail, and role are required" });
    }

    // Validate role
    const validRoles = ["owner", "admin", "educator"];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    // Check if timetable exists
    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ message: "Timetable not found" });
    }

    // Check if user exists
    const user = await User.findOne({ email: userEmail });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user is already associated with the timetable
    const isAlreadyAssociated = user.timetables.some(
      (t) => t.timetableId.toString() === timetableId
    );
    if (isAlreadyAssociated) {
      return res.status(400).json({ message: "User is already associated with this timetable" });
    }

    // Handle invitation for admin or educator roles
    if (["admin", "educator"].includes(role)) {
      const token = crypto.randomBytes(32).toString("hex");
      user.pendingInvitations.push({
        timetableId: new mongoose.Types.ObjectId(timetableId),
        role,
        invitedBy: new mongoose.Types.ObjectId(invitedBy),
        token,
      });
      await user.save();

      // Send invitation email
      const invitationLink = `https://yourapp.com/invitation?timetableId=${timetableId}&token=${token}`;
      await sendTimetableInvitation(userEmail, timetable.projectName, role, invitationLink);

      return res.status(200).json({
        message: "Invitation sent to user",
        user: { id: user._id, email: user.email, role, timetableId },
      });
    } else {
      // For "owner" role, add directly to both models
      user.timetables.push({
        timetableId: new mongoose.Types.ObjectId(timetableId),
        role,
      });
      timetable.users.push({
        userId: user._id,
        role,
      });

      // Save both documents
      await Promise.all([user.save(), timetable.save()]);

      return res.status(200).json({
        message: "User added to timetable successfully",
        user: { id: user._id, email: user.email, role, timetableId },
      });
    }
  } catch (error) {
    console.error("Error adding user to timetable:", error);
    return res.status(500).json({ message: "Server error" });
  }
};