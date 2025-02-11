import React from 'react';
import { Link } from 'react-router-dom';
import {assets} from '../assets/assets.js'

const View = () => {
  return (
    <div>
      <div className="export-buttons">
        <button className="csv-btn">Export as CSV</button>
        <button className="pdf-btn">Export as PDF</button>
        <button className="add-btn">Add</button>
        <button>Signin Button</button>
        <Link to="/">
        <button>Go Back</button>
        </Link>
      </div>

      <p>Champak Chutiye</p>
      
      {/* Image with styles to bring it to the front */}
      <img 
        src={assets.logo} 
        alt="Logo" 
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          width: '150px',
          height: '150px',
          zIndex: 9999
        }}
      />    </div>
  );
};

export default View;
