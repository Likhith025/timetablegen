import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name : {type:String ,requried:true},
    email : {type:String ,requried:true,unique:true},
    password :{type:String,requried : true},
    userId :{type : String},
    loginType :{type : String,enum:["OAuth","Email"],requried : true},
    role:{type : String,enum:["admin","user"],default:"user",requried :true},
    timetables:[{type:mongoose.Schema.Types.ObjectId,ref:"Timetable"}],


},{timestamps:true});



const User=mongoose.model.User || mongoose.model("User",userSchema);

export default User;
