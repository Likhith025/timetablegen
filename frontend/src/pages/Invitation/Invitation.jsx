import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Invitation.css';
import API_BASE_URL from '../../src';

const Invitation = () => {
  const { timetableId, token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleResponse = async (response) => {
    setLoading(true);
    setError('');
    setStatus('');
    try {
      const res = await axios.post(`${API_BASE_URL}/all/timetable/invitation`, {
        timetableId,
        token,
        response,
      });
      setStatus(res.data.message);
      setTimeout(() => {
        navigate('/'); // Redirect to login or dashboard after 2 seconds
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h2 className="title">Timetable Invitation</h2>
      {loading && <p className="loading">Processing...</p>}
      {status && <p className="success-message">{status}</p>}
      {error && <p className="error-message">{error}</p>}
      {!status && !error && (
        <>
          <p className="message">
            You have been invited to join a timetable. Please choose to accept or decline the invitation.
          </p>
          <div className="button-container">
            <button
              className="accept-button"
              onClick={() => handleResponse('agree')}
              disabled={loading}
            >
              Accept
            </button>
            <button
              className="decline-button"
              onClick={() => handleResponse('disagree')}
              disabled={loading}
            >
              Decline
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Invitation;