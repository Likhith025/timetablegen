import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import API_BASE_URL from '../../src';
import TopBar from '../../components/TopBar/TopBar';
import './Dashboard.css'; // Make sure this is linked

const Dashboard = () => {
  const navigate = useNavigate();
  const [timetables, setTimetables] = useState([]);

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));
    if (storedUser && storedUser._id) {
      fetchProjects(storedUser._id);
    }
  }, []);

  const fetchProjects = async (userId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/all/user/${userId}`);
      const data = await res.json();
      setTimetables(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  };

  return (
    <div className="dashboard-wrapper">
      <TopBar />
      <div className="dashboard-content">
        <div className="dashboard-header">
          <h2>Your Projects</h2>
          <button onClick={() => navigate('/addproject')} className="add-project-btn">
            + Add Project
          </button>
        </div>
        <div className="project-grid">
          {timetables.map((t) => (
            <div
              key={t._id}
              className="project-card"
              onClick={() => navigate(`/timetable/${t._id}`)}
            >
              {t.projectName}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
