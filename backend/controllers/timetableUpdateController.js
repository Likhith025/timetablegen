import mongoose from "mongoose";
import Timetable from "../model/Timetable_model.js";

export const updateTimetable = async (req, res) => {
  try {
    const { id } = req.params;
    const { generationResults, faculty } = req.body;

    // Log incoming request for debugging
    console.log('Received PATCH request:', {
      url: req.originalUrl,
      id,
      generationResults: generationResults ? 'Present' : 'Missing',
      faculty: faculty ? 'Present' : 'Missing',
      body: req.body,
    });

    // Validate request
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      console.error('Validation failed: Invalid ID', { id });
      return res.status(400).json({ error: 'Invalid request: Valid ID is required' });
    }

    // Find the timetable by MongoDB _id
    const timetable = await Timetable.findById(id);
    if (!timetable) {
      console.error('Timetable not found for ID:', id);
      return res.status(404).json({ error: 'Timetable not found' });
    }

    // Update generationResults if provided
    if (generationResults) {
      if (!Array.isArray(generationResults) || generationResults.length === 0) {
        console.error('Validation failed: generationResults is invalid', { generationResults });
        return res.status(400).json({ error: 'Invalid request: generationResults must be a non-empty array' });
      }

      const latestGeneration = generationResults[0];
      if (!latestGeneration || !latestGeneration.schedules || typeof latestGeneration.schedules !== 'object') {
        console.error('Validation failed: Invalid schedules structure', { latestGeneration });
        return res.status(400).json({ error: 'Invalid request: generationResults[0].schedules must be an object' });
      }

      // Validate rooms and faculty in schedules
      const validRooms = new Set(timetable.classes.map(cls => cls.room));
      const validFacultyIds = new Set(timetable.faculty.map(f => f.id));
      for (const gradeSection of Object.keys(latestGeneration.schedules)) {
        for (const day of Object.keys(latestGeneration.schedules[gradeSection])) {
          for (const slot of latestGeneration.schedules[gradeSection][day]) {
            if (slot.room && !validRooms.has(slot.room)) {
              console.error('Validation failed: Invalid room in schedule', { room: slot.room });
              return res.status(400).json({ error: `Invalid room: ${slot.room} not found in classes` });
            }
            if (slot.faculty && !validFacultyIds.has(slot.faculty)) {
              console.error('Validation failed: Invalid faculty in schedule', { faculty: slot.faculty });
              return res.status(400).json({ error: `Invalid faculty: ${slot.faculty} not found in faculty` });
            }
          }
        }
      }

      timetable.generationResults = generationResults;
    }

    // Update faculty if provided
    if (faculty) {
      if (!Array.isArray(faculty) || faculty.length === 0) {
        console.error('Validation failed: faculty is invalid', { faculty });
        return res.status(400).json({ error: 'Invalid request: faculty must be a non-empty array' });
      }

      // Validate faculty structure
      for (const fac of faculty) {
        if (!fac.id || !fac.name || (timetable.type === 'organization' && !fac.mail)) {
          console.error('Validation failed: Invalid faculty structure', { faculty: fac });
          return res.status(400).json({ error: 'Invalid faculty: id, name, and mail (for organization mode) are required' });
        }
      }

      // Update faculty array
      timetable.faculty = faculty.map(fac => ({
        id: fac.id,
        name: fac.name,
        mail: fac.mail || '',
        _id: fac._id || new mongoose.Types.ObjectId(),
      }));
    }

    // Update timestamp
    timetable.updatedAt = new Date();

    // Save the updated timetable
    await timetable.save();

    // Respond with success
    console.log('Timetable updated successfully for ID:', id);
    res.status(200).json({ message: 'Timetable updated successfully', timetable });
  } catch (error) {
    console.error('Error updating timetable:', error);
    res.status(500).json({ error: 'Failed to update timetable', details: error.message });
  }
};