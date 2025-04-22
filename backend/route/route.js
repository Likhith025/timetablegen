import express from "express";
import {
    generateTimetableDirectly,
    saveGenerationResults,
    getTimetablesWithResults,
    getLatestGenerationResult,
    getTimetablesByUser,
    getTimetableById,
    updateTimetable,
    processRequest,
    applyChanges,
    processChatbotMessage,
} from "../controllers/timeTableController.js";
import { processTimetableQuery } from "../controllers/chatBotController.js";
import {
    sendEmailOTP,
    addEmailUser,
    getallUsers,
    getUserById,
    editUser,
    sendOtp,
    resetPassword,
    verifyOtp,
    login,
    handleInvitationResponse,
    manageTimetableUsers,
} from "../controllers/userController.js";

const AllRouter = express.Router();

// User routes
AllRouter.post("/user/otp", sendEmailOTP);
AllRouter.post("/user/register", addEmailUser);
AllRouter.get("/users", getallUsers);
AllRouter.get("/user/:id", getUserById);
AllRouter.patch("/user/:id", editUser);
AllRouter.post("/user/reset-otp", sendOtp);
AllRouter.post("/user/reset-password", resetPassword);
AllRouter.post("/user/verify-otp", verifyOtp);
AllRouter.post("/user/login", login);

// Timetable invitation routes
AllRouter.post("/timetable/invitation", handleInvitationResponse);

// Timetable user management
AllRouter.post("/timetable/:timetableId/users", manageTimetableUsers);
AllRouter.post("/timetable/users", manageTimetableUsers); // New route for timetableId in body

// Timetable routes
AllRouter.post("/timetable/query", async (req, res) => {
    try {
      const { message, projectId } = req.body;
  
      // Validate request body
      if (!message || !projectId) {
        return res.status(400).json({ error: "Message and projectId are required" });
      }
  
      // Call the controller
      const response = await processTimetableQuery({ message, projectId });
  
      // Send the response
      res.status(200).json({ response });
    } catch (error) {
      console.error("Route error:", error.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
AllRouter.post("/:timetableId/save-generation", saveGenerationResults);
AllRouter.get("/with-results", getTimetablesWithResults);
AllRouter.get("/:timetableId/generation", getLatestGenerationResult);
AllRouter.post("/generate-direct", generateTimetableDirectly);
AllRouter.get("/user/:userId", getTimetablesByUser);
AllRouter.get("/timetables/:id", getTimetableById);
AllRouter.patch("/timetables/:projectId", updateTimetable);
AllRouter.post("/processRequest", processRequest);
AllRouter.post("/applyChanges", applyChanges);
AllRouter.post("/processChatbotMessage", processChatbotMessage);

AllRouter.get("/:projectId", async (req, res) => {
    try {
        const { projectId } = req.params;
        const { userId } = req.query;
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required",
            });
        }
        const timetable = await Timetable.findById(projectId);
        if (!timetable) {
            return res.status(404).json({
                success: false,
                message: "Timetable not found",
            });
        }
        const user = await User.findById(userId);
        if (
            !user.timetables.some((t) => t.timetableId.toString() === projectId) &&
            timetable.createdBy._id.toString() !== userId
        ) {
            return res.status(403).json({
                message: "You don't have permission to access this timetable.",
            });
        }
        return res.status(200).json({
            success: true,
            timetable,
        });
    } catch (error) {
        console.error("Error fetching timetable:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch timetable",
            error: error.message,
        });
    }
});

export default AllRouter;