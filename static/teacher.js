// ================= INIT =================
window.onload = function () {
    showTeacher("dashboard");
};

// ================= SIDE MESSAGE =================
function showMsg(msg, color = "green") {
    let box = document.getElementById("sideMessage");

    if (!box) {
        box = document.createElement("div");
        box.id = "sideMessage";
        box.className = "side-message";
        document.body.appendChild(box);
    }

    box.innerText = msg;
    box.style.background = color === "red" ? "#e74c3c" :
        color === "orange" ? "#f39c12" : "#2ecc71";

    box.classList.add("show");

    setTimeout(() => {
        box.classList.remove("show");
    }, 5000);
}

// ================= SAFE RESPONSE =================
function handleResponse(d) {
    let color = "green";

    if (d.status === "error") color = "red";
    if (d.status === "warning") color = "orange";

    let msg = d.message || "Done ✅";

    showMsg(msg, color);
}

// ================= NAVIGATION =================
function showTeacher(section) {

    let all = ["dashboard", "subjects", "students", "schedule", "attendance", "assignments", "notes", "announcements", "marks"];

    all.forEach(id => {
        let el = document.getElementById(id);
        if (el) el.style.display = "none";
    });

    let sec = document.getElementById(section);
    if (sec) sec.style.display = "block";

    if (section === "subjects") loadSubjects();
    if (section === "students") loadStudents();
    if (section === "schedule") loadSchedule();
    if (section === "attendance") loadAttendanceSection();
    if (section === "assignments") {
        loadAssignments();
        loadSubmissions();
    }
    if (section === "notes") loadNotes();
    if (section === "marks") loadMarksSection();
    if (section === "announcements") loadTeacherAnnouncements();
    loadTeacherNotifications();
    loadTeacherDashboard();
}

// ================= SUBJECTS =================
function loadSubjects() {
    let teacherName = localStorage.getItem("name") || "";
    fetch("/get_subjects?teacher_name=" + encodeURIComponent(teacherName))
        .then(r => r.json())
        .then(data => {
            let table = document.getElementById("subjectTable");
            table.innerHTML = "";

            if (data.length === 0) {
                table.innerHTML = "<tr><td colspan='5'>No subjects found</td></tr>";
                return;
            }

            data.forEach(s => {
                table.innerHTML += `
            <tr>
                <td>${s.name}</td>
                <td>${s.code}</td>
                <td>${s.type}</td>
                <td>${s.teacher_name}</td>
                <td>
                    <button onclick="editSubjectFill('${s._id}','${s.name}','${s.code}','${s.type}','${s.teacher_name}')" style="background:#3498db;">✏ Edit</button>
                    <button onclick="deleteSubject('${s._id}')" style="background:#e74c3c;">🗑 Delete</button>
                </td>
            </tr>`;
            });
        });
}

function saveSubject() {
    let id = document.getElementById("editSubjectId").value;
    let name = document.getElementById("subjectName").value.trim();
    let code = document.getElementById("subjectCode").value.trim();
    let type = document.getElementById("subjectType").value;
    let teacher = document.getElementById("subjectTeacher").value;

    if (!name) {
        showMsg("Subject name required ❌", "red");
        return;
    }

    let payload = { name, code, type, teacher_name: teacher };

    if (id) {
        // Editing
        payload._id = id;
        fetch("/edit_subject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
            .then(r => r.json())
            .then(d => {
                handleResponse(d);
                clearSubjectForm();
                loadSubjects();
            });
    } else {
        // Adding
        fetch("/add_subject", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        })
            .then(r => r.json())
            .then(d => {
                handleResponse(d);
                clearSubjectForm();
                loadSubjects();
            });
    }
}

function editSubjectFill(id, name, code, type, teacher) {
    document.getElementById("editSubjectId").value = id;
    document.getElementById("subjectName").value = name;
    document.getElementById("subjectCode").value = code;
    document.getElementById("subjectType").value = type;
    document.getElementById("subjectTeacher").value = teacher;
}

function deleteSubject(id) {
    if (!confirm("Delete this subject?")) return;

    fetch("/delete_subject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: id })
    })
        .then(r => r.json())
        .then(d => {
            handleResponse(d);
            loadSubjects();
        });
}

function clearSubjectForm() {
    document.getElementById("editSubjectId").value = "";
    document.getElementById("subjectName").value = "";
    document.getElementById("subjectCode").value = "";
    document.getElementById("subjectType").value = "Theory";
    document.getElementById("subjectTeacher").value = "";
}

// Removed loadTeacherDropdown

// ================= SUBJECT DROPDOWN HELPER =================
function loadSubjectDropdown(selectId, selected = "") {
    let teacherName = localStorage.getItem("name") || "";
    fetch("/get_subjects?teacher_name=" + encodeURIComponent(teacherName))
        .then(r => r.json())
        .then(data => {
            let sel = document.getElementById(selectId);
            if (!sel) return;
            let firstOpt = sel.options[0] ? sel.options[0].outerHTML : '<option value="">-- Select Subject --</option>';
            sel.innerHTML = firstOpt;

            data.forEach(s => {
                let isSelected = (s._id === selected) ? "selected" : "";
                sel.innerHTML += `<option value="${s._id}" ${isSelected}>${s.name}</option>`;
            });
        });
}

// ================= SCHEDULE =================
function scheduleClass() {

    let subject = document.getElementById("scheduleSubject");
    let subjectText = subject.options[subject.selectedIndex] ? subject.options[subject.selectedIndex].text : "";
    let date = document.getElementById("classDate").value;
    let time = document.getElementById("classTime").value;

    if (!date) {
        showMsg("Please select date ❌", "red");
        return;
    }

    fetch("/schedule_class", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            subject: subjectText !== "-- Select Subject --" ? subjectText : "",
            date: date,
            time: time
        })
    })
        .then(r => r.json())
        .then(d => {
            handleResponse(d);
            loadSchedule();
        });
}

function loadSchedule() {
    loadSubjectDropdown("scheduleSubject");

    fetch("/get_schedule")
        .then(r => r.json())
        .then(data => {
            let list = document.getElementById("scheduleList");
            list.innerHTML = "";

            if (data.length === 0) {
                list.innerHTML = "<li>No classes scheduled</li>";
                return;
            }

            data.forEach(c => {
                let subj = c.subject || "N/A";
                let time = c.time || "N/A";
                list.innerHTML += `<li>📅 <b>${subj}</b> — ${c.date} at ${time}</li>`;
            });
        });
}

// ================= STUDENTS =================
function loadStudents() {

    fetch("/get_students")
        .then(r => r.json())
        .then(students => {
            let table = document.getElementById("studentTable");
            table.innerHTML = "";

            if (!students || students.length === 0) {
                table.innerHTML = "<tr><td colspan='2'>No students found</td></tr>";
                return;
            }

            students.forEach(s => {
                table.innerHTML += `
            <tr>
                <td>${s[0]}</td>
                <td>${s[1]}</td>
            </tr>`;
            });
        });
}

// ================= ATTENDANCE =================
function loadAttendanceSection() {
    loadSubjectDropdown("attendanceSubject");
    loadAttendanceRecords();
}

function checkAttendanceFields() {
    let subj = document.getElementById("attendanceSubject").value;
    let sem = document.getElementById("attendanceSemester").value;
    let dt = document.getElementById("attendanceDate").value;

    if (subj && sem && dt) {
        loadStudentsForAttendance();
    } else {
        document.getElementById("attendanceStudentList").innerHTML = "";
        let saveBtn = document.getElementById("saveBulkAttBtn");
        if (saveBtn) saveBtn.style.display = "none";
    }
}

function loadStudentsForAttendance() {
    let subjectId = document.getElementById("attendanceSubject").value;
    let semester = document.getElementById("attendanceSemester").value;
    let classDate = document.getElementById("attendanceDate").value;
    let container = document.getElementById("attendanceStudentList");
    let saveBtn = document.getElementById("saveBulkAttBtn");

    if (!subjectId || !semester || !classDate) {
        container.innerHTML = "";
        saveBtn.style.display = "none";
        return;
    }

    fetch("/get_students")
        .then(r => r.json())
        .then(students => {
            container.innerHTML = "";

            if (!students || students.length === 0) {
                container.innerHTML = "<p>No students found</p>";
                saveBtn.style.display = "none";
                return;
            }

            let table = `<table>
        <thead>
        <tr>
            <th>Student Name</th>
            <th>Enrollment</th>
            <th>Present / Absent</th>
        </tr>
        </thead><tbody>`;

            students.forEach(s => {
                table += `
            <tr>
                <td>${s[0]}</td>
                <td>${s[1]}</td>
                <td>
                    <label class="att-toggle">
                        <input type="checkbox" data-name="${s[0]}" checked>
                        <span class="att-label">Present</span>
                    </label>
                </td>
            </tr>`;
            });

            table += "</tbody></table>";
            container.innerHTML = table;
            saveBtn.style.display = "block";

            // Toggle label text
            container.querySelectorAll("input[type=checkbox]").forEach(cb => {
                cb.addEventListener("change", function () {
                    this.nextElementSibling.textContent = this.checked ? "Present" : "Absent";
                });
            });
        });
}

function saveBulkAttendance() {
    let subjectId = document.getElementById("attendanceSubject").value;
    let semester = document.getElementById("attendanceSemester").value;
    let classDate = document.getElementById("attendanceDate").value;

    if (!subjectId || !semester || !classDate) {
        showMsg("Fill all fields ❌", "red");
        return;
    }

    let checkboxes = document.querySelectorAll("#attendanceStudentList input[type=checkbox]");
    let attendance = [];

    checkboxes.forEach(cb => {
        attendance.push({
            name: cb.getAttribute("data-name"),
            status: cb.checked ? "present" : "absent"
        });
    });

    fetch("/mark_bulk_attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_id: subjectId, semester: semester, class_date: classDate, attendance: attendance })
    })
        .then(r => r.json())
        .then(d => {
            handleResponse(d);
            loadAttendanceRecords();
        });
}

function loadAttendanceRecords() {
    fetch("/get_class_attendance")
        .then(r => r.json())
        .then(data => {
            let table = document.getElementById("attendanceRecordTable");
            if (!table) return;
            table.innerHTML = "";

            if (data.length === 0) {
                table.innerHTML = "<tr><td colspan='5'>No records</td></tr>";
                return;
            }

            data.forEach(d => {
                let statusColor = d.status === "present" ? "color:green;font-weight:bold;" : "color:red;font-weight:bold;";
                table.innerHTML += `
            <tr>
                <td>${d.name}</td>
                <td>${d.subject || "N/A"}</td>
                <td>${d.semester || "N/A"}</td>
                <td>${d.class_date}</td>
                <td style="${statusColor}">${d.status === "present" ? "✔ Present" : "✘ Absent"}</td>
            </tr>`;
            });
        });
}

// ================= ASSIGNMENTS =================
function uploadAssignment() {

    let title = document.getElementById("assignTitle").value;
    let desc = document.getElementById("assignDesc").value;
    let file = document.getElementById("assignFile").files[0];

    if (!title || !file) {
        showMsg("Fill all fields ❌", "red");
        return;
    }

    let fd = new FormData();
    fd.append("title", title);
    fd.append("desc", desc);
    fd.append("file", file);

    fetch("/upload_assignment", { method: "POST", body: fd })
        .then(r => r.json())
        .then(d => {
            handleResponse(d);
            loadAssignments();
        });
}

function loadAssignments() {
    fetch("/get_assignments")
        .then(r => r.json())
        .then(data => {
            let list = document.getElementById("assignList");
            list.innerHTML = "";
            data.forEach(a => {
                list.innerHTML += `
            <li>
                <b>${a[1]}</b> - ${a[3]}<br>
                <a href="/uploads/${a[2]}" target="_blank">Open</a>
                <button onclick="deleteAssignment('${a[0]}')" style="background:#e74c3c;margin-left:8px;">
                    Delete
                </button>
            </li>`;
            });
        });
}

function loadSubmissions() {
    fetch("/get_submissions")
        .then(r => r.json())
        .then(data => {
            let list = document.getElementById("assignList");
            // append submissions after assignments
            data.forEach(s => {
                list.innerHTML += `
            <li>
                <b>${s[1]}</b> submitted <b>${s[2]}</b><br>
                <small>${s[4]}</small><br>
                <a href="/uploads/${s[3]}" target="_blank">View</a>
            </li>`;
            });
        });
}

function deleteAssignment(assignmentId) {
    if (!confirm("Delete this assignment?")) return;

    fetch("/delete_assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignment_id: assignmentId })
    })
        .then(r => r.json())
        .then(d => {
            handleResponse(d);
            loadAssignments();
        })
        .catch(() => {
            showMsg("Delete failed ❌", "red");
        });
}

// ================= NOTES =================
function uploadNotes() {

    let title = document.getElementById("noteTitle").value;
    let file = document.getElementById("noteFile").files[0];

    if (!title || !file) {
        showMsg("Fill all fields ❌", "red");
        return;
    }

    let fd = new FormData();
    fd.append("title", title);
    fd.append("file", file);

    fetch("/upload_notes", { method: "POST", body: fd })
        .then(r => r.json())
        .then(d => {
            handleResponse(d);
            loadNotes();
        });
}

function loadNotes() {
    fetch("/get_notes")
        .then(r => r.json())
        .then(data => {
            let list = document.getElementById("noteList");
            list.innerHTML = "";
            data.forEach(n => {
                list.innerHTML += `
            <li>${n[1]} - <a href="/uploads/${n[2]}" target="_blank">Open</a></li>`;
            });
        });
}

// ================= ANNOUNCEMENTS =================
function postAnnouncement() {

    let msg = document.getElementById("announcementInput").value;

    if (!msg) {
        showMsg("Message required ❌", "red");
        return;
    }

    fetch("/add_announcement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            message: msg,
            posted_by: localStorage.getItem("name") || "Teacher"
        })
    })

        .then(r => r.json())
        .then(d => {
            handleResponse(d);
            document.getElementById("announcementInput").value = "";
            loadTeacherAnnouncements();
        });
}

function loadTeacherAnnouncements() {
    fetch("/get_announcements")
        .then(r => r.json())
        .then(data => {
            let list = document.getElementById("teacherAnnouncementList");
            if (!list) return;

            list.innerHTML = "";

            if (data.length === 0) {
                list.innerHTML = "<li>No announcements yet</li>";
                return;
            }

            data.forEach(a => {
                list.innerHTML += `
            <li>
                <b>${a[1]}</b><br>
                <small>By: ${a[3]} | ${a[2]}</small>
            </li>`;
            });
        });
}


// ================= MARKS =================
function loadMarksSection() {
    loadSubjectDropdown("marksSubject");
}

function loadMarks() {
    let subjectId = document.getElementById("marksSubject").value;
    if (!subjectId) {
        document.getElementById("marksTable").innerHTML = "<tr><td colspan='6'>Select a subject first</td></tr>";
        return;
    }

    Promise.all([
        fetch("/get_students").then(r => r.json()),
        fetch("/get_marks").then(r => r.json())
    ])
        .then(([students, marks]) => {
            let table = document.getElementById("marksTable");
            table.innerHTML = "";

            if (!students || students.length === 0) {
                table.innerHTML = "<tr><td colspan='6'>No students found</td></tr>";
                return;
            }

            students.forEach(s => {
                let name = s[0];
                let enroll = s[1];

                // Find existing marks for this student+subject
                let existing = marks.find(m => m.name === name && m.subject_id === subjectId);
                let theory = existing ? existing.theory : 0;
                let practical = existing ? existing.practical : 0;
                let total = theory + practical;

                table.innerHTML += `
            <tr>
                <td>${name}</td>
                <td>${enroll}</td>
                <td><input type="number" id="theory_${enroll}" value="${theory}" placeholder="Theory" min="0"></td>
                <td><input type="number" id="practical_${enroll}" value="${practical}" placeholder="Practical" min="0"></td>
                <td id="total_${enroll}">${total}</td>
                <td>
                    <button onclick="saveMarks('${name}','${enroll}')">
                    💾 Save
                    </button>
                </td>
            </tr>`;
            });

            // Auto-calc total on input change
            students.forEach(s => {
                let enroll = s[1];
                let theoryInput = document.getElementById("theory_" + enroll);
                let practicalInput = document.getElementById("practical_" + enroll);

                if (theoryInput && practicalInput) {
                    theoryInput.addEventListener("input", () => {
                        let t = Number(theoryInput.value) || 0;
                        let p = Number(practicalInput.value) || 0;
                        document.getElementById("total_" + enroll).innerText = t + p;
                    });
                    practicalInput.addEventListener("input", () => {
                        let t = Number(theoryInput.value) || 0;
                        let p = Number(practicalInput.value) || 0;
                        document.getElementById("total_" + enroll).innerText = t + p;
                    });
                }
            });
        })
        .catch(() => {
            showMsg("Failed to load students ❌", "red");
        });
}

// ================= SAVE MARKS =================
function saveMarks(name, enroll) {
    let subjectId = document.getElementById("marksSubject").value;

    if (!subjectId) {
        showMsg("Select a subject first ❌", "red");
        return;
    }

    let theory = Number(document.getElementById("theory_" + enroll).value) || 0;
    let practical = Number(document.getElementById("practical_" + enroll).value) || 0;
    let teacherName = localStorage.getItem("name") || "";

    fetch("/save_marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: name,
            subject_id: subjectId,
            theory: theory,
            practical: practical,
            teacher_name: teacherName
        })
    })
        .then(r => r.json())
        .then(d => {
            handleResponse(d);
        })
        .catch(() => {
            showMsg("Save failed ❌", "red");
        });
}

// ================= LOGOUT =================
function logout() {
    localStorage.clear();
    location.href = "/";
}

function loadTeacherNotifications() {
    fetch("/get_announcements")
        .then(r => r.json())
        .then(data => {
            let list = document.getElementById("teacherNotif");
            if (!list) return;

            list.innerHTML = "";

            data.slice(0, 3).forEach(a => {
                list.innerHTML += `<li>📢 ${a[1]} <small>(${a[3]})</small></li>`;
            });
        });
}

function loadTeacherDashboard() {

    fetch("/teacher_dashboard_data")
        .then(r => r.json())
        .then(data => {

            // 📊 stats
            document.getElementById("totalStudents").innerText = data.students;
            document.getElementById("totalAssign").innerText = data.assignments;
            document.getElementById("totalNotes").innerText = data.notes;

            let totalSubj = document.getElementById("totalSubjects");
            if (totalSubj) totalSubj.innerText = data.subjects || 0;

            // 📂 recent submissions
            let list = document.getElementById("recentSubmissions");
            if (!list) return;

            list.innerHTML = "";

            if (data.submissions.length === 0) {
                list.innerHTML = "<li>No submissions</li>";
                return;
            }

            data.submissions.forEach(s => {
                list.innerHTML += `
                <li>
                    👤 ${s[0]} <br>
                    📂 ${s[1]} <br>
                    <small>${s[2]}</small>
                </li>
            `;
            });
        });

    // Load assigned subjects for current teacher
    let teacherName = localStorage.getItem("name") || "";
    fetch("/get_subjects")
        .then(r => r.json())
        .then(data => {
            let list = document.getElementById("dashSubjectList");
            if (!list) return;
            list.innerHTML = "";

            let mySubjects = data.filter(s => s.teacher_name === teacherName);

            if (mySubjects.length === 0) {
                list.innerHTML = "<li>No subjects assigned</li>";
                return;
            }

            mySubjects.forEach(s => {
                list.innerHTML += `<li>📘 <b>${s.name}</b> (${s.type}) ${s.code ? '— ' + s.code : ''}</li>`;
            });
        });
}

function changePassword() {

    let enrollment = localStorage.getItem("enrollment");
    let oldPass = document.getElementById("oldPass").value.trim();
    let newPass = document.getElementById("newPass").value.trim();

    if (!oldPass || !newPass) {
        showToast("Fill all fields ❌", "#dc3545");
        return;
    }

    fetch("/change_password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            enrollment: enrollment,
            old: oldPass,
            new: newPass
        })
    })
        .then(res => res.json())
        .then(data => {

            document.getElementById("msg").innerText = data.message;

            let success = data.message.includes("Updated");

            showToast(
                data.message,
                success ? "#28a745" : "#dc3545"
            );

            if (success) {
                setTimeout(() => {
                    localStorage.clear();
                    window.location.href = "/";
                }, 1200);
            }
        })
        .catch(() => {
            showToast("Server error ❌", "#dc3545");
        });
}