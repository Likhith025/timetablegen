import React from 'react'

const OTpass = () => {
  return (
    <div className='loginpage'>
    <div className="box1">
      <h1>Enter OTP</h1>
      
      <div className="labeldiv">
        <p>Email Id</p>
        <input type="text" placeholder="Email Id" className='label1'/>
      </div>

      <div className="labeldiv">
        <p>Enter OTP</p>
        <input type="number" placeholder="Enter OTP" className='label1'/>
        <p>Didn't recieve OTP?<a href="#">Resend</a></p>
      </div>
      <br />
      <button className="button1">Continue</button>
    </div>
  </div>
  )
}

export default OTpass