import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import API_BASE_URL from "../../src"; // Adjust the import path as needed
import "./ParametersView.css";

const ParametersView = ({ projectId }) => {
  const [parameters, setParameters] = useState(null);
  const [editedParameters, setEditedParameters] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userInfo, setUserInfo] = useState({ userId: "", userName: "", userEmail: "" });
  const [isEditing, setIsEditing] = useState(false);
  const [applyToAllGrades, setApplyToAllGrades] = useState(false);
  const [facultyMode, setFacultyMode] = useState("organization"); // 'organization' or 'personal'
  const navigate = useNavigate();

  // Fetch user info from localStorage or token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserInfo({
          userId: decoded.id || "",
          userName: decoded.name || "",
          userEmail: decoded.email || "",
        });
      } catch (error) {
        console.error("Error decoding token:", error);
      }
    }

    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserInfo((prev) => ({
          ...prev,
          userId: user._id || prev.userId,
          userName: user.name || prev.userName,
          userEmail: user.email || prev.userEmail,
        }));
      } catch (error) {
        console.error("Error parsing user from localStorage:", error);
      }
    }
  }, []);

  // Fetch timetable data
  useEffect(() => {
    const fetchParameters = async () => {
      if (!projectId || projectId === "undefined" || projectId.length !== 24) {
        console.error("Invalid projectId:", projectId);
        setError("Invalid timetable ID. Please select a valid timetable.");
        setLoading(false);
        navigate("/add-project");
        return;
      }

      try {
        console.log("Fetching timetable with ID:", projectId);
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/all/timetables/${projectId}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || "Failed to fetch timetable");
        }

        const data = await response.json();
        console.log("Fetched timetable:", data);

        // Normalize timeSlots to ensure compatibility with days/day
        const normalizedData = {
          ...data,
          classes: Array.isArray(data.classes) ? data.classes : [],
          faculty: Array.isArray(data.faculty) ? data.faculty : [],
          grades: Array.isArray(data.grades) ? data.grades : [],
          subjects: Array.isArray(data.subjects) ? data.subjects : [],
          timeSlots: Array.isArray(data.timeSlots)
            ? data.timeSlots.map((slot) => ({
                ...slot,
                day: slot.day || (Array.isArray(slot.days) && slot.days.length > 0 ? slot.days[0] : ""),
                days: Array.isArray(slot.days) ? slot.days : slot.day ? [slot.day] : [],
              }))
            : [],
          buildings: Array.isArray(data.buildings) ? data.buildings : [],
          multipleBuildings: data.multipleBuildings || false,
          projectName: data.projectName || "",
          type: data.type || "organization",
        };

        setParameters(normalizedData);
        setEditedParameters(JSON.parse(JSON.stringify(normalizedData))); // Deep copy
        setFacultyMode(normalizedData.type);
      } catch (err) {
        console.error("Error fetching timetable:", err);
        setError(err.message || "Failed to load timetable.");
      } finally {
        setLoading(false);
      }
    };

    fetchParameters();
  }, [projectId, navigate]);

  // Helper function to check if two time ranges overlap
  const doTimesOverlap = (start1, end1, start2, end2) => {
    const startTime1 = new Date(`1970-01-01T${start1}:00Z`).getTime();
    const endTime1 = new Date(`1970-01-01T${end1}:00Z`).getTime();
    const startTime2 = new Date(`1970-01-01T${start2}:00Z`).getTime();
    const endTime2 = new Date(`1970-01-01T${end2}:00Z`).getTime();
    // Assume endTime is exclusive
    return startTime1 < endTime2 && startTime2 < endTime1;
  };

  // Get available grade-sections for a time slot group, excluding collisions
  const getAvailableGradeSections = (groupIndex, timeSlots, grades) => {
    const group = groupedTimeSlots[groupIndex];
    if (!group || !group.days.length) return grades.map((g) => `${g.grade} - ${g.section}`);

    const allGradeSections = grades.map((g) => `${g.grade} - ${g.section}`);
    const collidingGradeSections = new Set();

    // Check for collisions with other time slots
    timeSlots.forEach((slot, index) => {
      // Skip slots in the current group
      if (group.indices.includes(index)) return;

      // Check if days overlap
      const commonDays = slot.days.filter((day) => group.days.includes(day));
      if (commonDays.length === 0) return;

      // Check if times overlap
      if (doTimesOverlap(group.startTime, group.endTime, slot.startTime, slot.endTime)) {
        slot.applicableTo.forEach((gs) => collidingGradeSections.add(gs));
      }
    });

    // Return only non-colliding grade-sections
    return allGradeSections.filter((gs) => !collidingGradeSections.has(gs));
  };

  // Group time slots for edit mode display
  const getGroupedTimeSlots = (timeSlots) => {
    const grouped = [];
    const seen = new Set();

    // Process timeSlots in order
    timeSlots.forEach((slot, index) => {
      // Skip invalid slots
      if (!slot.startTime || !slot.endTime || !slot.applicableTo || slot.days.length === 0) {
        return;
      }

      // Normalize applicableTo for consistent key, sorting to ensure stability
      const applicableToKey = Array.isArray(slot.applicableTo)
        ? slot.applicableTo.sort().join(",")
        : "";
      const key = `${slot.startTime}-${slot.endTime}-${applicableToKey}`;

      if (!seen.has(key)) {
        seen.add(key);
        // Find all slots with matching startTime, endTime, and applicableTo
        const matchingSlots = timeSlots
          .map((s, i) => ({
            ...s,
            index: i,
          }))
          .filter(
            (s) =>
              s.startTime === slot.startTime &&
              s.endTime === slot.endTime &&
              Array.isArray(s.applicableTo) &&
              s.applicableTo.sort().join(",") === applicableToKey
          );
        grouped.push({
          days: [...new Set(matchingSlots.flatMap((s) => s.days))].sort(),
          startTime: slot.startTime,
          endTime: slot.endTime,
          applicableTo: slot.applicableTo,
          indices: matchingSlots.map((s) => s.index).sort((a, b) => a - b), // Sort indices for consistency
          groupId: key + `-${index}`, // Unique stable ID
        });
      }
    });

    // Return groups in the order they were processed
    return grouped;
  };

  // Memoize grouped time slots
  const groupedTimeSlots = useMemo(() => getGroupedTimeSlots(editedParameters?.timeSlots || []), [editedParameters]);

  // Memoize available grade-sections for each group
  const availableGradeSections = useMemo(() => {
    return groupedTimeSlots.map((_, index) =>
      getAvailableGradeSections(index, editedParameters?.timeSlots || [], editedParameters?.grades || [])
    );
  }, [groupedTimeSlots, editedParameters?.timeSlots, editedParameters?.grades]);

  // Handle input changes for time slots
  const handleTimeSlotChange = (groupIndex, field, value) => {
    setEditedParameters((prev) => {
      const updated = { ...prev };
      const group = groupedTimeSlots[groupIndex];
      if (!group) return updated;

      // Update all slots in the group
      group.indices.forEach((index) => {
        if (field === "days") {
          updated.timeSlots[index].days = Array.isArray(value) ? value : [value];
          updated.timeSlots[index].day = updated.timeSlots[index].days[0] || "";
        } else {
          updated.timeSlots[index][field] = value;
        }
      });
      return updated;
    });
  };

  // Handle input changes for other sections
  const handleInputChange = (section, index, field, value) => {
    setEditedParameters((prev) => {
      const updated = { ...prev };
      if (section === "projectName") {
        updated.projectName = value;
      } else if (section === "timeSlots") {
        handleTimeSlotChange(index, field, value);
      } else {
        updated[section][index][field] = value;
      }
      return updated;
    });
  };

  // Handle multi-select changes
  const handleMultiSelectChange = (section, index, field, selectedOptions) => {
    const values = Array.from(selectedOptions, (option) => option.value);
    setEditedParameters((prev) => {
      const updated = { ...prev };
      if (section === "timeSlots" && field === "days") {
        const group = groupedTimeSlots[index];
        if (!group) return updated;

        // Remove existing slots for this group
        updated.timeSlots = updated.timeSlots.filter((_, i) => !group.indices.includes(i));

        // Create new slots for each selected day
        if (values.length > 0) {
          values.forEach((day) => {
            updated.timeSlots.push({
              day,
              days: [day],
              startTime: group.startTime,
              endTime: group.endTime,
              applicableTo: group.applicableTo,
            });
          });
        }
      } else if (section === "timeSlots" && field === "applicableTo") {
        const group = groupedTimeSlots[index];
        group.indices.forEach((slotIndex) => {
          updated.timeSlots[slotIndex][field] = values;
        });
      } else if (field === "gradeSections") {
        updated[section][index][field] = values.map((value) => {
          const [grade, section] = value.split(" - ");
          return { grade, section };
        });
      } else {
        updated[section][index][field] = values;
      }
      return updated;
    });
  };

  // Handle multipleBuildings toggle
  const handleMultipleBuildingsChange = (e) => {
    setEditedParameters((prev) => ({
      ...prev,
      multipleBuildings: e.target.checked,
      classes: e.target.checked ? prev.classes : prev.classes.map((cls) => ({ ...cls, building: "" })),
    }));
  };

  // Handle applyToAllGrades toggle
  const handleApplyToAllGradesChange = (e) => {
    const isChecked = e.target.checked;
    setApplyToAllGrades(isChecked);
    if (isChecked && editedParameters.grades.length > 0) {
      const firstGrade = editedParameters.grades[0];
      setEditedParameters((prev) => ({
        ...prev,
        grades: prev.grades.map((grade) => ({
          ...grade,
          classAssignmentType: firstGrade.classAssignmentType,
        })),
      }));
    }
  };

  // Handle facultyMode change
  const handleFacultyModeChange = (mode) => {
    setFacultyMode(mode);
    setEditedParameters((prev) => ({
      ...prev,
      type: mode,
      faculty: mode === "personal" ? prev.faculty.map((f) => ({ ...f, mail: "" })) : prev.faculty,
    }));
  };

  // Add new row
  const addNewRow = (section) => {
    setEditedParameters((prev) => {
      const updated = { ...prev };
      const lastRow = section === "timeSlots" ? updated.timeSlots[updated.timeSlots.length - 1] : updated[section][updated[section].length - 1];
      let isPreviousFilled = true;

      if (section === "classes") {
        isPreviousFilled =
          !lastRow ||
          (lastRow.room.trim() !== "" &&
            lastRow.capacity.trim() !== "" &&
            (!prev.multipleBuildings || lastRow.building.trim() !== ""));
      } else if (section === "faculty") {
        isPreviousFilled =
          !lastRow ||
          (lastRow.id.trim() !== "" &&
            lastRow.name.trim() !== "" &&
            (facultyMode === "personal" || lastRow.mail.trim() !== ""));
      } else if (section === "grades") {
        isPreviousFilled =
          !lastRow ||
          (lastRow.grade.trim() !== "" &&
            lastRow.section.trim() !== "" &&
            lastRow.strength.trim() !== "");
      } else if (section === "subjects") {
        isPreviousFilled =
          !lastRow ||
          (lastRow.code.trim() !== "" &&
            lastRow.subject.trim() !== "" &&
            lastRow.facultyIds.length > 0 &&
            lastRow.gradeSections.length > 0 &&
            lastRow.classesWeek.trim() !== "");
      } else if (section === "timeSlots") {
        isPreviousFilled =
          !lastRow ||
          (lastRow.days.length > 0 &&
            lastRow.startTime.trim() !== "" &&
            lastRow.endTime.trim() !== "" &&
            lastRow.applicableTo.length > 0);
      }

      if (isPreviousFilled) {
        if (section === "timeSlots") {
          updated.timeSlots.push({
            day: "Monday",
            days: ["Monday"],
            startTime: "09:00",
            endTime: "10:00",
            applicableTo: [],
          });
        } else {
          updated[section].push(
            section === "classes"
              ? { room: "", capacity: "", building: "" }
              : section === "faculty"
              ? { id: "", name: "", mail: "" }
              : section === "grades"
              ? {
                  grade: "",
                  section: "",
                  strength: "",
                  classAssignmentType: applyToAllGrades && updated.grades.length > 0
                    ? updated.grades[0].classAssignmentType
                    : "same",
                }
              : {
                  code: "",
                  subject: "",
                  facultyIds: [],
                  gradeSections: [],
                  classesWeek: "",
                  isCombined: false,
                  assignedClasses: [],
                }
          );
        }
      }
      return updated;
    });
  };

  // Delete row
  const deleteRow = (section, index) => {
    if (section === "timeSlots" && !window.confirm("Are you sure you want to delete this time slot group?")) {
      return;
    }
    setEditedParameters((prev) => {
      const updated = { ...prev };
      if (section === "timeSlots") {
        const group = groupedTimeSlots[index];
        if (group) {
          updated.timeSlots = updated.timeSlots.filter((_, i) => !group.indices.includes(i));
        }
      } else {
        updated[section].splice(index, 1);
      }
      return updated;
    });
  };

  // Validate form data
  const isFormValid = () => {
    if (!editedParameters.projectName.trim()) return false;
    if (
      !Array.isArray(editedParameters.classes) ||
      !editedParameters.classes.every(
        (row) =>
          row.room.trim() &&
          row.capacity.trim() &&
          (!editedParameters.multipleBuildings || row.building.trim())
      )
    )
      return false;
    if (
      !Array.isArray(editedParameters.faculty) ||
      !editedParameters.faculty.every(
        (row) =>
          row.id.trim() &&
          row.name.trim() &&
          (facultyMode === "personal" || row.mail.trim())
      )
    )
      return false;
    if (
      !Array.isArray(editedParameters.grades) ||
      !editedParameters.grades.every(
        (row) => row.grade.trim() && row.section.trim() && row.strength.trim()
      )
    )
      return false;
    if (
      !Array.isArray(editedParameters.subjects) ||
      !editedParameters.subjects.every(
        (row) =>
          row.code.trim() &&
          row.subject.trim() &&
          row.facultyIds.length > 0 &&
          row.gradeSections.length > 0 &&
          row.classesWeek.trim()
      )
    )
      return false;
    if (
      !Array.isArray(editedParameters.timeSlots) ||
      !editedParameters.timeSlots.every(
        (row) =>
          row.days.length > 0 &&
          row.startTime.trim() &&
          row.endTime.trim() &&
          row.applicableTo.length > 0
      )
    )
      return false;
    return true;
  };

  // Save changes
  const saveChanges = async () => {
    if (!isFormValid()) {
      alert("Please fill all required fields before saving.");
      return;
    }

    // Filter out colliding time slots
    const validTimeSlots = [];
    const seenGradeSections = new Set();

    editedParameters.timeSlots
      .filter((slot) => slot.days.length > 0 && slot.startTime && slot.endTime && slot.applicableTo.length > 0)
      .forEach((slot) => {
        slot.days.forEach((day) => {
          const slotKey = `${day}-${slot.startTime}-${slot.endTime}`;
          const slotGradeSections = new Set(slot.applicableTo);

          // Check for collisions with already processed slots
          let hasCollision = false;
          for (const existing of validTimeSlots) {
            if (existing.day !== day) continue;
            if (doTimesOverlap(slot.startTime, slot.endTime, existing.startTime, existing.endTime)) {
              const existingGradeSections = new Set(existing.applicableTo);
              for (const gs of slotGradeSections) {
                if (existingGradeSections.has(gs)) {
                  hasCollision = true;
                  break;
                }
              }
            }
            if (hasCollision) break;
          }

          if (!hasCollision) {
            validTimeSlots.push({
              day,
              startTime: slot.startTime,
              endTime: slot.endTime,
              applicableTo: slot.applicableTo,
            });
          }
        });
      });

    // Transform timeSlots for backend
    const transformedParameters = {
      ...editedParameters,
      timeSlots: validTimeSlots,
      type: facultyMode,
    };

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/all/timetables/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(transformedParameters),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update timetable");
      }

      const updatedData = await response.json();
      console.log("Updated timetable:", updatedData);
      setParameters(updatedData);
      setEditedParameters(JSON.parse(JSON.stringify(updatedData)));
      setFacultyMode(updatedData.type || "organization");
      setIsEditing(false);
      alert("Timetable updated successfully!");
    } catch (err) {
      console.error("Error updating timetable:", err);
      alert(`Failed to update timetable: ${err.message || "Unknown error"}`);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditedParameters(JSON.parse(JSON.stringify(parameters)));
    setFacultyMode(parameters.type || "organization");
    setIsEditing(false);
    setApplyToAllGrades(false);
  };

  if (loading) return <div>Loading timetable...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!parameters) return <div>No timetable found.</div>;

  return (
    <div className="parameters-container">
      <h2>📋 Timetable: {parameters.projectName}</h2>

      {!isEditing ? (
        <>
          {/* View Mode */}
          <div className="section">
            <h3>Project Name</h3>
            <p>{parameters.projectName || "N/A"}</p>
          </div>
          <div className="section">
            <h3>Classes</h3>
            {Array.isArray(parameters.classes) && parameters.classes.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Room</th>
                    <th>Room Capacity</th>
                    {parameters.multipleBuildings && <th>Building Name</th>}
                  </tr>
                </thead>
                <tbody>
                  {parameters.classes.map((row, index) => (
                    <tr key={index}>
                      <td>{row.room}</td>
                      <td>{row.capacity}</td>
                      {parameters.multipleBuildings && <td>{row.building}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No classes available.</p>
            )}
          </div>
          <div className="section">
            <h3>Faculty</h3>
            {Array.isArray(parameters.faculty) && parameters.faculty.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Faculty ID</th>
                    <th>Name</th>
                    {parameters.type === "organization" && <th>Mail ID</th>}
                  </tr>
                </thead>
                <tbody>
                  {parameters.faculty.map((row, index) => (
                    <tr key={index}>
                      <td>{row.id}</td>
                      <td>{row.name}</td>
                      {parameters.type === "organization" && <td>{row.mail || "N/A"}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No faculty available.</p>
            )}
          </div>
          <div className="section">
            <h3>Grades</h3>
            {Array.isArray(parameters.grades) && parameters.grades.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Grade</th>
                    <th>Section</th>
                    <th>Strength</th>
                    <th>Class Assignment Type</th>
                  </tr>
                </thead>
                <tbody>
                  {parameters.grades.map((row, index) => (
                    <tr key={index}>
                      <td>{row.grade}</td>
                      <td>{row.section}</td>
                      <td>{row.strength}</td>
                      <td>{row.classAssignmentType === "same" ? "Same Class" : "Any Class"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No grades available.</p>
            )}
          </div>
          <div className="section">
            <h3>Subjects</h3>
            {Array.isArray(parameters.subjects) && parameters.subjects.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Subject Code</th>
                    <th>Subject</th>
                    <th>Faculty</th>
                    <th>Grade - Section</th>
                    <th>Combined?</th>
                    <th>Assigned Classes</th>
                    <th>Classes/Week</th>
                  </tr>
                </thead>
                <tbody>
                  {parameters.subjects.map((row, index) => (
                    <tr key={index}>
                      <td>{row.code}</td>
                      <td>{row.subject}</td>
                      <td>{row.facultyIds.join(", ")}</td>
                      <td>
                        {row.gradeSections
                          .map((gs) => `${gs.grade} - ${gs.section}`)
                          .join(", ")
                          .replace(/\$/g, "")}
                      </td>
                      <td>{row.isCombined ? "Yes" : "No"}</td>
                      <td>{row.assignedClasses.length > 0 ? row.assignedClasses.join(", ") : "None"}</td>
                      <td>{row.classesWeek}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No subjects available.</p>
            )}
          </div>
          <div className="section">
            <h3>Time Slots</h3>
            {Array.isArray(parameters.timeSlots) && parameters.timeSlots.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Applicable To (Grade - Section)</th>
                  </tr>
                </thead>
                <tbody>
                  {parameters.timeSlots.map((row, index) => (
                    <tr key={index}>
                      <td>{row.day || row.days.join(", ") || "N/A"}</td>
                      <td>{row.startTime}</td>
                      <td>{row.endTime}</td>
                      <td>{row.applicableTo.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No time slots available.</p>
            )}
          </div>
          <div className="section user-info">
            <h3>User Information</h3>
            <table>
              <tbody>
                <tr>
                  <td><strong>User ID:</strong></td>
                  <td>{userInfo.userId || "Not logged in"}</td>
                </tr>
                {userInfo.userName && (
                  <tr>
                    <td><strong>Name:</strong></td>
                    <td>{userInfo.userName}</td>
                  </tr>
                )}
                {userInfo.userEmail && (
                  <tr>
                    <td><strong>Email:</strong></td>
                    <td>{userInfo.userEmail}</td>
                  </tr>
                )}
                <tr>
                  <td><strong>Faculty Mode:</strong></td>
                  <td>{parameters.type === "organization" ? "Organization" : "Personal"}</td>
                </tr>
              </tbody>
            </table>
            <p className="user-info-note">This timetable is associated with your account.</p>
          </div>
        </>
      ) : (
        <>
          {/* Edit Mode */}
          <div className="section">
            <h3>Faculty Mode</h3>
            <div style={{ marginBottom: "10px" }}>
              <label style={{ marginRight: "20px" }}>
                <input
                  type="radio"
                  name="facultyMode"
                  value="organization"
                  checked={facultyMode === "organization"}
                  onChange={() => handleFacultyModeChange("organization")}
                />
                Organization Mode
              </label>
              <label>
                <input
                  type="radio"
                  name="facultyMode"
                  value="personal"
                  checked={facultyMode === "personal"}
                  onChange={() => handleFacultyModeChange("personal")}
                />
                Personal Mode
              </label>
            </div>
          </div>
          <div className="section">
            <h3>Project Name</h3>
            <input
              type="text"
              value={editedParameters.projectName}
              onChange={(e) => handleInputChange("projectName", null, null, e.target.value)}
            />
          </div>
          <div className="section">
            <h3>Classes</h3>
            <label>
              <input
                type="checkbox"
                checked={editedParameters.multipleBuildings}
                onChange={handleMultipleBuildingsChange}
              />
              Multiple Buildings
            </label>
            <table>
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Room Capacity</th>
                  {editedParameters.multipleBuildings && <th>Building Name</th>}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(editedParameters.classes) &&
                  editedParameters.classes.map((row, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          value={row.room}
                          onChange={(e) => handleInputChange("classes", index, "room", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.capacity}
                          onChange={(e) =>
                            handleInputChange("classes", index, "capacity", e.target.value)
                          }
                        />
                      </td>
                      {editedParameters.multipleBuildings && (
                        <td>
                          <input
                            type="text"
                            value={row.building}
                            onChange={(e) =>
                              handleInputChange("classes", index, "building", e.target.value)
                            }
                          />
                        </td>
                      )}
                      <td>
                        <button className="delete-btn" onClick={() => deleteRow("classes", index)}>
                          X
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <button className="add-btn" onClick={() => addNewRow("classes")}>
              Add New Room
            </button>
          </div>
          <div className="section">
            <h3>Faculty</h3>
            <table>
              <thead>
                <tr>
                  <th>Faculty ID</th>
                  <th>Name</th>
                  {facultyMode === "organization" && <th>Mail ID</th>}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(editedParameters.faculty) &&
                  editedParameters.faculty.map((row, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          value={row.id}
                          onChange={(e) => handleInputChange("faculty", index, "id", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => handleInputChange("faculty", index, "name", e.target.value)}
                        />
                      </td>
                      {facultyMode === "organization" && (
                        <td>
                          <input
                            type="text"
                            value={row.mail}
                            onChange={(e) => handleInputChange("faculty", index, "mail", e.target.value)}
                          />
                        </td>
                      )}
                      <td>
                        <button className="delete-btn" onClick={() => deleteRow("faculty", index)}>
                          X
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <button className="add-btn" onClick={() => addNewRow("faculty")}>
              Add New Faculty
            </button>
          </div>
          <div className="section">
            <h3>Grades</h3>
            <label>
              <input
                type="checkbox"
                checked={applyToAllGrades}
                onChange={handleApplyToAllGradesChange}
              />
              Apply class assignment type to all grades
            </label>
            <table>
              <thead>
                <tr>
                  <th>Grade</th>
                  <th>Section</th>
                  <th>Strength</th>
                  <th>Class Assignment Type</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(editedParameters.grades) &&
                  editedParameters.grades.map((row, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          value={row.grade}
                          onChange={(e) => handleInputChange("grades", index, "grade", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.section}
                          onChange={(e) =>
                            handleInputChange("grades", index, "section", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.strength}
                          onChange={(e) =>
                            handleInputChange("grades", index, "strength", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <select
                          value={row.classAssignmentType}
                          onChange={(e) =>
                            handleInputChange("grades", index, "classAssignmentType", e.target.value)
                          }
                          disabled={applyToAllGrades && index !== 0}
                        >
                          <option value="same">Same Class</option>
                          <option value="any">Any Class</option>
                        </select>
                      </td>
                      <td>
                        <button className="delete-btn" onClick={() => deleteRow("grades", index)}>
                          X
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <button className="add-btn" onClick={() => addNewRow("grades")}>
              Add New Grade
            </button>
          </div>
          <div className="section">
            <h3>Subjects</h3>
            <table>
              <thead>
                <tr>
                  <th>Subject Code</th>
                  <th>Subject</th>
                  <th>Faculty</th>
                  <th>Grade - Section</th>
                  <th>Combined?</th>
                  <th>Assigned Classes</th>
                  <th>Classes/Week</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {Array.isArray(editedParameters.subjects) &&
                  editedParameters.subjects.map((row, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          value={row.code}
                          onChange={(e) => handleInputChange("subjects", index, "code", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.subject}
                          onChange={(e) =>
                            handleInputChange("subjects", index, "subject", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <select
                          multiple
                          value={row.facultyIds}
                          onChange={(e) =>
                            handleMultiSelectChange("subjects", index, "facultyIds", e.target.selectedOptions)
                          }
                          className="multi-select"
                        >
                          {Array.isArray(editedParameters.faculty) &&
                            editedParameters.faculty.map((faculty, i) => (
                              <option key={i} value={faculty.id}>
                                {faculty.id} - {faculty.name}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>
                        <select
                          multiple
                          value={row.gradeSections.map((gs) => `${gs.grade} - ${gs.section}`)}
                          onChange={(e) =>
                            handleMultiSelectChange("subjects", index, "gradeSections", e.target.selectedOptions)
                          }
                          className="multi-select"
                        >
                          {Array.isArray(editedParameters.grades) &&
                            editedParameters.grades.map((grade, i) => (
                              <option key={i} value={`${grade.grade} - ${grade.section}`}>
                                {grade.grade} - ${grade.section}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          checked={row.isCombined}
                          onChange={(e) =>
                            handleInputChange("subjects", index, "isCombined", e.target.checked)
                          }
                        />
                      </td>
                      <td>
                        <select
                          multiple
                          value={row.assignedClasses}
                          onChange={(e) =>
                            handleMultiSelectChange("subjects", index, "assignedClasses", e.target.selectedOptions)
                          }
                          className="multi-select"
                        >
                          {Array.isArray(editedParameters.classes) &&
                            editedParameters.classes.map((cls, i) => (
                              <option key={i} value={cls.room}>
                                {cls.room}
                              </option>
                            ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="text"
                          value={row.classesWeek}
                          onChange={(e) =>
                            handleInputChange("subjects", index, "classesWeek", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <button className="delete-btn" onClick={() => deleteRow("subjects", index)}>
                          X
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <button className="add-btn" onClick={() => addNewRow("subjects")}>
              Add New Subject
            </button>
          </div>
          <div className="section">
            <h3>Time Slots</h3>
            <table>
              <thead>
                <tr>
                  <th>Days</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Applicable To (Grade - Section)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {groupedTimeSlots.map((group, index) => (
                  <tr key={group.groupId}>
                    <td>
                      <select
                        multiple
                        value={group.days}
                        onChange={(e) =>
                          handleMultiSelectChange("timeSlots", index, "days", e.target.selectedOptions)
                        }
                        className="multi-select"
                      >
                        {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
                          (day) => (
                            <option key={day} value={day}>
                              {day}
                            </option>
                          )
                        )}
                      </select>
                    </td>
                    <td>
                      <input
                        type="time"
                        value={group.startTime}
                        onChange={(e) =>
                          handleInputChange("timeSlots", index, "startTime", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={group.endTime}
                        onChange={(e) =>
                          handleInputChange("timeSlots", index, "endTime", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <select
                        multiple
                        value={group.applicableTo}
                        onChange={(e) =>
                          handleMultiSelectChange("timeSlots", index, "applicableTo", e.target.selectedOptions)
                        }
                        className="multi-select"
                      >
                        {(availableGradeSections[index] || []).map((gs) => (
                          <option key={gs} value={gs}>
                            {gs}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button className="delete-btn" onClick={() => deleteRow("timeSlots", index)}>
                        X
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="add-btn" onClick={() => addNewRow("timeSlots")}>
              Add New Time Slot
            </button>
          </div>
        </>
      )}

      {/* Buttons */}
      <div className="button-group">
        {!isEditing ? (
          <>
            <button className="edit-btn" onClick={() => setIsEditing(true)}>
              Edit Timetable
            </button>
            <button className="back-btn" onClick={() => navigate("/add-project")}>
              Back to Projects
            </button>
          </>
        ) : (
          <>
            <button className="save-btn" onClick={saveChanges} disabled={!isFormValid()}>
              Save Changes
            </button>
            <button className="cancel-btn" onClick={cancelEditing}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ParametersView;