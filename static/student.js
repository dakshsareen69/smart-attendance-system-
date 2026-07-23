// ================= GLOBAL ERROR SAFETY =================
window.onerror = function (msg, url, line) {
    console.log("JS ERROR:", msg, "at line", line);
};

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {

    let name = localStorage.getItem("name");

    if (name) {
        document.getElementById("studentName").innerText = "Welcome " + name;
    }

    showSection("dashboard");

    // Load everything
    loadAttendance();
    loadAssignments();
    loadNotes();
    loadAnnouncements();
    loadCGPA();
    loadNotifications();
    loadScheduleStudent();
});

// ================= UI MESSAGE =================
function showMsg(msg, color = "green") {

    let box = document.getElementById("sideMessage");
    if (!box) return;

    box.innerText = msg;
    box.style.background = color;
    box.classList.add("show");

    setTimeout(() => {
        box.classList.remove("show");
    }, 5000);
}

function handleResponse(d) {
    let color = "green";

    if (d.status === "error") color = "red";
    if (d.status === "warning") color = "orange";

    showMsg(d.message || "Done", color);
}

// ================= SECTION CONTROL =================
function showSection(section) {

    let sections = ["dashboard", "attendance", "schedule", "assignments", "notes", "announcements", "marks"];

    sections.forEach(id => {
        let el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    let active = document.getElementById(section);
    if (active) active.style.display = "block";

    if (section === "attendance") loadAttendance();
    if (section === "assignments") loadAssignments();
    if (section === "notes") loadNotes();
    if (section === "announcements") loadAnnouncements();
    if (section === "schedule") loadScheduleStudent();
    if (section === "marks") loadMarksTable();
    if (section === "dashboard") {
        setTimeout(() => {
            loadCGPA();
        }, 300);
    }
}

// ================= DATE HELPER =================
function getToday() {
    let d = new Date();

    let year = d.getFullYear();
    let month = String(d.getMonth() + 1).padStart(2, '0');
    let day = String(d.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

// ================= ATTENDANCE =================
function loadAttendance() {

    let name = localStorage.getItem("name");
    if (!name) return;

    Promise.all([
        fetch("/get_my_attendance/" + name).then(r => r.json()).catch(() => [])
    ]).then(([att]) => {

        let table = document.getElementById("attendanceTable");
        if (!table) return;

        table.innerHTML = "";

        if (!att || att.length === 0) {
            table.innerHTML = `<tr><td colspan="3">No attendance records</td></tr>`;
            document.getElementById("attValue").innerText = "0%";
            return;
        }

        let present = 0;
        let total = att.length;

        att.forEach(a => {
            let status = a.status || "present";
            if (status === "present") present++;

            let statusText = status === "present" ? "✔ Present" : "✘ Absent";
            let statusColor = status === "present" ? "color:green;" : "color:red;";

            table.innerHTML += `
            <tr>
                <td>${a.subject || "N/A"}</td>
                <td>${a.class_date}</td>
                <td style="${statusColor}font-weight:bold;">${statusText}</td>
            </tr>`;
        });

        let percent = total > 0 ? Math.round((present / total) * 100) : 0;
        loadAttendanceGraph(percent);

        let fill = document.getElementById("progressFill");
        if (fill) fill.style.width = percent + "%";

        let text = document.getElementById("percentText");
        if (text) text.innerText = `Attendance: ${present}/${total} (${percent}%)`;

        let val = document.getElementById("attValue");
        if (val) val.innerText = percent + "%";

    }).catch(() => {
        showMsg("Failed to load attendance ❌", "red");
    });
}

// ================= SCHEDULE =================
function loadScheduleStudent() {
    fetch("/get_schedule")
        .then(r => r.json())
        .then(data => {
            // Full table
            let table = document.getElementById("scheduleTable");
            if (table) {
                table.innerHTML = "";

                if (data.length === 0) {
                    table.innerHTML = "<tr><td colspan='3'>No scheduled classes</td></tr>";
                } else {
                    data.forEach(c => {
                        table.innerHTML += `
                    <tr>
                        <td>${c.subject || "N/A"}</td>
                        <td>${c.date}</td>
                        <td>${c.time || "N/A"}</td>
                    </tr>`;
                    });
                }
            }

            // Dashboard mini list
            let list = document.getElementById("dashScheduleList");
            if (list) {
                list.innerHTML = "";

                if (data.length === 0) {
                    list.innerHTML = "<li>No upcoming classes</li>";
                } else {
                    data.slice(0, 5).forEach(c => {
                        list.innerHTML += `<li>📘 <b>${c.subject || "Class"}</b> — ${c.date} at ${c.time || "N/A"}</li>`;
                    });
                }
            }
        })
        .catch(() => {
            showMsg("Failed to load schedule ❌", "red");
        });
}

// ================= ASSIGNMENTS =================
function loadAssignments() {

    let name = localStorage.getItem("name");

    Promise.all([
        fetch("/get_assignments").then(r => r.json()),
        fetch("/get_submissions").then(r => r.json())
    ])
        .then(([assignments, submissions]) => {
            let val = document.getElementById("assignValue");
            if (val) val.innerText = assignments.length;

            let total = assignments.length;
            let done = submissions.filter(s => s[1] === name).length;

            let progress = document.getElementById("assignProgress");
            if (progress) {
                progress.innerHTML = `
                <b>${done} / ${total}</b><br>
                <small>Assignments Submitted</small>
            `;
            }

            let list = document.getElementById("assignmentList");
            if (!list) return;

            list.innerHTML = "";

            assignments.forEach(a => {

                let submitted = submissions.find(s =>
                    s[1] === name && s[2] === a[1]
                );

                list.innerHTML += `
            <li>
                <b>${a[1]}</b><br>
                <small>${a[3]}</small><br>

                <a href="/uploads/${a[2]}" target="_blank">View</a>

                <br><br>

                ${submitted
                        ?
                        `<span style="color:green;font-weight:bold;">
                        ✅ Submitted (${submitted[4]})
                    </span>
                    <br><br>
                    <button onclick="deleteSubmission('${submitted[0]}')" style="background:#e74c3c;">Delete Submission</button>`
                        :
                        `<form onsubmit="submitAssignment(event,'${a[1]}')">
                        <input type="file" required>
                        <button>Submit</button>
                    </form>`
                    }

                <hr>
            </li>`;
            });

        })
        .catch(() => {
            showMsg("Assignments load failed ❌", "red");
        });
}

// ================= ANNOUNCEMENTS =================
function loadAnnouncements() {

    fetch("/get_announcements")
        .then(r => r.json())
        .then(data => {

            let list = document.getElementById("announcementList");
            if (!list) return;

            list.innerHTML = "";

            data.forEach(a => {
                list.innerHTML += `
            <li>
                <b>${a[1]}</b><br>
                <small>By: ${a[3]} | ${a[2]}</small>
            </li>`;
            });
        })
        .catch(() => {
            showMsg("Announcements load failed ❌", "red");
        });
}

// ================= CGPA =================
function loadCGPA() {
    let name = localStorage.getItem("name");
    if (!name) return;

    fetch("/get_cgpa/" + encodeURIComponent(name))
        .then(r => r.json())
        .then(data => {
            let val = document.getElementById("cgpaValue");
            if (val) val.innerText = data.cgpa ? data.cgpa.toFixed(2) : "0.00";

            let detail = document.getElementById("cgpaDetail");
            if (detail) detail.innerText = data.cgpa ? data.cgpa.toFixed(2) : "0.00";
        })
        .catch(() => {
            let val = document.getElementById("cgpaValue");
            if (val) val.innerText = "—";
        });
}

// ================= MARKS TABLE =================
function loadMarksTable() {
    let name = localStorage.getItem("name");
    if (!name) return;

    Promise.all([
        fetch("/get_cgpa/" + encodeURIComponent(name)).then(r => r.json()),
    ])
        .then(([cgpaData]) => {
            let table = document.getElementById("marksTable");
            if (!table) return;

            table.innerHTML = "";

            if (!cgpaData.subjects || cgpaData.subjects.length === 0) {
                table.innerHTML = "<tr><td colspan='4'>No marks available</td></tr>";
                return;
            }

            cgpaData.subjects.forEach(s => {
                table.innerHTML += `
            <tr>
                <td>${s.subject || "N/A"}</td>
                <td>${s.theory}</td>
                <td>${s.practical}</td>
                <td><b>${s.total}</b></td>
            </tr>`;
            });

            let detail = document.getElementById("cgpaDetail");
            if (detail) detail.innerText = cgpaData.cgpa ? cgpaData.cgpa.toFixed(2) : "0.00";
        })
        .catch(() => {
            showMsg("Marks load failed ❌", "red");
        });
}

// ================= SUBMIT ASSIGNMENT =================
function submitAssignment(e, title) {

    e.preventDefault();

    let file = e.target.querySelector("input").files[0];
    let name = localStorage.getItem("name");

    if (!file) {
        showMsg("Please select file ❌", "red");
        return;
    }

    let fd = new FormData();
    fd.append("file", file);
    fd.append("name", name);
    fd.append("title", title);

    fetch("/submit_assignment", {
        method: "POST",
        body: fd
    })
        .then(r => r.json())
        .then(d => {
            handleResponse({
                message: d.message,
                status: d.message.includes("Submitted") ? "success" : "error"
            });

            setTimeout(() => {
                loadAssignments();
            }, 300);
        })
        .catch(() => {
            showMsg("Submission failed ❌", "red");
        });
}

function deleteSubmission(submissionId) {

    let name = localStorage.getItem("name");

    if (!name) {
        showMsg("Session expired ❌", "red");
        return;
    }

    if (!confirm("Are you sure you want to delete this submission?")) {
        return;
    }

    fetch("/delete_submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId, name })
    })
        .then(r => r.json())
        .then(d => {
            handleResponse(d);
            setTimeout(() => {
                loadAssignments();
            }, 300);
        })
        .catch(() => {
            showMsg("Delete failed ❌", "red");
        });
}

// ================= LOGOUT =================
function logout() {
    localStorage.clear();
    location.href = "/";
}

// ================= NOTES =================
function loadNotes() {

    fetch("/get_notes")
        .then(r => r.json())
        .then(data => {

            let list = document.getElementById("notesList");
            if (!list) return;

            list.innerHTML = "";

            if (data.length === 0) {
                list.innerHTML = "<p>No notes available</p>";
                return;
            }

            data.forEach(n => {
                list.innerHTML += `
            <li>
                <b>${n[1]}</b><br>
                <small>Uploaded: ${n[3]}</small><br>
                <a href="/uploads/${n[2]}" target="_blank">Download</a>
            </li>`;
            });

        })
        .catch(() => {
            showMsg("Notes load failed ❌", "red");
        });
}

// ================= ATTENDANCE GRAPH =================
function loadAttendanceGraph(percent) {

    const ctx = document.getElementById("attendanceChart");

    if (!ctx) return;

    if (window.attChart) {
        window.attChart.destroy();
    }

    window.attChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Present", "Absent"],
            datasets: [{
                data: [percent, 100 - percent],
                backgroundColor: ["#00c6ff", "#ff6b6b"]
            }]
        }
    });
}

function loadNotifications() {

    fetch("/get_announcements")
        .then(r => r.json())
        .then(data => {

            let list = document.getElementById("notifList");
            if (!list) return;

            list.innerHTML = "";

            data.slice(0, 3).forEach(a => {
                list.innerHTML += `<li>📢 ${a[1]} <small>(${a[3]})</small></li>`;
            });

        });
}