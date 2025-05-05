import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import API_BASE_URL from '../../src'; // Adjust path as needed
import TimetableViewer from './TimetableViewer';
import ParametersView from './Parameters';
import Users from './Users';
import './ProjectSidebar.css';

const ProjectSidebar = () => {
  const [projectData, setProjectData] = useState(null);
  const [userInfo, setUserInfo] = useState({ userId: '', userName: '', userEmail: '', userRole: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('timetable');
  const { id } = useParams();

  useEffect(() => {
    console.log('ProjectSidebar: Mounted');
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserInfo({
          userId: decoded.id || '',
          userName: decoded.name || '',
          userEmail: decoded.email || '',
          userRole: decoded.role || '',
        });
      } catch (error) {
        console.error('ProjectSidebar: Error decoding token:', error);
      }
    }

    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserInfo((prev) => ({
          ...prev,
          userId: user._id || user.id || prev.userId,
          userName: user.name || prev.userName,
          userEmail: user.email || prev.userEmail,
          userRole: user.role || prev.userRole,
        }));
      } catch (error) {
        console.error('ProjectSidebar: Error parsing user from localStorage:', error);
      }
    }

    console.log('ProjectSidebar: User info:', userInfo);
  }, []);

  useEffect(() => {
    const fetchProjectData = async () => {
      if (!id) {
        setError('Project ID not found');
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/all/timetables/${id}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch project data');
        }

        const data = await response.json();
        console.log('ProjectSidebar: Fetched project data:', data);
        setProjectData(data);
      } catch (err) {
        console.error('ProjectSidebar: Error fetching project:', err);
        setError('Error loading project data');
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [id]);

  const updateProjectData = (newData) => {
    setProjectData(newData);
  };

  const getActiveClass = (view) => {
    return activeView === view ? 'sidebar-menu-item active' : 'sidebar-menu-item';
  };

  const isEducator =
    userInfo.userRole.toLowerCase() === 'educator' ||
    (projectData?.faculty?.some((f) => f.mail.toLowerCase() === userInfo.userEmail.toLowerCase()));

  const getUserProjectInfo = () => {
    if (!projectData || !userInfo.userId || !userInfo.userEmail) {
      return { name: userInfo.userName || 'Unknown', role: 'Unknown' };
    }
    if (projectData.createdBy?._id === userInfo.userId) {
      return { name: userInfo.userName || projectData.createdBy.name || 'Unknown', role: 'Owner' };
    }
    const facultyMatch = projectData.faculty?.find(
      (f) => f.mail.toLowerCase() === userInfo.userEmail.toLowerCase()
    );
    if (facultyMatch) {
      return { name: facultyMatch.name || userInfo.userName || 'Unknown', role: 'Educator' };
    }
    return { name: userInfo.userName || 'Unknown', role: 'Member' };
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'timetable':
        return <TimetableViewer projectId={id} userId={userInfo.userId} userRole={userInfo.userRole} />;
      case 'parameters':
        return (
          <ParametersView
            projectId={id}
            projectData={projectData}
            updateProjectData={updateProjectData}
          />
        );
      case 'user':
        return <Users />;
      default:
        return <TimetableViewer projectId={id} userId={userInfo.userId} userRole={userInfo.userRole} />;
    }
  };

  const { name: userProjectName, role: userProjectRole } = getUserProjectInfo();

  return (
    <div className="project-wrapper">
      <div className="sidebar-container">
        {loading ? (
          <div className="sidebar-loading">Loading project data...</div>
        ) : error ? (
          <div className="sidebar-error">{error}</div>
        ) : projectData ? (
          <>
            <div className="project-info">
              <h2 className="project-name">{projectData.projectName || 'Untitled Project'}</h2>
              <p className="created-by">
                Created by: {projectData.createdBy?.name || 'Unknown'}
              </p>
              <p className="user-info">
                You: {userProjectName} ({userProjectRole})
              </p>
            </div>

            <nav className="sidebar-menu">
              <div className={getActiveClass('timetable')} onClick={() => setActiveView('timetable')}>
                <span className="menu-icon">📅</span> Timetable
              </div>
              {!isEducator && (
                <div
                  className={getActiveClass('parameters')}
                  onClick={() => setActiveView('parameters')}
                >
                  <span className="menu-icon">⚙️</span> Parameters
                </div>
              )}
              {!isEducator && (
                <div
                  className={getActiveClass('user')}
                  onClick={() => setActiveView('user')}
                >
                  <span className="menu-icon">👤</span> User
                </div>
              )}
            </nav>
          </>
        ) : (
          <div className="sidebar-error">Project not found</div>
        )}
      </div>

      <div className="main-content">{renderActiveView()}</div>
    </div>
  );
};

export default ProjectSidebar;