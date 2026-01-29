import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const connectDB = async () => {
  try {
    if (!process.env.database) {
      throw new Error("process.env.database is undefined. Make sure the 'database' environment variable is set in Render.");
    }
    await mongoose.connect(process.env.database);
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error("MongoDB Connection Failed:", error.message);
    process.exit(1);
  }
};

export default connectDB;
