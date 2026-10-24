const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { User } = require("../models");

const [name = "Administrator", email = "admin@example.com", password = "ChangeMe123"] = process.argv.slice(2);
const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/attendance_system";

mongoose.connect(mongoUri).then(async () => {
    if (await User.exists({ email: email.toLowerCase() })) throw new Error("An account with this email already exists.");
    await User.create({ name, email: email.toLowerCase(), role: "admin", passwordHash: await bcrypt.hash(password, 12) });
    console.log(`Admin created in MongoDB: ${email}`);
    await mongoose.disconnect();
}).catch(async (error) => { console.error(error.message); await mongoose.disconnect(); process.exitCode = 1; });
