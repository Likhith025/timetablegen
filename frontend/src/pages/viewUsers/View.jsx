import React, { useEffect, useState } from 'react';
import axios from 'axios';
import API_BASE_URL from '../../src.js';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './View.css';
import Loader from '../../components/Loader.jsx';
import TopBar from '../../components/TopBar/TopBar.jsx';


const View = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editedRoles, setEditedRoles] = useState({});
  const [editMode, setEditMode] = useState({});

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/user/`);
        setUsers(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleEditClick = (id) => {
    setEditMode((prev) => ({ ...prev, [id]: true }));
  };

  const handleRoleChange = (id, newRole) => {
    setEditedRoles((prev) => ({ ...prev, [id]: newRole }));
  };

  const handleSubmit = async (id) => {
    const currentRole = users.find(user => user._id === id)?.role;
    
    if (!editedRoles[id] || editedRoles[id] === currentRole) {
      toast.info("No changes made.");
      setEditMode((prev) => ({ ...prev, [id]: false })); // Turn off edit mode
      return;
    }
  
    try {
      await axios.put(`${API_BASE_URL}/user/edit/${id}`, { role: editedRoles[id] });
      setUsers(users.map(user => user._id === id ? { ...user, role: editedRoles[id] } : user));
      setEditedRoles((prev) => ({ ...prev, [id]: undefined }));
      setEditMode((prev) => ({ ...prev, [id]: false }));
      toast.success("Role updated successfully!");
    } catch (err) {
      toast.error("Failed to update role");
    }
  };
  
  if (loading) return <p className="loading"><Loader/></p>;
  if (error) return <p className="error">Error: {error}</p>;

  return (
    <div>
    <TopBar/>
    <div className="container">
      <h1 className="title">Users List</h1>
      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Login Type</th>
            <th>Role</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user._id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.loginType}</td>
              <td>
                {editMode[user._id] ? (
                  <select
                    value={editedRoles[user._id] || user.role}
                    onChange={(e) => handleRoleChange(user._id, e.target.value)}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                ) : (
                  <span>{user.role}</span>
                )}
              </td>
              <td>
                {editMode[user._id] ? (
                  <button className="submit-btn" onClick={() => handleSubmit(user._id)}>Submit</button>
                ) : (
                  <button className="edit-btn" onClick={() => handleEditClick(user._id)}>Edit</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ToastContainer />
    </div>
    </div>
  );
};

export default View;
