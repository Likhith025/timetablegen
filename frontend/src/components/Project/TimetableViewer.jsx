import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import API_BASE_URL from '../../src'; // Adjust path as needed
import './TimetableViewer.css';
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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const isFreePeriod = (classItem) => {
  if (!classItem || !classItem.subject) return false;
  return classItem.subject.toLowerCase().includes('free period');
};

const SortableItem = ({ id, item, index, viewMode, subject, faculty, isEmpty, isOver, isEditing, editMode, onEdit, onUpdate, onCancel, editedRoom, setEditedRoom, editedFaculty, setEditedFaculty, availableRooms, availableFaculty, tableScale }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : 'all 0.3s ease',
    opacity: isDragging ? 0 : 1,
    cursor: editMode === 'drag' && !isEmpty ? 'move' : 'default',
    backgroundColor: isOver ? '#f0f0f0' : isDragging ? '#d0e7ff' : isEmpty ? 'transparent' : isEditing ? '#fff3cd' : '#e6f3ff',
    border: isOver ? '2px dashed #000' : isEditing ? '2px solid #ffc107' : 'none',
    fontSize: `${14 * tableScale}px`,
    padding: `${8 * tableScale}px`,
  };

  if (isEmpty || isFreePeriod(item)) {
    return (
      <div ref={setNodeRef} style={style} className="empty-slot">
        {isEmpty ? '-' : 'Free Period'}
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} {...(editMode === 'drag' && !isEditing ? { ...attributes, ...listeners } : {})} className="class-cell-content">
      {isEditing && editMode === 'details' ? (
        <div className="edit-slot" style={{ gap: `${8 * tableScale}px` }}>
          <select
            value={editedRoom || item.room || ''}
            onChange={(e) => setEditedRoom(e.target.value)}
            aria-label="Select Room"
            style={{ fontSize: `${14 * tableScale}px`, padding: `${6 * tableScale}px` }}
          >
            <option value="">Select Room</option>
            {availableRooms.map((room) => (
              <option key={room.room} value={room.room}>
                {room.room}
              </option>
            ))}
          </select>
          <select
            value={editedFaculty || item.faculty || ''}
            onChange={(e) => setEditedFaculty(e.target.value)}
            aria-label="Select Faculty"
            style={{ fontSize: `${14 * tableScale}px`, padding: `${6 * tableScale}px` }}
          >
            <option value="">Select Faculty</option>
            {availableFaculty.map((fac) => (
              <option key={fac.id} value={fac.id}>
                {fac.name}
              </option>
            ))}
          </select>
          <div className="edit-slot-buttons" style={{ gap: `${8 * tableScale}px` }}>
            <button onClick={onUpdate} disabled={!editedRoom && !editedFaculty} aria-label="Confirm Edit" style={{ fontSize: `${14 * tableScale}px`, padding: `${6 * tableScale}px ${12 * tableScale}px` }}>
              Confirm
            </button>
            <button onClick={onCancel} className="cancel-button" aria-label="Cancel Edit" style={{ fontSize: `${14 * tableScale}px`, padding: `${6 * tableScale}px ${12 * tableScale}px` }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {viewMode !== 'subject' && (
            <div className="subject" style={{ fontSize: `${15 * tableScale}px`, margin: `${4 * tableScale}px 0` }}>
              {subject ? subject.subject : item.subject || 'Free Period'}
            </div>
          )}
          {viewMode !== 'faculty' && !isFreePeriod(item) && (
            <div className="teacher" style={{ fontSize: `${14 * tableScale}px`, marginBottom: `${4 * tableScale}px` }}>
              {faculty ? faculty.name : item.faculty ? findFacultyById(item.faculty)?.name : '-'}
            </div>
          )}
          {viewMode !== 'room' && !isFreePeriod(item) && (
            <div className="room" style={{ fontSize: `${13 * tableScale}px` }}>
              Room: {item.room || '-'}
            </div>
          )}
          {(viewMode === 'subject' || viewMode === 'faculty' || viewMode === 'room') && (
            <div className="grade-section" style={{ fontSize: `${13 * tableScale}px`, marginTop: `${4 * tableScale}px` }}>
              {item.gradeSection || '-'}
            </div>
          )}
          {editMode === 'details' && (
            <button onClick={onEdit} className="edit-button" aria-label="Edit Slot" style={{ fontSize: `${14 * tableScale}px`, padding: `${6 * tableScale}px ${12 * tableScale}px`, marginTop: `${8 * tableScale}px` }}>
              Edit
            </button>
          )}
        </>
      )}
    </div>
  );
};

const DraggedItemOverlay = ({ item, viewMode, subject, faculty, isEmpty, tableScale }) => {
  const style = {
    backgroundColor: isEmpty ? 'transparent' : '#e6f3ff',
    opacity: 0.8,
    cursor: 'move',
    padding: `${5 * tableScale}px`,
    border: '1px solid #ddd',
    fontSize: `${14 * tableScale}px`,
  };

  if (isEmpty || isFreePeriod(item)) {
    return (
      <div style={style} className="empty-slot">
        {isEmpty ? '-' : 'Free Period'}
      </div>
    );
  }

  return (
    <div style={style} className="class-cell-content">
      {viewMode !== 'subject' && (
        <div className="subject" style={{ fontSize: `${15 * tableScale}px`, margin: `${4 * tableScale}px 0` }}>
          {subject ? subject.subject : item.subject || 'Free Period'}
        </div>
      )}
      {viewMode !== 'faculty' && !isFreePeriod(item) && (
        <div className="teacher" style={{ fontSize: `${14 * tableScale}px`, marginBottom: `${4 * tableScale}px` }}>
          {faculty ? faculty.name : item.faculty ? findFacultyById(item.faculty)?.name : '-'}
        </div>
      )}
      {viewMode !== 'room' && !isFreePeriod(item) && (
        <div className="room" style={{ fontSize: `${13 * tableScale}px` }}>
          Room: {item.room || '-'}
        </div>
      )}
      {(viewMode === 'subject' || viewMode === 'faculty' || viewMode === 'room') && (
        <div className="grade-section" style={{ fontSize: `${13 * tableScale}px`, marginTop: `${4 * tableScale}px` }}>
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
  const [viewMode, setViewMode] = useState('class');
  const [selectedItem, setSelectedItem] = useState(null);
  const [email, setEmail] = useState(userEmail);
  const [educatorFound, setEducatorFound] = useState(false);
  const [editMode, setEditMode] = useState('none'); // 'none', 'drag', 'details'
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [activeTab, setActiveTab] = useState('single');
  const [editingSlotId, setEditingSlotId] = useState(null);
  const [editedRoom, setEditedRoom] = useState('');
  const [editedFaculty, setEditedFaculty] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [tableScale, setTableScale] = useState(1); // State for timetable appearance
  const [isFullScreen, setIsFullScreen] = useState(false); // State for full-screen mode

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const isMountedRef = useRef(true);

  // Define educator early
  const educator = useMemo(() => {
    if (!timetableData || !timetableData.faculty || !email) return null;
    return timetableData.faculty.find(f => f.mail.toLowerCase() === email.toLowerCase());
  }, [timetableData, email]);

  const addNotification = useCallback((message) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message }]);
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const Notification = ({ id, message }) => (
    <div className="notification">
      <span>{message}</span>
      <button onClick={() => removeNotification(id)} aria-label="Dismiss Notification">
        ×
      </button>
    </div>
  );

  // Toggle full-screen mode
  const toggleFullScreen = useCallback(() => {
    setIsFullScreen((prev) => !prev);
  }, []);

  // Utility functions
  const findSubjectByCode = useCallback((subjectCode) => {
    if (!timetableData || !timetableData.subjects) return null;
    return timetableData.subjects.find(s => s.code === subjectCode);
  }, [timetableData]);

  const findFacultyById = useCallback((facultyId) => {
    if (!timetableData || !timetableData.faculty) return null;
    return timetableData.faculty.find(f => f.id === facultyId);
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

  const getAvailableResources = useCallback((day, timeSlot, currentGradeSection) => {
    if (!timetableData || !timetableData.generationResults || !timetableData.generationResults[0]) {
      return { availableRooms: [], availableFaculty: [] };
    }

    const schedules = timetableData.generationResults[0].schedules;
    const allRooms = timetableData.classes || [];
    const allFaculty = timetableData.faculty || [];

    const occupiedRooms = new Set();
    const occupiedFaculty = new Set();

    Object.keys(schedules).forEach(gradeSection => {
      if (gradeSection === currentGradeSection) return;
      const daySchedule = schedules[gradeSection][day];
      if (daySchedule) {
        daySchedule.forEach(slot => {
          if (slot.timeSlot === timeSlot) {
            if (slot.room) occupiedRooms.add(slot.room);
            if (slot.faculty) occupiedFaculty.add(slot.faculty);
          }
        });
      }
    });

    const availableRooms = allRooms.filter(room => !occupiedRooms.has(room.room));
    const availableFaculty = allFaculty.filter(fac => !occupiedFaculty.has(fac.id));

    return { availableRooms, availableFaculty };
  }, [timetableData]);

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

  const getFlatSchedule = useCallback((schedule) => {
    if (!schedule) {
      return {
        flatSchedule: [],
        days: [],
        uniqueTimeSlots: [],
        slotLookup: {},
      };
    }

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const timeSlotsWithStart = timetableData?.timeSlots?.map(slot => ({
      timeSlot: `${slot.startTime}-${slot.endTime}`,
      startTime: slot.startTime,
    })) || [{ timeSlot: '08:30-09:30', startTime: '08:30' }];

    const uniqueTimeSlotsMap = new Map(timeSlotsWithStart.map(slot => [slot.timeSlot, slot]));
    const uniqueTimeSlotsWithStart = Array.from(uniqueTimeSlotsMap.values());

    uniqueTimeSlotsWithStart.sort((a, b) => {
      const timeA = a.startTime.split(':').map(Number);
      const timeB = b.startTime.split(':').map(Number);
      return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
    });

    const uniqueTimeSlots = uniqueTimeSlotsWithStart.map(slot => slot.timeSlot);

    const flatSchedule = [];
    const slotLookup = {};

    days.forEach(day => {
      slotLookup[day] = {};
      uniqueTimeSlots.forEach((timeSlot, tsIndex) => {
        slotLookup[day][timeSlot] = [];
        const slots = schedule[day]?.filter(slot => `${slot.timeSlot}` === timeSlot) || [];

        // Filter slots to ensure only one entry per time slot
        let selectedSlot = null;
        const classSlots = slots.filter(slot => !isFreePeriod(slot));
        if (classSlots.length > 0) {
          // If there are class slots, pick the first one (prefer classes over Free Periods)
          selectedSlot = classSlots[0];
        } else if (slots.length > 0) {
          // If no class slots but there are slots (e.g., Free Period), pick the first one
          selectedSlot = slots[0];
        }

        if (selectedSlot) {
          flatSchedule.push({
            ...selectedSlot,
            day,
            timeSlot,
            id: `${day}-${timeSlot}-0`,
            isEmpty: false,
          });
          slotLookup[day][timeSlot].push({
            ...selectedSlot,
            day,
            timeSlot,
            id: `${day}-${timeSlot}-0`,
            isEmpty: false,
          });
        } else {
          // If no slot exists, add a placeholder (empty slot)
          flatSchedule.push({
            day,
            timeSlot,
            id: `${day}-${timeSlot}-empty-${tsIndex}`,
            isEmpty: true,
            subject: 'Free Period',
            faculty: null,
            room: null,
            gradeSection: null,
          });
          slotLookup[day][timeSlot].push({
            day,
            timeSlot,
            id: `${day}-${timeSlot}-empty-${tsIndex}`,
            isEmpty: true,
            subject: 'Free Period',
            faculty: null,
            room: null,
            gradeSection: null,
          });
        }
      });
    });

    return { flatSchedule, days, uniqueTimeSlots, slotLookup };
  }, [timetableData]);

  // Define schedule and flatSchedule
  const schedule = activeTab === 'single' ? getScheduleForItem(selectedItem) : null;
  const { flatSchedule, days, uniqueTimeSlots, slotLookup } = useMemo(() => {
    if (!schedule) {
      return { flatSchedule: [], days: [], uniqueTimeSlots: [], slotLookup: {} };
    }
    return getFlatSchedule(schedule);
  }, [schedule, getFlatSchedule]);

  const allSchedules = useMemo(() => getAllSchedules(), [getAllSchedules]);

  // Handler functions
  const handleEditSlot = useCallback((slotId, currentRoom, currentFaculty) => {
    setEditingSlotId(slotId);
    setEditedRoom(currentRoom || '');
    setEditedFaculty(currentFaculty || '');
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingSlotId(null);
    setEditedRoom('');
    setEditedFaculty('');
  }, []);

  const handleSlotUpdate = useCallback((slotId) => {
    const slotIndex = flatSchedule.findIndex(slot => slot.id === slotId);
    if (slotIndex === -1) {
      addNotification('Slot not found.');
      return;
    }

    const slot = flatSchedule[slotIndex];
    if (slot.isEmpty || isFreePeriod(slot)) {
      addNotification('Cannot edit empty or free period slots.');
      return;
    }

    if (!editedRoom && !editedFaculty) {
      addNotification('Please select a room or faculty to update.');
      return;
    }

    const subject = findSubjectByCode(slot.subject);
    if (editedFaculty && subject && !subject.facultyIds.includes(editedFaculty)) {
      addNotification('Selected faculty is not assigned to this subject.');
      return;
    }

    const updatedSchedules = { ...timetableData.generationResults[0].schedules };
    const gradeSection = slot.gradeSection || selectedItem;
    const day = slot.day;

    if (!updatedSchedules[gradeSection] || !updatedSchedules[gradeSection][day]) {
      addNotification('Invalid schedule data.');
      return;
    }

    const slotInSchedule = updatedSchedules[gradeSection][day].find(
      s => s.timeSlot === slot.timeSlot && s.subject === slot.subject
    );

    if (slotInSchedule) {
      slotInSchedule.room = editedRoom || slotInSchedule.room;
      slotInSchedule.faculty = editedFaculty || slotInSchedule.faculty;
    } else {
      addNotification('Slot not found in schedule.');
      return;
    }

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
    setHasChanges(true);
    setEditingSlotId(null);
    setEditedRoom('');
    setEditedFaculty('');
  }, [flatSchedule, timetableData, selectedItem, editedRoom, editedFaculty, findSubjectByCode, addNotification]);

  const handleDragStart = useCallback(({ active }) => {
    setActiveId(active.id);
  }, []);

  const handleDragOver = useCallback(({ over }) => {
    setOverId(over?.id || null);
  }, []);

  const handleDragEnd = useCallback(async ({ active, over }) => {
    if (editMode !== 'drag' || !active || !over || active.id === over.id) {
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

    if (activeItem.isEmpty && !isFreePeriod(activeItem)) {
      setActiveId(null);
      setOverId(null);
      return;
    }

    const currentGradeSection = activeItem.gradeSection || selectedItem;
    const targetDay = overItem.day;
    const targetTimeSlot = overItem.timeSlot;
    const { availableRooms, availableFaculty } = getAvailableResources(targetDay, targetTimeSlot, currentGradeSection);

    if (activeItem.room && !availableRooms.some(room => room.room === activeItem.room)) {
      addNotification(`Cannot drag: Room ${activeItem.room} is occupied at ${targetDay} ${targetTimeSlot}`);
      setActiveId(null);
      setOverId(null);
      return;
    }

    if (activeItem.faculty && !availableFaculty.some(fac => fac.id === activeItem.faculty)) {
      addNotification(`Cannot drag: Faculty ${findFacultyById(activeItem.faculty)?.name || activeItem.faculty} is busy at ${targetDay} ${targetTimeSlot}`);
      setActiveId(null);
      setOverId(null);
      return;
    }

    if (overItem.room && !isFreePeriod(overItem)) {
      const overGradeSection = overItem.gradeSection || selectedItem;
      const { availableRooms: activeAvailableRooms } = getAvailableResources(activeItem.day, activeItem.timeSlot, overGradeSection);
      if (!activeAvailableRooms.some(room => room.room === overItem.room)) {
        addNotification(`Cannot drag: Room ${overItem.room} is occupied at ${activeItem.day} ${activeItem.timeSlot}`);
        setActiveId(null);
        setOverId(null);
        return;
      }
    }

    if (overItem.faculty && !isFreePeriod(overItem)) {
      const overGradeSection = overItem.gradeSection || selectedItem;
      const { availableFaculty: activeAvailableFaculty } = getAvailableResources(activeItem.day, activeItem.timeSlot, overGradeSection);
      if (!activeAvailableFaculty.some(fac => fac.id === overItem.faculty)) {
        addNotification(`Cannot drag: Faculty ${findFacultyById(overItem.faculty)?.name || overItem.faculty} is busy at ${activeItem.day} ${activeItem.timeSlot}`);
        setActiveId(null);
        setOverId(null);
        return;
      }
    }

    const newFlatSchedule = [...flatSchedule];
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
    setHasChanges(true);

    setActiveId(null);
    setOverId(null);
  }, [editMode, flatSchedule, timetableData, selectedItem, getAvailableResources, addNotification]);

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;

    try {
      const updateData = {
        generationResults: timetableData.generationResults,
      };

      const response = await axios.patch(
        `${API_BASE_URL}/all/update/timetables/${id}`,
        updateData
      );

      if (response.status === 200) {
        setHasChanges(false);
        addNotification('Timetable updated successfully.');
        console.log('Timetable updated successfully on the server');
      } else {
        throw new Error('Failed to update timetable on the server');
      }
    } catch (error) {
      console.error('Error saving timetable:', error);
      addNotification('Failed to save changes to the server. Please try again.');
    }
  }, [hasChanges, timetableData, id, addNotification]);

  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
    setEditingSlotId(null);
    setActiveId(null);
    setOverId(null);
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
        setSelectedItem(null);
      }
    } else {
      setSelectedItem(null);
    }
    setActiveTab('single');
  }, [timetableData]);

  const exportToCSV = useCallback(() => {
    if (!timetableData) return;

    let csvContent = '';
    if (activeTab === 'single' && selectedItem) {
      const schedule = getScheduleForItem(selectedItem);
      if (!schedule) return;

      const { days, uniqueTimeSlots } = getFlatSchedule(schedule);
      csvContent = 'Day,' + uniqueTimeSlots.join(',') + '\n';

      days.forEach((day) => {
        let row = [day];
        uniqueTimeSlots.forEach((timeSlot) => {
          const slots = schedule[day]?.filter((slot) => slot.timeSlot === timeSlot) || [];
          if (slots.length > 0) {
            const slot = slots[0];
            if (isFreePeriod(slot)) {
              row.push('Free Period');
            } else {
              const subject = findSubjectByCode(slot.subject)?.subject || slot.subject;
              const faculty = findFacultyById(slot.faculty)?.name || slot.faculty || '-';
              const room = slot.room || '-';
              const gradeSection = slot.gradeSection || '-';
              row.push(`${subject} (${faculty}, Room: ${room}, ${gradeSection})`);
            }
          } else {
            row.push('-');
          }
        });
        csvContent += row.map((cell) => `"${cell}"`).join(',') + '\n';
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `timetable_${selectedItem}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // All View Mode
      allSchedules.forEach(({ id, name, schedule }, index) => {
        const { days, uniqueTimeSlots } = getFlatSchedule(schedule);
        csvContent += `"Timetable for ${name}"\n`;
        csvContent += 'Day,' + uniqueTimeSlots.join(',') + '\n';

        days.forEach((day) => {
          let row = [day];
          uniqueTimeSlots.forEach((timeSlot) => {
            const slots = schedule[day]?.filter((slot) => slot.timeSlot === timeSlot) || [];
            if (slots.length > 0) {
              const slot = slots[0];
              if (isFreePeriod(slot)) {
                row.push('Free Period');
              } else {
                const subject = findSubjectByCode(slot.subject)?.subject || slot.subject;
                const faculty = findFacultyById(slot.faculty)?.name || slot.faculty || '-';
                const room = slot.room || '-';
                const gradeSection = slot.gradeSection || '-';
                row.push(`${subject} (${faculty}, Room: ${room}, ${gradeSection})`);
              }
            } else {
              row.push('-');
            }
          });
          csvContent += row.map((cell) => `"${cell}"`).join(',') + '\n';
        });
        if (index < allSchedules.length - 1) {
          csvContent += '\n';
        }
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `timetable_all_${viewMode}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  }, [timetableData, activeTab, selectedItem, allSchedules, viewMode, getScheduleForItem, getFlatSchedule, findSubjectByCode, findFacultyById]);

  const exportToPDF = useCallback(() => {
    if (!timetableData) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const date = new Date().toLocaleDateString();

    const generateTable = (schedule, title, startY) => {
      const { days, uniqueTimeSlots } = getFlatSchedule(schedule);
      if (!days.length || !uniqueTimeSlots.length) return startY;

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(title, pageWidth / 2, startY, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on: ${date}`, pageWidth - 10, startY, { align: 'right' });

      // Table
      const tableData = days.map((day) => {
        const row = [day];
        uniqueTimeSlots.forEach((timeSlot) => {
          const slots = schedule[day]?.filter((slot) => slot.timeSlot === timeSlot) || [];
          if (slots.length > 0) {
            const slot = slots[0];
            if (isFreePeriod(slot)) {
              row.push('Free Period');
            } else {
              const subject = findSubjectByCode(slot.subject)?.subject || slot.subject || '-';
              const faculty = findFacultyById(slot.faculty)?.name || slot.faculty || '-';
              const room = slot.room || '-';
              const gradeSection = slot.gradeSection || '-';
              row.push(`${subject}\n${faculty}\nRoom: ${room}\n${gradeSection}`);
            }
          } else {
            row.push('-');
          }
        });
        return row;
      });

      autoTable(doc, {
        startY: startY + 10,
        head: [['Day', ...uniqueTimeSlots]],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 9,
          cellPadding: 3,
          minCellHeight: 20,
          valign: 'middle',
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 30 },
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
      });

      return doc.lastAutoTable.finalY + 10;
    };

    try {
      if (activeTab === 'single' && selectedItem) {
        const schedule = getScheduleForItem(selectedItem);
        if (!schedule) return;

        const title = educator
          ? `Timetable for ${educator.name || 'Educator'}`
          : viewMode === 'class'
          ? `Timetable for ${selectedItem}`
          : viewMode === 'subject'
          ? `Timetable for ${findSubjectByCode(selectedItem)?.subject || selectedItem}`
          : viewMode === 'faculty'
          ? `Timetable for ${findFacultyById(selectedItem)?.name || selectedItem}`
          : `Timetable for Room ${selectedItem}`;

        generateTable(schedule, title, 15);
        doc.save(`timetable_${selectedItem}.pdf`);
      } else {
        // All View Mode
        allSchedules.forEach(({ id, name, schedule }, index) => {
          if (index > 0) {
            doc.addPage();
          }
          generateTable(schedule, `Timetable for ${name}`, 15);
        });

        doc.save(`timetable_all_${viewMode}.pdf`);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      addNotification('Failed to export PDF. Please try again.');
    }
  }, [timetableData, activeTab, selectedItem, allSchedules, viewMode, educator, getScheduleForItem, getFlatSchedule, findSubjectByCode, findFacultyById, addNotification]);

  const handleIncreaseSize = useCallback(() => {
    setTableScale((prev) => Math.min(prev + 0.1, 1.2)); // Max scale: 1.2
  }, []);

  const handleDecreaseSize = useCallback(() => {
    setTableScale((prev) => Math.max(prev - 0.1, 0.8)); // Min scale: 0.8
  }, []);

  const renderTimetableGrid = useCallback((scheduleData) => {
    const { schedule, identifier } = scheduleData;
    const { flatSchedule, days, uniqueTimeSlots, slotLookup } = getFlatSchedule(schedule);

    if (!schedule) {
      return <div className="empty-schedule">No schedule data available for {identifier}</div>;
    }

    if (days.length === 0) {
      return <div className="empty-schedule">No schedule data available for {identifier}</div>;
    }

    const activeItem = flatSchedule.find(slot => slot.id === activeId);

    return (
      <div className={`timetable-grid ${editMode === 'drag' ? 'drag-mode' : ''}`}>
        <table style={{ fontSize: `${14 * tableScale}px` }}>
          <thead>
            <tr>
              <th style={{ padding: `${12 * tableScale}px`, fontSize: `${14 * tableScale}px`, width: `${120 * tableScale}px` }}>Day</th>
              {uniqueTimeSlots.map((timeSlot, index) => (
                <th key={`header-${index}`} style={{ padding: `${12 * tableScale}px`, fontSize: `${14 * tableScale}px`, minWidth: `${100 * tableScale}px` }}>{timeSlot}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map(day => (
              <tr key={day} style={{ minHeight: `${140 * tableScale}px` }}>
                <td className="day-cell" style={{ padding: `${12 * tableScale}px`, fontSize: `${14 * tableScale}px`, width: `${120 * tableScale}px` }}>{day}</td>
                {uniqueTimeSlots.map((timeSlot, tsIndex) => {
                  const slots = slotLookup[day][timeSlot];
                  return (
                    <td key={`${day}-${timeSlot}-${tsIndex}`} data-day={day} data-time-slot={timeSlot} className="class-cell" style={{ minHeight: `${140 * tableScale}px`, padding: `${8 * tableScale}px`, minWidth: `${100 * tableScale}px` }}>
                      {editMode === 'drag' ? (
                        <SortableContext items={slots.map(slot => slot.id)}>
                          {slots.map((item, index) => {
                            const subject = findSubjectByCode(item.subject);
                            const faculty = findFacultyById(item.faculty);
                            const isOver = overId === item.id;
                            const isEditing = editingSlotId === item.id;
                            const { availableRooms, availableFaculty } = isEditing
                              ? getAvailableResources(item.day, item.timeSlot, item.gradeSection || selectedItem)
                              : { availableRooms: timetableData?.classes || [], availableFaculty: timetableData?.faculty || [] };
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
                                isEditing={isEditing}
                                editMode={editMode}
                                onEdit={() => handleEditSlot(item.id, item.room, item.faculty)}
                                onUpdate={() => handleSlotUpdate(item.id)}
                                onCancel={handleCancelEdit}
                                editedRoom={editedRoom}
                                setEditedRoom={setEditedRoom}
                                editedFaculty={editedFaculty}
                                setEditedFaculty={setEditedFaculty}
                                availableRooms={availableRooms}
                                availableFaculty={availableFaculty}
                                tableScale={tableScale}
                              />
                            );
                          })}
                        </SortableContext>
                      ) : (
                        slots.map((item, index) => {
                          const subject = findSubjectByCode(item.subject);
                          const faculty = findFacultyById(item.faculty);
                          const isEditing = editingSlotId === item.id;
                          const { availableRooms, availableFaculty } = isEditing
                            ? getAvailableResources(item.day, item.timeSlot, item.gradeSection || selectedItem)
                            : { availableRooms: timetableData?.classes || [], availableFaculty: timetableData?.faculty || [] };
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
                              isOver={false}
                              isEditing={isEditing}
                              editMode={editMode}
                              onEdit={() => handleEditSlot(item.id, item.room, item.faculty)}
                              onUpdate={() => handleSlotUpdate(item.id)}
                              onCancel={handleCancelEdit}
                              editedRoom={editedRoom}
                              setEditedRoom={setEditedRoom}
                              editedFaculty={editedFaculty}
                              setEditedFaculty={setEditedFaculty}
                              availableRooms={availableRooms}
                              availableFaculty={availableFaculty}
                              tableScale={tableScale}
                            />
                          );
                        })
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {activeItem && editMode === 'drag' && (
          <DragOverlay>
            <DraggedItemOverlay
              item={activeItem}
              viewMode={viewMode}
              subject={findSubjectByCode(activeItem.subject)}
              faculty={findFacultyById(activeItem.faculty)}
              isEmpty={activeItem.isEmpty}
              tableScale={tableScale}
            />
          </DragOverlay>
        )}
      </div>
    );
  }, [editMode, viewMode, activeId, overId, editingSlotId, editedRoom, editedFaculty, findSubjectByCode, findFacultyById, getFlatSchedule, handleEditSlot, handleSlotUpdate, handleCancelEdit, timetableData, selectedItem, getAvailableResources, tableScale]);

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
        addNotification('Project ID not found');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/all/timetables/${id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch timetable data');
        }

        const data = await response.json();

        if (!data || !data.generationResults || !Array.isArray(data.generationResults)) {
          throw new Error('Invalid timetable data structure');
        }

        if (isMountedRef.current) {
          setTimetableData(data);
          setLoading(false);

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
          const delay = (4 - retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
          return fetchTimetableData(retryCount - 1);
        }
        if (isMountedRef.current) {
          addNotification('Error loading timetable data');
          setLoading(false);
        }
      }
    };

    fetchTimetableData();
  }, [id, email, addNotification]);

  useEffect(() => {
    console.log('TimetableViewer: Updated logged-in user email (from prop):', userEmail);
    if (userEmail && !email) {
      setEmail(userEmail);
    }
  }, [userEmail]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (isFullScreen) {
          setIsFullScreen(false);
        } else if (activeId || editingSlotId) {
          setActiveId(null);
          setOverId(null);
          setEditingSlotId(null);
          setEditedRoom('');
          setEditedFaculty('');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeId, editingSlotId, isFullScreen]);

  if (loading) return <div className="loading">Loading timetable data...</div>;
  if (!timetableData) return <div className="error">Timetable not found</div>;

  return (
    <div className={`timetable-viewer ${isFullScreen ? 'full-screen' : ''}`}>
      {!isFullScreen && (
        <div className="viewer-header">
          <h2>Timetable Viewer</h2>
          {!educator && (
            <div className="header-controls">
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
              <div className="tab-selector">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={activeTab === 'all'}
                    onChange={() => setActiveTab(activeTab === 'single' ? 'all' : 'single')}
                  />
                  <span className="slider">
                    <span className="toggle-label single">Single</span>
                    <span className="toggle-label all">All</span>
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={`viewer-content ${isFullScreen ? 'full-screen-content' : ''}`}>
        {!isFullScreen && !educator && (
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

        <div className={`timetable-display ${isFullScreen ? 'full-screen-display' : ''}`}>
          <div className="notifications">
            {notifications.map((notification) => (
              <Notification
                key={notification.id}
                id={notification.id}
                message={notification.message}
              />
            ))}
          </div>
          <div className="timetable-controls">
            <div className="action-buttons">
              <div className="edit-controls">
                <button
                  className={editMode === 'drag' ? 'edit-mode-button disable' : 'edit-mode-button enable'}
                  onClick={() => setEditMode(editMode === 'drag' ? 'none' : 'drag')}
                  disabled={editMode === 'details'}
                >
                  {editMode === 'drag' ? 'Exit Drag Mode' : 'Enter Drag Mode'}
                </button>
                <button
                  className={editMode === 'details' ? 'edit-mode-button disable' : 'edit-mode-button enable'}
                  onClick={() => setEditMode(editMode === 'details' ? 'none' : 'details')}
                  disabled={editMode === 'drag'}
                >
                  {editMode === 'details' ? 'Exit Edit Details' : 'Edit Details'}
                </button>
                {hasChanges && (
                  <button className="save-button" onClick={handleSave}>
                    Save Changes
                  </button>
                )}
              </div>
              <div className="display-controls">
                <div className="size-controls">
                  <button
                    className="size-button"
                    onClick={handleDecreaseSize}
                    aria-label="Decrease timetable size"
                    disabled={tableScale <= 0.8}
                  >
                    -
                  </button>
                  <button
                    className="size-button"
                    onClick={handleIncreaseSize}
                    aria-label="Increase timetable size"
                    disabled={tableScale >= 1.2}
                  >
                    +
                  </button>
                </div>
                <div className="export-buttons">
                  <button className="export-button csv" onClick={exportToCSV}>
                    <span className="export-icon">📄</span> CSV
                  </button>
                  <button className="export-button pdf" onClick={exportToPDF}>
                    <span className="export-icon">📝</span> PDF
                  </button>
                </div>
                <button
                  className="fullscreen-button"
                  onClick={toggleFullScreen}
                  aria-label={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
                >
                  {isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
                </button>
              </div>
            </div>
          </div>
          {activeTab === 'single' ? (
            selectedItem ? (
              <>
                {!isFullScreen && (
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
                )}
                {editMode === 'drag' ? (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={rectIntersection}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                  >
                    {renderTimetableGrid({ schedule, identifier: selectedItem })}
                  </DndContext>
                ) : (
                  renderTimetableGrid({ schedule, identifier: selectedItem })
                )}
              </>
            ) : (
              <div className="empty-schedule">Please select an item to view its timetable.</div>
            )
          ) : (
            <div className="all-timetables">
              {allSchedules.map(scheduleData => (
                <div key={scheduleData.id} className="timetable-section">
                  {!isFullScreen && <h4>{scheduleData.name}</h4>}
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