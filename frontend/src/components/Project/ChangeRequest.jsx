import React, { useState, useEffect } from "react";
import API_BASE_URL from "../../src"; // Adjust path as needed
import "./ChangeRequest.css";

const ChangeRequests = ({ projectId, userId, userRole }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch change requests
  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/all/change-requests/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Failed to fetch change requests");
        }
        const data = await response.json();
        setRequests(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (projectId) {
      fetchRequests();
    } else {
      setError("Project ID is missing");
      setLoading(false);
    }
  }, [projectId]);

  // Handle approve/reject actions
  const handleAction = async (requestId, action) => {
    try {
      const token = localStorage.getItem("token");
      const endpoint = `${API_BASE_URL}/all/change-request/${action}/${requestId}`;
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${action} request`);
      }
      setRequests((prev) =>
        prev.map((req) =>
          req._id === requestId ? { ...req, status: action } : req
        )
      );
      setSuccess(`Request ${action}d successfully`);
      setTimeout(() => setSuccess(""), 3000); // Clear success message after 3s
    } catch (err) {
      setError(err.message);
    }
  };

  // Check if user is admin or owner
  const isAdminOrOwner = userRole === "admin" || userRole === "owner";

  if (loading) return <div className="loading">Loading change requests...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="change-requests-container">
      <h2 className="section-title">Change Requests</h2>
      {success && <div className="success-message">{success}</div>}
      {requests.length === 0 ? (
        <p className="no-data">No pending change requests.</p>
      ) : (
        <div className="table-container">
          <table className="requests-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Current Time Slot</th>
                <th>Proposed Time Slot</th>
                <th>Requester</th>
                <th>Status</th>
                {isAdminOrOwner && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req._id}>
                  <td>{req.classId}</td>
                  <td>{req.currentTimeSlot}</td>
                  <td>{req.proposedTimeSlot}</td>
                  <td>{req.requesterId?.name || "Unknown"}</td>
                  <td className={`status-${req.status.toLowerCase()}`}>
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </td>
                  {isAdminOrOwner && (
                    <td>
                      {req.status === "pending" ? (
                        <div className="action-buttons">
                          <button
                            className="approve-btn"
                            onClick={() => handleAction(req._id, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            className="reject-btn"
                            onClick={() => handleAction(req._id, "reject")}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ChangeRequests;