import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode"; // Import jwtDecode
import { assets } from "../../assets/assets.js";
import { FaUserCircle } from "react-icons/fa";
import API_BASE_URL from "../../src"; // Ensure correct import path
import "./TopBar.css";

const TopBar = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");

    if (token) {
      localStorage.setItem("token", token);
      try {
        const decodedToken = jwtDecode(token);
        if (decodedToken.id) {
          setUserId(decodedToken.id);
          fetchUserDetails(decodedToken.id);
        }
      } catch (error) {
        console.error("Invalid token:", error);
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      const storedToken = localStorage.getItem("token");
      const storedUser = JSON.parse(localStorage.getItem("user"));

      if (storedToken) {
        try {
          const decodedToken = jwtDecode(storedToken);
          if (decodedToken.id) {
            setUserId(decodedToken.id);
            fetchUserDetails(decodedToken.id);
          } else if (storedUser && storedUser._id) {
            setUserId(storedUser._id);
            setUserEmail(storedUser.email);
            setUserName(storedUser.name);
            setUserRole(storedUser.role);
          }
        } catch (error) {
          console.error("Invalid stored token:", error);
        }
      } else {
        navigate("/");
      }
    }
  }, [navigate]);

  // Fetch user details from backend
  const fetchUserDetails = async (userId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/user/get/${userId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch user data");
      }
      const userData = await response.json();

      setUserId(userData._id);
      setUserName(userData.name);
      setUserRole(userData.role);
      setUserEmail(userData.email);

      localStorage.setItem(
        "user",
        JSON.stringify({
          _id: userData._id,
          email: userData.email,
          name: userData.name,
          role: userData.role,
        })
      );
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className="topbar">
      <img
        src={assets.logo}
        alt="Logo"
        className="topbar-logo"
        draggable="false"
        style={{ userSelect: "none" }}
        onClick={() => navigate('/dashboard')}
      />

      <div className="topbar-user" ref={dropdownRef}>
        <div className="user-info">
          <p><strong>{userName || "User"}</strong></p>
          {userRole.toLowerCase() === "admin" && <p className="role">Admin</p>}
        </div>
        <div className="user-avatar" onClick={() => setDropdownOpen(!dropdownOpen)}>
  {userName ? userName.charAt(0).toUpperCase() : "U"}
        </div>

        {dropdownOpen && (
          <div className="dropdown-menu">
            <p onClick={() => navigate("/profile")}>My Profile</p>
            <p onClick={() => navigate("/otp", { state: { email: userEmail } })}>
              Forgot Password
            </p>
            {userRole.toLowerCase() === "admin" && (
              <p onClick={() => navigate("/view")}>View All Users</p>
            )}
            <p onClick={handleLogout} className="logout-option">Logout</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopBar;