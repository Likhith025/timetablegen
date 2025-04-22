import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import API_BASE_URL from '../../src.js';
import {assets} from '../../assets/assets.js'

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Track password visibility
  const navigate = useNavigate();

  const googleLogin = useGoogleLogin({
    flow: 'auth-code',
    ux_mode: 'redirect',
    redirect_uri: `${API_BASE_URL}/auth/google/callback`,
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
  
    try {
      const response = await fetch(`${API_BASE_URL}/user/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
  
      const data = await response.json();
      console.log('Backend response:', data); // Log the response
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
  
      console.log('Saving token:', data.token); // Log the token
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
  
      navigate('/dashboard');
    } catch (err) {
      console.error('Login error:', err); // Log any errors
      setError(err.message);
    }
  };
  
  return (
<div 
  className="bgsetup" 
>
  <div className="logo">
    <img src={assets.logo} alt="" />
  </div>
    <div className='loginpage'>
      <div className="box1">
        <h1>Log In</h1>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleLogin}>
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
                {showPassword ? '🙈' : '👁'} {/* Eye Toggle Icon */}
              </span>
            </div>
            <a 
              href="#" 
              className="forgotpassword" 
              onClick={(e) => {
                e.preventDefault();
                navigate('/otp', { state: { email } });
              }}
            >
              Forgot Password?
            </a>
          </div>
          <br />
          <button type="submit" className="button1">Log In</button>
        </form>
        <p>Or</p>
        <button className="SignInWithGoogle" onClick={() => googleLogin()}> 
          <img 
            src="https://developers.google.com/identity/images/g-logo.png" 
            alt="Google Logo" 
            className="glogo"
            style={{ width: '20px', height: '20px', marginRight: '8px' }}
          />
          Sign In with Google
        </button>
        <p>
          Don't have an Account?{' '}
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              navigate('/register');
            }}
          >
            Register
          </a>
        </p>
      </div>
    </div>
    </div>
  );
};

export default Login;
