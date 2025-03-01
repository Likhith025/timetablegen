import express from "express";
import { addEmailUser } from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.post("/add",addEmailUser);

export default userRouter;