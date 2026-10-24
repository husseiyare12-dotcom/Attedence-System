const dateInput = document.getElementById("attendanceDate");
const searchInput = document.getElementById("studentSearch");
const table = document.getElementById("attendanceTable");
const message = document.getElementById("attendanceMessage");
let students = [];
let records = {};

dateInput.value = new Date().toISOString().slice(0, 10);

async function loadAttendance() {
    message.textContent = "Loading attendance...";
    const response = await fetch("/api/students");
    if (response.status === 401) { window.location.href = "/login.html"; return; }
    if (!response.ok) throw new Error("Could not load students.");
    students = await response.json();
    records = {};
    await Promise.all(students.map(async (student) => {
        const reportResponse = await fetch(`/api/students/${encodeURIComponent(student.studentId)}/report`);
        if (!reportResponse.ok) return;
        const report = await reportResponse.json();
        const record = report.attendance.find((item) => item.date === dateInput.value);
        if (record) records[student.studentId] = record.status;
    }));
    render();
    message.textContent = "";
}

function render() {
    const search = searchInput.value.trim().toLowerCase();
    const visible = students.filter((student) => `${student.name} ${student.studentId}`.toLowerCase().includes(search));
    table.innerHTML = "";
    visible.forEach((student) => {
        const row = document.createElement("tr");
        row.innerHTML = `<td>${student.name}</td><td>${student.studentId}</td><td>${student.className || "-"}</td>`;
        const statusCell = document.createElement("td");
        const select = document.createElement("select");
        ["Not marked", "Present", "Absent", "Late", "Excused"].forEach((status) => {
            const option = new Option(status, status === "Not marked" ? "" : status, false, records[student.studentId] === status);
            select.add(option);
        });
        select.value = records[student.studentId] || "";
        select.addEventListener("change", () => { records[student.studentId] = select.value; updateSummary(); });
        statusCell.appendChild(select);
        const actionCell = document.createElement("td");
        const save = document.createElement("button");
        save.textContent = "Save";
        save.type = "button";
        save.addEventListener("click", () => saveAttendance(student.studentId, select.value));
        actionCell.appendChild(save);
        row.append(statusCell, actionCell);
        table.appendChild(row);
    });
    updateSummary();
}

function updateSummary() {
    const values = students.map((student) => records[student.studentId] || "");
    document.getElementById("totalCount").textContent = students.length;
    document.getElementById("presentCount").textContent = values.filter((status) => ["Present", "Late"].includes(status)).length;
    document.getElementById("absentCount").textContent = values.filter((status) => status === "Absent").length;
    document.getElementById("unmarkedCount").textContent = values.filter((status) => !status).length;
}

async function saveAttendance(studentId, status) {
    if (!status) { message.textContent = "Select an attendance status first."; return; }
    const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/attendance`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: dateInput.value, status })
    });
    const result = await response.json();
    message.textContent = response.ok ? "Attendance saved successfully." : result.message;
}

dateInput.addEventListener("change", loadAttendance);
searchInput.addEventListener("input", render);
document.getElementById("refreshButton").addEventListener("click", loadAttendance);
loadAttendance().catch((error) => { message.textContent = error.message; });
