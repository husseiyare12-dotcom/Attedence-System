const form = document.getElementById("studentForm");
const studentsList = document.getElementById("studentsList");
const message = document.createElement("p");
form.insertAdjacentElement("afterend", message);
let selectedStudentId = null;

function showStudentView(view) {
    document.querySelectorAll(".student-view").forEach((section) => { section.hidden = section.id !== `${view}View`; });
    document.querySelectorAll("[data-student-view]").forEach((button) => { button.classList.toggle("active", button.dataset.studentView === view); });
    const extras = document.getElementById("studentExtras");
    const nav = document.getElementById("studentNav");
    if (extras && nav && !nav.hidden) extras.hidden = view !== "exams";
}

function gradeClass(grade) {
    return `grade-${String(grade || "F").toLowerCase().replace(/[^a-z]/g, "")}`;
}

document.querySelectorAll("[data-student-view]").forEach((button) => {
    button.addEventListener("click", () => showStudentView(button.dataset.studentView));
});

function hideForStudent() {
    form.hidden = true;
    document.getElementById("studentsListTitle").hidden = true;
    studentsList.hidden = true;
    document.querySelector(".lookup-card").hidden = true;
    document.getElementById("portalTitle").textContent = "My Student Dashboard";
    document.getElementById("portalSubtitle").textContent = "View your attendance, payments, exams, and results.";
    document.getElementById("studentNav").hidden = false;
    showStudentView("profile");
    document.getElementById("attendanceForm").hidden = true;
    document.getElementById("attendanceForm").previousElementSibling.hidden = true;
    document.getElementById("resultForm").hidden = true;
    document.getElementById("resultForm").previousElementSibling.hidden = true;
}

async function loadStudentExtras() {
    const [examsResponse, notificationsResponse] = await Promise.all([fetch("/api/exams"), fetch("/api/notifications")]);
    const exams = examsResponse.ok ? await examsResponse.json() : [];
    const notifications = notificationsResponse.ok ? await notificationsResponse.json() : [];
    document.getElementById("examSchedule").innerHTML = exams.length ? exams.map((exam) => `<li><strong>${exam.title || exam.exam}</strong> · ${exam.subject} · ${exam.date}</li>`).join("") : '<li class="empty-state">No upcoming exams.</li>';
    document.getElementById("portalNotifications").innerHTML = notifications.length ? notifications.map((item) => `<li><strong>${item.title}</strong><br>${item.message}</li>`).join("") : '<li class="empty-state">No notifications yet.</li>';
}

async function initPortal() {
    const response = await fetch("/api/auth/me");
    const auth = await response.json();
    if (!auth.authenticated) { window.location.href = "/login.html"; return; }
    document.getElementById("portalLogout").addEventListener("click", async (event) => { event.preventDefault(); await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login.html"; });
    if (auth.user.role === "student") {
        hideForStudent();
        await loadReport(auth.user.studentId);
        await loadStudentExtras();
        return;
    }
    document.querySelectorAll(".student-view").forEach((section) => { section.hidden = false; });
    await loadStudents();
}

function renderStudents(students) {
    studentsList.innerHTML = "";

    students.forEach((student) => {
        const li = document.createElement("li");
        li.className = "student-list-card";
        const avatar = document.createElement("div");
        avatar.className = "student-list-avatar";
        if (student.photo) {
            const image = document.createElement("img");
            image.src = student.photo;
            image.alt = `${student.name} photo`;
            avatar.appendChild(image);
        } else {
            avatar.textContent = (student.name || "?").trim().charAt(0).toUpperCase() || "?";
        }
        const details = document.createElement("div");
        details.className = "student-list-details";
        const name = document.createElement("strong");
        name.textContent = student.name;
        const meta = document.createElement("span");
        meta.textContent = `${student.studentId} · ${student.className || "Class not provided"}`;
        const email = document.createElement("small");
        email.textContent = student.email || "No email provided";
        details.append(name, meta, email);
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "View report";
        button.className = "student-list-action";
        button.addEventListener("click", () => loadReport(student.studentId));
        li.append(avatar, details, button);
        studentsList.appendChild(li);
    });
}

async function loadReport(studentId) {
    const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/report`);
    const report = await response.json();
    if (!response.ok) throw new Error(report.message || "Could not load report.");
    selectedStudentId = studentId;
    document.getElementById("studentReport").hidden = false;
    const photo = document.getElementById("reportPhoto");
    photo.src = report.student.photo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='100%25' height='100%25' fill='%23dbeafe'/%3E%3Ctext x='50%25' y='55%25' text-anchor='middle' font-size='36' fill='%231d4ed8'%3E%3F%3C/text%3E%3C/svg%3E";
    document.getElementById("reportProfile").textContent = `${report.student.name} | ID: ${report.student.studentId} | Email: ${report.student.email} | Class: ${report.student.className || "Not provided"} | Phone: ${report.student.phone || "Not provided"}`;
    document.getElementById("reportStudent").textContent = `${report.student.name} (${report.student.studentId})`;
    const attendancePercentage = Math.max(0, Math.min(100, Number(report.attendancePercentage || 0)));
    const attendanceRing = document.getElementById("attendancePercentage");
    attendanceRing.textContent = `Attendance percentage: ${attendancePercentage}%`;
    attendanceRing.dataset.percent = attendancePercentage;
    attendanceRing.style.setProperty("--attendance-progress", `${attendancePercentage}%`);
    const balanceDue = Number(report.student.balanceDue || 0);
    const amountPaid = Number(report.student.amountPaid || 0);
    const remaining = Math.max(0, balanceDue - amountPaid);
    document.getElementById("reportBalanceDue").textContent = `${balanceDue.toLocaleString()} USD`;
    document.getElementById("reportAmountPaid").textContent = `${amountPaid.toLocaleString()} USD`;
    document.getElementById("reportRemainingBalance").textContent = `${remaining.toLocaleString()} USD`;
    document.getElementById("reportPaymentStatus").textContent = report.student.paymentStatus === "paid" ? "Paid" : "Pending";
    document.getElementById("resultsAccessNotice").textContent = report.resultsLocked ? `Results are locked. Please pay the remaining balance of ${remaining.toLocaleString()} USD to view your exam results.` : "Your results are available because your payment is complete.";
    const summary = document.getElementById("resultsSummary");
    summary.innerHTML = report.resultsLocked ? `<div class="results-locked"><span class="lock-icon">🔒</span><div><strong>Results are locked</strong><p>Pay the remaining balance to unlock your exam results.</p></div></div>` : `<div class="result-summary-grid"><div><span>Total marks</span><strong>${report.summary.totalMarks}/${report.summary.maximumMarks}</strong></div><div><span>Average</span><strong>${report.summary.percentage}%</strong></div><div><span>Overall grade</span><strong class="grade-badge ${gradeClass(report.summary.grade)}">${report.summary.grade}</strong></div></div>`;
    document.getElementById("attendanceHistory").innerHTML = report.attendance.map((item) => `<li>${item.date}: ${item.status}</li>`).join("") || "<li>No attendance records yet.</li>";
    document.getElementById("resultsList").innerHTML = report.results.map((item) => `<li class="result-card"><div class="result-card-icon">✦</div><div class="result-card-main"><span class="result-subject">${item.subject}</span><h4>${item.exam}</h4><p>${item.marks}/${item.maximumMarks} marks · ${item.percentage}%</p></div><strong class="grade-badge ${gradeClass(item.grade)}">${item.grade || "N/A"}</strong></li>`).join("") || '<li class="empty-state result-empty">No exam results yet.</li>';
}

document.getElementById("lookupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        await loadReport(document.getElementById("lookupStudentId").value.trim());
    } catch (error) {
        message.textContent = error.message;
    }
});

async function loadStudents() {
    const response = await fetch("/api/students");
    if (response.status === 401) { window.location.href = "/login.html"; return; }
    if (!response.ok) throw new Error("Could not load students.");
    renderStudents(await response.json());
}

form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = document.getElementById("name").value;
    const studentId = document.getElementById("studentId").value;
    const email = document.getElementById("email").value;
    const className = document.getElementById("className").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const photoFile = document.getElementById("photo").files[0];

    message.textContent = "Saving...";

    try {
        const photo = photoFile ? await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(photoFile);
        }) : "";
        const response = await fetch("/api/students", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, studentId, email, className, phone, photo })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Unable to add student.");

        form.reset();
        message.textContent = "Student added successfully.";
        await loadStudents();
    } catch (error) {
        message.textContent = error.message;
    }
});

initPortal().catch((error) => {
    message.textContent = error.message;
});

document.getElementById("attendanceForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedStudentId) return;
    const response = await fetch(`/api/students/${encodeURIComponent(selectedStudentId)}/attendance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: document.getElementById("attendanceDate").value, status: document.getElementById("attendanceStatus").value }) });
    const result = await response.json();
    message.textContent = result.message;
    if (response.ok) await loadReport(selectedStudentId);
});

document.getElementById("resultForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedStudentId) return;
    const response = await fetch(`/api/students/${encodeURIComponent(selectedStudentId)}/results`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exam: document.getElementById("exam").value, subject: document.getElementById("subject").value, marks: document.getElementById("marks").value, maximumMarks: document.getElementById("maximumMarks").value }) });
    const result = await response.json();
    message.textContent = response.ok ? "Exam result saved." : result.message;
    if (response.ok) { event.target.reset(); await loadReport(selectedStudentId); }
});
