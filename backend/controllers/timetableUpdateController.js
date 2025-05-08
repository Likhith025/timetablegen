// controllers/timetableUpdateController.js
import Timetable from "../model/Timetable_model.js";

export const updateTimetable = async (req, res) => {
  try {
    const { id } = req.params;
    const { generationResults } = req.body;

    // Validate request
    if (!id || !generationResults || !Array.isArray(generationResults)) {
      return res.status(400).json({ error: 'Invalid request: ID and generationResults are required' });
    }

    // Find the timetable by ID
    const timetable = await Timetable.findOne({ id });
    if (!timetable) {
      return res.status(404).json({ error: 'Timetable not found' });
    }

    // Update the generationResults
    timetable.generationResults = generationResults;

    // Save the updated timetable
    await timetable.save();

    // Respond with success
    res.status(200).json({ message: 'Timetable updated successfully', timetable });
  } catch (error) {
    console.error('Error updating timetable:', error);
    res.status(500).json({ error: 'Failed to update timetable' });
  }
};