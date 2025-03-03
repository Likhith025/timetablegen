import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../model/user_model.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();


passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL,
            scope: ["profile", "email"],
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                let user = await User.findOne({ email: profile.emails[0].value });

                if (!user) {
                    console.log("Registering new user:", profile.emails[0].value);

                    user = new User({
                        name: profile.displayName,
                        email: profile.emails[0].value,
                        password: "", // No password for OAuth users
                        role: "user",
                        loginType: "Google",
                    });

                    await user.save();
                    console.log("New user registered successfully:", user);
                } else {
                    console.log("Existing user found:", user.email);
                }

                return done(null, user);
            } catch (error) {
                console.error("Google Strategy Error:", error);
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});


export const googleAuth = passport.authenticate("google", { scope: ["profile", "email"] });

export const googleAuthCallback = (req, res, next) => {
    passport.authenticate("google", (err, user) => {
        if (err) {
            console.error("Google Auth Error:", err);
            return res.status(500).json({ message: "Authentication error" });
        }
        if (!user) {
            return res.status(401).json({ message: "Unauthorized: No user found" });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
            expiresIn: "7d",
        });

        // Send JSON response instead of redirecting
        res.json({ token, user });
    })(req, res, next);
};
