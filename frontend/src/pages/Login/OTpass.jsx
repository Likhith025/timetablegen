import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API_BASE_URL from "../../src"; // Ensure correct API URL import
import { assets } from "../../assets/assets.js";
import TopBar from "../../components/TopBar/TopBar.jsx";

const OTpass = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Store email in state (pre-filled if passed)
  const [email, setEmail] = useState(location.state?.email || "");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Check if token exists in localStorage
  const tokenExists = !!localStorage.getItem("token");

  useEffect(() => {
    if (!email) {
      setError("No email found. Please enter your email.");
    }
  }, [email]);

  // Function to send OTP
  const handleSendOTP = async () => {
    if (!email.trim()) {
      setError("Email is required to send OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/user/sendotp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send OTP");
      }

      setOtpSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Function to verify OTP
  const handleVerifyOTP = async () => {
    if (!otp.trim()) {
      setError("Please enter the OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/user/verifyotp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Invalid OTP");
      }

      navigate("/newpassword", { state: { email, otp } });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bgsetup">
      {/* Show TopBar if token exists, else show logo */}
      {tokenExists ? (
        <TopBar />
      ) : (
        <div className="logo">
          <img src={assets.logo} alt="Logo" />
        </div>
      )}

      <div className="loginpage">
        <div className="box1">
          <h1>Enter OTP</h1>

          {/* Email Field (Now always read-only) */}
          <div className="labeldiv">
            <p>Email Id</p>
            <input
              type="text"
              placeholder="Email Id"
              className="label1"
              value={email}
              readOnly // Email is always uneditable
            />
          </div>

          {/* Show error if any */}
          {error && <p className="error">{error}</p>}

          {/* OTP Request Button */}
          {!otpSent && (
            <button
              className="button1"
              onClick={handleSendOTP}
              disabled={loading}
            >
              {loading ? "Sending..." : "Receive OTP"}
            </button>
          )}

          {/* OTP Input and Resend Option */}
          {otpSent && (
            <>
              <div className="labeldiv">
                <p>Enter OTP</p>
                <input
                  type="text"
                  placeholder="Enter OTP"
                  className="label1"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
                <p>
                  Didn't receive OTP?{" "}
                  <a href="#" onClick={(e) => { e.preventDefault(); handleSendOTP(); }}>
                    Resend
                  </a>
                </p>
              </div>

              <br />
              <button
                className="button1"
                onClick={handleVerifyOTP}
                disabled={loading}
              >
                {loading ? "Verifying..." : "Continue"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OTpass;
