import express from "express";
import dotenv from "dotenv";
import connectDB from "./database/config.js";
import userRouter from "./route/userRoute.js";
import cors from 'cors';
import "./database/passport.js";  // Ensure passport configuration loads
import Grouter from "./route/googleRoute.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: "http://localhost:5173", // Allow requests from frontend
  methods: ["GET", "POST", "PUT", "DELETE"], // Allowed HTTP methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allowed headers
  credentials: true, // Allow cookies/auth headers
}));


// Middleware
app.use(express.json());

connectDB();

// Simple Route
app.get("/", (req, res) => {
  res.send("API is Running...");
});

app.use('/user',userRouter);
app.use('/auth',Grouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
