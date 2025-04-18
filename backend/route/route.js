import express from "express";
import {
  generateTimetableDirectly,
  saveGenerationResults,
  getTimetablesWithResults,
  getLatestGenerationResult,
  getTimetablesByUser,
  getTimetableById,
  updateTimetable
} from "../controllers/timeTableController.js";


const AllRouter = express.Router();


AllRouter.post('/:timetableId/save-generation', saveGenerationResults);
AllRouter.get('/with-results', getTimetablesWithResults);
AllRouter.get('/:timetableId/generation', getLatestGenerationResult);
AllRouter.post('/generate-direct', generateTimetableDirectly);
AllRouter.get("/user/:userId", getTimetablesByUser);
AllRouter.get('/timetables/:id', getTimetableById);

AllRouter.patch("/timetables/:projectId", updateTimetable);


export default AllRouter;

