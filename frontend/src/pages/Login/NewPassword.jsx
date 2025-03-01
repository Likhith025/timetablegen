import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import API_BASE_URL from '../../src'; // Ensure correct API URL import

const NewPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || 'No email received';
  const otp = location.state?.otp || 'No OTP received'; // Ensure OTP is passed from previous step

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setError('Please fill all fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/user/resetpass`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Password reset failed');
      }

      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='loginpage'>
      <div className="box1">
        <h1>New Password</h1>

        {/* Display OTP and Email */}
        <div className="info-box">
          <p><strong>Email:</strong> {email}</p>
          <p><strong>OTP:</strong> {otp}</p>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="labeldiv">
          <p>Enter New Password</p>
          <input 
            type="password" 
            placeholder="Enter New Password" 
            className='label1' 
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>

        <div className="labeldiv">
          <p>Confirm New Password</p>
          <input 
            type="password" 
            placeholder="Confirm New Password" 
            className='label1' 
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <br />
        <button 
          className="button1" 
          onClick={handleResetPassword} 
          disabled={loading}
        >
          {loading ? 'Updating...' : 'Continue'}
        </button>
      </div>
    </div>
  );
};

export default NewPassword;
