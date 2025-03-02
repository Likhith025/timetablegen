import express from "express";
import dotenv from "dotenv";
import connectDB from "./database/config.js";
import userRouter from "./route/userRoute.js";
import cors from "cors";
import "./database/passport.js"; 
import Grouter from "./route/googleRoute.js";

dotenv.config();

const app = express();

// ✅ Corrected CORS Configuration
app.use(
  cors({
    origin: ["http://localhost:5173", "https://timetablegen-production.up.railway.app"], 
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

// ✅ Ensure CORS Headers are Always Set
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Middleware
app.use(express.json());

// Connect Database
connectDB()
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((error) => {
    console.error("❌ MongoDB Connection Failed:", error.message);
    process.exit(1);
  });

// Simple Route
app.get("/", (req, res) => {
  res.send("✅ API is Running...");
});

// Routes
app.use("/user", userRouter);
app.use("/auth", Grouter);

// Handle Preflight Requests (Important for CORS)
app.options("*", (req, res) => {
  res.sendStatus(200);
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);
  res.status(500).json({ message: "Internal Server Error", error: err.message });
});

// Dynamic Port for Deployment
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
