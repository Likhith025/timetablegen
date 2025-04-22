import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import API_BASE_URL from "../../src";
import TimetableViewer from "./TimetableViewer";
import ParametersView from "./Parameters";
import "./ProjectSidebar.css";
import Users from "./Users";

const ProjectSidebar = () => {
  const [projectData, setProjectData] = useState(null);
  const [userInfo, setUserInfo] = useState({ userId: "", userName: "", userEmail: "", userRole: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeView, setActiveView] = useState("dashboard");
  const { id } = useParams();

  useEffect(() => {
    console.log("ProjectSidebar: Mounted");
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setUserInfo({
          userId: decoded.id || "",
          userName: decoded.name || "",
          userEmail: decoded.email || "",
          userRole: decoded.role || "",
        });
      } catch (error) {
        console.error("ProjectSidebar: Error decoding token:", error);
      }
    }

    const userStr = localStorage.getItem("user");
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        setUserInfo(prev => ({
          ...prev,
          userId: user._id || user.id || prev.userId,
          userName: user.name || prev.userName,
          userEmail: user.email || prev.userEmail,
          userRole: user.role || prev.userRole,
        }));
      } catch (error) {
        console.error("ProjectSidebar: Error parsing user from localStorage:", error);
      }
    }

    console.log("ProjectSidebar: User info:", userInfo);
  }, []);

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
        console.log("ProjectSidebar: Fetched project data:", data);
        setProjectData(data);
      } catch (err) {
        console.error("ProjectSidebar: Error fetching project:", err);
        setError("Error loading project data");
      } finally {
        setLoading(false);
      }
    };

    fetchProjectData();
  }, [id]);

  const updateProjectData = (newData) => {
    setProjectData(newData);
  };

  const getActiveClass = (view) => {
    return activeView === view ? "sidebar-menu-item active" : "sidebar-menu-item";
  };

  const isEducator = userInfo.userRole.toLowerCase() === "educator" ||
    (projectData?.faculty?.some(f => f.mail.toLowerCase() === userInfo.userEmail.toLowerCase()));
  console.log("ProjectSidebar: isEducator:", isEducator, "userRole:", userInfo.userRole);

  const getUserProjectInfo = () => {
    if (!projectData || !userInfo.userId || !userInfo.userEmail) {
      return { name: userInfo.userName || "Unknown", role: "Unknown" };
    }
    if (projectData.createdBy?._id === userInfo.userId) {
      return { name: userInfo.userName || projectData.createdBy.name || "Unknown", role: "Owner" };
    }
    const facultyMatch = projectData.faculty?.find(f => f.mail.toLowerCase() === userInfo.userEmail.toLowerCase());
    if (facultyMatch) {
      return { name: facultyMatch.name || userInfo.userName || "Unknown", role: "Educator" };
    }
    return { name: userInfo.userName || "Unknown", role: "Member" };
  };

  const renderActiveView = () => {
    switch (activeView) {
      case "dashboard":
        return <div className="view-panel">📊 Dashboard View Content</div>;
      case "timetable":
        return <TimetableViewer projectId={id} userId={userInfo.userId} userRole={userInfo.userRole} />;
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
        return <Users/>;
      default:
        return <div className="view-panel">Select a view</div>;
    }
  };

  const { name: userProjectName, role: userProjectRole } = getUserProjectInfo();

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
              <p className="user-info">
                You: {userProjectName} ({userProjectRole})
              </p>
            </div>

            <nav className="sidebar-menu">
              <div className={getActiveClass("dashboard")} onClick={() => setActiveView("dashboard")}>
                <span className="menu-icon">📊</span> Dashboard
              </div>
              <div className={getActiveClass("timetable")} onClick={() => setActiveView("timetable")}>
                <span className="menu-icon">📅</span> Timetable
              </div>
              {!isEducator && (
                <div
                  className={getActiveClass("parameters")}
                  onClick={() => setActiveView("parameters")}
                >
                  <span className="menu-icon">⚙️</span> Parameters
                </div>
              )}
              <div className={getActiveClass("chat")} onClick={() => setActiveView("chat")}>
                <span className="menu-icon">💬</span> Chat
              </div>
              <div
                className={getActiveClass("block-room")}
                onClick={() => setActiveView("block-room")}
              >
                <span className="menu-icon">🚫</span> Block Room
              </div>
              {!isEducator && (
                <div
                  className={getActiveClass("user")}
                  onClick={() => setActiveView("user")}
                >
                  <span className="menu-icon">👤</span> User
                </div>
              )}
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