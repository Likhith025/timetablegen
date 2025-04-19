import express from "express";
import dotenv from "dotenv";
import connectDB from "./database/config.js";
import userRouter from "./route/userRoute.js";
import cors from "cors";
import "./database/passport.js";
import Grouter from "./route/googleRoute.js";
import AllRouter from "./route/route.js";

dotenv.config();

const app = express();

// Set up CORS with multiple allowed origins
const allowedOrigins = [
  "https://timetablegen-2ytm.vercel.app",
  "http://localhost:3000"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

app.use(express.json());

connectDB()
  .then(() => console.log("MongoDB Connected"))
  .catch((error) => {
    console.error("MongoDB Connection Failed:", error.message);
    process.exit(1);
  });

app.get("/", (req, res) => {
  res.send("API is Running...");
});

// Routes
app.use("/user", userRouter);
app.use("/auth", Grouter);
app.use("/all", AllRouter);

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(500).json({ message: "Internal Server Error", error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});