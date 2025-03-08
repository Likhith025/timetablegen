import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import API_BASE_URL from '../../src';
import TopBar from '../../components/TopBar/TopBar';

const Dashboard = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    console.log("Token from URL:", token);

    if (token) {
      localStorage.setItem('token', token);

      try {
        const decodedToken = jwtDecode(token);
        console.log("Decoded Token:", decodedToken);

        if (decodedToken.id) {
          setUserId(decodedToken.id);
          fetchUserDetails(decodedToken.id);
        } else {
          console.warn("Token is missing 'id' field.");
        }
      } catch (error) {
        console.error('Invalid token:', error);
      }

      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      const storedToken = localStorage.getItem('token');
      const storedUser = JSON.parse(localStorage.getItem('user'));

      if (storedToken) {
        try {
          const decodedToken = jwtDecode(storedToken);
          console.log("Decoded Stored Token:", decodedToken);

          if (decodedToken.id) {
            setUserId(decodedToken.id);
            fetchUserDetails(decodedToken.id);
          } else if (storedUser && storedUser._id) {
            setUserId(storedUser._id);
            setUserEmail(storedUser.email);
            setUserName(storedUser.name);
            setUserRole(storedUser.role);
          } else {
            console.warn("Stored user data is missing required fields.");
          }
        } catch (error) {
          console.error('Invalid stored token:', error);
        }
      } else {
        navigate('/');
      }
    }
  }, [navigate]);

  // Fetch user details from backend
  const fetchUserDetails = async (userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/user/get/${userId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch user data");
      }
      const userData = await response.json();
      console.log("Fetched User Data:", userData);

      setUserId(userData._id); // Set user ID
      setUserName(userData.name);
      setUserRole(userData.role);
      setUserEmail(userData.email);

      localStorage.setItem(
        'user',
        JSON.stringify({
          _id: userData._id, // Store _id
          email: userData.email,
          name: userData.name,
          role: userData.role,
        })
      );
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  };

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/'); // Redirect to login page
  };

  return (
    <div>
      <TopBar/>
      Welcome to Dashboard. We are still building
      {/*}
      <h1>Welcome, {userName || 'User'}!</h1>
      <h3>Your Role: {userRole || 'N/A'}</h3>
      <h3>Your Email: {userEmail || 'N/A'}</h3>
      <h3>Your ID: {userId || 'N/A'}</h3>
      <p>We are coming soon!</p>
      <button onClick={handleLogout} className="button1">
        Logout
      </button>
      <button onClick={() => navigate('/view')} className="button1">
        View all users
      </button>*/}
    </div>
  );
};

export default Dashboard;
