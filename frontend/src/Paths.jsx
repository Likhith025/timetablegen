import React from 'react'
import { Routes, Route } from 'react-router-dom';
import './Button.css'
import './Global.css'
import './LogIn.css'
import './Input.css'


import Login from './pages/Login/Login';
import View from './pages/View';
import Loader from './components/Loader';
import Register from './pages/Login/Register';
import NewPassword from './pages/Login/NewPassword';
import OTpass from './pages/Login/OTpass';
import Dashboard from './pages/Dashboard/Dashboard';


const Paths = () => {
  return (
    <div>
      <Routes>

        <Route path='/' element={<Login/>}/>
        <Route path='/view' element={<View/>}/>
        <Route path='/loader' element={<Loader/>}/>
        <Route path='/register' element={<Register/>}/>
        <Route path='/newpassword' element={<NewPassword/>}/>  
        <Route path='/otp' element={<OTpass/>}/>

        <Route path='/dashboard' element={<Dashboard/>}/>       

      </Routes>
    </div>
  )
}

export default Paths
