import React from 'react'
import logo from '../assets/logo.png'

const View = () => {
  return (
    <div>
        <div className="export-buttons">
      <button className="csv-btn">Export as CSV</button>
      <button className="pdf-btn">Export as PDF</button>
      <button className="add-btn">Add</button>
      <button >Signin Button</button>

    </div>
      <img src={logo} alt="Data" />
    </div>
  )
}

export default View
