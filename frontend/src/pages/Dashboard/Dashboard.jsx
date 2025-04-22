import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../../src';
import TopBar from '../../components/TopBar/TopBar';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [timetables, setTimetables] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    console.log('Dashboard: Mounted');
    const storedUser = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');
    console.log('Dashboard: Stored user:', storedUser);
    console.log('Dashboard: Stored token:', token ? 'Present' : 'Missing');

    if (storedUser && (storedUser.id || storedUser._id) && token) {
      const userId = storedUser.id || storedUser._id;
      console.log('Dashboard: Valid user and token, fetching projects for user ID:', userId);
      fetchProjects(userId, token);
    } else {
      console.log('Dashboard: No valid user or token, redirecting to login');
      navigate('/', { replace: true });
    }

    console.log('Dashboard: localStorage after check:', {
      user: localStorage.getItem('user'),
      token: localStorage.getItem('token') ? 'Present' : 'Missing',
    });

    const handleStorageChange = (e) => {
      if (e.key === 'token' || e.key === 'user') {
        console.log(`Dashboard: localStorage changed - ${e.key}: ${e.newValue || 'Removed'}`);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      console.log('Dashboard: Unmounting, localStorage state:', {
        user: localStorage.getItem('user'),
        token: localStorage.getItem('token') ? 'Present' : 'Missing',
      });
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [navigate]);

  const fetchProjects = async (userId, token) => {
    try {
      console.log('Dashboard: Fetching projects');
      const res = await fetch(`${API_BASE_URL}/all/user/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('Dashboard: API URL:', `${API_BASE_URL}/all/user/${userId}`);
      console.log('Dashboard: Response status:', res.status);

      if (!res.ok) {
        throw new Error(`Failed to fetch user data: ${res.statusText}`);
      }

      const userData = await res.json();
      console.log('Dashboard: User data:', userData);

      const fetchedTimetables = userData.timetables
        ?.filter(t => t.timetableId && t.timetableId._id && t.timetableId.projectName)
        .map(t => ({
          _id: t.timetableId._id,
          projectName: t.timetableId.projectName,
          role: t.role,
        })) || [];
      console.log('Dashboard: Processed timetables:', fetchedTimetables);
      setTimetables(fetchedTimetables);
    } catch (err) {
      console.error('Dashboard: Failed to load projects:', err);
      setError('Unable to load your projects. Please try again later.');
      setTimetables([]);
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
        {error && <p className="error-message">{error}</p>}
        {timetables.length === 0 && !error && (
          <p className="no-projects">No projects found. Create a new project to get started!</p>
        )}
        <div className="project-grid">
          {timetables.map((t) => (
            <div
              key={t._id}
              className="project-card"
              onClick={() => navigate(`/timetable/${t._id}`)}
            >
              <div className="project-name">{t.projectName}</div>
              <div className="project-role">{t.role}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;