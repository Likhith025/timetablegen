import User from "../model/user_model.js";
import bcrypt from "bcryptjs";

export const addEmailUser = async (req, res) => {
    try {
        const { email, name, password, loginType, role } = req.body;

        let user = await User.findOne({ email }); // Fixed findOne

        if (user) {
            return res.status(400).json({ message: "Email already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        user = new User({ // Fixed model instantiation
            name,
            email,
            password: hashedPassword,
            role,
            loginType:"Email", // Optional
        });

        await user.save();

        res.status(201).json({ message: "User added successfully" });
    } catch (error) {
        res.status(500).json({ message: "Unable to add user", error: error.message });
    }
};
