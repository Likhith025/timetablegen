import React from 'react';
import logo from '../assets/logo.png';

const View = () => {
  return (
    <div>
      <div className="export-buttons">
        <button className="csv-btn">Export as CSV</button>
        <button className="pdf-btn">Export as PDF</button>
        <button className="add-btn">Add</button>
        <button>Signin Button</button>
      </div>
      
      {/* Image with styles to bring it to the front */}
      <img 
        src={logo} 
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
