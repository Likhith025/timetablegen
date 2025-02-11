import React from 'react'
import { assets } from '../assets/assets'

const View = () => {
  return (
    <div>
        <div className="export-buttons">
      <button className="csv-btn">Export as CSV</button>
      <button className="pdf-btn">Export as PDF</button>
      <button className="add-btn">Add</button>
      <button >Signin Button</button>

    </div>
    <img src={assets.logo} alt="logo" />

    </div>
  )
}

export default View
