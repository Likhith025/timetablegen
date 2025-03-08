import React, { useEffect, useState } from "react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css"; // Import toast styles
import "./Profile.css"; 
import TopBar from "../../components/TopBar/TopBar";

const API_BASE_URL = "http://localhost:5000";

const Profile = () => {
  const [user, setUser] = useState({});
  const [newName, setNewName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem("user"));

    if (storedUser && storedUser._id) {
      setUser(storedUser);
      setNewName(storedUser.name);
      console.log("Loaded user from localStorage:", storedUser);
    } else {
      console.error("User ID (_id) not found in localStorage");
    }
  }, []);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleSaveClick = async () => {
    setLoading(true);
    setError("");

    if (!user._id) {
      console.error("Cannot update: User ID (_id) is missing!");
      setError("User ID is missing. Cannot update.");
      toast.error("User ID is missing. Cannot update.");
      setLoading(false);
      return;
    }

    const updateData = { name: newName };

    console.log(`Sending to backend (User ID: ${user._id}):`, updateData);

    try {
      const response = await fetch(`${API_BASE_URL}/user/edit/${user._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error(`Failed to update profile: ${response.statusText}`);
      }

      const updatedUser = { ...user, name: newName };
      setUser(updatedUser);
      localStorage.setItem("user", JSON.stringify(updatedUser));

      console.log("Update successful:", updatedUser);

      setIsEditing(false);
      toast.success("Profile updated successfully!");
    } catch (err) {
      setError("Error updating profile. Please try again.");
      toast.error("Error updating profile. Please try again.");
      console.error("Error updating profile:", err);
    }

    setLoading(false);
  };

  return (
    <div>
      <TopBar/>
    <div className="profile-container">
      <ToastContainer position="top-right" autoClose={3000} /> {/* Toast Container */}
      <h2>Profile</h2>

      <div className="profile-info">
        {/*}
        <p><strong>User ID:</strong> {user._id || "Not Found"}</p>*/}
        <p><strong>Email:</strong> {user.email || "Not Found"}</p>
        <p>
          <strong>Name:</strong> 
          {isEditing ? (
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          ) : (
            user.name || "Not Found"
          )}
        </p>
      </div>

      {isEditing ? (
        <button className="profile-button" onClick={handleSaveClick} disabled={loading}>
          {loading ? "Saving..." : "Save"}
        </button>
      ) : (
        <button className="profile-button" onClick={handleEditClick}>
          Edit Name
        </button>
      )}

      {error && <p className="error-message">{error}</p>}
    </div>
    </div>
  );
};

export default Profile;
