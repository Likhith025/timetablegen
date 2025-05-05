import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './BlockRoom.css';
import API_BASE_URL from '../../src';

const BlockRoom = ({ timetableId, userId }) => {
  const [formData, setFormData] = useState({
    timetableId,
    userId,
    purpose: '',
    date: '2025-05-01',
    timeSlot: '',
    classRoom: '',
    gradeSection: '',
  });
  const [blockRooms, setBlockRooms] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [classRooms, setClassRooms] = useState([]);
  const [grades, setGrades] = useState([]);
  const [emptyClassrooms, setEmptyClassrooms] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userRole, setUserRole] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('current');

  const CURRENT_DATE = new Date('2025-04-28');

  // Fetch initial data (timetable, block rooms, and user role)
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const timetableResponse = await axios.get(
          `${API_BASE_URL}/all/timetables/${timetableId}`
        );
        const timetable = timetableResponse.data || {};
        setTimeSlots(timetable.timeSlots || []);
        setClassRooms(timetable.classes || []);
        setGrades(timetable.grades || []);

        const blockRoomsResponse = await axios.get(
          `${API_BASE_URL}/all/br/${timetableId}`
        );
        setBlockRooms(blockRoomsResponse.data || []);

        const userResponse = await axios.get(
          `${API_BASE_URL}/all/user/${userId}`
        );
        setUserRole(userResponse.data.role);
      } catch (err) {
        setError('Failed to fetch initial data: ' + (err.response?.data?.message || err.message));
      }
    };
    if (timetableId && userId) {
      fetchInitialData();
    } else {
      setError('Timetable ID or User ID is missing');
    }
  }, [timetableId, userId]);

  // Fetch available time slots and classrooms based on date, gradeSection, and timeSlot
  useEffect(() => {
    const fetchAvailabilityData = async () => {
      if (formData.date && formData.gradeSection) {
        try {
          // Fetch available time slots for the selected date and grade-section
          const timeSlotsResponse = await axios.get(
            `${API_BASE_URL}/all/br/available-time-slots/${timetableId}?date=${formData.date}&gradeSection=${formData.gradeSection}`
          );
          const availableSlots = timeSlotsResponse.data.availableTimeSlots || [];
          setAvailableTimeSlots(availableSlots);
          if (availableSlots.length === 0) {
            setError('No time slots available for the selected date and grade-section');
            setFormData({ ...formData, timeSlot: '', classRoom: '' });
            setEmptyClassrooms([]);
            return;
          }

          // Fetch available classrooms only if a time slot is selected
          if (formData.timeSlot) {
            const classroomsResponse = await axios.get(
              `${API_BASE_URL}/all/br/available-slots/${timetableId}?date=${formData.date}&timeSlot=${formData.timeSlot}&gradeSection=${formData.gradeSection}`
            );
            const availableClassrooms = classroomsResponse.data.availableClassrooms || [];
            setEmptyClassrooms(availableClassrooms);
            if (availableClassrooms.length > 0 && !formData.classRoom) {
              setFormData({ ...formData, classRoom: availableClassrooms[0]._id });
            } else if (availableClassrooms.length === 0) {
              setError('No classrooms available for the selected date, time slot, and grade-section');
            }
          }
        } catch (err) {
          setError(err.response?.data?.message || 'Failed to fetch availability data');
        }
      } else {
        setAvailableTimeSlots([]);
        setEmptyClassrooms([]);
      }
    };
    fetchAvailabilityData();
  }, [formData.date, formData.gradeSection, formData.timeSlot, timetableId]);

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'date' || name === 'gradeSection') {
      setFormData({ ...formData, [name]: value, timeSlot: '', classRoom: '' });
      setAvailableTimeSlots([]);
      setEmptyClassrooms([]);
    } else if (name === 'timeSlot') {
      setFormData({ ...formData, [name]: value, classRoom: '' });
      setEmptyClassrooms([]);
    } else {
      setFormData({ ...formData, [name]: value });
    }
    setError('');
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!userId) {
      setError('User ID is required.');
      return;
    }
    try {
      if (editingId) {
        const response = await axios.put(`${API_BASE_URL}/all/br/${editingId}`, formData);
        setBlockRooms(
          blockRooms.map((room) =>
            room._id === editingId ? response.data.blockRoom : room
          )
        );
        setSuccess('Block room updated successfully');
      } else {
        const response = await axios.post(`${API_BASE_URL}/all/br/add`, formData);
        setBlockRooms([...blockRooms, response.data.blockRoom]);
        setSuccess('Block room created successfully');
      }
      closeModal();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save block room');
    }
  };

  // Handle edit
  const handleEdit = (room) => {
    setFormData({
      timetableId: room.timetableId._id || room.timetableId,
      userId: room.userId._id || room.userId,
      purpose: room.purpose,
      date: room.date.split('T')[0],
      timeSlot: room.timeSlot._id,
      classRoom: room.classRoom._id,
      gradeSection: room.gradeSection._id,
    });
    setEditingId(room._id);
    setIsModalOpen(true);
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this block room?')) {
      try {
        await axios.delete(`${API_BASE_URL}/all/br/${id}`);
        setBlockRooms(blockRooms.filter((room) => room._id !== id));
        setSuccess('Block room deleted successfully');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to delete block room');
      }
    }
  };

  // Open modal for adding
  const openAddModal = () => {
    setFormData({
      timetableId,
      userId,
      purpose: '',
      date: '2025-05-01',
      timeSlot: '',
      classRoom: '',
      gradeSection: '',
    });
    setEditingId(null);
    setIsModalOpen(true);
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({
      timetableId,
      userId,
      purpose: '',
      date: '2025-05-01',
      timeSlot: '',
      classRoom: '',
      gradeSection: '',
    });
    setError('');
    setAvailableTimeSlots([]);
    setEmptyClassrooms([]);
  };

  // Filter block rooms by date and role
  const filterBlockRoomsByDate = (rooms) => {
    const currentAndFuture = [];
    const past = [];

    rooms.forEach((room) => {
      const roomDate = new Date(room.date);
      if (roomDate >= CURRENT_DATE) {
        currentAndFuture.push(room);
      } else {
        past.push(room);
      }
    });

    return { currentAndFuture, past };
  };

  // Apply role and date filtering
  const roleFilteredRooms = userRole === 'educator'
    ? blockRooms.filter((room) => room.userId._id === userId || room.userId === userId)
    : blockRooms;
  const { currentAndFuture, past } = filterBlockRoomsByDate(roleFilteredRooms);
  const displayedRooms = activeTab === 'current' ? currentAndFuture : past;

  return (
    <div className="block-room-container">
      <h1 className="block-room-title">Block Room Management</h1>

      {/* Error and Success Messages */}
      {error && !isModalOpen && <div className="error-message">{error}</div>}
      {success && !isModalOpen && <div className="success-message">{success}</div>}

      {/* Tabs for Current/Future and Past */}
      <div className="tab-selector">
        <button
          className={`tab-button ${activeTab === 'current' ? 'active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          Current & Future
        </button>
        <button
          className={`tab-button ${activeTab === 'past' ? 'active' : ''}`}
          onClick={() => setActiveTab('past')}
        >
          Past (Ended)
        </button>
      </div>

      {/* Block Rooms Table */}
      <div className="block-rooms-table">
        <div className="table-header-section">
          <h2 className="section-title">
            {activeTab === 'current' ? 'Current & Future Blocked Rooms' : 'Past Blocked Rooms'}
          </h2>
          <button className="add-button" onClick={openAddModal}>
            Add Block Room
          </button>
        </div>
        {displayedRooms.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr className="table-header">
                  <th className="table-cell">Purpose</th>
                  <th className="table-cell">Date</th>
                  <th className="table-cell">Time Slot</th>
                  <th className="table-cell">Classroom</th>
                  <th className="table-cell">Grade-Section</th>
                  <th className="table-cell">User Name</th>
                  <th className="table-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedRooms.map((room) => (
                  <tr key={room._id} className="table-row">
                    <td className="table-cell">{room.purpose}</td>
                    <td className="table-cell">{room.date.split('T')[0]}</td>
                    <td className="table-cell">
                      {room.timeSlot.day} {room.timeSlot.startTime} - {room.timeSlot.endTime}
                    </td>
                    <td className="table-cell">
                      {room.classRoom.room} ({room.classRoom.building})
                    </td>
                    <td className="table-cell">
                      {room.gradeSection.grade}-{room.gradeSection.section}
                    </td>
                    <td className="table-cell">{room.userName || 'Unknown User'}</td>
                    <td className="table-cell">
                      <button onClick={() => handleEdit(room)} className="edit-button">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(room._id)} className="delete-button">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="no-data">
            {activeTab === 'current'
              ? 'No current or future block rooms found.'
              : 'No past block rooms found.'}
          </p>
        )}
      </div>

      {/* Empty Classrooms */}
      {formData.date && formData.timeSlot && !isModalOpen && (
        <div className="empty-classrooms">
          <h2 className="section-title">Empty Classrooms</h2>
          {emptyClassrooms.length > 0 ? (
            <ul className="classroom-list">
              {emptyClassrooms.map((room) => (
                <li key={room._id} className="classroom-item">
                  {room.room} ({room.building}, Capacity: {room.capacity})
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-data">No empty classrooms available for the selected date and time slot.</p>
          )}
        </div>
      )}

      {/* Modal for Add/Edit */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">{editingId ? 'Update Block Room' : 'Add Block Room'}</h2>
            {error && <div className="error-message">{error}</div>}
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-grid">
                {/* Purpose */}
                <div className="form-group">
                  <label className="form-label">Purpose</label>
                  <input
                    type="text"
                    name="purpose"
                    value={formData.purpose}
                    onChange={handleInputChange}
                    className="form-input"
                    required
                  />
                </div>
                {/* Date */}
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    className="form-input"
                    required
                  />
                </div>
                {/* Grade-Section */}
                <div className="form-group">
                  <label className="form-label">Grade-Section</label>
                  <select
                    name="gradeSection"
                    value={formData.gradeSection}
                    onChange={handleInputChange}
                    className="form-select"
                    required
                  >
                    <option value="">Select Grade-Section</option>
                    {grades.map((grade) => (
                      <option key={grade._id} value={grade._id}>
                        {grade.grade}-{grade.section}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Time Slot */}
                <div className="form-group">
                  <label className="form-label">Time Slot</label>
                  <select
                    name="timeSlot"
                    value={formData.timeSlot}
                    onChange={handleInputChange}
                    className="form-select"
                    required
                    disabled={!formData.date || !formData.gradeSection}
                  >
                    <option value="">Select Time Slot</option>
                    {availableTimeSlots.length > 0 ? (
                      availableTimeSlots.map((slot) => (
                        <option key={slot._id} value={slot._id}>
                          {slot.day} {slot.startTime} - {slot.endTime}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>No time slots available</option>
                    )}
                  </select>
                </div>
                {/* Classroom */}
                <div className="form-group">
                  <label className="form-label">Classroom</label>
                  <select
                    name="classRoom"
                    value={formData.classRoom}
                    onChange={handleInputChange}
                    className="form-select"
                    required
                    disabled={!formData.timeSlot}
                  >
                    <option value="">Select Classroom</option>
                    {emptyClassrooms.length > 0 ? (
                      emptyClassrooms.map((room) => (
                        <option key={room._id} value={room._id}>
                          {room.room} ({room.building})
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>No classrooms available</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="submit-button">
                  {editingId ? 'Update' : 'Add'} Block Room
                </button>
                <button type="button" onClick={closeModal} className="cancel-button">
                  {editingId ? 'Cancel' : 'Close'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockRoom;