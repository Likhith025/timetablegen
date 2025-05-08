import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import API_BASE_URL from '../../src'; // Adjust path as needed
import './TimetableViewer.css';
import ChatbotInterface from '../ChatBot/ChatbotInterface';
import {
  DndContext,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import axios from 'axios';

const isFreePeriod = (classItem) => {
  if (!classItem || !classItem.subject) return false;
  return classItem.subject.toLowerCase().includes('free period');
};

const SortableItem = ({ id, item, index, viewMode, subject, faculty, isEmpty, isOver }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : 'all 0.3s ease', // Smooth transition on drop
    opacity: isDragging ? 0 : 1,
    cursor: isEmpty ? 'default' : 'move',
    backgroundColor: isOver ? '#f0f0f0' : isDragging ? '#d0e7ff' : isEmpty ? 'transparent' : '#e6f3ff',
    border: isOver ? '2px dashed #000' : 'none',
  };

  if (isEmpty) {
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="empty-slot">
        -
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="class-cell-content">
      {viewMode !== 'subject' && (
        <div className="subject">
          {subject ? subject.subject : item.subject || 'Free Period'}
        </div>
      )}
      {viewMode !== 'faculty' && !isFreePeriod(item) && (
        <div className="teacher">
          {faculty ? faculty.name : item.faculty || '-'}
        </div>
      )}
      {viewMode !== 'room' && !isFreePeriod(item) && (
        <div className="room">
          Room: {item.room || '-'}
        </div>
      )}
      {(viewMode === 'subject' || viewMode === 'faculty' || viewMode === 'room') && (
        <div className="grade-section">
          {item.gradeSection || '-'}
        </div>
      )}
    </div>
  );
};

const DraggedItemOverlay = ({ item, viewMode, subject, faculty, isEmpty }) => {
  const style = {
    backgroundColor: isEmpty ? 'transparent' : '#e6f3ff',
    opacity: 0.8,
    cursor: 'move',
    padding: '5px',
    border: '1px solid #ddd',
  };

  if (isEmpty) {
    return (
      <div style={style} className="empty-slot">
        -
      </div>
    );
  }

  return (
    <div style={style} className="class-cell-content">
      {viewMode !== 'subject' && (
        <div className="subject">
          {subject ? subject.subject : item.subject || 'Free Period'}
        </div>
      )}
      {viewMode !== 'faculty' && !isFreePeriod(item) && (
        <div className="teacher">
          {faculty ? faculty.name : item.faculty || '-'}
        </div>
      )}
      {viewMode !== 'room' && !isFreePeriod(item) && (
        <div className="room">
          Room: {item.room || '-'}
        </div>
      )}
      {(viewMode === 'subject' || viewMode === 'faculty' || viewMode === 'room') && (
        <div className="grade-section">
          {item.gradeSection || '-'}
        </div>
      )}
    </div>
  );
};

const TimetableViewer = ({ projectId, userId, userRole, userEmail }) => {
  const { id } = useParams();
  const [timetableData, setTimetableData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('class');
  const [selectedItem, setSelectedItem] = useState(null);
  const [email, setEmail] = useState(userEmail);
  const [educatorFound, setEducatorFound] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('single');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Local storage key for persisting timetable data
  const localStorageKey = `timetable_${id}`;

  // Ref to track mounted state and prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!email) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          setEmail(user.email || 'Not found in user object');
        } catch (err) {
          console.error('TimetableViewer: Error parsing user from localStorage:', err);
          setEmail('Error parsing user');
        }
      } else {
        setEmail('No user item in localStorage');
      }
    }
    console.log('TimetableViewer: Email from localStorage user:', email);

    const fetchTimetableData = async (retryCount = 3) => {
      if (!id) {
        setError('Project ID not found');
        setLoading(false);
        return;
      }

      try {
        // Check local storage for persisted timetable data
        const storedTimetable = localStorage.getItem(localStorageKey);
        if (storedTimetable) {
          const parsedData = JSON.parse(storedTimetable);
          if (isMountedRef.current) {
            setTimetableData(parsedData);
            setLoading(false);
          }
          return;
        }

        const response = await fetch(`${API_BASE_URL}/all/timetables/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch timetable data');
        }

        const data = await response.json();

        // Validate timetable data
        if (!data || !data.generationResults || !Array.isArray(data.generationResults)) {
          throw new Error('Invalid timetable data structure');
        }

        if (isMountedRef.current) {
          setTimetableData(data);
          setLoading(false);

          // Persist to local storage
          localStorage.setItem(localStorageKey, JSON.stringify(data));

          // Update view mode and selected item based on fetched data
          if (data.faculty && data.faculty.length > 0 && email) {
            const faculty = data.faculty.find(f => f.mail.toLowerCase() === email.toLowerCase());
            if (faculty) {
              setEducatorFound(true);
              setViewMode('faculty');
              setSelectedItem(faculty.id);
            } else if (data.grades && data.grades.length > 0) {
              setSelectedItem(`${data.grades[0].grade}-${data.grades[0].section}`);
            }
          } else if (data.grades && data.grades.length > 0) {
            setSelectedItem(`${data.grades[0].grade}-${data.grades[0].section}`);
          } else if (data.subjects && data.subjects.length > 0) {
            setViewMode('subject');
            setSelectedItem(data.subjects[0].code);
          } else if (data.classes && data.classes.length > 0) {
            setViewMode('room');
            setSelectedItem(data.classes[0].room);
          }
        }
      } catch (err) {
        console.error('Error fetching timetable:', err);
        if (retryCount > 0) {
          // Retry with exponential backoff
          const delay = (4 - retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchTimetableData(retryCount - 1);
        }
        if (isMountedRef.current) {
          setError('Error loading timetable data');
          setLoading(false);
        }
      }
    };

    fetchTimetableData();
  }, [id, email, localStorageKey]);

  useEffect(() => {
    console.log('TimetableViewer: Updated logged-in user email (from prop):', userEmail);
    if (userEmail && !email) {
      setEmail(userEmail);
    }
  }, [userEmail]);

  // Handle Escape key to cancel drag
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && activeId) {
        setActiveId(null);
        setOverId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeId]);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    if (timetableData) {
      if (mode === 'class' && timetableData.grades && timetableData.grades.length > 0) {
        setSelectedItem(`${timetableData.grades[0].grade}-${timetableData.grades[0].section}`);
      } else if (mode === 'subject' && timetableData.subjects && timetableData.subjects.length > 0) {
        setSelectedItem(timetableData.subjects[0].code);
      } else if (mode === 'faculty' && timetableData.faculty && timetableData.faculty.length > 0) {
        setSelectedItem(timetableData.faculty[0].id);
      } else if (mode === 'room' && timetableData.classes && timetableData.classes.length > 0) {
        setSelectedItem(timetableData.classes[0].room);
      } else {
        setSelectedItem(null); // Reset if no valid items
      }
    } else {
      setSelectedItem(null);
    }
    setActiveTab('single'); // Reset to single view when changing mode
  }, [timetableData]);

  const getSelectableItems = useCallback(() => {
    if (!timetableData) return [];
    switch (viewMode) {
      case 'class':
        return timetableData.grades ? timetableData.grades.map(g => ({
          id: `${g.grade}-${g.section}`,
          name: `Grade ${g.grade} - Section ${g.section}`,
        })) : [];
      case 'subject':
        return timetableData.subjects ? timetableData.subjects.map(s => ({
          id: s.code,
          name: `${s.subject} (${s.code})`,
        })) : [];
      case 'faculty':
        return timetableData.faculty ? timetableData.faculty.map(f => ({
          id: f.id,
          name: f.name,
        })) : [];
      case 'room':
        return timetableData.classes ? timetableData.classes.map(c => ({
          id: c.room,
          name: `Room ${c.room}`,
        })) : [];
      default:
        return [];
    }
  }, [timetableData, viewMode]);

  const getScheduleForItem = useCallback((itemId) => {
    if (!timetableData || !timetableData.generationResults || timetableData.generationResults.length === 0 || !itemId) {
      return null;
    }
    const latestGeneration = timetableData.generationResults[0];
    if (!latestGeneration.schedules) {
      return null;
    }
    if (viewMode === 'class') {
      return latestGeneration.schedules[itemId] || null;
    } else if (viewMode === 'subject') {
      const subjectCode = itemId;
      const filteredSchedule = {};
      Object.keys(latestGeneration.schedules).forEach(gradeSection => {
        const classSchedule = latestGeneration.schedules[gradeSection];
        Object.keys(classSchedule).forEach(day => {
          if (!filteredSchedule[day]) {
            filteredSchedule[day] = [];
          }
          const subjectClasses = classSchedule[day].filter(classItem => classItem.subject === subjectCode);
          subjectClasses.forEach(classItem => {
            filteredSchedule[day].push({
              ...classItem,
              gradeSection,
            });
          });
        });
      });
      return filteredSchedule;
    } else if (viewMode === 'faculty') {
      const facultyId = itemId;
      const filteredSchedule = {};
      Object.keys(latestGeneration.schedules).forEach(gradeSection => {
        const classSchedule = latestGeneration.schedules[gradeSection];
        Object.keys(classSchedule).forEach(day => {
          if (!filteredSchedule[day]) {
            filteredSchedule[day] = [];
          }
          const facultyClasses = classSchedule[day].filter(classItem => classItem.faculty === facultyId);
          facultyClasses.forEach(classItem => {
            filteredSchedule[day].push({
              ...classItem,
              gradeSection,
            });
          });
        });
      });
      return filteredSchedule;
    } else if (viewMode === 'room') {
      const roomId = itemId;
      const filteredSchedule = {};
      Object.keys(latestGeneration.schedules).forEach(gradeSection => {
        const classSchedule = latestGeneration.schedules[gradeSection];
        Object.keys(classSchedule).forEach(day => {
          if (!filteredSchedule[day]) {
            filteredSchedule[day] = [];
          }
          const roomClasses = classSchedule[day].filter(classItem => classItem.room === roomId);
          roomClasses.forEach(classItem => {
            filteredSchedule[day].push({
              ...classItem,
              gradeSection,
            });
          });
        });
      });
      return filteredSchedule;
    }
    return null;
  }, [timetableData, viewMode]);

  const getAllSchedules = useCallback(() => {
    if (!timetableData || !timetableData.generationResults || timetableData.generationResults.length === 0) {
      return [];
    }
    const latestGeneration = timetableData.generationResults[0];
    if (!latestGeneration.schedules) {
      return [];
    }

    const schedules = [];
    const items = getSelectableItems();

    items.forEach(item => {
      const schedule = getScheduleForItem(item.id);
      if (schedule) {
        schedules.push({ id: item.id, name: item.name, schedule });
      }
    });

    return schedules;
  }, [getSelectableItems, getScheduleForItem]);

  const findSubjectByCode = useCallback((subjectCode) => {
    if (!timetableData || !timetableData.subjects) return null;
    return timetableData.subjects.find(s => s.code === subjectCode);
  }, [timetableData]);

  const findFacultyById = useCallback((facultyId) => {
    if (!timetableData || !timetableData.faculty) return null;
    return timetableData.faculty.find(f => f.id === facultyId);
  }, [timetableData]);

  const getFlatSchedule = useCallback((schedule) => {
    // Guard against null or undefined schedule
    if (!schedule) {
      return {
        flatSchedule: [],
        days: [],
        uniqueTimeSlots: [],
        slotLookup: {},
      };
    }

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    // Deduplicate time slots and sort chronologically
    const timeSlotsWithStart = timetableData?.timeSlots?.map(slot => ({
      timeSlot: `${slot.startTime}-${slot.endTime}`,
      startTime: slot.startTime,
    })) || [{ timeSlot: '08:30-09:30', startTime: '08:30' }];
    
    // Deduplicate based on timeSlot
    const uniqueTimeSlotsMap = new Map(timeSlotsWithStart.map(slot => [slot.timeSlot, slot]));
    const uniqueTimeSlotsWithStart = Array.from(uniqueTimeSlotsMap.values());
    
    // Sort by startTime (e.g., "08:30" < "09:30")
    uniqueTimeSlotsWithStart.sort((a, b) => {
      const timeA = a.startTime.split(':').map(Number);
      const timeB = b.startTime.split(':').map(Number);
      return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });

    const uniqueTimeSlots = uniqueTimeSlotsWithStart.map(slot => slot.timeSlot);

    const flatSchedule = [];
    const slotIndices = {};
    days.forEach(day => {
      uniqueTimeSlots.forEach((timeSlot, tsIndex) => {
        const slots = schedule[day]?.filter(slot => `${slot.timeSlot}` === timeSlot) || [];
        const key = `${day}-${timeSlot}`;
        slotIndices[key] = slotIndices[key] || 0;

        if (slots.length > 0) {
          slots.forEach((slot) => {
            const index = slotIndices[key]++;
            flatSchedule.push({
              ...slot,
              day,
              timeSlot,
              id: `${day}-${timeSlot}-${index}`,
              isEmpty: false,
            });
          });
        } else {
          flatSchedule.push({
            day,
            timeSlot,
            id: `${day}-${timeSlot}-empty-${tsIndex}-${slotIndices[key]++}`,
            isEmpty: true,
            subject: 'Free Period',
            faculty: null,
            room: null,
            gradeSection: null,
          });
        }
      });
    });

    // Precompute a lookup map for faster slot access
    const slotLookup = {};
    days.forEach(day => {
      slotLookup[day] = {};
      uniqueTimeSlots.forEach(timeSlot => {
        slotLookup[day][timeSlot] = flatSchedule.filter(slot => slot.day === day && slot.timeSlot === timeSlot);
      });
    });

    return { flatSchedule, days, uniqueTimeSlots, slotLookup };
  }, [timetableData]);

  const schedule = activeTab === 'single' ? getScheduleForItem(selectedItem) : null;
  const { flatSchedule, days, uniqueTimeSlots, slotLookup } = useMemo(() => {
    if (!schedule) {
      return { flatSchedule: [], days: [], uniqueTimeSlots: [], slotLookup: {} };
    }
    return getFlatSchedule(schedule);
  }, [schedule, getFlatSchedule]);

  const allSchedules = useMemo(() => getAllSchedules(), [getAllSchedules]);

  const handleDragStart = useCallback(({ active }) => {
    setActiveId(active.id);
  }, []);

  const handleDragOver = useCallback(({ over }) => {
    setOverId(over?.id || null);
  }, []);

  const handleDragEnd = useCallback(async ({ active, over }) => {
    if (!isEditMode || !active || !over || active.id === over.id) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const activeIndex = flatSchedule.findIndex(slot => slot.id === active.id);
    const overIndex = flatSchedule.findIndex(slot => slot.id === over.id);

    if (activeIndex === -1 || overIndex === -1) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const activeItem = flatSchedule[activeIndex];
    const overItem = flatSchedule[overIndex];

    // Allow dragging non-empty slots (including free periods)
    if (activeItem.isEmpty && !isFreePeriod(activeItem)) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const newFlatSchedule = [...flatSchedule];
    const targetDay = overItem.day;
    const targetTimeSlot = overItem.timeSlot;

    // Swap with the target slot
    newFlatSchedule[activeIndex] = {
      ...activeItem,
      day: targetDay,
      timeSlot: targetTimeSlot,
      id: `${targetDay}-${targetTimeSlot}-${flatSchedule[overIndex].id.split('-')[3] || '0'}`,
    };
    newFlatSchedule[overIndex] = {
      ...overItem,
      day: activeItem.day,
      timeSlot: activeItem.timeSlot,
      id: `${activeItem.day}-${activeItem.timeSlot}-${flatSchedule[activeIndex].id.split('-')[3] || '0'}`,
    };

    // Update the timetable data
    const updatedSchedules = { ...timetableData.generationResults[0].schedules };
    const updatedScheduleByGradeSection = {};
    newFlatSchedule.forEach(slot => {
      if (slot.isEmpty && !isFreePeriod(slot)) return;
      const { gradeSection, day, timeSlot, subject, faculty, room } = slot;
      const gs = gradeSection || selectedItem;
      if (!updatedScheduleByGradeSection[gs]) {
        updatedScheduleByGradeSection[gs] = {};
      }
      if (!updatedScheduleByGradeSection[gs][day]) {
        updatedScheduleByGradeSection[gs][day] = [];
      }
      updatedScheduleByGradeSection[gs][day].push({
        timeSlot,
        subject: subject || 'Free Period',
        faculty,
        room,
      });
    });

    Object.keys(updatedScheduleByGradeSection).forEach(gradeSection => {
      updatedSchedules[gradeSection] = updatedScheduleByGradeSection[gradeSection];
    });

    const updatedTimetableData = {
      ...timetableData,
      generationResults: [
        {
          ...timetableData.generationResults[0],
          schedules: updatedSchedules,
        },
        ...timetableData.generationResults.slice(1),
      ],
    };
    setTimetableData(updatedTimetableData);
    setHasChanges(true); // Mark that changes have been made

    setActiveId(null);
    setOverId(null);
  }, [isEditMode, flatSchedule, timetableData, selectedItem]);

  const handleSave = useCallback(() => {
    if (!hasChanges) return;

    try {
      // Persist the updated timetable data to local storage
      localStorage.setItem(localStorageKey, JSON.stringify(timetableData));
      setHasChanges(false);
      setError(''); // Clear any previous errors
      console.log('Timetable saved locally to localStorage');
    } catch (error) {
      console.error('Error saving timetable to localStorage:', error);
      setError('Failed to save changes locally. Please try again.');
    }
  }, [hasChanges, timetableData, localStorageKey]);

  const renderTimetableGrid = useCallback((scheduleData) => {
    const { schedule, identifier } = scheduleData;
    const { flatSchedule, days, uniqueTimeSlots, slotLookup } = getFlatSchedule(schedule);

    if (!schedule) {
      return <div className="empty-schedule">No schedule data available for {identifier}</div>;
    }

    if (days.length === 0) {
      return <div className="empty-schedule">No schedule data available for {identifier}</div>;
    }

    if (!isEditMode) {
      return (
        <div className="timetable-grid">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                {uniqueTimeSlots.map((timeSlot, index) => (
                  <th key={`header-${index}`}>{timeSlot}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(day => (
                <tr key={day}>
                  <td className="day-cell">{day}</td>
                  {uniqueTimeSlots.map((timeSlot, tsIndex) => {
                    const classesForTimeSlot = slotLookup[day][timeSlot];
                    return (
                      <td key={`${day}-${timeSlot}-${tsIndex}`} className="class-cell">
                        {classesForTimeSlot.length > 0 ? (
                          classesForTimeSlot.map((item, index) => {
                            const subject = findSubjectByCode(item.subject);
                            const faculty = findFacultyById(item.faculty);
                            const cellClass = isFreePeriod(item) ? 'free-period' : 'class-cell-content';
                            return (
                              <div key={item.id} className={index > 0 ? 'multiple-class' : cellClass}>
                                {viewMode !== 'subject' && (
                                  <div className="subject">
                                    {subject ? subject.subject : item.subject || 'Free Period'}
                                  </div>
                                )}
                                {viewMode !== 'faculty' && !isFreePeriod(item) && (
                                  <div className="teacher">
                                    {faculty ? faculty.name : item.faculty || '-'}
                                  </div>
                                )}
                                {viewMode !== 'room' && !isFreePeriod(item) && (
                                  <div className="room">
                                    Room: {item.room || '-'}
                                  </div>
                                )}
                                {(viewMode === 'subject' || viewMode === 'faculty' || viewMode === 'room') && (
                                  <div className="grade-section">
                                    {item.gradeSection || '-'}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="empty-slot">-</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    const activeItem = flatSchedule.find(slot => slot.id === activeId);

    return (
      <>
        <div className="timetable-grid">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                {uniqueTimeSlots.map((timeSlot, index) => (
                  <th key={`header-${index}`}>{timeSlot}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.map(day => (
                <tr key={day}>
                  <td className="day-cell">{day}</td>
                  {uniqueTimeSlots.map((timeSlot, tsIndex) => {
                    const slots = slotLookup[day][timeSlot];
                    return (
                      <td key={`${day}-${timeSlot}-${tsIndex}`} data-day={day} data-time-slot={timeSlot} className="class-cell">
                        {slots.map((item, index) => {
                          const subject = findSubjectByCode(item.subject);
                          const faculty = findFacultyById(item.faculty);
                          const isOver = overId === item.id;
                          return (
                            <SortableItem
                              key={item.id}
                              id={item.id}
                              item={item}
                              index={index}
                              viewMode={viewMode}
                              subject={subject}
                              faculty={faculty}
                              isEmpty={item.isEmpty}
                              isOver={isOver}
                            />
                          );
                        })}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {activeItem && (
          <DragOverlay>
            <DraggedItemOverlay
              item={activeItem}
              viewMode={viewMode}
              subject={findSubjectByCode(activeItem.subject)}
              faculty={findFacultyById(activeItem.faculty)}
              isEmpty={activeItem.isEmpty}
            />
          </DragOverlay>
        )}
      </>
    );
  }, [isEditMode, viewMode, activeId, overId, findSubjectByCode, findFacultyById, getFlatSchedule]);

  if (loading) return <div className="loading">Loading timetable data...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!timetableData) return <div className="error">Timetable not found</div>;

  const educator = timetableData.faculty.find(f => f.mail.toLowerCase() === email.toLowerCase());

  return (
    <div className="timetable-viewer">
      <div className="viewer-header">
        <h2>Timetable Viewer</h2>
        {!educator && (
          <div className="view-mode-selector">
            <button className={viewMode === 'class' ? 'active' : ''} onClick={() => handleViewModeChange('class')}>
              View by Class
            </button>
            <button className={viewMode === 'subject' ? 'active' : ''} onClick={() => handleViewModeChange('subject')}>
              View by Subject
            </button>
            <button className={viewMode === 'faculty' ? 'active' : ''} onClick={() => handleViewModeChange('faculty')}>
              View by Educator
            </button>
            <button className={viewMode === 'room' ? 'active' : ''} onClick={() => handleViewModeChange('room')}>
              View by Room
            </button>
          </div>
        )}
      </div>

      <div className="viewer-content">
        {!educator && (
          <div className="item-selector">
            <h3>
              {viewMode === 'class' ? 'Select Class' : viewMode === 'subject' ? 'Select Subject' : viewMode === 'faculty' ? 'Select Educator' : 'Select Room'}
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
        )}

        <div className="timetable-display">
          <div className="timetable-controls">
            <div className="tab-selector">
              <button
                className={activeTab === 'single' ? 'active' : ''}
                onClick={() => setActiveTab('single')}
              >
                Single View
              </button>
              <button
                className={activeTab === 'all' ? 'active' : ''}
                onClick={() => setActiveTab('all')}
              >
                All View
              </button>
            </div>
            <div className="action-buttons">
              <button
                className={isEditMode ? 'edit-mode-button disable' : 'edit-mode-button enable'}
                onClick={() => setIsEditMode(!isEditMode)}
              >
                {isEditMode ? 'Disable Edit Mode' : 'Enable Edit Mode'}
              </button>
              {hasChanges && (
                <button className="save-button" onClick={handleSave}>
                  Save Changes
                </button>
              )}
            </div>
          </div>
          {activeTab === 'single' ? (
            selectedItem ? (
              <>
                <h3>
                  {educator
                    ? `Timetable for ${educator.name || 'Educator'}`
                    : viewMode === 'class'
                    ? `Timetable for ${selectedItem}`
                    : viewMode === 'subject'
                    ? `Timetable for ${findSubjectByCode(selectedItem)?.subject || selectedItem}`
                    : viewMode === 'faculty'
                    ? `Timetable for ${findFacultyById(selectedItem)?.name || selectedItem}`
                    : `Timetable for Room ${selectedItem}`}
                </h3>
                <DndContext
                  sensors={sensors}
                  collisionDetection={rectIntersection}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDragEnd={handleDragEnd}
                >
                  {renderTimetableGrid({ schedule, identifier: selectedItem })}
                </DndContext>
              </>
            ) : (
              <div className="empty-schedule">Please select an item to view its timetable.</div>
            )
          ) : (
            <div className="all-timetables">
              {allSchedules.map(scheduleData => (
                <div key={scheduleData.id} className="timetable-section">
                  <h4>{scheduleData.name}</h4>
                  {renderTimetableGrid({ schedule: scheduleData.schedule, identifier: scheduleData.name })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimetableViewer;