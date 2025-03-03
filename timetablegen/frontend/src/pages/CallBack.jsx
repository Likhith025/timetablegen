import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import API_BASE_URL from "../src.js";

const GoogleCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const fetchGoogleUser = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code"); // Extract the auth code from URL

      if (!code) {
        console.error("No authorization code found");
        navigate("/login");
        return;
      }

      try {
        const response = await fetch(`${API_BASE_URL}/auth/google/callback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
          credentials: "include",
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Google login failed");

        // Store user info in localStorage
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));

        navigate("/dashboard"); // Redirect to Dashboard
      } catch (error) {
        console.error("Google login failed:", error);
        navigate("/login");
      }
    };

    fetchGoogleUser();
  }, [navigate]);

  return <p>Logging in...</p>; // Show a loading message while processing
};

export default GoogleCallback;
