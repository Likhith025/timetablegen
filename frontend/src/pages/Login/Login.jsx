import React from 'react';
import { Link } from 'react-router-dom';

const Login = () => {
  return (
    <div>
      <h2>We are launching soon. Plaese wait</h2>
      <Link to="/view">
        <button>Go to View Page</button>
      </Link>
    </div>
  );
};

export default Login;
