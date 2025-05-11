import mongoose from "mongoose";
import Timetable from "../model/Timetable_model.js";

// Helper function to safely parse JSON
const safeJsonParse = (jsonString) => {
  if (!jsonString) return null;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    try {
      let cleaned = jsonString.replace(/```json[\s\n]*/g, "")
                             .replace(/```[\s\n]*/g, "")
                             .replace(/[\s\n]*```$/g, "");
      if (cleaned.includes('{') && cleaned.includes('}')) {
        const match = cleaned.match(/(\{[\s\S]*\})/);
        if (match) cleaned = match[0];
      }
      return JSON.parse(cleaned);
    } catch (e2) {
      console.error("JSON parsing failed:", e2, "Input:", jsonString);
      return null;
    }
  }
};

// Helper function to check if a time slot is free for a teacher, grade, and room
const isSlotFree = (timetableObj, teacherSubjects, gradeSection, day, newTimeSlot, subject) => {
  const schedules = timetableObj.generationResults?.[timetableObj.generationResults.length - 1]?.schedules;
  if (!schedules) return false;

  // Check if the new time slot is free for the grade section
  const gradeSchedule = schedules[gradeSection]?.[day];
  if (gradeSchedule) {
    const conflictingSlot = gradeSchedule.find(slot => slot.timeSlot === newTimeSlot);
    if (conflictingSlot && conflictingSlot.subject && conflictingSlot.subject.toLowerCase() !== 'free period') {
      return false; // Slot is occupied by a non-free period
    }
  }

  // Check if the teacher is free (assuming teacher is linked to subjects)
  for (const grade in schedules) {
    const daySchedule = schedules[grade]?.[day];
    if (daySchedule) {
      const conflictingSlot = daySchedule.find(slot => 
        slot.timeSlot === newTimeSlot && 
        teacherSubjects.includes(slot.subject) &&
        slot.subject.toLowerCase() !== 'free period'
      );
      if (conflictingSlot) {
        return false; // Teacher is already teaching in this slot
      }
    }
  }

  return true; // Slot is free
};

export const processTimetableQuery = async (request) => {
  const { message, projectId } = request;

  try {
    // 1. Get the timetable data
    const timetableData = await Timetable.findById(projectId);
    if (!timetableData) {
      return "No timetable data found for the given project.";
    }

    // Convert to plain object
    const timetableObj = timetableData.toObject();

    // Hard-coded teacher subjects for Hindi Pandit (in a real system, fetch from DB)
    const teacherSubjects = ['H-001', 'H-002', 'H-003', 'H-004', 'H-005'];

    // 2. Send to AI for analysis
    const prompt = `
You are a school timetable assistant. You will be given a user's message and the timetable data. Respond in a natural, concise, and narrative-style text format, avoiding markdown, bullet points, or structured formatting. Do not include Free Periods or empty slots in the response unless explicitly requested. Focus only on the teacher's actual teaching slots, including the day, time, subject, grade section, and room.

If the user requests changes or modifications to the timetable, first provide a natural response explaining the proposed changes or why they cannot be made. Then, include a JSON structure with the exact changes needed at the end of the response.

IMPORTANT:
- Do not modify or move Free Period or empty slots. Free Periods are empty slots where teachers and students are free.
- Verify the teacher's subjects before proposing changes. For Hindi Pandit, the subject codes are: ${teacherSubjects.join(', ')}. Do not propose changes for subjects not taught by the teacher (e.g., T-004, M-005).
- Ensure proposed new time slots are free for the teacher, grade section, and room. Check the timetable data to avoid scheduling conflicts.
- If a conflict is detected, suggest an alternative free slot or reject the change.

User message: "${message}"
Timetable Data: ${JSON.stringify(timetableObj)}

For queries about a teacher's schedule, respond like this example:
"Sarah Johnson's teaching schedule for the week is as follows: For Grade 9-A, she teaches English on Wednesday from 09:30 to 10:30 in Room 101. For Grade 9-B, she teaches English on Monday from 08:30 to 09:30 in Room 102. She has no classes scheduled for Grades 10-A and 10-B this week."

For changes, respond naturally first, then add a JSON structure like:
{
  "needsChanges": true,
  "changes": [
    {
      "gradeSection": "affected grade-section",
      "day": "affected day",
      "subject": "affected subject",
      "currentTimeSlot": "current time slot",
      "newTimeSlot": "new time slot",
      "index": index of the slot in the day's schedule
    }
  ]
}

If no changes are needed, do not include any JSON in the response.`;

    // Send to Mistral API
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        temperature: 0.2,
        top_p: 1,
        max_tokens: 1500,
        stream: false,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: message }
        ],
      }),
    });

    const result = await response.json();
    let aiResponse = result.choices?.[0]?.message?.content || "No response from model.";

    // 3. Extract the changes JSON (if any)
    const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```|(\{[\s\S]*?\})/);
    let changesData = null;

    if (jsonMatch) {
      const jsonString = jsonMatch[1] || jsonMatch[2];
      changesData = safeJsonParse(jsonString);
      // Clean the AI response by removing the JSON part
      aiResponse = aiResponse.replace(/```json[\s\S]*```|\{[\s\S]*?\}/, "").trim();
    }

    // 4. Validate and filter changes
    if (changesData && changesData.needsChanges && changesData.changes) {
      // Filter out Free Period changes and validate subject codes and slots
      changesData.changes = changesData.changes.filter(change => {
        const { subject, gradeSection, day, newTimeSlot } = change;

        // Skip Free Period or empty subjects
        if (!subject || subject.trim() === '' || 
            subject.toLowerCase() === 'free period' || 
            subject.toLowerCase() === 'free') {
          return false;
        }

        // Validate subject code
        if (!teacherSubjects.includes(subject)) {
          console.log(`Invalid subject ${subject} for Hindi Pandit`);
          return false;
        }

        // Check for scheduling conflicts
        if (!isSlotFree(timetableObj, teacherSubjects, gradeSection, day, newTimeSlot, subject)) {
          console.log(`Conflict detected for ${gradeSection} on ${day} at ${newTimeSlot}`);
          return false;
        }

        return true;
      });

      // If all changes were filtered out, set needsChanges to false
      if (changesData.changes.length === 0) {
        changesData.needsChanges = false;
      }

      // Return response with confirmation option if there are still changes
      if (changesData.needsChanges) {
        return {
          message: aiResponse,
          needsConfirmation: true,
          changes: changesData.changes
        };
      }
    }

    // Return the cleaned AI response (no JSON for non-change queries)
    return aiResponse;

  } catch (error) {
    console.error("Error processing timetable query:", error);
    return "Error processing the request: " + error.message;
  }
};

export const applyTimetableChanges = async (projectId, changes) => {
  try {
    const timetableData = await Timetable.findById(projectId);
    if (!timetableData) return "Timetable not found";

    const latestGenIndex = timetableData.generationResults.length - 1;
    const timetableObj = timetableData.toObject();
    const teacherSubjects = ['H-001', 'H-002', 'H-003', 'H-004', 'H-005'];

    // Validate changes before applying
    for (const change of changes) {
      const { gradeSection, day, index, newTimeSlot, subject } = change;

      // Skip Free Period
      if (subject && (subject.toLowerCase() === 'free period' || subject.toLowerCase() === 'free')) {
        console.log(`Skipping Free Period change for ${gradeSection} on ${day}`);
        continue;
      }

      // Validate subject code
      if (!teacherSubjects.includes(subject)) {
        return `Error: Invalid subject ${subject} for Hindi Pandit`;
      }

      // Check for conflicts in the new time slot
      if (!isSlotFree(timetableObj, teacherSubjects, gradeSection, day, newTimeSlot, subject)) {
        return `Error: Conflict detected for ${gradeSection} on ${day} at ${newTimeSlot}`;
      }

      // Update path
      const updatePath = `generationResults.${latestGenIndex}.schedules.${gradeSection}.${day}.${index}.timeSlot`;

      // Update in database
      await Timetable.updateOne(
        { _id: projectId },
        { $set: { [updatePath]: newTimeSlot } }
      );
    }

    return "Changes applied successfully";
  } catch (error) {
    console.error("Error applying changes:", error);
    return "Error applying changes: " + error.message;
  }
};