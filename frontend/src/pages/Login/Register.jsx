import React from 'react'

const Register = () => {
  return (
    <div className='loginpage'>
      <div className="box1">
        <h1>Register</h1>
        
        <div className="labeldiv">
          <p>Name</p>
          <input type="text" placeholder="Name" className='label1'/>
        </div>

        <div className="labeldiv">
          <p>Email Id</p>
          <input type="text" placeholder="Email Id" className='label1'/>
        </div>

        <div className="labeldiv">
          <p>Password</p>
          <input type="password" placeholder="Password" className='label1'/>
        </div>

        <div className="labeldiv">
          <p>Confirm Password</p>
          <input type="password" placeholder="Confirm Password" className='label1'/>
        </div>

        <br />
        <button className="button1">Register</button>

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

        <p>Already have an Account? <a href="#">Log In</a></p>
      </div>
    </div>
  );
};

export default Register