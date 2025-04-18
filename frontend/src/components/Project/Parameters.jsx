import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode"; // Import jwt-decode
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
  const navigate = useNavigate();

  // Fetch user info from localStorage or token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token); // Use jwtDecode instead of require
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
        setParameters(data);
        setEditedParameters(JSON.parse(JSON.stringify(data))); // Deep copy for editing
      } catch (err) {
        console.error("Error fetching timetable:", err);
        setError(err.message || "Failed to load timetable.");
      } finally {
        setLoading(false);
      }
    };

    fetchParameters();
  }, [projectId, navigate]);

  // Handle input changes
  const handleInputChange = (section, index, field, value) => {
    setEditedParameters((prev) => {
      const updated = { ...prev };
      if (section === "projectName") {
        updated.projectName = value;
      } else {
        updated[section][index][field] = value;
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

  // Handle multi-select changes (e.g., facultyIds, gradeSections, applicableTo)
  const handleMultiSelectChange = (section, index, field, selectedOptions) => {
    const values = Array.from(selectedOptions, (option) => option.value);
    setEditedParameters((prev) => {
      const updated = { ...prev };
      if (field === "gradeSections") {
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

  // Add new row
  const addNewRow = (section) => {
    setEditedParameters((prev) => {
      const updated = { ...prev };
      const lastRow = updated[section][updated[section].length - 1];
      let isPreviousFilled = true;

      if (section === "classes") {
        isPreviousFilled =
          lastRow.room.trim() !== "" &&
          lastRow.capacity.trim() !== "" &&
          (!prev.multipleBuildings || lastRow.building.trim() !== "");
      } else if (section === "faculty") {
        isPreviousFilled =
          lastRow.id.trim() !== "" &&
          lastRow.name.trim() !== "" &&
          lastRow.mail.trim() !== "";
      } else if (section === "grades") {
        isPreviousFilled =
          lastRow.grade.trim() !== "" &&
          lastRow.section.trim() !== "" &&
          lastRow.strength.trim() !== "";
      } else if (section === "subjects") {
        isPreviousFilled =
          lastRow.code.trim() !== "" &&
          lastRow.subject.trim() !== "" &&
          lastRow.facultyIds.length > 0 &&
          lastRow.gradeSections.length > 0 &&
          lastRow.classesWeek.trim() !== "";
      } else if (section === "timeSlots") {
        isPreviousFilled =
          lastRow.day.trim() !== "" &&
          lastRow.startTime.trim() !== "" &&
          lastRow.endTime.trim() !== "" &&
          lastRow.applicableTo.length > 0;
      }

      if (isPreviousFilled) {
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
            : section === "subjects"
            ? {
                code: "",
                subject: "",
                facultyIds: [],
                gradeSections: [],
                classesWeek: "",
                isCombined: false,
                assignedClasses: [],
              }
            : { day: "", startTime: "", endTime: "", applicableTo: [] }
        );
      }
      return updated;
    });
  };

  // Delete row
  const deleteRow = (section, index) => {
    setEditedParameters((prev) => {
      const updated = { ...prev };
      updated[section].splice(index, 1);
      return updated;
    });
  };

  // Validate form data
  const isFormValid = () => {
    if (!editedParameters.projectName.trim()) return false;
    if (
      !editedParameters.classes.every(
        (row) =>
          row.room.trim() &&
          row.capacity.trim() &&
          (!editedParameters.multipleBuildings || row.building.trim())
      )
    )
      return false;
    if (
      !editedParameters.faculty.every(
        (row) => row.id.trim() && row.name.trim() && row.mail.trim()
      )
    )
      return false;
    if (
      !editedParameters.grades.every(
        (row) => row.grade.trim() && row.section.trim() && row.strength.trim()
      )
    )
      return false;
    if (
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
      !editedParameters.timeSlots.every(
        (row) =>
          row.day.trim() &&
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

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE_URL}/all/timetables/${projectId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(editedParameters),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to update timetable");
      }

      const updatedData = await response.json();
      console.log("Updated timetable:", updatedData);
      setParameters(updatedData);
      setIsEditing(false);
      alert("Timetable updated successfully!");
    } catch (err) {
      console.error("Error updating timetable:", err);
      alert(`Failed to update timetable: ${err.message || "Unknown error"}`);
    }
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditedParameters(JSON.parse(JSON.stringify(parameters))); // Reset to original
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
            <p>{parameters.projectName}</p>
          </div>
          <div className="section">
            <h3>Classes</h3>
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
          </div>
          <div className="section">
            <h3>Faculty</h3>
            <table>
              <thead>
                <tr>
                  <th>Faculty ID</th>
                  <th>Name</th>
                  <th>Mail ID</th>
                </tr>
              </thead>
              <tbody>
                {parameters.faculty.map((row, index) => (
                  <tr key={index}>
                    <td>{row.id}</td>
                    <td>{row.name}</td>
                    <td>{row.mail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="section">
            <h3>Grades</h3>
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
          </div>
          <div className="section">
            <h3>Time Slots</h3>
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
                    <td>{row.day}</td>
                    <td>{row.startTime}</td>
                    <td>{row.endTime}</td>
                    <td>{row.applicableTo.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              </tbody>
            </table>
            <p className="user-info-note">This timetable is associated with your account.</p>
          </div>
        </>
      ) : (
        <>
          {/* Edit Mode */}
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
                {editedParameters.classes.map((row, index) => (
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
                  <th>Mail ID</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {editedParameters.faculty.map((row, index) => (
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
                    <td>
                      <input
                        type="text"
                        value={row.mail}
                        onChange={(e) => handleInputChange("faculty", index, "mail", e.target.value)}
                      />
                    </td>
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
                {editedParameters.grades.map((row, index) => (
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
                {editedParameters.subjects.map((row, index) => (
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
                        {editedParameters.faculty.map((faculty, i) => (
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
                        {editedParameters.grades.map((grade, i) => (
                          <option key={i} value={`${grade.grade} - ${grade.section}`}>
                            {grade.grade} - {grade.section}
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
                        {editedParameters.classes.map((cls, i) => (
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
            <h3>Time_lazy Slots</h3>
            <table>
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Applicable To (Grade - Section)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {editedParameters.timeSlots.map((row, index) => (
                  <tr key={index}>
                    <td>
                      <select
                        value={row.day}
                        onChange={(e) => handleInputChange("timeSlots", index, "day", e.target.value)}
                      >
                        <option value="">Select Day</option>
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
                        value={row.startTime}
                        onChange={(e) =>
                          handleInputChange("timeSlots", index, "startTime", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={row.endTime}
                        onChange={(e) =>
                          handleInputChange("timeSlots", index, "endTime", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <select
                        multiple
                        value={row.applicableTo}
                        onChange={(e) =>
                          handleMultiSelectChange("timeSlots", index, "applicableTo", e.target.selectedOptions)
                        }
                        className="multi-select"
                      >
                        {editedParameters.grades.map((grade, i) => (
                          <option key={i} value={`${grade.grade} - ${grade.section}`}>
                            {grade.grade} - {grade.section}
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