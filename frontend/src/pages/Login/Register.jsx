import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import API_BASE_URL from '../../src.js';
import {assets} from '../../assets/assets.js'

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [showOtpField, setShowOtpField] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();

  const handleSendOtp = async () => {
    if (!email) {
      setError('Please enter your email to receive OTP');
      return;
    }
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/user/regotp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to send OTP');
      }
      alert('OTP Sent to your email! Check your inbox.');
      setShowOtpField(true);
      setOtpSent(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    try {
      const response = await fetch(`${API_BASE_URL}/user/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, otp }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }
      alert('Registration Successful!');
      navigate('/login');
    } catch (err) {
      setError(err.message);
    }
  };

  // Google Signup using Redirect Flow
  const googleSignup = useGoogleLogin({
    flow: 'auth-code',
    ux_mode: 'redirect',
    redirect_uri: `${API_BASE_URL}/auth/google/callback`,
  });

  return (
    <div className="bgsetup">
    <div className="logo">
        <img src={assets.logo} alt="" />
    </div>
    <div className='loginpage'>
      <div className="box1">
        <h1>Register</h1>
        {error && <p className="error">{error}</p>}

        <div className="labeldiv">
          <p>Name</p>
          <input type="text" placeholder="Name" className='label1' value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="labeldiv">
          <p>Email Id</p>
          <input type="text" placeholder="Email Id" className='label1' value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        {/* Password Field */}
        <div className="labeldiv">
          <p>Password</p>
          <div className="password-container" style={{ position: 'relative' }}>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              className='label1' 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
            <span 
              onClick={() => setShowPassword(!showPassword)} 
              style={{
                position: 'absolute', 
                right: '10px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                cursor: 'pointer'
              }}
            >
              {showPassword ? '🙈' : '👁'}
            </span>
          </div>
        </div>

        {/* Confirm Password Field */}
        <div className="labeldiv">
          <p>Confirm Password</p>
          <div className="password-container" style={{ position: 'relative' }}>
            <input 
              type={showConfirmPassword ? "text" : "password"} 
              placeholder="Confirm Password" 
              className='label1' 
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

        {!showOtpField && <button className="button1" onClick={handleSendOtp} disabled={!email}>Get OTP</button>}
        {showOtpField && (
          <>
            <div className="labeldiv">
              <p>Enter OTP</p>
              <input type="text" placeholder="Enter OTP" className='label1' value={otp} onChange={(e) => setOtp(e.target.value)} />
            </div>
            {otpSent && (
              <p className="resend-otp">
                Didn't get OTP? 
                <a href="#" onClick={(e) => { e.preventDefault(); handleSendOtp(); }} style={{ marginLeft: '5px', color: 'blue', cursor: 'pointer' }}>Resend OTP</a>
              </p>
            )}
          </>
        )}
        <button className="button1" onClick={handleRegister}>Register</button>
        <span>Or</span>
        <button className="SignInWithGoogle" onClick={() => googleSignup()}>
          <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google Logo" className="glogo" style={{ width: '20px', height: '20px', marginRight: '8px' }} />
          Sign Up with Google
        </button>
        <span>Already have an Account? <a href="#" onClick={(e) => { e.preventDefault(); navigate('/'); }}>Log In</a></span>
      </div>
    </div>
    </div>
  );
};

export default Register;
