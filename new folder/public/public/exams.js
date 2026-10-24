const form = document.getElementById("examForm");
const table = document.getElementById("examTable");
const message = document.getElementById("examMessage");
const resultForm = document.getElementById("resultForm");
const resultStudent = document.getElementById("resultStudent");
const resultMessage = document.getElementById("resultMessage");

async function loadExams() {
    const response = await fetch("/api/exams");
    const exams = await response.json();
    table.innerHTML = exams.map((exam) => `<tr><td>${exam.title}</td><td>${exam.subject}</td><td>${exam.date}</td><td>${exam.maximumMarks}</td></tr>`).join("") || '<tr><td colspan="4">No examinations created yet.</td></tr>';
}

async function loadStudentsForResults() {
    const response = await fetch("/api/students");
    if (response.status === 401) { window.location.href = "/login.html"; return; }
    const students = await response.json();
    resultStudent.innerHTML = '<option value="">Select student</option>' + students.map((student) => `<option value="${student.studentId}">${student.name} · ${student.studentId}</option>`).join("");
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const response = await fetch("/api/exams", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: document.getElementById("title").value, subject: document.getElementById("subject").value, date: document.getElementById("date").value, maximumMarks: document.getElementById("maximumMarks").value }) });
    const result = await response.json();
    message.textContent = response.ok ? "Examination created." : result.message;
    if (response.ok) { form.reset(); await loadExams(); }
});

loadExams().catch((error) => { message.textContent = error.message; });
loadStudentsForResults().catch((error) => { resultMessage.textContent = error.message; });

resultForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const studentId = resultStudent.value;
    const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/results`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ exam: document.getElementById("resultExam").value, subject: document.getElementById("resultSubject").value, marks: document.getElementById("resultMarks").value, maximumMarks: document.getElementById("resultMaximumMarks").value }) });
    const result = await response.json();
    resultMessage.textContent = response.ok ? `Result saved. Grade: ${result.grade}` : result.message || "Could not save result.";
    if (response.ok) event.target.reset();
});
