const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 3000;
const publicDir = path.join(__dirname, "new folder", "public");
const dataDir = path.join(__dirname, "data");
const studentsFile = path.join(dataDir, "students.json");
const attendanceFile = path.join(dataDir, "attendance.json");
const resultsFile = path.join(dataDir, "results.json");
const usersFile = path.join(dataDir, "users.json");
const examsFile = path.join(dataDir, "exams.json");
const notificationsFile = path.join(dataDir, "notifications.json");
const resetTokensFile = path.join(dataDir, "reset_tokens.json");
const classesFile = path.join(dataDir, "classes.json");
const subjectsFile = path.join(dataDir, "subjects.json");
const assignmentsFile = path.join(dataDir, "assignments.json");
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";

app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(publicDir));
app.use(express.static(path.join(publicDir, "public")));
app.use("/public", express.static(path.join(publicDir, "public")));

function readStudents() {
    try {
        return JSON.parse(fs.readFileSync(studentsFile, "utf8"));
    } catch (error) {
        return [];
    }
}

function writeStudents(students) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(studentsFile, JSON.stringify(students, null, 2));
}

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch (error) {
        return [];
    }
}

function writeJson(file, value) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function calculateGrade(percentage) {
    if (percentage >= 80) return "A";
    if (percentage >= 70) return "B";
    if (percentage >= 60) return "C";
    if (percentage >= 50) return "D";
    return "F";
}

function parseCookies(req) {
    return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map((part) => {
        const [key, ...value] = part.trim().split("=");
        return [key, decodeURIComponent(value.join("="))];
    }));
}

function currentUser(req) {
    try {
        const token = parseCookies(req).attendance_token;
        return token ? jwt.verify(token, JWT_SECRET) : null;
    } catch (error) {
        return null;
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        const user = currentUser(req);
        if (!user) return res.status(401).json({ message: "Please log in first." });
        if (roles.length && !roles.includes(user.role)) return res.status(403).json({ message: "You do not have permission for this action." });
        req.user = user;
        next();
    };
}

function topStudents() {
    const students = readStudents();
    const results = readJson(resultsFile);
    return students.map((student) => {
        const studentResults = results.filter((result) => result.studentId === student.studentId);
        const totalMarks = studentResults.reduce((sum, result) => sum + result.marks, 0);
        const maximumMarks = studentResults.reduce((sum, result) => sum + result.maximumMarks, 0);
        return { ...student, totalMarks, maximumMarks, percentage: maximumMarks ? Number(((totalMarks / maximumMarks) * 100).toFixed(2)) : 0 };
    }).filter((student) => student.maximumMarks !== 0 || student.totalMarks > 0).sort((a, b) => b.percentage - a.percentage || b.totalMarks - a.totalMarks || a.studentId.localeCompare(b.studentId)).slice(0, 3);
}


app.get("/", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/student.html", (req, res) => {
    res.sendFile(path.join(publicDir, "public", "student.html"));
});

app.get("/attendance.html", (req, res) => {
    res.sendFile(path.join(publicDir, "public", "attendance.html"));
});
app.get("/exams.html", (req, res) => {
    res.sendFile(path.join(publicDir, "public", "exams.html"));
});
app.get("/reports.html", (req, res) => {
    res.sendFile(path.join(publicDir, "public", "reports.html"));
});

app.get("/login.html", (req, res) => res.sendFile(path.join(publicDir, "public", "login.html")));
app.get("/admin-login.html", (req, res) => res.sendFile(path.join(publicDir, "public", "login.html")));
app.get("/admin.html", (req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.get("/admin-dashboard.html", (req, res) => res.sendFile(path.join(publicDir, "index.html")));
app.get("/register.html", (req, res) => res.sendFile(path.join(publicDir, "public", "register.html")));
app.get("/forgot-password.html", (req, res) => res.sendFile(path.join(publicDir, "public", "forgot-password.html")));

app.post("/api/auth/register", async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const role = ["student", "teacher"].includes(req.body.role) ? req.body.role : "student";
    const studentId = String(req.body.studentId || "").trim();
    if (!name || !email || password.length < 8) return res.status(400).json({ message: "Name, email, and a password of at least 8 characters are required." });
    const users = readJson(usersFile);
    if (users.some((user) => user.email === email)) return res.status(409).json({ message: "Email is already registered." });
    const user = { id: Date.now().toString(), name, email, role, studentId, passwordHash: await bcrypt.hash(password, 12), createdAt: new Date().toISOString() };
    users.push(user);
    writeJson(usersFile, users);
    if (role === "student" && studentId) {
        const students = readStudents();
        const existing = students.find((item) => item.studentId === studentId);
        if (existing) { existing.name = name; existing.email = email; }
        else students.push({ id: Date.now().toString(), name, studentId, email, className: "", phone: "", photo: "", balanceDue: 0, amountPaid: 0, paymentStatus: "paid" });
        writeStudents(students);
    }
    res.status(201).json({ id: user.id, name, email, role });
});

app.post("/api/auth/login", async (req, res) => {
    const identifier = String(req.body.identifier || req.body.email || "").trim();
    const password = String(req.body.password || "");
    const user = readJson(usersFile).find((item) => identifier.includes("@") ? item.email === identifier.toLowerCase() : item.role === "student" && item.studentId === identifier);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Invalid email, Student ID, or password." });
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, studentId: user.studentId || "" }, JWT_SECRET, { expiresIn: "8h" });
    res.setHeader("Set-Cookie", `attendance_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Max-Age=28800; Path=/`);
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.post("/api/auth/admin-login", async (req, res) => {
    const email = String(req.body.email || req.body.identifier || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = readJson(usersFile).find((item) => item.email === email && item.role === "admin");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: "Invalid admin credentials." });
    const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role, studentId: user.studentId || "" }, JWT_SECRET, { expiresIn: "8h" });
    res.setHeader("Set-Cookie", `attendance_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Max-Age=28800; Path=/`);
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.post("/api/auth/logout", (req, res) => {
    res.setHeader("Set-Cookie", "attendance_token=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/");
    res.json({ message: "Logged out." });
});

app.get("/api/auth/me", (req, res) => {
    const user = currentUser(req);
    res.json({ authenticated: Boolean(user), user });
});

app.get("/api/profile", requireRole("admin", "teacher", "student"), (req, res) => {
    const user = readJson(usersFile).find((item) => item.id === req.user.id);
    if (!user) return res.status(404).json({ message: "Profile not found." });
    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
});

app.put("/api/profile", requireRole("admin", "teacher", "student"), (req, res) => {
    const users = readJson(usersFile);
    const user = users.find((item) => item.id === req.user.id);
    if (!user) return res.status(404).json({ message: "Profile not found." });
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Name is required." });
    user.name = name;
    writeJson(usersFile, users);
    res.json({ message: "Profile updated." });
});

app.post("/api/auth/password-reset/request", (req, res) => {
    const email = String(req.body.email || "").trim().toLowerCase();
    const user = readJson(usersFile).find((item) => item.email === email);
    if (user) {
        const tokens = readJson(resetTokensFile).filter((item) => new Date(item.expiresAt) > new Date());
        tokens.push({ token: `${Date.now()}-${Math.random().toString(36).slice(2)}`, userId: user.id, expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() });
        writeJson(resetTokensFile, tokens);
    }
    res.json({ message: "If that email exists, a password reset token has been created." });
});

app.post("/api/auth/password-reset/confirm", async (req, res) => {
    const token = String(req.body.token || "");
    const password = String(req.body.password || "");
    const tokens = readJson(resetTokensFile);
    const reset = tokens.find((item) => item.token === token && new Date(item.expiresAt) > new Date());
    if (!reset || password.length < 8) return res.status(400).json({ message: "Invalid token or password is too short." });
    const users = readJson(usersFile);
    const user = users.find((item) => item.id === reset.userId);
    if (!user) return res.status(400).json({ message: "Invalid reset request." });
    user.passwordHash = await bcrypt.hash(password, 12);
    writeJson(usersFile, users);
    writeJson(resetTokensFile, tokens.filter((item) => item.token !== token));
    res.json({ message: "Password reset successfully." });
});

app.get("/api/dashboard", (req, res) => {
    const students = readStudents();
    const attendance = readJson(attendanceFile);
    const today = new Date().toISOString().slice(0, 10);
    const todayAttendance = attendance.filter((item) => item.date === today);
    const totalDue = students.reduce((sum, student) => sum + Number(student.balanceDue || 0), 0);
    const totalPaid = students.reduce((sum, student) => sum + Number(student.amountPaid || 0), 0);
    res.json({ totalStudents: students.length, totalTeachers: readJson(usersFile).filter((user) => user.role === "teacher").length, totalClasses: new Set(students.map((student) => student.className).filter(Boolean)).size, financial: { totalDue, totalPaid, outstanding: Math.max(0, totalDue - totalPaid) }, today: { present: todayAttendance.filter((item) => item.status === "Present").length, absent: todayAttendance.filter((item) => item.status === "Absent").length, late: todayAttendance.filter((item) => item.status === "Late").length }, topStudents: topStudents(), exams: readJson(examsFile).slice(-5).reverse(), notifications: readJson(notificationsFile).slice(-5).reverse() });
});

app.get("/api/exams", (req, res) => res.json(readJson(examsFile)));
app.post("/api/exams", requireRole("admin", "teacher"), (req, res) => {
    const title = String(req.body.title || "").trim();
    const subject = String(req.body.subject || "").trim();
    const date = String(req.body.date || "").trim();
    const maximumMarks = Number(req.body.maximumMarks);
    if (!title || !subject || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(maximumMarks) || maximumMarks <= 0) return res.status(400).json({ message: "Valid title, subject, date, and maximum marks are required." });
    const exams = readJson(examsFile);
    const exam = { id: Date.now().toString(), title, subject, date, maximumMarks };
    exams.push(exam);
    writeJson(examsFile, exams);
    res.status(201).json(exam);
});

app.get("/api/notifications", (req, res) => res.json(readJson(notificationsFile).slice(-30).reverse()));
app.post("/api/notifications", requireRole("admin", "teacher"), (req, res) => {
    const title = String(req.body.title || "").trim();
    const message = String(req.body.message || "").trim();
    if (!title || !message) return res.status(400).json({ message: "Title and message are required." });
    const notifications = readJson(notificationsFile);
    const notification = { id: Date.now().toString(), title, message, createdAt: new Date().toISOString(), createdBy: req.user.id };
    notifications.push(notification);
    writeJson(notificationsFile, notifications);
    res.status(201).json(notification);
});

app.get("/api/reports/attendance", (req, res) => {
    const from = String(req.query.from || "0000-01-01");
    const to = String(req.query.to || "9999-12-31");
    const attendance = readJson(attendanceFile).filter((item) => item.date >= from && item.date <= to);
    const rows = readStudents().map((student) => {
        const records = attendance.filter((item) => item.studentId === student.studentId);
        const attended = records.filter((item) => ["Present", "Late"].includes(item.status)).length;
        return { studentId: student.studentId, name: student.name, totalDays: records.length, attended, absent: records.filter((item) => item.status === "Absent").length, percentage: records.length ? Number(((attended / records.length) * 100).toFixed(2)) : 0 };
    });
    res.json({ from, to, rows });
});

app.get("/api/students", requireRole("admin", "teacher", "student"), (req, res) => {
    const students = readStudents();
    res.json(req.user.role === "student" ? students.filter((student) => student.studentId === req.user.studentId) : students);
});

app.post("/api/students", requireRole("admin"), (req, res) => {
    const name = String(req.body.name || "").trim();
    const studentId = String(req.body.studentId || "").trim();
    const email = String(req.body.email || "").trim();
    const className = String(req.body.className || "").trim();
    const phone = String(req.body.phone || "").trim();
    const photo = typeof req.body.photo === "string" && req.body.photo.startsWith("data:image/") ? req.body.photo : "";
    const balanceDue = Math.max(0, Number(req.body.balanceDue || 0));
    const amountPaid = Math.max(0, Number(req.body.amountPaid || 0));

    if (!name || !studentId || !email) {
        return res.status(400).json({ message: "Name, student ID, and email are required." });
    }

    const students = readStudents();
    if (students.some((student) => student.studentId.toLowerCase() === studentId.toLowerCase())) {
        return res.status(409).json({ message: "Student ID already exists." });
    }

    const student = { id: Date.now().toString(), name, studentId, email, className, phone, photo, balanceDue, amountPaid, paymentStatus: amountPaid >= balanceDue ? "paid" : "pending" };
    students.push(student);
    writeStudents(students);
    return res.status(201).json(student);
});

app.post("/api/students/:studentId/payment", requireRole("admin"), (req, res) => {
    const students = readStudents();
    const student = students.find((item) => item.studentId === req.params.studentId);
    const balanceDue = Math.max(0, Number(req.body.balanceDue || 0));
    const amountPaid = Math.max(0, Number(req.body.amountPaid || 0));
    if (!student || !Number.isFinite(balanceDue) || !Number.isFinite(amountPaid)) return res.status(400).json({ message: "Valid student and payment amounts are required." });
    student.balanceDue = balanceDue;
    student.amountPaid = amountPaid;
    student.paymentStatus = amountPaid >= balanceDue ? "paid" : "pending";
    writeStudents(students);
    res.json({ message: student.paymentStatus === "paid" ? "Payment complete. Results unlocked." : "Payment saved. Balance is still pending.", student });
});

app.get("/api/students/:studentId/report", requireRole("admin", "teacher", "student"), (req, res) => {
    if (req.user.role === "student" && req.user.studentId !== req.params.studentId) return res.status(403).json({ message: "You can only view your own report." });
    const student = readStudents().find((item) => item.studentId === req.params.studentId);
    if (!student) return res.status(404).json({ message: "Student not found." });

    const attendance = readJson(attendanceFile).filter((item) => item.studentId === student.studentId);
    const presentCount = attendance.filter((item) => ["Present", "Late"].includes(item.status)).length;
    const attendancePercentage = attendance.length ? Number(((presentCount / attendance.length) * 100).toFixed(2)) : 0;
    const resultsLocked = req.user.role === "student" && student.paymentStatus === "pending" && Number(student.balanceDue || 0) > Number(student.amountPaid || 0);
    const results = resultsLocked ? [] : readJson(resultsFile).filter((item) => item.studentId === student.studentId);
    const totalMarks = results.reduce((sum, item) => sum + item.marks, 0);
    const maximumMarks = results.reduce((sum, item) => sum + item.maximumMarks, 0);
    const examPercentage = maximumMarks ? Number(((totalMarks / maximumMarks) * 100).toFixed(2)) : 0;

    res.json({
        student,
        attendance,
        attendancePercentage,
        resultsLocked,
        results,
        summary: { totalMarks, maximumMarks, percentage: examPercentage, grade: calculateGrade(examPercentage) }
    });
});

app.post("/api/students/:studentId/attendance", requireRole("admin", "teacher"), (req, res) => {
    const student = readStudents().find((item) => item.studentId === req.params.studentId);
    const date = String(req.body.date || "").trim();
    const status = String(req.body.status || "").trim();
    if (!student) return res.status(404).json({ message: "Student not found." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !["Present", "Absent", "Late", "Excused"].includes(status)) {
        return res.status(400).json({ message: "A valid date and attendance status are required." });
    }

    const attendance = readJson(attendanceFile);
    const existing = attendance.find((item) => item.studentId === student.studentId && item.date === date);
    if (existing) existing.status = status;
    else attendance.push({ id: Date.now().toString(), studentId: student.studentId, date, status });
    writeJson(attendanceFile, attendance);
    res.status(201).json({ message: "Attendance saved." });
});

app.post("/api/students/:studentId/results", requireRole("admin", "teacher"), (req, res) => {
    const student = readStudents().find((item) => item.studentId === req.params.studentId);
    const exam = String(req.body.exam || "").trim();
    const subject = String(req.body.subject || "").trim();
    const marks = Number(req.body.marks);
    const maximumMarks = Number(req.body.maximumMarks);
    if (!student) return res.status(404).json({ message: "Student not found." });
    if (!exam || !subject || !Number.isFinite(marks) || !Number.isFinite(maximumMarks) || maximumMarks <= 0 || marks < 0 || marks > maximumMarks) {
        return res.status(400).json({ message: "Enter a valid exam, subject, marks, and maximum marks." });
    }

    const results = readJson(resultsFile);
    const existing = results.find((item) => item.studentId === student.studentId && item.exam === exam && item.subject === subject);
    const result = { id: existing?.id || Date.now().toString(), studentId: student.studentId, exam, subject, marks, maximumMarks, percentage: Number(((marks / maximumMarks) * 100).toFixed(2)), grade: calculateGrade((marks / maximumMarks) * 100) };
    if (existing) Object.assign(existing, result);
    else results.push(result);
    writeJson(resultsFile, results);
    res.status(201).json(result);
});

app.get("/api/classes", requireRole("admin", "teacher"), (req, res) => res.json(readJson(classesFile)));
app.post("/api/classes", requireRole("admin"), (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Class name is required." });
    const classes = readJson(classesFile);
    if (classes.some((item) => item.name.toLowerCase() === name.toLowerCase())) return res.status(409).json({ message: "Class already exists." });
    const item = { id: Date.now().toString(), name };
    classes.push(item);
    writeJson(classesFile, classes);
    res.status(201).json(item);
});

app.get("/api/subjects", requireRole("admin", "teacher"), (req, res) => res.json(readJson(subjectsFile)));
app.post("/api/subjects", requireRole("admin"), (req, res) => {
    const name = String(req.body.name || "").trim();
    if (!name) return res.status(400).json({ message: "Subject name is required." });
    const subjects = readJson(subjectsFile);
    if (subjects.some((item) => item.name.toLowerCase() === name.toLowerCase())) return res.status(409).json({ message: "Subject already exists." });
    const item = { id: Date.now().toString(), name };
    subjects.push(item);
    writeJson(subjectsFile, subjects);
    res.status(201).json(item);
});

app.get("/api/assignments", requireRole("admin", "teacher"), (req, res) => res.json(readJson(assignmentsFile)));
app.post("/api/assignments", requireRole("admin"), (req, res) => {
    const teacherId = String(req.body.teacherId || "").trim();
    const className = String(req.body.className || "").trim();
    const subject = String(req.body.subject || "").trim();
    if (!teacherId || !className || !subject) return res.status(400).json({ message: "Teacher, class, and subject are required." });
    const assignments = readJson(assignmentsFile);
    const assignment = { id: Date.now().toString(), teacherId, className, subject };
    assignments.push(assignment);
    writeJson(assignmentsFile, assignments);
    res.status(201).json(assignment);
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
