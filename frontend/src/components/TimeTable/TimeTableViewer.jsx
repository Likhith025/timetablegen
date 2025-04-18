import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import API_BASE_URL from "../../src"; // Adjust path as needed
import "./TimeTableViewer.css";

const TimetableViewer = () => {
  const { id } = useParams();
  const [timetableData, setTimetableData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("class");
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    const fetchTimetableData = async () => {
      if (!id) {
        setError("Project ID not found");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/all/timetables/${id}`);
        if (!response.ok) throw new Error("Failed to fetch timetable data");

        const data = await response.json();
        console.log("Fetched timetable data:", data);
        setTimetableData(data);

        if (data.grades?.length > 0) {
          setSelectedItem(`${data.grades[0].grade}-${data.grades[0].section}`);
        }
      } catch (err) {
        console.error("Error fetching timetable:", err);
        setError("Error loading timetable data");
      } finally {
        setLoading(false);
      }
    };

    fetchTimetableData();
  }, [id]);

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    if (!timetableData) return;

    if (mode === "class" && timetableData.grades.length > 0) {
      setSelectedItem(`${timetableData.grades[0].grade}-${timetableData.grades[0].section}`);
    } else if (mode === "subject" && timetableData.subjects.length > 0) {
      setSelectedItem(timetableData.subjects[0].code);
    } else if (mode === "faculty" && timetableData.faculty.length > 0) {
      setSelectedItem(timetableData.faculty[0].id);
    } else if (mode === "room" && timetableData.classes?.length > 0) {
      const rooms = [...new Set(timetableData.classes.map(c => c.room))];
      if (rooms.length > 0) setSelectedItem(rooms[0]);
    }
  };

  const getSelectableItems = () => {
    if (!timetableData) return [];
    switch (viewMode) {
      case "class":
        return timetableData.grades.map(g => ({
          id: `${g.grade}-${g.section}`,
          name: `Grade ${g.grade} - Section ${g.section}`
        }));
      case "subject":
        return timetableData.subjects.map(s => ({
          id: s.code,
          name: `${s.subject} (${s.code})`
        }));
      case "faculty":
        return timetableData.faculty.map(f => ({
          id: f.id,
          name: f.name
        }));
      case "room":
        const uniqueRooms = [...new Set(timetableData.classes?.map(c => c.room))];
        return uniqueRooms.map(roomId => {
          const roomInfo = timetableData.classes.find(c => c.room === roomId);
          return {
            id: roomId,
            name: roomInfo ? `Room ${roomId} (${roomInfo.building})` : `Room ${roomId}`
          };
        });
      default:
        return [];
    }
  };

  const getScheduleForSelectedItem = () => {
    if (!timetableData?.generationResults?.length) return null;

    const latestGeneration = timetableData.generationResults[0];
    if (!latestGeneration.schedules) return null;

    const normalizeDayArray = (scheduleObj) => {
      Object.keys(scheduleObj).forEach(day => {
        if (!Array.isArray(scheduleObj[day])) {
          scheduleObj[day] = scheduleObj[day] ? [scheduleObj[day]] : [];
        }
      });
      return scheduleObj;
    };

    if (viewMode === "class") {
      const classSchedule = latestGeneration.schedules[selectedItem];
      return normalizeDayArray({ ...classSchedule });
    }

    const filteredSchedule = {};

    Object.entries(latestGeneration.schedules).forEach(([gradeSection, classSchedule]) => {
      Object.entries(classSchedule).forEach(([day, entries]) => {
        const dayEntries = Array.isArray(entries) ? entries : [entries];

        const matchingClasses = dayEntries.filter(item => {
          if (viewMode === "subject") return item.subject === selectedItem;
          if (viewMode === "faculty") return item.faculty === selectedItem;
          if (viewMode === "room") return item.room === selectedItem;
          return false;
        });

        if (!filteredSchedule[day]) filteredSchedule[day] = [];
        matchingClasses.forEach(item => {
          filteredSchedule[day].push({ ...item, gradeSection });
        });
      });
    });

    return normalizeDayArray(filteredSchedule);
  };

  const findSubjectByCode = (code) => timetableData?.subjects?.find(s => s.code === code);
  const findFacultyById = (id) => timetableData?.faculty?.find(f => f.id === id);
  const formatTimeSlot = (slot) => slot;

  const renderTimetableGrid = () => {
    const schedule = getScheduleForSelectedItem();
    if (!schedule) return <div className="empty-schedule">No schedule data available</div>;

    const availableDays = Object.keys(schedule).filter(day => Array.isArray(schedule[day]) && schedule[day].length > 0);
    if (availableDays.length === 0) return <div className="empty-schedule">No schedule data available for the selected item</div>;

    const allTimeSlots = new Set();
    availableDays.forEach(day => {
      if (Array.isArray(schedule[day])) {
        schedule[day].forEach(slot => allTimeSlots.add(slot.timeSlot));
      }
    });

    const uniqueTimeSlots = Array.from(allTimeSlots).sort((a, b) => {
      const [hA, mA] = a.split("-")[0].split(":").map(Number);
      const [hB, mB] = b.split("-")[0].split(":").map(Number);
      return hA * 60 + mA - (hB * 60 + mB);
    });

    const getRoomBuilding = (roomId) => {
      const roomInfo = timetableData?.classes?.find(c => c.room === roomId);
      return roomInfo?.building || null;
    };

    return (
      <div className="timetable-grid">
        <table>
          <colgroup>
            <col style={{ width: '120px' }} />
            {availableDays.map((_, i) => <col key={i} style={{ width: `${100 / availableDays.length}%` }} />)}
          </colgroup>
          <thead>
            <tr>
              <th>Time Slot</th>
              {availableDays.map(day => <th key={day}>{day}</th>)}
            </tr>
          </thead>
          <tbody>
            {uniqueTimeSlots.map(timeSlot => (
              <tr key={timeSlot}>
                <td className="time-cell">{formatTimeSlot(timeSlot)}</td>
                {availableDays.map(day => {
                  const entries = schedule[day]?.filter(item => item.timeSlot === timeSlot) || [];
                  return (
                    <td key={day} className="class-cell">
                      {entries.length ? entries.map((item, i) => {
                        const subject = findSubjectByCode(item.subject);
                        const faculty = findFacultyById(item.faculty);
                        const building = getRoomBuilding(item.room);

                        return (
                          <div key={i} className={i > 0 ? 'multiple-class' : ''}>
                            {faculty && <div className="teacher">{faculty.name}</div>}
                            <div className="room-info">Room: {item.room}{building ? ` (${building})` : ''}</div>
                            {viewMode !== 'subject' && subject && <div className="subject">{subject.subject}</div>}
                            {(viewMode === 'subject' || viewMode === 'faculty' || viewMode === 'room') && (
                              <div className="grade-section">{item.gradeSection}</div>
                            )}
                          </div>
                        );
                      }) : <div className="empty-cell">-</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) return <div className="loading">Loading timetable data...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!timetableData) return <div className="error">Timetable not found</div>;

  return (
    <div className="timetable-viewer timetable-page">
      <div className="viewer-header">
        <h2>Timetable Viewer</h2>
        <div className="view-mode-selector">
          {["class", "subject", "faculty", "room"].map(mode => (
            <button key={mode} className={viewMode === mode ? "active" : ""} onClick={() => handleViewModeChange(mode)}>
              View by {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="viewer-content">
        <div className="item-selector">
          <h3>
            {viewMode === "class" ? "Select Class" :
             viewMode === "subject" ? "Select Subject" :
             viewMode === "faculty" ? "Select Educator" : "Select Room"}
          </h3>
          <div className="selector-list">
            {getSelectableItems().map(item => (
              <div
                key={item.id}
                className={`selector-item ${selectedItem === item.id ? "selected" : ""}`}
                onClick={() => setSelectedItem(item.id)}
              >
                {item.name}
              </div>
            ))}
          </div>
        </div>

        <div className="timetable-display">
          <h3>
            {viewMode === "class" 
              ? `Timetable for ${selectedItem}` 
              : viewMode === "subject"
                ? `Timetable for ${findSubjectByCode(selectedItem)?.subject || selectedItem}`
                : viewMode === "faculty"
                  ? `Timetable for ${findFacultyById(selectedItem)?.name || selectedItem}`
                  : (() => {
                      const roomInfo = timetableData.classes.find(c => c.room === selectedItem);
                      return roomInfo 
                        ? `Timetable for Room ${selectedItem} (${roomInfo.building})` 
                        : `Timetable for Room ${selectedItem}`;
                    })()
            }
          </h3>
          {renderTimetableGrid()}
        </div>
      </div>
    </div>
  );
};

export default TimetableViewer;
