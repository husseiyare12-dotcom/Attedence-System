const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { Student, Attendance, Result, Exam, Notification } = require("../models");

const dataDir = path.join(__dirname, "..", "data");
const read = (name) => JSON.parse(fs.readFileSync(path.join(dataDir, name), "utf8"));
const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/attendance_system";

(async () => {
    await mongoose.connect(uri);
    for (const item of read("students.json")) await Student.findOneAndUpdate({ studentId: item.studentId }, item, { upsert: true, setDefaultsOnInsert: true });
    for (const item of read("attendance.json")) await Attendance.findOneAndUpdate({ studentId: item.studentId, date: item.date }, item, { upsert: true, setDefaultsOnInsert: true });
    for (const item of read("results.json")) await Result.findOneAndUpdate({ studentId: item.studentId, exam: item.exam, subject: item.subject }, item, { upsert: true, setDefaultsOnInsert: true });
    for (const item of read("exams.json")) await Exam.findOneAndUpdate({ title: item.title, subject: item.subject, date: item.date }, item, { upsert: true, setDefaultsOnInsert: true });
    for (const item of read("notifications.json")) await Notification.create(item);
    console.log("JSON data migrated to MongoDB.");
    await mongoose.disconnect();
})().catch(async (error) => { console.error(error.message); await mongoose.disconnect(); process.exitCode = 1; });
