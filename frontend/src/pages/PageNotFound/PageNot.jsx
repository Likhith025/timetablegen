import React from 'react'
import "./PageNotFound.css"
import { useNavigate } from 'react-router-dom'

const PageNot = () => {
  const navigate = useNavigate();
  return (
    <div className='pnf'>
      <h1>Page not found</h1>
      <button className='button1' onClick={()=>{navigate("/dashboard")}}>
        Go to Home
      </button>
    </div>
  )
}

export default PageNot
