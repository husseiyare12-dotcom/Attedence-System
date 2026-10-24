const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true }, role: { type: String, enum: ["admin", "teacher", "student"], required: true }, studentId: { type: String, default: "", trim: true }, passwordHash: { type: String, required: true }, resetToken: { type: String, default: "" }, resetTokenExpires: { type: Date, default: null } }, { timestamps: true });
const studentSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true }, studentId: { type: String, required: true, unique: true, trim: true }, email: { type: String, required: true, lowercase: true, trim: true }, className: { type: String, default: "" }, phone: { type: String, default: "" }, photo: { type: String, default: "" }, balanceDue: { type: Number, default: 0, min: 0 }, amountPaid: { type: Number, default: 0, min: 0 }, paymentStatus: { type: String, enum: ["pending", "paid"], default: "pending" } }, { timestamps: true });
const attendanceSchema = new mongoose.Schema({ studentId: { type: String, required: true }, date: { type: String, required: true }, status: { type: String, enum: ["Present", "Absent", "Late", "Excused"], required: true } }, { timestamps: true });
attendanceSchema.index({ studentId: 1, date: 1 }, { unique: true });
const resultSchema = new mongoose.Schema({ studentId: { type: String, required: true }, exam: { type: String, required: true }, subject: { type: String, required: true }, marks: Number, maximumMarks: Number, percentage: Number, grade: String }, { timestamps: true });
resultSchema.index({ studentId: 1, exam: 1, subject: 1 }, { unique: true });
const examSchema = new mongoose.Schema({ title: String, subject: String, date: String, maximumMarks: Number }, { timestamps: true });
const notificationSchema = new mongoose.Schema({ title: String, message: String, createdBy: String }, { timestamps: true });
const namedSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true, trim: true } }, { timestamps: true });
const assignmentSchema = new mongoose.Schema({ teacherId: String, className: String, subject: String }, { timestamps: true });

module.exports = {
    User: mongoose.models.User || mongoose.model("User", userSchema),
    Student: mongoose.models.Student || mongoose.model("Student", studentSchema),
    Attendance: mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema),
    Result: mongoose.models.Result || mongoose.model("Result", resultSchema),
    Exam: mongoose.models.Exam || mongoose.model("Exam", examSchema),
    Notification: mongoose.models.Notification || mongoose.model("Notification", notificationSchema),
    SchoolClass: mongoose.models.SchoolClass || mongoose.model("SchoolClass", namedSchema),
    Subject: mongoose.models.Subject || mongoose.model("Subject", namedSchema),
    Assignment: mongoose.models.Assignment || mongoose.model("Assignment", assignmentSchema)
};
