import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import API_BASE_URL from '../../src';
import { assets } from '../../assets/assets.js';

const NewPassword = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email = location.state?.email || 'No email received';
  const otp = location.state?.otp || 'No OTP received';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e) => {
    e.preventDefault();

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
    <div className="bgsetup">
      <div className="logo">
        <img src={assets.logo} alt="Logo" />
      </div>
      <div className="loginpage">
        <div className="box1">
          <h1>New Password</h1>
          
          {/* Display Email and OTP */}
          <span><strong>Email:</strong> {email}</span>
          {/*<span><strong>OTP:</strong> {otp}</span>*/}

          {error && <p className="error">{error}</p>}
          <form onSubmit={handleResetPassword}>
            <div className="labeldiv">
              <p>New Password</p>
              <div className="password-container" style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Enter New Password"
                  className="label1"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <span
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer'
                  }}
                >
                  {showNewPassword ? '🙈' : '👁'}
                </span>
              </div>
            </div>

            <div className="labeldiv">
              <p>Confirm New Password</p>
              <div className="password-container" style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm New Password"
                  className="label1"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <span
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    cursor: 'pointer'
                  }}
                >
                  {showConfirmPassword ? '🙈' : '👁'}
                </span>
              </div>
            </div>

            <br />
            <button type="submit" className="button1" disabled={loading}>
              {loading ? 'Updating...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewPassword;
