import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import API_BASE_URL from '../../src'; // Adjust path as needed
import './TimetableViewer.css';
import ChatbotInterface from '../ChatBot/ChatbotInterface';

const TimetableViewer = () => {
  const { id } = useParams();
  const [timetableData, setTimetableData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('class'); // class, subject, faculty, room
  const [selectedItem, setSelectedItem] = useState('');

  // Fetch timetable data
  useEffect(() => {
    const fetchTimetableData = async () => {
      if (!id) {
        setError('Project ID not found');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/all/timetables/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch timetable data');
        }

        const data = await response.json();
        setTimetableData(data);

        // Set default selected item based on view mode
        if (data.grades && data.grades.length > 0) {
          setSelectedItem(`${data.grades[0].grade}-${data.grades[0].section}`);
        }
      } catch (err) {
        console.error('Error fetching timetable:', err);
        setError('Error loading timetable data');
      } finally {
        setLoading(false);
      }
    };

    fetchTimetableData();
  }, [id]);

  // Handle view mode change
  const handleViewModeChange = (mode) => {
    setViewMode(mode);

    // Reset selected item based on new view mode
    if (timetableData) {
      if (mode === 'class' && timetableData.grades.length > 0) {
        setSelectedItem(`${timetableData.grades[0].grade}-${timetableData.grades[0].section}`);
      } else if (mode === 'subject' && timetableData.subjects.length > 0) {
        setSelectedItem(timetableData.subjects[0].code);
      } else if (mode === 'faculty' && timetableData.faculty.length > 0) {
        setSelectedItem(timetableData.faculty[0].id);
      } else if (mode === 'room' && timetableData.classes.length > 0) {
        setSelectedItem(timetableData.classes[0].room);
      }
    }
  };

  // Generate the list of selectable items based on view mode
  const getSelectableItems = () => {
    if (!timetableData) return [];

    switch (viewMode) {
      case 'class':
        return timetableData.grades.map(g => ({
          id: `${g.grade}-${g.section}`,
          name: `Grade ${g.grade} - Section ${g.section}`
        }));
      case 'subject':
        return timetableData.subjects.map(s => ({
          id: s.code,
          name: `${s.subject} (${s.code})`
        }));
      case 'faculty':
        return timetableData.faculty.map(f => ({
          id: f.id,
          name: f.name
        }));
      case 'room':
        return timetableData.classes.map(c => ({
          id: c.room,
          name: `Room ${c.room}`
        }));
      default:
        return [];
    }
  };

  // Get schedule for the selected item
  const getScheduleForSelectedItem = () => {
    if (!timetableData || !timetableData.generationResults || timetableData.generationResults.length === 0) {
      return null;
    }

    const latestGeneration = timetableData.generationResults[0]; // Assuming the first one is the latest

    if (!latestGeneration.schedules) {
      return null;
    }

    if (viewMode === 'class') {
      // For class view, return the class schedule directly
      return latestGeneration.schedules[selectedItem];
    } else if (viewMode === 'subject') {
      // For subject view, filter all schedules to find classes for this subject
      const subjectCode = selectedItem;
      const filteredSchedule = {};

      Object.keys(latestGeneration.schedules).forEach(gradeSection => {
        const classSchedule = latestGeneration.schedules[gradeSection];

        Object.keys(classSchedule).forEach(day => {
          if (!filteredSchedule[day]) {
            filteredSchedule[day] = [];
          }

          const subjectClasses = classSchedule[day].filter(
            classItem => classItem.subject === subjectCode
          );

          subjectClasses.forEach(classItem => {
            filteredSchedule[day].push({
              ...classItem,
              gradeSection
            });
          });
        });
      });

      return filteredSchedule;
    } else if (viewMode === 'faculty') {
      // For faculty view, filter all schedules to find classes for this faculty
      const facultyId = selectedItem;
      const filteredSchedule = {};

      Object.keys(latestGeneration.schedules).forEach(gradeSection => {
        const classSchedule = latestGeneration.schedules[gradeSection];

        Object.keys(classSchedule).forEach(day => {
          if (!filteredSchedule[day]) {
            filteredSchedule[day] = [];
          }

          const facultyClasses = classSchedule[day].filter(
            classItem => classItem.faculty === facultyId
          );

          facultyClasses.forEach(classItem => {
            filteredSchedule[day].push({
              ...classItem,
              gradeSection
            });
          });
        });
      });

      return filteredSchedule;
    } else if (viewMode === 'room') {
      // For room view, filter all schedules to find classes for this room
      const roomId = selectedItem;
      const filteredSchedule = {};

      Object.keys(latestGeneration.schedules).forEach(gradeSection => {
        const classSchedule = latestGeneration.schedules[gradeSection];

        Object.keys(classSchedule).forEach(day => {
          if (!filteredSchedule[day]) {
            filteredSchedule[day] = [];
          }

          const roomClasses = classSchedule[day].filter(
            classItem => classItem.room === roomId
          );

          roomClasses.forEach(classItem => {
            filteredSchedule[day].push({
              ...classItem,
              gradeSection
            });
          });
        });
      });

      return filteredSchedule;
    }

    return null;
  };

  // Find subject by code
  const findSubjectByCode = (subjectCode) => {
    if (!timetableData || !timetableData.subjects) return null;
    return timetableData.subjects.find(s => s.code === subjectCode);
  };

  // Find faculty by ID
  const findFacultyById = (facultyId) => {
    if (!timetableData || !timetableData.faculty) return null;
    return timetableData.faculty.find(f => f.id === facultyId);
  };

  // Check if a class represents a free period
  const isFreePeriod = (classItem) => {
    if (!classItem || !classItem.subject) return false;
    return classItem.subject.toLowerCase().includes('free period');
  };

  // Render the timetable grid
  const renderTimetableGrid = () => {
    const schedule = getScheduleForSelectedItem();
    if (!schedule) {
      return <div className="empty-schedule">No schedule data available</div>;
    }

    // Get all days that have schedule data
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].filter(
      day => schedule[day] && schedule[day].length > 0
    );

    if (days.length === 0) {
      return <div className="empty-schedule">No schedule data available for the selected item</div>;
    }

    // Get all unique time slots across all days
    const allTimeSlots = new Set();
    days.forEach(day => {
      schedule[day].forEach(slot => {
        allTimeSlots.add(slot.timeSlot);
      });
    });
    const uniqueTimeSlots = Array.from(allTimeSlots).sort();

    return (
      <div className="timetable-grid">
        <table>
          <thead>
            <tr>
              <th>Day</th>
              {uniqueTimeSlots.map(timeSlot => (
                <th key={timeSlot}>{timeSlot}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map(day => (
              <tr key={day}>
                <td className="day-cell">{day}</td>
                {uniqueTimeSlots.map(timeSlot => {
                  const classesForTimeSlot = schedule[day]?.filter(
                    item => item.timeSlot === timeSlot
                  ) || [];

                  // Check if all classes in this timeslot are free periods
                  const allFreePeriods = classesForTimeSlot.length > 0 && 
                                     classesForTimeSlot.every(item => 
                                     isFreePeriod(item) || item.subject === "Free Period");
                  
                  if (allFreePeriods) {
                    // Render an empty cell for free periods
                    return <td key={timeSlot} className="empty-cell"></td>;
                  } else if (classesForTimeSlot.length > 0) {
                    return (
                      <td key={timeSlot} className="class-cell">
                        {classesForTimeSlot.map((item, index) => {
                          // Skip rendering free periods
                          if (isFreePeriod(item) || item.subject === "Free Period") {
                            return null;
                          }
                          
                          const subject = findSubjectByCode(item.subject);
                          const faculty = findFacultyById(item.faculty);

                          return (
                            <div key={index} className={index > 0 ? 'multiple-class' : ''}>
                              {viewMode !== 'subject' && (
                                <div className="subject">
                                  {subject ? subject.subject : item.subject}
                                </div>
                              )}
                              {viewMode !== 'faculty' && (
                                <div className="teacher">
                                  {faculty ? faculty.name : item.faculty}
                                </div>
                              )}
                              {viewMode !== 'room' && (
                                <div className="room">
                                  Room: {item.room}
                                </div>
                              )}
                              {(viewMode === 'subject' || viewMode === 'faculty' || viewMode === 'room') && (
                                <div className="grade-section">
                                  {item.gradeSection}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </td>
                    );
                  } else {
                    return <td key={timeSlot} className="empty-cell">-</td>;
                  }
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
    <div className="timetable-viewer">
      <ChatbotInterface/>
      <div className="viewer-header">
        <h2>Timetable Viewer</h2>
        <div className="view-mode-selector">
          <button
            className={viewMode === 'class' ? 'active' : ''}
            onClick={() => handleViewModeChange('class')}
          >
            View by Class
          </button>
          <button
            className={viewMode === 'subject' ? 'active' : ''}
            onClick={() => handleViewModeChange('subject')}
          >
            View by Subject
          </button>
          <button
            className={viewMode === 'faculty' ? 'active' : ''}
            onClick={() => handleViewModeChange('faculty')}
          >
            View by Educator
          </button>
          <button
            className={viewMode === 'room' ? 'active' : ''}
            onClick={() => handleViewModeChange('room')}
          >
            View by Room
          </button>
        </div>
      </div>

      <div className="viewer-content">
        <div className="item-selector">
          <h3>
            {viewMode === 'class'
              ? 'Select Class'
              : viewMode === 'subject'
              ? 'Select Subject'
              : viewMode === 'faculty'
              ? 'Select Educator'
              : 'Select Room'}
          </h3>
          <div className="selector-list">
            {getSelectableItems().map(item => (
              <div
                key={item.id}
                className={`selector-item ${selectedItem === item.id ? 'selected' : ''}`}
                onClick={() => setSelectedItem(item.id)}
              >
                {item.name}
              </div>
            ))}
          </div>
        </div>

        <div className="timetable-display">
          <h3>
            {viewMode === 'class'
              ? `Timetable for ${selectedItem}`
              : viewMode === 'subject'
              ? `Timetable for ${findSubjectByCode(selectedItem)?.subject || selectedItem}`
              : viewMode === 'faculty'
              ? `Timetable for ${findFacultyById(selectedItem)?.name || selectedItem}`
              : `Timetable for Room ${selectedItem}`}
          </h3>
          {renderTimetableGrid()}
        </div>
      </div>
    </div>
  );
};

export default TimetableViewer;