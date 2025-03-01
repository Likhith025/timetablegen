import express from "express";
import { addEmailUser, editUser, getallUsers, getUserById, resetPassword, sendOtp } from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.post("/add",addEmailUser);
userRouter.get("/",getallUsers);
userRouter.get("/get/:id",getUserById);
userRouter.put("/edit/:id",editUser);

userRouter.post("/sendotp",sendOtp);
userRouter.post("/resetpass",resetPassword);


export default userRouter;