require("dotenv").config();
const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const crypto = require("crypto");
const { User, Student, Attendance, Result, Exam, Notification, SchoolClass, Subject, Assignment } = require("./models");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/attendance_system";
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const publicDir = path.join(__dirname, "new folder", "public");
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));
app.use(express.static(path.join(publicDir, "public")));
app.use("/public", express.static(path.join(publicDir, "public")));

const clean = (value) => String(value || "").trim();
const grade = (percentage) => percentage >= 80 ? "A" : percentage >= 70 ? "B" : percentage >= 60 ? "C" : percentage >= 50 ? "D" : "F";
const cookies = (req) => Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((part) => { const [key, ...value] = part.trim().split("="); return [key, decodeURIComponent(value.join("="))]; }));
const currentUser = (req) => { try { const token = cookies(req).attendance_token; return token ? jwt.verify(token, JWT_SECRET) : null; } catch { return null; } };
const requireRole = (...roles) => (req, res, next) => { const user = currentUser(req); if (!user) return res.status(401).json({ message: "Please log in first." }); if (roles.length && !roles.includes(user.role)) return res.status(403).json({ message: "You do not have permission for this action." }); req.user = user; next(); };
const tokenCookie = (token) => `attendance_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Max-Age=28800; Path=/`;

app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));
for (const page of ["student", "attendance", "exams", "reports", "login", "register", "forgot-password"]) app.get(`/${page}.html`, (req, res) => res.sendFile(path.join(publicDir, "public", `${page}.html`)));
app.get("/admin-login.html", (req, res) => res.sendFile(path.join(publicDir, "public", "login.html")));
app.get("/admin.html", (req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.get("/admin-dashboard.html", (req, res) => res.sendFile(path.join(publicDir, "index.html")));

app.post("/api/auth/register", async (req, res) => { const name = clean(req.body.name), email = clean(req.body.email).toLowerCase(), password = String(req.body.password || ""), role = ["student", "teacher"].includes(req.body.role) ? req.body.role : "student", studentId = clean(req.body.studentId); if (!name || !email || password.length < 8) return res.status(400).json({ message: "Name, email, and a password of at least 8 characters are required." }); if (role === "student" && !studentId) return res.status(400).json({ message: "Student ID is required for student accounts." }); if (await User.exists({ email })) return res.status(409).json({ message: "Email is already registered." }); const user = await User.create({ name, email, role, studentId, passwordHash: await bcrypt.hash(password, 12) }); if (role === "student") await Student.findOneAndUpdate({ studentId }, { name, studentId, email }, { upsert: true, new: true, setDefaultsOnInsert: true }); res.status(201).json({ id: user._id, name, email, role }); });
const login = async (req, res, adminOnly = false) => { const identifier = clean(req.body.identifier || req.body.email); const query = identifier.includes("@") ? { email: identifier.toLowerCase() } : { studentId: identifier, role: "student" }; if (adminOnly) { query.email = identifier.toLowerCase(); query.role = "admin"; delete query.studentId; } const user = await User.findOne(query); if (!user || !(await bcrypt.compare(String(req.body.password || ""), user.passwordHash))) return res.status(401).json({ message: adminOnly ? "Invalid admin credentials." : "Invalid email, Student ID, or password." }); const token = jwt.sign({ id: user._id.toString(), name: user.name, email: user.email, role: user.role, studentId: user.studentId || "" }, JWT_SECRET, { expiresIn: "8h" }); res.setHeader("Set-Cookie", tokenCookie(token)); res.json({ id: user._id, name: user.name, email: user.email, role: user.role }); };
app.post("/api/auth/login", (req, res) => login(req, res));
app.post("/api/auth/admin-login", (req, res) => login(req, res, true));
app.post("/api/auth/logout", (req, res) => { res.setHeader("Set-Cookie", "attendance_token=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/"); res.json({ message: "Logged out." }); });
app.get("/api/auth/me", (req, res) => { const user = currentUser(req); res.json({ authenticated: Boolean(user), user }); });
app.post("/api/students/:studentId/payment", requireRole("admin"), async (req, res) => {
    const student = await Student.findOne({ studentId: req.params.studentId });
    const balanceDue = Math.max(0, Number(req.body.balanceDue || 0));
    const amountPaid = Math.max(0, Number(req.body.amountPaid || 0));
    if (!student || !Number.isFinite(balanceDue) || !Number.isFinite(amountPaid)) return res.status(400).json({ message: "Valid student and payment amounts are required." });
    student.balanceDue = balanceDue; student.amountPaid = amountPaid; student.paymentStatus = amountPaid >= balanceDue ? "paid" : "pending";
    await student.save();
    res.json({ message: student.paymentStatus === "paid" ? "Payment complete. Results unlocked." : "Payment saved. Balance is still pending.", student });
});
app.get("/api/students/:studentId/report", requireRole("admin", "teacher", "student"), async (req, res) => {
    if (req.user.role === "student" && req.user.studentId !== req.params.studentId) return res.status(403).json({ message: "You can only view your own report." });
    const student = await Student.findOne({ studentId: req.params.studentId }).lean();
    if (!student) return res.status(404).json({ message: "Student not found." });
    const attendance = await Attendance.find({ studentId: student.studentId }).sort({ date: -1 }).lean();
    const locked = req.user.role === "student" && student.paymentStatus === "pending" && student.balanceDue > student.amountPaid;
    const results = locked ? [] : await Result.find({ studentId: student.studentId }).sort({ createdAt: -1 }).lean();
    const present = attendance.filter((item) => ["Present", "Late"].includes(item.status)).length;
    const totalMarks = results.reduce((sum, item) => sum + item.marks, 0), maximumMarks = results.reduce((sum, item) => sum + item.maximumMarks, 0), percentage = maximumMarks ? Number((totalMarks / maximumMarks * 100).toFixed(2)) : 0;
    res.json({ student, attendance, resultsLocked: locked, attendancePercentage: attendance.length ? Number((present / attendance.length * 100).toFixed(2)) : 0, results, summary: { totalMarks, maximumMarks, percentage, grade: grade(percentage) } });
});
app.post("/api/students", requireRole("admin"), async (req, res) => {
    const balanceDue = Math.max(0, Number(req.body.balanceDue || 0)), amountPaid = Math.max(0, Number(req.body.amountPaid || 0));
    const data = { name: clean(req.body.name), studentId: clean(req.body.studentId), email: clean(req.body.email).toLowerCase(), className: clean(req.body.className), phone: clean(req.body.phone), photo: typeof req.body.photo === "string" && req.body.photo.startsWith("data:image/") ? req.body.photo : "", balanceDue, amountPaid, paymentStatus: amountPaid >= balanceDue ? "paid" : "pending" };
    if (!data.name || !data.studentId || !data.email) return res.status(400).json({ message: "Name, student ID, and email are required." });
    if (await Student.exists({ studentId: data.studentId })) return res.status(409).json({ message: "Student ID already exists." });
    res.status(201).json(await Student.create(data));
});
app.post("/api/auth/password-reset/request", async (req, res) => {
    const email = clean(req.body.email).toLowerCase();
    const user = await User.findOne({ email });
    if (!user) return res.json({ message: "If that email exists, a reset token has been created." });
    const token = crypto.randomBytes(24).toString("hex");
    user.resetToken = token;
    user.resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();
    res.json({ message: "Reset token created. For development, copy the token below.", resetToken: token });
});
app.post("/api/auth/password-reset/confirm", async (req, res) => {
    const token = clean(req.body.token), password = String(req.body.password || "");
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters." });
    const user = await User.findOne({ resetToken: token, resetTokenExpires: { $gt: new Date() } });
    if (!user) return res.status(400).json({ message: "Reset token is invalid or expired." });
    user.passwordHash = await bcrypt.hash(password, 12); user.resetToken = ""; user.resetTokenExpires = null; await user.save();
    res.json({ message: "Password updated successfully. You can now sign in." });
});

app.get("/api/teachers", requireRole("admin"), async (req, res) => res.json(await User.find({ role: "teacher" }).select("-passwordHash").sort({ name: 1 }).lean()));
app.post("/api/teachers", requireRole("admin"), async (req, res) => { const name = clean(req.body.name), email = clean(req.body.email).toLowerCase(), password = String(req.body.password || ""); if (!name || !email || password.length < 8) return res.status(400).json({ message: "Teacher name, email, and password of at least 8 characters are required." }); if (await User.exists({ email })) return res.status(409).json({ message: "Email is already registered." }); const teacher = await User.create({ name, email, role: "teacher", passwordHash: await bcrypt.hash(password, 12) }); res.status(201).json({ id: teacher._id, name: teacher.name, email: teacher.email, role: teacher.role }); });

app.get("/api/students", requireRole("admin", "teacher", "student"), async (req, res) => { const students = await Student.find().lean(); res.json(req.user.role === "student" ? students.filter((student) => student.studentId === req.user.studentId) : students); });
app.post("/api/students", requireRole("admin"), async (req, res) => { const data = { name: clean(req.body.name), studentId: clean(req.body.studentId), email: clean(req.body.email).toLowerCase(), className: clean(req.body.className), phone: clean(req.body.phone), photo: typeof req.body.photo === "string" && req.body.photo.startsWith("data:image/") ? req.body.photo : "" }; if (!data.name || !data.studentId || !data.email) return res.status(400).json({ message: "Name, student ID, and email are required." }); if (await Student.exists({ studentId: data.studentId })) return res.status(409).json({ message: "Student ID already exists." }); res.status(201).json(await Student.create(data)); });
app.get("/api/students/:studentId/report", requireRole("admin", "teacher", "student"), async (req, res) => { if (req.user.role === "student" && req.user.studentId !== req.params.studentId) return res.status(403).json({ message: "You can only view your own report." }); const student = await Student.findOne({ studentId: req.params.studentId }).lean(); if (!student) return res.status(404).json({ message: "Student not found." }); const attendance = await Attendance.find({ studentId: student.studentId }).sort({ date: -1 }).lean(), results = await Result.find({ studentId: student.studentId }).sort({ createdAt: -1 }).lean(), present = attendance.filter((item) => ["Present", "Late"].includes(item.status)).length, totalMarks = results.reduce((sum, item) => sum + item.marks, 0), maximumMarks = results.reduce((sum, item) => sum + item.maximumMarks, 0), percentage = maximumMarks ? Number((totalMarks / maximumMarks * 100).toFixed(2)) : 0; res.json({ student, attendance, attendancePercentage: attendance.length ? Number((present / attendance.length * 100).toFixed(2)) : 0, results, summary: { totalMarks, maximumMarks, percentage, grade: grade(percentage) } }); });
app.post("/api/students/:studentId/attendance", requireRole("admin", "teacher"), async (req, res) => { const student = await Student.findOne({ studentId: req.params.studentId }), date = clean(req.body.date), status = clean(req.body.status); if (!student) return res.status(404).json({ message: "Student not found." }); if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !["Present", "Absent", "Late", "Excused"].includes(status)) return res.status(400).json({ message: "A valid date and attendance status are required." }); await Attendance.findOneAndUpdate({ studentId: student.studentId, date }, { studentId: student.studentId, date, status }, { upsert: true, new: true, setDefaultsOnInsert: true }); res.status(201).json({ message: "Attendance saved." }); });
app.post("/api/students/:studentId/results", requireRole("admin", "teacher"), async (req, res) => { const student = await Student.findOne({ studentId: req.params.studentId }), exam = clean(req.body.exam), subject = clean(req.body.subject), marks = Number(req.body.marks), maximumMarks = Number(req.body.maximumMarks); if (!student) return res.status(404).json({ message: "Student not found." }); if (!exam || !subject || !Number.isFinite(marks) || !Number.isFinite(maximumMarks) || maximumMarks <= 0 || marks < 0 || marks > maximumMarks) return res.status(400).json({ message: "Enter valid result details." }); const percentage = Number((marks / maximumMarks * 100).toFixed(2)); res.status(201).json(await Result.findOneAndUpdate({ studentId: student.studentId, exam, subject }, { studentId: student.studentId, exam, subject, marks, maximumMarks, percentage, grade: grade(percentage) }, { upsert: true, new: true, setDefaultsOnInsert: true })); });

app.get("/api/exams", async (req, res) => res.json(await Exam.find().sort({ date: 1 }).lean()));
app.post("/api/exams", requireRole("admin", "teacher"), async (req, res) => { const title = clean(req.body.title), subject = clean(req.body.subject), date = clean(req.body.date), maximumMarks = Number(req.body.maximumMarks); if (!title || !subject || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(maximumMarks) || maximumMarks <= 0) return res.status(400).json({ message: "Valid exam details are required." }); res.status(201).json(await Exam.create({ title, subject, date, maximumMarks })); });
app.get("/api/notifications", async (req, res) => res.json(await Notification.find().sort({ createdAt: -1 }).limit(30).lean()));
app.post("/api/notifications", requireRole("admin", "teacher"), async (req, res) => { const title = clean(req.body.title), message = clean(req.body.message); if (!title || !message) return res.status(400).json({ message: "Title and message are required." }); res.status(201).json(await Notification.create({ title, message, createdBy: req.user.id })); });
app.get("/api/reports/attendance", requireRole("admin", "teacher"), async (req, res) => { const from = clean(req.query.from) || "0000-01-01", to = clean(req.query.to) || "9999-12-31", students = await Student.find().lean(), records = await Attendance.find({ date: { $gte: from, $lte: to } }).lean(); res.json({ from, to, rows: students.map((student) => { const items = records.filter((item) => item.studentId === student.studentId), attended = items.filter((item) => ["Present", "Late"].includes(item.status)).length; return { studentId: student.studentId, name: student.name, totalDays: items.length, attended, absent: items.filter((item) => item.status === "Absent").length, percentage: items.length ? Number((attended / items.length * 100).toFixed(2)) : 0 }; }) }); });

app.get("/api/classes", requireRole("admin", "teacher"), async (req, res) => res.json(await SchoolClass.find().sort({ name: 1 }).lean()));
app.post("/api/classes", requireRole("admin"), async (req, res) => { const name = clean(req.body.name); if (!name) return res.status(400).json({ message: "Class name is required." }); res.status(201).json(await SchoolClass.create({ name })); });
app.get("/api/subjects", requireRole("admin", "teacher"), async (req, res) => res.json(await Subject.find().sort({ name: 1 }).lean()));
app.post("/api/subjects", requireRole("admin"), async (req, res) => { const name = clean(req.body.name); if (!name) return res.status(400).json({ message: "Subject name is required." }); res.status(201).json(await Subject.create({ name })); });
app.get("/api/assignments", requireRole("admin", "teacher"), async (req, res) => res.json(await Assignment.find().lean()));
app.post("/api/assignments", requireRole("admin"), async (req, res) => { const teacherId = clean(req.body.teacherId), className = clean(req.body.className), subject = clean(req.body.subject); if (!teacherId || !className || !subject) return res.status(400).json({ message: "Teacher, class, and subject are required." }); res.status(201).json(await Assignment.create({ teacherId, className, subject })); });

app.get("/api/dashboard", async (req, res) => {
    const [totalStudents, totalTeachers, totalClasses, exams, notifications, students, results] = await Promise.all([Student.countDocuments(), User.countDocuments({ role: "teacher" }), SchoolClass.countDocuments(), Exam.find().sort({ date: 1 }).limit(5).lean(), Notification.find().sort({ createdAt: -1 }).limit(5).lean(), Student.find().lean(), Result.find().lean()]);
    const today = new Date().toISOString().slice(0, 10), todayRecords = await Attendance.find({ date: today }).lean();
    const totalDue = students.reduce((sum, student) => sum + Number(student.balanceDue || 0), 0);
    const totalPaid = students.reduce((sum, student) => sum + Number(student.amountPaid || 0), 0);
    const topStudents = students.map((student) => { const items = results.filter((item) => item.studentId === student.studentId), totalMarks = items.reduce((sum, item) => sum + item.marks, 0), maximumMarks = items.reduce((sum, item) => sum + item.maximumMarks, 0); return { ...student, totalMarks, maximumMarks, percentage: maximumMarks ? Number((totalMarks / maximumMarks * 100).toFixed(2)) : 0 }; }).filter((student) => student.maximumMarks > 0).sort((a, b) => b.percentage - a.percentage || a.studentId.localeCompare(b.studentId)).slice(0, 3);
    res.json({ totalStudents, totalTeachers, totalClasses, financial: { totalDue, totalPaid, outstanding: Math.max(0, totalDue - totalPaid) }, today: { present: todayRecords.filter((item) => item.status === "Present").length, absent: todayRecords.filter((item) => item.status === "Absent").length, late: todayRecords.filter((item) => item.status === "Late").length }, topStudents, exams, notifications });
});

mongoose.connect(MONGO_URI).then(() => app.listen(PORT, "0.0.0.0", () => console.log(`MongoDB connected. Server running on port ${PORT}`))).catch((error) => { console.error("MongoDB connection failed:", error.message); process.exit(1); });
