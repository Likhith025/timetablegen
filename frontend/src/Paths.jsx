import React from 'react'
import { Routes, Route } from 'react-router-dom';

import Login from './pages/Login/Login';
import OTP from './pages/Login/OTP';


const Paths = () => {
  return (
    <div>
      <Routes>

        <Route path='/' element={<Login/>}/>
        <Route path='/otp' element={<OTP/>}/>
      </Routes>
    </div>
  )
}

export default Paths
