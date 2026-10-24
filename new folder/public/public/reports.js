const fromDate = document.getElementById("fromDate");
const toDate = document.getElementById("toDate");
const table = document.getElementById("reportTable");
const message = document.getElementById("reportMessage");
fromDate.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
toDate.value = new Date().toISOString().slice(0, 10);

async function generateReport() {
    const response = await fetch(`/api/reports/attendance?from=${fromDate.value}&to=${toDate.value}`);
    if (response.status === 401) { window.location.href = "/login.html"; return; }
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not load report.");
    table.innerHTML = result.rows.map((row) => `<tr><td>${row.name}</td><td>${row.studentId}</td><td>${row.totalDays}</td><td>${row.attended}</td><td>${row.absent}</td><td>${row.percentage}%</td></tr>`).join("") || '<tr><td colspan="6">No students found.</td></tr>';
    message.textContent = `Report: ${result.from} to ${result.to}`;
}

document.getElementById("loadReport").addEventListener("click", () => generateReport().catch((error) => { message.textContent = error.message; }));
generateReport().catch((error) => { message.textContent = error.message; });
