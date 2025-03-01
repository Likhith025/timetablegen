import User from "../model/user_model.js";
import bcrypt from "bcryptjs";
import dotenv from "dotenv"
import nodemailer from "nodemailer"
import otpGenerator from "otp-generator"
import jwt from "jsonwebtoken"

export const addEmailUser = async (req, res) => {
    try {
        const { email, name, password, loginType, role } = req.body;

        let user = await User.findOne({ email });

        if (user) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({
            name,
            email,
            password: hashedPassword,
            role,
            loginType:"Email",
        });

        await user.save();

        res.status(201).json({ message: "User added successfully" });
    } catch (error) {
        res.status(500).json({ message: "Unable to add user", error: error.message });
    }
};

export const getallUsers = async (req,res) => {
    try{
        const users = await User.find().select("-password");
        res.status(200).json(users);
    }
    catch (error){
        res.status(500).json({message:"Error in getting users"});
    }
}

export const getUserById = async (req,res) => {
    try{
        const users = await User.findById(req.params.id).select("-password");

        if(!users){
            res.status(201).json({message:"No user found"});
        }
        res.status(200).json(users);
    }
    catch (error){
        res.status(500).json({message:"Error in getting users"});
    }
}

export const editUser = async (req, res) => {
    try {
        const { name, email, role= "user", loginType } = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            { name, email, role, loginType },
            { new: true, runValidators: true }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json(updatedUser);
    } catch (error) {
        res.status(500).json({ message: "Error in editing user", error: error.message });
    }
};


dotenv.config();

const otpStorage={};

console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS:", process.env.EMAIL_PASS);


const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});


export const sendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const otp = otpGenerator.generate(6, {digits:true,lowerCaseAlphabets: false, 
            upperCaseAlphabets: false, 
            specialChars: false , upperCase: false, specialChars: false });
        otpStorage[email] = otp;

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Password Reset OTP",
            text: `Your OTP for password reset is: ${otp}`,
        });

        res.status(200).json({ message: "OTP sent to email" });
    } catch (error) {
        res.status(500).json({ message: "Error sending OTP", error: error.message });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!otpStorage[email] || otpStorage[email] !== otp) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const user = await User.findOneAndUpdate(
            { email },
            { password: hashedPassword },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        delete otpStorage[email];

        res.status(200).json({ message: "Password changed successfully" });
    } catch (error) {
        res.status(500).json({ message: "Error resetting password", error: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Fix: Await the database query
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(401).json({ message: "Invalid Email" });
        }

        // Fix: Ensure `user.password` exists before comparing
        const isMatch = await bcrypt.compare(password, user.password || "");

        if (!isMatch) {
            return res.status(401).json({ message: "Invalid Password" });
        }

        // Fix: Correct typo (`iser.role` -> `user.role`)
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(200).json({
            message: "Login successful",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            }
        });

    } catch (error) {
        res.status(500).json({ message: "Invalid Credentials", error: error.message });
    }
};
