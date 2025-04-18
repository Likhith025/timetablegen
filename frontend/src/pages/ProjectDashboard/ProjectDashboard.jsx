import React from "react";
import ProjectSidebar from "../../components/Project/ProjectSideBar";
import TopBar from "../../components/TopBar/TopBar";
import TimetableViewer from "../../components/Project/TimetableViewer";

const ProjectPage = ({ children }) => {
  return (
    <div className="project-container">
      <TopBar />
      <div className="project-page-layout">
        <ProjectSidebar />
        <div className="project-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ProjectPage;