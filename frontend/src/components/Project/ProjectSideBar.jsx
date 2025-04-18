import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode"; // Import jwt-decode for user info
import API_BASE_URL from "../../src"; // Adjust path as needed
import TimetableViewer from "./TimetableViewer"; // Adjust path to your component
import ParametersView from "./Parameters";
import "./ProjectSidebar.css";

const ProjectSidebar = () => {
  const [projectData, setProjectData] = useState(null);
  const [userInfo, setUserInfo] = useState({ userId: "", userName: "", userEmail: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("dashboard");
  const { id } = useParams();

  // Fetch user info from localStorage or token
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserInfo({
          userId: decoded.id || "",
          userName: decoded.name || "",
          userEmail: decoded.email || "",
        });
      } catch (error) {
        console.error("Error decoding token:", error);
      }
    }

    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserInfo((prev) => ({
          ...prev,
          userId: user._id || prev.userId,
          userName: user.name || prev.userName,
          userEmail: user.email || prev.userEmail,
        }));
      } catch (error) {
        console.error("Error parsing user from localStorage:", error);
      }
    }
  }, []);

  // Fetch project data
  useEffect(() => {
    const fetchProjectData = async () => {
      if (!id) {
        setError("Project ID not found");
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem("token");
        const response = await fetch(`${API_BASE_URL}/all/timetables/${id}`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch project data");
        }

        const data = await response.json();
        console.log("Fetched project data:", data);
        setProjectData(data);
      } catch (err) {
        console.error("Error fetching project:", err);
        setError("Error loading project data");
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [id]);

  // Callback to update projectData after saving changes in ParametersView
  const updateProjectData = (newData) => {
    setProjectData(newData);
  };

  const getActiveClass = (view) => {
    return activeView === view ? "sidebar-menu-item active" : "sidebar-menu-item";
  };

  const renderActiveView = () => {
    switch (activeView) {
      case "dashboard":
        return <div className="view-panel">📊 Dashboard View Content</div>;
      case "timetable":
        return <TimetableViewer projectId={id} />;
      case "parameters":
        return (
          <ParametersView
            projectId={id}
            projectData={projectData}
            updateProjectData={updateProjectData}
          />
        );
      case "chat":
        return <div className="view-panel">💬 Chat View Content</div>;
      case "block-room":
        return <div className="view-panel">🚫 Block Room View Content</div>;
      case "user":
        return (
          <div className="view-panel">
            <h3>👤 User Information</h3>
            {userInfo.userId ? (
              <table className="user-info-table">
                <tbody>
                  <tr>
                    <td><strong>User ID:</strong></td>
                    <td>{userInfo.userId}</td>
                  </tr>
                  {userInfo.userName && (
                    <tr>
                      <td><strong>Name:</strong></td>
                      <td>{userInfo.userName}</td>
                    </tr>
                  )}
                  {userInfo.userEmail && (
                    <tr>
                      <td><strong>Email:</strong></td>
                      <td>{userInfo.userEmail}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <p>Not logged in</p>
            )}
          </div>
        );
      default:
        return <div className="view-panel">Select a view</div>;
    }
  };

  return (
    <div className="project-wrapper">
      <div className="sidebar-container">
        {loading ? (
          <div className="sidebar-loading">Loading project data...</div>
        ) : error ? (
          <div className="sidebar-error">{error}</div>
        ) : projectData ? (
          <>
            <div className="project-info">
              <h2 className="project-name">{projectData.projectName || "Untitled Project"}</h2>
              <p className="created-by">
                Created by: {projectData.createdBy?.name || "Unknown"}
              </p>
            </div>

            <nav className="sidebar-menu">
              <div className={getActiveClass("dashboard")} onClick={() => setActiveView("dashboard")}>
                <span className="menu-icon">📊</span> Dashboard
              </div>
              <div className={getActiveClass("timetable")} onClick={() => setActiveView("timetable")}>
                <span className="menu-icon">📅</span> Timetable
              </div>
              <div
                className={getActiveClass("parameters")}
                onClick={() => setActiveView("parameters")}
              >
                <span className="menu-icon">⚙️</span> Parameters
              </div>
              <div className={getActiveClass("chat")} onClick={() => setActiveView("chat")}>
                <span className="menu-icon">💬</span> Chat
              </div>
              <div
                className={getActiveClass("block-room")}
                onClick={() => setActiveView("block-room")}
              >
                <span className="menu-icon">🚫</span> Block Room
              </div>
              <div className={getActiveClass("user")} onClick={() => setActiveView("user")}>
                <span className="menu-icon">👤</span> User
              </div>
            </nav>
          </>
        ) : (
          <div className="sidebar-error">Project not found</div>
        )}
      </div>

      <div className="main-content">{renderActiveView()}</div>
    </div>
  );
};

export default ProjectSidebar;