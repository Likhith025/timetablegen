import express from "express";
import dotenv from "dotenv";
import connectDB from "./database/config.js";
import userRouter from "./route/userRoute.js";

dotenv.config();

const app = express();

// Middleware
app.use(express.json());

connectDB();

// Simple Route
app.get("/", (req, res) => {
  res.send("API is Running...");
});

app.use('/user',userRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
