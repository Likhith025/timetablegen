// routes/AllRouter.js
import express from "express";
import {
    generateTimetableDirectly,
    saveGenerationResults,
    getTimetablesWithResults,
    getLatestGenerationResult,
    getTimetablesByUser,
    getTimetableById,
    processRequest,
    applyChanges,
    processChatbotMessage,
    updateTimetableu
} from "../controllers/timeTableController.js";
import { updateTimetable } from "../controllers/timetableUpdateController.js";
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
    getAllTimetables,
    addUserToTimetable,
    getTimetableUsers,
    updateTimetableUser,
    removeTimetableUser
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
AllRouter.post('/:id/users', addUserToTimetable);
AllRouter.get('/:id/users', getTimetableUsers);
AllRouter.put('/:id/users/:userId', updateTimetableUser);
AllRouter.delete('/:id/users/:userId', removeTimetableUser);

// Timetable routes
AllRouter.post("/timetable/query", async (req, res) => {
    try {
      const { message, projectId } = req.body;
      if (!message || !projectId) {
        return res.status(400).json({ error: "Message and projectId are required" });
      }
      const response = await processTimetableQuery({ message, projectId });
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
AllRouter.patch("/timetables/:id", updateTimetableu);
AllRouter.patch("/update/timetables/:id", updateTimetable); // Updated route
AllRouter.post("/processRequest", processRequest);
AllRouter.post("/applyChanges", applyChanges);
AllRouter.post("/processChatbotMessage", processChatbotMessage);



export default AllRouter;