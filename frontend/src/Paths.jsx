import React from 'react'
import { Routes, Route } from 'react-router-dom';
import './Button.css'
import './Global.css'
import './LogIn.css'
import './Input.css'


import Login from './pages/Login/Login';
import OTP from './pages/Login/OTP';
import View from './pages/View';


const Paths = () => {
  return (
    <div>
      <Routes>

        <Route path='/' element={<Login/>}/>
        <Route path='/otp' element={<OTP/>}/>
        <Route path='/view' element={<View/>}/>
      </Routes>
    </div>
  )
}

export default Paths
