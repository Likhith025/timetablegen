import React from 'react'

const NewPassword = () => {
  return (
    <div className='loginpage'>
    <div className="box1">
      <h1>New Password</h1>
      
      <div className="labeldiv">
        <p>Enter New Password</p>
        <input type="password" placeholder="Enter New Password" className='label1'/>
      </div>

      <div className="labeldiv">
        <p>Confirm New Password</p>
        <input type="password" placeholder="Confirm New Password" className='label1'/>
      </div>
      <br />
      <button className="button1">Continue</button>
    </div>
  </div>
  )
}

export default NewPassword