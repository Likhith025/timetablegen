import User from "../model/user_model.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import otpGenerator from "otp-generator";
import { v4 as uuidv4 } from "uuid";
import Timetable from "../model/Timetable_model.js";
import jwt from "jsonwebtoken"

dotenv.config();

const otpStore = {};
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send OTP for registration
const sendOTP = async (email) => {
  const otp = otpGenerator.generate(6, { digits: true, lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });
  otpStore[email] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Your OTP for Registration",
    text: `Your OTP is ${otp}. It is valid for 5 minutes.`,
  };

  await transporter.sendMail(mailOptions);
};

// Send invitation email for timetable
export const sendTimetableInvitation = async (email, timetableId, role, invitedBy) => {
  if (!email || email.toLowerCase() === "na" || email.trim() === "") {
    return { success: false, message: "No valid email provided for invitation" };
  }

  const token = uuidv4();
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const invitationLink = `${frontendUrl}/invitation/${timetableId}/${token}`;

  const user = await User.findById(invitedBy);
  const timetable = await Timetable.findById(timetableId);

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `Invitation to Join Timetable: ${timetable.projectName}`,
    html: `
      <p>Dear User,</p>
      <p>You have been invited by ${user.name} to join the timetable "${timetable.projectName}" as an ${role}.</p>
      <p>Please click the link below to accept or decline the invitation:</p>
      <a href="${invitationLink}">Accept/Decline Invitation</a>
      <p>This invitation is valid for 24 hours.</p>
    `,
  };

  await User.updateOne(
    { email },
    {
      $push: {
        pendingInvitations: {
          timetableId,
          role,
          invitedBy,
          token,
          invitedAt: new Date(),
        },
      },
    },
    { upsert: true }
  );

  try {
    await transporter.sendMail(mailOptions);
    console.log("Invitation email sent to:", email, "with link:", invitationLink);
    return { success: true, message: "Invitation sent to user" };
  } catch (error) {
    console.error("Error sending invitation email:", error);
    return { success: false, message: "Failed to send invitation email" };
  }
};

// Handle invitation response
export const handleInvitationResponse = async (req, res) => {
  try {
    const { timetableId, token, response } = req.body;
    const user = await User.findOne({
      "pendingInvitations.token": token,
      "pendingInvitations.timetableId": timetableId,
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired invitation" });
    }

    const invitation = user.pendingInvitations.find(
      (inv) => inv.token === token && inv.timetableId.toString() === timetableId
    );

    if (!invitation || invitation.invitedAt < new Date(Date.now() - 24 * 60 * 60 * 1000)) {
      return res.status(400).json({ message: "Invitation expired" });
    }

    if (response === "agree") {
      await User.findByIdAndUpdate(user._id, {
        $push: {
          timetables: { timetableId, role: invitation.role },
        },
        $pull: {
          pendingInvitations: { token, timetableId },
        },
      });
      return res.status(200).json({ message: "Invitation accepted successfully" });
    } else {
      await User.findByIdAndUpdate(user._id, {
        $pull: {
          pendingInvitations: { token, timetableId },
        },
      });
      return res.status(200).json({ message: "Invitation declined" });
    }
  } catch (error) {
    res.status(500).json({ message: "Error processing invitation", error: error.message });
  }
};

// Send OTP for registration
export const sendEmailOTP = async (req, res) => {
  try {
    const { email } = req.body;
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "Email already exists" });
    }
    await sendOTP(email);
    res.status(200).json({ message: "OTP sent to email" });
  } catch (error) {
    res.status(500).json({ message: "Error sending OTP", error: error.message });
  }
};

// Register user with OTP
export const addEmailUser = async (req, res) => {
  try {
    const { email, name, password, role, otp } = req.body;
    if (!otpStore[email] || otpStore[email].otp !== otp || otpStore[email].expiresAt < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || "user",
      loginType: "Email",
    });

    await user.save();
    delete otpStore[email];

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Unable to register user", error: error.message });
  }
};

// Get all users
export const getallUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .populate({
        path: 'timetables.timetableId',
        model: 'Timetable',
        select: 'projectName'
      });
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: "Error in getting users", error: error.message });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate({
        path: 'timetables.timetableId',
        model: 'Timetable',
        select: 'projectName'
      });
    if (!user) {
      return res.status(404).json({ message: "No user found" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Error in getting user", error: error.message });
  }
};

// Edit user
export const editUser = async (req, res) => {
  try {
    const { name, email, role, loginType } = req.body;
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name, email, role, loginType },
      { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: "Error in editing user", error: error.message });
  }
};

// Send OTP for password reset
export const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = otpGenerator.generate(6, { digits: true, lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });
    otpStore[email] = otp;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is: ${otp}`,
    });

    res.status(200).json({ message: "OTP sent to email" });
  } catch (error) {
    res.status(500).json({ message: "Error sending OTP", error: error.message });
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!otpStore[email] || otpStore[email] !== otp) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const user = await User.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    delete otpStore[email];
    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error resetting password", error: error.message });
  }
};

// Verify OTP
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!otpStore[email] || otpStore[email] !== otp) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error verifying OTP", error: error.message });
  }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find the user in the database
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ message: "Invalid Email" });
        }

        // Check password (ensure user.password exists)
        const isMatch = await bcrypt.compare(password, user.password || "");

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid Password" });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Send response
        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error("Login Error:", error.message);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};
// Manage timetable users


export const getAllTimetables = async (req, res) => {
  try {
    const timetables = await Timetable.find({}).select('_id projectName createdBy users').lean();

    res.status(200).json({
      success: true,
      data: timetables,
    });
  } catch (error) {
    console.error('Error fetching timetables:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

export const addUserToTimetable = async (req, res) => {
  try {
    const { email, role } = req.body;
    const timetableId = req.params.id;

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ message: 'Timetable not found' });
    }

    // Validate role
    const validRoles = ['owner', 'admin', 'faculty', 'educator'];
    if (!validRoles.includes(role.toLowerCase())) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    let userId;
    let userEmail = email;

    // For owner/admin/educator, find user by email in User model
    if (['owner', 'admin', 'educator'].includes(role.toLowerCase())) {
      const user = await User.findOne({ email }).lean();
      if (!user) {
        return res.status(400).json({ message: 'User not found' });
      }
      userId = user._id;
      // Check if user already exists in timetable
      if (timetable.users.some(u => u.userId.toString() === userId.toString())) {
        return res.status(400).json({ message: 'User already exists in timetable' });
      }
    } else {
      // For faculty, find faculty member by email in faculty array
      const faculty = timetable.faculty.find(f => f.mail === email);
      if (!faculty) {
        return res.status(400).json({ message: 'Faculty member not found in timetable' });
      }
      userId = faculty.id;
      // Check if faculty member already exists in timetable
      if (timetable.users.some(u => u.userId === userId)) {
        return res.status(400).json({ message: 'Faculty member already exists in timetable' });
      }
    }

    // Add user to timetable
    timetable.users.push({
      userId,
      role,
      accepted: role.toLowerCase() === 'owner' ? 'Yes' : 'Pending',
    });

    // Update user's timetables array if user exists in User model
    if (['owner', 'admin', 'educator'].includes(role.toLowerCase())) {
      await User.findByIdAndUpdate(
        userId,
        {
          $addToSet: {
            timetables: {
              timetableId: timetable._id,
              role,
              accepted: role.toLowerCase() === 'owner' ? 'Yes' : 'Pending',
            },
          },
        },
        { new: true }
      );
    }

    await timetable.save();

    // Send invitation email
    const invitationResult = await sendTimetableInvitation(
      userEmail,
      timetable._id,
      role,
      timetable.createdBy // Using createdBy as the inviter
    );
    if (!invitationResult.success) {
      console.error(`Failed to send invitation to ${userEmail}: ${invitationResult.message}`);
    } else {
      console.log(`Invitation sent to ${userEmail} for timetable ${timetable._id}`);
    }

    // Fetch user details for response
    const userDetails = await getUserDetails(timetable, { userId, role, accepted: timetable.users[timetable.users.length - 1].accepted });

    res.status(201).json({
      success: true,
      data: userDetails,
    });
  } catch (error) {
    console.error('Error adding user to timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

export const getTimetableUsers = async (req, res) => {
  try {
    const timetableId = req.params.id;
    const timetable = await Timetable.findById(timetableId).lean();

    if (!timetable) {
      return res.status(404).json({ message: 'Timetable not found' });
    }

    const userDetails = await Promise.all(timetable.users.map(user => getUserDetails(timetable, user)));

    res.status(200).json({
      success: true,
      data: userDetails,
    });
  } catch (error) {
    console.error('Error fetching timetable users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

export const updateTimetableUser = async (req, res) => {
  try {
    const { role, accepted } = req.body;
    const { id: timetableId, userId } = req.params;

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ message: 'Timetable not found' });
    }

    const user = timetable.users.find(u => u.userId.toString() === userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found in timetable' });
    }

    // Validate role if provided
    if (role) {
      const validRoles = ['owner', 'admin', 'faculty', 'educator'];
      if (!validRoles.includes(role.toLowerCase())) {
        return res.status(400).json({ message: 'Invalid role' });
      }
      // For faculty role, verify userId exists in faculty array
      if (role.toLowerCase() === 'faculty' && !timetable.faculty.some(f => f.id === userId)) {
        return res.status(400).json({ message: 'Faculty member not found in timetable' });
      }
      // For owner/admin/educator, verify user exists in User model
      if (['owner', 'admin', 'educator'].includes(role.toLowerCase())) {
        const userExists = await User.findById(userId).lean();
        if (!userExists) {
          return res.status(400).json({ message: 'User not found' });
        }
      }
      user.role = role;

      // Update user's timetables array if user exists in User model
      if (['owner', 'admin', 'educator'].includes(role.toLowerCase())) {
        await User.findByIdAndUpdate(
          userId,
          {
            $set: {
              'timetables.$[elem].role': role,
            },
          },
          {
            arrayFilters: [{ 'elem.timetableId': timetable._id }],
            new: true,
          }
        );
      }
    }

    // Update accepted status if provided
    if (accepted) {
      const validStatuses = ['Yes', 'Pending', 'No'];
      if (!validStatuses.includes(accepted)) {
        return res.status(400).json({ message: 'Invalid accepted status' });
      }
      user.accepted = accepted;

      // Update user's timetables array if user exists in User model
      if (['owner', 'admin', 'educator'].includes(user.role.toLowerCase())) {
        await User.findByIdAndUpdate(
          userId,
          {
            $set: {
              'timetables.$[elem].accepted': accepted,
            },
          },
          {
            arrayFilters: [{ 'elem.timetableId': timetable._id }],
            new: true,
          }
        );
      }
    }

    await timetable.save();

    const userDetails = await getUserDetails(timetable, user);

    res.status(200).json({
      success: true,
      data: userDetails,
    });
  } catch (error) {
    console.error('Error updating timetable user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

export const removeTimetableUser = async (req, res) => {
  try {
    const { id: timetableId, userId } = req.params;

    const timetable = await Timetable.findById(timetableId);
    if (!timetable) {
      return res.status(404).json({ message: 'Timetable not found' });
    }

    const userToRemove = timetable.users.find(u => u.userId.toString() === userId);
    if (!userToRemove) {
      return res.status(404).json({ message: 'User not found in timetable' });
    }

    // Prevent removing the last owner
    if (userToRemove.role.toLowerCase() === 'owner') {
      const owners = timetable.users.filter(u => u.role.toLowerCase() === 'owner');
      if (owners.length <= 1) {
        return res.status(400).json({ message: 'Cannot remove the last owner' });
      }
    }

    // Remove user from timetable
    timetable.users = timetable.users.filter(u => u.userId.toString() !== userId);

    // Remove timetable from user's timetables array if user exists in User model
    if (['owner', 'admin', 'educator'].includes(userToRemove.role.toLowerCase())) {
      await User.findByIdAndUpdate(
        userId,
        {
          $pull: {
            timetables: { timetableId: timetable._id },
          },
        },
        { new: true }
      );
    }

    await timetable.save();

    res.status(200).json({
      success: true,
      message: 'User removed successfully',
    });
  } catch (error) {
    console.error('Error removing user from timetable:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Helper function to get user details
const getUserDetails = async (timetable, user) => {
  if (['owner', 'admin', 'educator'].includes(user.role.toLowerCase())) {
    const userData = await User.findById(user.userId).select('name email').lean();
    return {
      userId: user.userId,
      role: user.role,
      accepted: user.accepted,
      name: userData?.name || 'Unknown',
      email: userData?.email || 'Unknown',
    };
  } else {
    const faculty = timetable.faculty.find(f => f.id === user.userId);
    return {
      userId: user.userId,
      role: user.role,
      accepted: user.accepted,
      name: faculty?.name || 'Unknown',
      email: faculty?.mail || 'Unknown',
    };
  }
};