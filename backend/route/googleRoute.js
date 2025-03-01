import express from "express";
import passport from "passport";
import { googleAuth, googleAuthCallback } from "../controllers/googleController.js";
import jwt from 'jsonwebtoken'

const Grouter = express.Router();

// Start Google authentication
Grouter.get("/google", googleAuth);

// Google OAuth callback
Grouter.get("/google/callback", passport.authenticate("google", { session: false }), (req, res) => {
    if (!req.user) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=GoogleAuthFailed`);
    }
  
    const token = jwt.sign({ id: req.user._id, role: req.user.role }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });
  
    res.redirect(`${process.env.CLIENT_URL}/dashboard?token=${token}`);
  });
  
export default Grouter;
