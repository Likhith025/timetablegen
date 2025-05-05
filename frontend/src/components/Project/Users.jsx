import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import './Users.css';

const Users = () => {
  const params = useParams();
  const location = useLocation();
  let timetableId = params.timetableId;

  // Fallback: Manually parse URL if useParams fails
  if (!timetableId) {
    const pathSegments = location.pathname.split('/');
    if (pathSegments.length >= 3 && pathSegments[1] === 'timetable') {
      timetableId = pathSegments[2];
    }
  }

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newUser, setNewUser] = useState({ email: '', role: 'educator' });
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ email: '', role: '' });
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Log debugging information
  useEffect(() => {
    console.log('Location:', location);
    console.log('Params from useParams:', params);
    console.log('Extracted timetableId:', timetableId);
    if (!timetableId) {
      setError('Timetable ID is missing from URL. Expected URL format: /timetable/68181de909e61cc4a8e7b24b');
      setLoading(false);
      return;
    }

    const fetchUsers = async () => {
      try {
        console.log('Fetching users for timetableId:', timetableId);
        const response = await axios.get(`http://localhost:5000/all/${timetableId}/users`);
        setUsers(response.data.data);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };
    fetchUsers();
  }, [timetableId, location]);

  // Handle adding a new user
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!timetableId) {
      setError('Cannot add user: Timetable ID is missing');
      return;
    }
    try {
      const response = await axios.post(`http://localhost:5000/all/${timetableId}/users`, newUser);
      setUsers([...users, response.data.data]);
      setNewUser({ email: '', role: 'educator' });
      setIsAddModalOpen(false);
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle editing a user
  const handleEditUser = (user) => {
    setEditingUser(user);
    setEditForm({
      email: user.email,
      role: user.role,
    });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!timetableId) {
      setError('Cannot update user: Timetable ID is missing');
      return;
    }
    try {
      const identifier = editingUser.userId || editingUser.email;
      const response = await axios.put(`http://localhost:5000/all/${timetableId}/users/${identifier}`, editForm);
      setUsers(users.map(u => (u.userId === editingUser.userId || u.email === editingUser.email ? response.data.data : u)));
      setEditingUser(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle removing a user
  const handleRemoveUser = async (identifier) => {
    if (!timetableId) {
      setError('Cannot remove user: Timetable ID is missing');
      return;
    }
    try {
      await axios.delete(`http://localhost:5000/all/${timetableId}/users/${identifier}`);
      setUsers(users.filter(u => u.userId !== identifier && u.email !== identifier));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="container">
      <h1>Timetable Users</h1>

      {/* Add User Button */}
      <div className="add-user-button-container">
        <button onClick={() => setIsAddModalOpen(true)} className="add-user-button">Add User</button>
      </div>

      {/* Add User Modal */}
      {isAddModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>Add New User</h2>
            <form onSubmit={handleAddUser}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  placeholder="Enter email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="educator">Educator</option>
                  <option value="faculty">Faculty</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="submit">Add User</button>
                <button type="button" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal">
          <div className="modal-content">
            <h2>Edit User</h2>
            <form onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  disabled={editForm.role === 'educator' || editForm.role === 'owner'}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="educator">Educator</option>
                  <option value="faculty">Faculty</option>
                  <option value="admin">Admin</option>
                  <option value="owner">Owner</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="submit">Update</button>
                <button type="button" onClick={() => setEditingUser(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.userId || user.email}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>
                  <button
                    onClick={() => handleEditUser(user)}
                    className="action-btn edit"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleRemoveUser(user.userId || user.email)}
                    className="action-btn remove"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Users;