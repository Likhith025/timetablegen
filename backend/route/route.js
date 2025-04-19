import express from "express";
import {
  generateTimetableDirectly,
  saveGenerationResults,
  getTimetablesWithResults,
  getLatestGenerationResult,
  getTimetablesByUser,
  getTimetableById,
  updateTimetable,
  processRequest, applyChanges, processChatbotMessage
} from "../controllers/timeTableController.js";


const AllRouter = express.Router();


AllRouter.post('/:timetableId/save-generation', saveGenerationResults);
AllRouter.get('/with-results', getTimetablesWithResults);
AllRouter.get('/:timetableId/generation', getLatestGenerationResult);
AllRouter.post('/generate-direct', generateTimetableDirectly);
AllRouter.get("/user/:userId", getTimetablesByUser);
AllRouter.get('/timetables/:id', getTimetableById);

AllRouter.patch("/timetables/:projectId", updateTimetable);

AllRouter.post('/processRequest', processRequest);

// Apply approved changes
AllRouter.post('/applyChanges', applyChanges);

// Process chatbot messages (handles both request processing and change application)
AllRouter.post('/processChatbotMessage', processChatbotMessage);

// Get timetable by ID
AllRouter.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const timetable = await Timetable.findById(projectId);
    
    if (!timetable) {
      return res.status(404).json({
        success: false,
        message: "Timetable not found"
      });
    }
    
    return res.status(200).json({
      success: true,
      timetable
    });
  } catch (error) {
    console.error("Error fetching timetable:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch timetable",
      error: error.message
    });
  }
});


export default AllRouter;

