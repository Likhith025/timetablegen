import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';

const Dashboard = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      localStorage.setItem('token', token);

      try {
        const decodedToken = jwtDecode(token);
        if (decodedToken.name) {
          setUserName(decodedToken.name);
          localStorage.setItem('user', JSON.stringify({ name: decodedToken.name })); // Store user name
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
          if (decodedToken.name) {
            setUserName(decodedToken.name);
          } else if (storedUser && storedUser.name) {
            setUserName(storedUser.name);
          }
        } catch (error) {
          console.error('Invalid stored token:', error);
        }
      } else {
        navigate('/login');
      }
    }
  }, [navigate]);

  // Logout function
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/'); // Redirect to login page
  };

  return (
    <div>
      <h1>Welcome, {userName || 'User'}!</h1>
      <p>We are coming soon!</p>
      <button onClick={handleLogout} className='button1'>
        Logout
      </button>
      <button onClick={() => navigate('/view')} className='button1'>
        View all users
      </button>
    </div>
  );
};

export default Dashboard;
