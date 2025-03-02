import express from "express";
import dotenv from "dotenv";
import connectDB from "./database/config.js";
import userRouter from "./route/userRoute.js";
import cors from "cors";
import "./database/passport.js"; 
import Grouter from "./route/googleRoute.js";

dotenv.config();

const app = express();

// ✅ Allow CORS from anywhere
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

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
