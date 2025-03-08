import React from 'react';
import { Navigate } from 'react-router-dom';
import PageNot from './pages/PageNotFound/PageNot';

const ProtectedRoute = ({ element }) => {
  const storedUser = JSON.parse(localStorage.getItem('user'));

  if (!storedUser || storedUser.role !== 'admin') {
    return <PageNot />;
  }

  return <>{element}</>;
};

export default ProtectedRoute;
