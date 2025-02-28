import React from 'react';
import { Link } from 'react-router-dom';

const Login = () => {
  return (
    <div className='loginpage'>
      <div className="box1">
        <h1>Log In</h1>
        
        <div className="labeldiv">
          <p>Email Id</p>
          <input type="text" placeholder="Email Id" className='label1'/>
        </div>

        <div className="labeldiv">
          <p>Password</p>
          <input type="password" placeholder="Password" className='label1'/>
          <a href="#" className='forgotpassword'>Forgot Password?</a>
        </div>
        <br />
        <button className="button1">Log In</button>

        <p>Or</p>

        <button className="SignInWithGoogle">
          <img 
            src="https://developers.google.com/identity/images/g-logo.png" 
            alt="Google Logo" 
            className="glogo"
            style={{ width: '20px', height: '20px', marginRight: '8px' }}
          />
          Sign In with Google
        </button>

        <p>Don't have an Account? <a href="#">Register</a></p>
      </div>
    </div>
  );
};

export default Login;
