import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API_BASE_URL from '../../src';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [showOtpField, setShowOtpField] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
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
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className='loginpage'>
      <div className="box1">
        <h1>Register</h1>

        {error && <p className="error">{error}</p>}

        <div className="labeldiv">
          <p>Name</p>
          <input 
            type="text" 
            placeholder="Name" 
            className='label1' 
            value={name} 
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="labeldiv">
          <p>Email Id</p>
          <input 
            type="text" 
            placeholder="Email Id" 
            className='label1' 
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="labeldiv">
          <p>Password</p>
          <input 
            type="password" 
            placeholder="Password" 
            className='label1' 
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="labeldiv">
          <p>Confirm Password</p>
          <input 
            type="password" 
            placeholder="Confirm Password" 
            className='label1' 
            value={confirmPassword} 
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>

        <div className="labeldiv">
  {!showOtpField && (
    <button className="button1" onClick={handleSendOtp} disabled={!email}>
      Get OTP
    </button>
  )}
</div>

        {showOtpField && (
          <>
            <div className="labeldiv">
              <p>Enter OTP</p>
              <input 
                type="text" 
                placeholder="Enter OTP" 
                className='label1' 
                value={otp} 
                onChange={(e) => setOtp(e.target.value)}
              />
            </div>

            {showOtpField && otpSent && (
  <p className="resend-otp">
    Didn't get OTP? 
    <a 
      href="#" 
      onClick={(e) => {
        e.preventDefault();
        handleSendOtp();
      }}
      style={{ marginLeft: '5px', color: 'blue', cursor: 'pointer' }}
    >
      Resend OTP
    </a>
  </p>
)}
          </>
        )}

        <br />
        <button className="button1" onClick={handleRegister}>
          Register
        </button>

        <p>Or</p>

        <button className="SignInWithGoogle">
          <img 
            src="https://developers.google.com/identity/images/g-logo.png" 
            alt="Google Logo" 
            className="glogo"
            style={{ width: '20px', height: '20px', marginRight: '8px' }}
          />
          Sign Up with Google
        </button>

        <p>Already have an Account? 
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
          >
            Log In
          </a>
        </p>
      </div>
    </div>
  );
};

export default Register;
