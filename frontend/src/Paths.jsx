import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './Button.css';
import './Global.css';
import './LogIn.css';
import './Input.css';

import Login from './pages/Login/Login';
import View from './pages/viewUsers/View';
import Loader from './components/Loader';
import Register from './pages/Login/Register';
import NewPassword from './pages/Login/NewPassword';
import OTpass from './pages/Login/OTpass';
import Dashboard from './pages/Dashboard/Dashboard';
import PageNot from './pages/PageNotFound/PageNot';
import ProtectedRoute from './ProtectedRoute.jsx';
import Profile from './pages/myProfile/Profile.jsx';

const Paths = () => {
  return (
    <GoogleOAuthProvider clientId="252303016884-ml8b3g00san0u75nuqtgf3ss8dr5kvkb.apps.googleusercontent.com">
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/view" element={<ProtectedRoute element={<View />} />} />
        <Route path="/loader" element={<Loader />} />
        <Route path="/register" element={<Register />} />
        <Route path="/newpassword" element={<NewPassword />} />
        <Route path="/otp" element={<OTpass />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<PageNot />} />
        <Route path="/profile" element={<Profile/>} />
      </Routes>
    </GoogleOAuthProvider>
  );
};

export default Paths;
