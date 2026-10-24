let students = [];
const attendance = {};

function applyTheme(theme) {
    const isDark = theme === "dark";
    document.body.classList.toggle("dark-mode", isDark);
    const toggle = document.getElementById("themeToggle");
    const icon = document.getElementById("themeIcon");
    const label = document.getElementById("themeLabel");
    if (toggle) {
        toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
        toggle.title = isDark ? "Switch to light mode" : "Switch to dark mode";
    }
    if (icon) icon.textContent = isDark ? "☀" : "☾";
    if (label) label.textContent = isDark ? "Light mode" : "Dark mode";
}

const savedTheme = localStorage.getItem("attendance-theme");
applyTheme(savedTheme === "dark" ? "dark" : "light");
document.getElementById("themeToggle")?.addEventListener("click", () => {
    const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
    localStorage.setItem("attendance-theme", nextTheme);
    applyTheme(nextTheme);
});

const form = document.getElementById("studentForm");
const table = document.getElementById("studentTable");

function renderStudents() {
    table.innerHTML = "";

    students.forEach((student) => {
        const status = attendance[student.studentId] || "Not marked";

        const row = document.createElement("tr");

        const idCell = document.createElement("td");
        idCell.textContent = student.studentId;

        const nameCell = document.createElement("td");
        nameCell.textContent = student.name;

        const statusCell = document.createElement("td");
        statusCell.textContent = status;

        const actionCell = document.createElement("td");
        const select = document.createElement("select");

        ["Present", "Absent", "Late"].forEach((value) => {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = value;
            option.selected = status === value;
            select.appendChild(option);
        });

        select.addEventListener("change", () => {
            saveAttendance(student.studentId, select.value);
        });

        actionCell.appendChild(select);

        row.append(idCell, nameCell, statusCell, actionCell);
        table.appendChild(row);
    });

    document.getElementById("totalStudents").textContent =
        students.length;

    document.getElementById("presentStudents").textContent =
        students.filter(s => attendance[s.studentId] === "Present").length;

    document.getElementById("absentStudents").textContent =
        students.filter(s => attendance[s.studentId] === "Absent").length;

    document.getElementById("summary").textContent =
        `${students.length} students registered. Attendance can be marked Present, Absent, or Late.`;
}

async function saveAttendance(studentId, status) {
    const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: new Date().toISOString().slice(0, 10), status })
    });
    if (!response.ok) {
        const result = await response.json();
        alert(result.message || "Could not save attendance.");
        return;
    }
    attendance[studentId] = status;
    renderStudents();
}

async function loadStudents() {
    const response = await fetch("/api/students");
    if (response.status === 401) { window.location.href = "/login.html"; return; }
    if (!response.ok) throw new Error("Could not load students.");
    students = await response.json();

    await Promise.all(students.map(async (student) => {
        const reportResponse = await fetch(`/api/students/${encodeURIComponent(student.studentId)}/report`);
        if (!reportResponse.ok) return;
        const report = await reportResponse.json();
        const today = new Date().toISOString().slice(0, 10);
        const todayRecord = report.attendance.find((item) => item.date === today);
        if (todayRecord) attendance[student.studentId] = todayRecord.status;
    }));
    renderStudents();
}

async function loadDashboard() {
    const response = await fetch("/api/dashboard");
    if (!response.ok) return;
    const dashboard = await response.json();
    document.getElementById("totalTeachers").textContent = dashboard.totalTeachers;
    if (dashboard.financial) {
        document.getElementById("totalFeesDue").textContent = money(dashboard.financial.totalDue);
        document.getElementById("totalFeesPaid").textContent = money(dashboard.financial.totalPaid);
        document.getElementById("totalOutstanding").textContent = money(dashboard.financial.outstanding);
    }
    const podium = document.getElementById("topStudents");
    podium.innerHTML = dashboard.topStudents.length ? dashboard.topStudents.map((student, index) => `<article class="podium-item rank-${index + 1}"><strong>${index + 1}</strong><div class="podium-avatar">${student.photo ? `<img src="${student.photo}" alt="${student.name}">` : "?"}</div><h3>${student.name}</h3><p>${student.className || "Class not provided"}</p><b>${student.percentage}%</b></article>`).join("") : '<p class="empty-state">No exam results yet.</p>';
}

async function loadAccount() {
    const response = await fetch("/api/auth/me");
    const result = await response.json();
    const authLink = document.getElementById("authLink");
    if (result.authenticated) {
        authLink.textContent = `${result.user.name} · Logout`;
        authLink.href = "#logout";
        authLink.onclick = async (event) => { event.preventDefault(); await fetch("/api/auth/logout", { method: "POST" }); window.location.reload(); };
        if (result.user.role === "admin") { document.getElementById("adminManagement").hidden = false; loadAdminManagement(); }
    }
    const notifications = await fetch("/api/notifications").then((item) => item.json());
    document.getElementById("notificationList").innerHTML = notifications.map((item) => `<li><strong>${item.title}</strong><br>${item.message}</li>`).join("") || '<li class="empty-state">No notifications yet.</li>';
}

async function loadAdminManagement() {
    const [teachersResponse, classesResponse, subjectsResponse] = await Promise.all([fetch("/api/teachers"), fetch("/api/classes"), fetch("/api/subjects")]);
    if (!teachersResponse.ok) return;
    const teachers = await teachersResponse.json(), classes = await classesResponse.json(), subjects = await subjectsResponse.json();
    document.getElementById("teacherList").innerHTML = teachers.map((teacher) => `<li><strong>${teacher.name}</strong><small>${teacher.email}</small></li>`).join("") || '<li class="empty-state">No teachers yet.</li>';
    document.getElementById("classSubjectList").innerHTML = [...classes.map((item) => `<li><span>Class</span>${item.name}</li>`), ...subjects.map((item) => `<li><span>Subject</span>${item.name}</li>`)].join("") || '<li class="empty-state">No classes or subjects yet.</li>';
}
async function submitAdminForm(event, url, body) { event.preventDefault(); const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }), result = await response.json(), message = document.getElementById("adminMessage"); message.textContent = result.message || (response.ok ? "Saved successfully." : "Could not save."); if (!response.ok) return; event.target.reset(); loadAdminManagement(); if (url === "/api/notifications") loadAccount(); }
document.getElementById("teacherForm")?.addEventListener("submit", (event) => submitAdminForm(event, "/api/teachers", { name: document.getElementById("teacherName").value, email: document.getElementById("teacherEmail").value, password: document.getElementById("teacherPassword").value }));
document.getElementById("classForm")?.addEventListener("submit", (event) => submitAdminForm(event, "/api/classes", { name: document.getElementById("className").value }));
document.getElementById("subjectForm")?.addEventListener("submit", (event) => submitAdminForm(event, "/api/subjects", { name: document.getElementById("subjectName").value }));
document.getElementById("notificationForm")?.addEventListener("submit", (event) => submitAdminForm(event, "/api/notifications", { title: document.getElementById("notificationTitle").value, message: document.getElementById("notificationText").value }));
document.getElementById("paymentForm")?.addEventListener("submit", async (event) => { event.preventDefault(); const id = document.getElementById("paymentStudentId").value.trim(); const response = await fetch(`/api/students/${encodeURIComponent(id)}/payment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ balanceDue: document.getElementById("paymentBalance").value, amountPaid: document.getElementById("paymentAmount").value }) }); const result = await response.json(); document.getElementById("paymentMessage").textContent = result.message || "Payment update failed."; if (response.ok) { event.target.reset(); loadDashboard(); } });

function money(value) {
    return `${Number(value || 0).toLocaleString()} USD`;
}

function setLookupValue(id, value) {
    document.getElementById(id).textContent = value || "Not provided";
}

function renderLookupResult(report) {
    const student = report.student;
    const remaining = Math.max(0, Number(student.balanceDue || 0) - Number(student.amountPaid || 0));
    setLookupValue("lookupName", student.name);
    setLookupValue("lookupMeta", `${student.className || "Class not provided"} · ${student.paymentStatus === "paid" ? "Account cleared" : "Payment pending"}`);
    setLookupValue("lookupId", student.studentId);
    setLookupValue("lookupEmail", student.email);
    setLookupValue("lookupPhone", student.phone);
    setLookupValue("lookupClass", student.className);
    setLookupValue("lookupAttendance", `${report.attendancePercentage || 0}%`);
    setLookupValue("lookupAverage", `${report.summary?.percentage || 0}% (${report.summary?.grade || "N/A"})`);
    setLookupValue("lookupBalance", money(student.balanceDue));
    setLookupValue("lookupPaid", money(student.amountPaid));
    setLookupValue("lookupRemaining", money(remaining));
    setLookupValue("lookupPaymentStatus", student.paymentStatus === "paid" ? "Paid" : "Pending");
    const photo = document.getElementById("lookupPhoto");
    photo.src = student.photo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='100%25' height='100%25' rx='20' fill='%23dbeafe'/%3E%3Ctext x='50%25' y='58%25' text-anchor='middle' font-size='38' fill='%231d4ed8'%3E%3F%3C/text%3E%3C/svg%3E";
    const results = document.getElementById("lookupExamResults");
    results.innerHTML = report.results?.length ? report.results.map((item) => `<div class="result-row"><span>${item.exam} · ${item.subject}</span><strong>${item.marks}/${item.maximumMarks} (${item.grade || "N/A"})</strong></div>`).join("") : '<p class="empty-state">No exam results recorded.</p>';
    document.getElementById("lookupResult").hidden = false;
}

async function lookupStudentById() {
    const id = document.getElementById("lookupStudentId").value.trim();
    const message = document.getElementById("lookupMessage");
    if (!id) return;
    message.textContent = "Loading student information...";
    const response = await fetch(`/api/students/${encodeURIComponent(id)}/report`);
    const result = await response.json();
    if (!response.ok) {
        document.getElementById("lookupResult").hidden = true;
        message.textContent = result.message || "Student not found.";
        return;
    }
    message.textContent = "Student information loaded successfully.";
    renderLookupResult(result);
}

document.getElementById("studentLookupForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await lookupStudentById();
});
document.getElementById("lookupStudentId")?.addEventListener("blur", lookupStudentById);

form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = document.getElementById("studentName").value.trim();
    const id = document.getElementById("studentId").value.trim();
    const email = document.getElementById("studentEmail").value.trim();
    const className = document.getElementById("studentClass").value.trim();
    const phone = document.getElementById("studentPhone").value.trim();
    const balanceDue = Number(document.getElementById("studentBalance").value || 0);
    const amountPaid = Number(document.getElementById("studentPaid").value || 0);
    const photoFile = document.getElementById("studentPhoto").files[0];

    if (students.some(student => student.studentId.toLowerCase() === id.toLowerCase())) {
        alert("Student ID already exists.");
        return;
    }

    const photo = photoFile ? await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(photoFile);
    }) : "";
    const response = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, studentId: id, email, className, phone, photo, balanceDue, amountPaid })
    });
    const result = await response.json();
    if (!response.ok) {
        document.getElementById("studentMessage").textContent = result.message || "Could not add student.";
        return;
    }
    form.reset();
    students.push(result);
    document.getElementById("studentMessage").textContent = "Student added successfully.";
    document.getElementById("profilePreview").hidden = false;
    document.getElementById("profileName").textContent = result.name;
    document.getElementById("profileInfo").textContent = `ID: ${result.studentId} | ${result.className || "Class not provided"} | ${result.email}`;
    document.getElementById("profilePhoto").src = result.photo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='100%25' height='100%25' fill='%23dbeafe'/%3E%3Ctext x='50%25' y='55%25' text-anchor='middle' font-size='36' fill='%231d4ed8'%3E%3F%3C/text%3E%3C/svg%3E";
    renderStudents();
});

loadStudents().catch((error) => {
    document.getElementById("summary").textContent = error.message;
});
loadDashboard();
loadAccount();
setInterval(() => { if (!document.hidden) loadDashboard(); }, 15000);
