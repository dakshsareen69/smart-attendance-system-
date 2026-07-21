from flask import Flask, render_template, request, jsonify, send_from_directory
from pymongo import MongoClient, DESCENDING
from bson import ObjectId
import os
from datetime import datetime
from werkzeug.utils import secure_filename

app = Flask(__name__)

# ================= GLOBAL =================
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ================= DB CONNECTION =================
client = MongoClient("mongodb://localhost:27017/")
db = client["smart_attendance"]

# Collections
users_col        = db["users"]
schedule_col     = db["class_schedule"]
attendance_col   = db["class_attendance"]
assignments_col  = db["assignments"]
notes_col        = db["notes"]
announcements_col = db["announcements"]
marks_col        = db["marks"]
submissions_col  = db["submissions"]
subjects_col     = db["subjects"]


# ================= DB INIT =================
def init_db():
    users_col.create_index("enrollment", unique=True)
    # marks indexed by name + subject_id (compound)
    marks_col.create_index([("name", 1), ("subject_id", 1)], unique=True)


# ================= ROUTES =================
@app.route('/')
def home():
    return render_template("index.html")

@app.route('/student')
def student():
    return render_template("student.html")

@app.route('/teacher')
def teacher():
    return render_template("teacher.html")

@app.route('/change-password')
def change_password():
    return render_template("change_password.html")


# ================= LOGIN =================
@app.route('/login', methods=['POST'])
def login():
    data = request.json

    user = users_col.find_one({
        "enrollment": data['enrollment'],
        "password": data['password'],
        "role": data['role']
    })

    if user:
        return jsonify({
            "name": user['name'],
            "redirect": "/teacher" if data['role'] == "teacher" else "/student"
        })

    return jsonify({"message": "Invalid credentials ❌"})


# ================= SUBJECTS CRUD =================
@app.route('/add_subject', methods=['POST'])
def add_subject():
    data = request.json

    if not data.get('name'):
        return jsonify({"status": "error", "message": "Subject name required ❌"}), 400

    subjects_col.insert_one({
        "name": data['name'],
        "code": data.get('code', ''),
        "type": data.get('type', 'Theory'),
        "teacher_name": data.get('teacher_name', '')
    })

    return jsonify({"status": "success", "message": "Subject added ✅"})


@app.route('/get_subjects')
def get_subjects():
    docs = subjects_col.find({})
    data = []
    for d in docs:
        data.append({
            "_id": str(d["_id"]),
            "name": d["name"],
            "code": d.get("code", ""),
            "type": d.get("type", "Theory"),
            "teacher_name": d.get("teacher_name", "")
        })
    return jsonify(data)


@app.route('/edit_subject', methods=['POST'])
def edit_subject():
    data = request.json
    subject_id = data.get('_id')

    if not subject_id:
        return jsonify({"status": "error", "message": "Subject ID required ❌"}), 400

    try:
        oid = ObjectId(subject_id)
    except Exception:
        return jsonify({"status": "error", "message": "Invalid subject ID ❌"}), 400

    subjects_col.update_one(
        {"_id": oid},
        {"$set": {
            "name": data.get('name', ''),
            "code": data.get('code', ''),
            "type": data.get('type', 'Theory'),
            "teacher_name": data.get('teacher_name', '')
        }}
    )

    return jsonify({"status": "success", "message": "Subject updated ✅"})


@app.route('/delete_subject', methods=['POST'])
def delete_subject():
    data = request.json
    subject_id = data.get('_id')

    if not subject_id:
        return jsonify({"status": "error", "message": "Subject ID required ❌"}), 400

    try:
        oid = ObjectId(subject_id)
    except Exception:
        return jsonify({"status": "error", "message": "Invalid subject ID ❌"}), 400

    subjects_col.delete_one({"_id": oid})
    return jsonify({"status": "success", "message": "Subject deleted ✅"})


# ================= TEACHERS =================
@app.route('/get_teachers')
def get_teachers():
    docs = users_col.find({"role": "teacher"}, {"_id": 0, "name": 1, "enrollment": 1})
    data = [[d["name"], d["enrollment"]] for d in docs]
    return jsonify(data)


# ================= CLASS SCHEDULE =================
@app.route('/schedule_class', methods=['POST'])
def schedule_class():
    data = request.json
    subject = data.get('subject', '')
    date = data['date']
    time_val = data.get('time', '')

    schedule_col.insert_one({
        "subject": subject,
        "date": date,
        "time": time_val
    })

    return jsonify({"message": "Class scheduled ✅"})


@app.route('/get_schedule')
def get_schedule():
    docs = schedule_col.find({}).sort("date", DESCENDING)
    data = []
    for d in docs:
        data.append({
            "_id": str(d["_id"]),
            "subject": d.get("subject", ""),
            "date": d.get("date", ""),
            "time": d.get("time", "")
        })
    return jsonify(data)


# ================= CLASS ATTENDANCE =================
@app.route('/mark_bulk_attendance', methods=['POST'])
def mark_bulk_attendance():
    data = request.json
    schedule_id = data.get('schedule_id')
    records = data.get('attendance', [])

    if not schedule_id or not records:
        return jsonify({"status": "error", "message": "Invalid data ❌"}), 400

    # find the schedule entry
    try:
        oid = ObjectId(schedule_id)
    except Exception:
        return jsonify({"status": "error", "message": "Invalid schedule ID ❌"}), 400

    schedule = schedule_col.find_one({"_id": oid})
    if not schedule:
        return jsonify({"status": "error", "message": "Schedule not found ❌"}), 404

    class_date = schedule.get("date", "")
    subject = schedule.get("subject", "")

    for rec in records:
        name = rec.get('name', '')
        status = rec.get('status', 'absent')

        # upsert: update if already exists
        attendance_col.update_one(
            {"name": name, "class_date": class_date, "subject": subject},
            {"$set": {
                "name": name,
                "class_date": class_date,
                "subject": subject,
                "status": status
            }},
            upsert=True
        )

    return jsonify({"status": "success", "message": "Attendance saved ✅"})


@app.route('/get_my_attendance/<name>')
def get_my_attendance(name):
    docs = attendance_col.find(
        {"name": name},
        {"_id": 0, "name": 1, "class_date": 1, "subject": 1, "status": 1}
    )
    data = []
    for d in docs:
        data.append({
            "name": d.get("name", ""),
            "class_date": d.get("class_date", ""),
            "subject": d.get("subject", ""),
            "status": d.get("status", "present")
        })
    return jsonify(data)


@app.route('/get_class_attendance')
def get_class_attendance():
    docs = attendance_col.find({})
    data = []
    for d in docs:
        data.append({
            "_id": str(d["_id"]),
            "name": d.get("name", ""),
            "class_date": d.get("class_date", ""),
            "subject": d.get("subject", ""),
            "status": d.get("status", "present")
        })
    return jsonify(data)


# ================= STUDENTS =================
@app.route('/get_students')
def get_students():
    docs = users_col.find({"role": "student"}, {"_id": 0, "name": 1, "enrollment": 1})
    data = [[d["name"], d["enrollment"]] for d in docs]
    return jsonify(data)


# ================= ASSIGNMENTS =================
@app.route('/upload_assignment', methods=['POST'])
def upload_assignment():
    file  = request.files['file']
    title = request.form['title']
    desc  = request.form.get('desc', '')

    filename = secure_filename(file.filename)
    file.save(os.path.join(UPLOAD_FOLDER, filename))

    time_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    assignments_col.insert_one({
        "title":    title + " - " + desc,
        "filename": filename,
        "time":     time_now
    })

    return jsonify({"message": "Assignment uploaded ✅"})


@app.route('/get_assignments')
def get_assignments():
    docs = assignments_col.find({}).sort("_id", DESCENDING)
    data = [[str(d["_id"]), d["title"], d["filename"], d["time"]] for d in docs]
    return jsonify(data)


@app.route('/delete_assignment', methods=['POST'])
def delete_assignment():
    data          = request.json
    assignment_id = data.get('assignment_id')

    if not assignment_id:
        return jsonify({"status": "error", "message": "Invalid assignment ❌"}), 400

    try:
        oid = ObjectId(assignment_id)
    except Exception:
        return jsonify({"status": "error", "message": "Invalid assignment ID ❌"}), 400

    doc = assignments_col.find_one({"_id": oid})
    if not doc:
        return jsonify({"status": "error", "message": "Assignment not found ❌"}), 404

    filename = doc["filename"]
    assignments_col.delete_one({"_id": oid})

    # Delete file only when no other record references it
    assignment_count = assignments_col.count_documents({"filename": filename})
    submission_count = submissions_col.count_documents({"filename": filename})
    notes_count      = notes_col.count_documents({"filename": filename})

    if assignment_count == 0 and submission_count == 0 and notes_count == 0:
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.exists(file_path):
            os.remove(file_path)

    return jsonify({"status": "success", "message": "Assignment deleted ✅"})


@app.route('/get_submissions')
def get_submissions():
    docs = submissions_col.find({}).sort("_id", DESCENDING)
    data = [[str(d["_id"]), d["student_name"], d["assignment_title"],
             d["filename"], d["time"]] for d in docs]
    return jsonify(data)


@app.route('/submit_assignment', methods=['POST'])
def submit_assignment():
    file    = request.files['file']
    student = request.form['name']
    title   = request.form['title']

    filename = secure_filename(file.filename)
    file.save(os.path.join(UPLOAD_FOLDER, filename))

    time_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    submissions_col.insert_one({
        "student_name":     student,
        "assignment_title": title,
        "filename":         filename,
        "time":             time_now
    })

    return jsonify({"message": "Submitted ✅"})


# ================= delete_submission =================
@app.route('/delete_submission', methods=['POST'])
def delete_submission():
    data          = request.json
    submission_id = data.get('submission_id')
    student_name  = data.get('name')

    if not submission_id or not student_name:
        return jsonify({"status": "error", "message": "Invalid request ❌"}), 400

    try:
        oid = ObjectId(submission_id)
    except Exception:
        return jsonify({"status": "error", "message": "Invalid submission ID ❌"}), 400

    doc = submissions_col.find_one({"_id": oid, "student_name": student_name})
    if not doc:
        return jsonify({"status": "error", "message": "Submission not found ❌"}), 404

    filename = doc["filename"]
    submissions_col.delete_one({"_id": oid, "student_name": student_name})

    # Delete file only when no other record references it
    submission_count = submissions_col.count_documents({"filename": filename})
    assignment_count = assignments_col.count_documents({"filename": filename})
    notes_count      = notes_col.count_documents({"filename": filename})

    if submission_count == 0 and assignment_count == 0 and notes_count == 0:
        file_path = os.path.join(UPLOAD_FOLDER, filename)
        if os.path.exists(file_path):
            os.remove(file_path)

    return jsonify({"status": "success", "message": "Submission deleted ✅"})


# ================= NOTES =================
@app.route('/upload_notes', methods=['POST'])
def upload_notes():
    file  = request.files['file']
    title = request.form['title']

    filename = secure_filename(file.filename)
    file.save(os.path.join(UPLOAD_FOLDER, filename))

    time_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    notes_col.insert_one({"title": title, "filename": filename, "time": time_now})

    return jsonify({"message": "Notes uploaded ✅"})


@app.route('/get_notes')
def get_notes():
    docs = notes_col.find({}).sort("_id", DESCENDING)
    data = [[str(d["_id"]), d["title"], d["filename"], d["time"]] for d in docs]
    return jsonify(data)


# ================= ANNOUNCEMENTS =================
@app.route('/add_announcement', methods=['POST'])
def add_announcement():
    data     = request.json
    time_now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    posted_by = data.get('posted_by', 'Teacher')

    announcements_col.insert_one({
        "message":   data['message'],
        "time":      time_now,
        "posted_by": posted_by
    })

    return jsonify({"message": "Announcement posted ✅"})


@app.route('/get_announcements')
def get_announcements():
    docs = announcements_col.find({}).sort("_id", DESCENDING)
    data = [[str(d["_id"]), d["message"], d["time"],
             d.get("posted_by", "Teacher")] for d in docs]
    return jsonify(data)


# ================= MARKS =================
@app.route('/save_marks', methods=['POST'])
def save_marks():
    data = request.json

    name = data['name']
    subject_id = data.get('subject_id', '')
    theory = data.get('theory', 0)
    practical = data.get('practical', 0)

    marks_col.update_one(
        {"name": name, "subject_id": subject_id},
        {"$set": {
            "name": name,
            "subject_id": subject_id,
            "theory": theory,
            "practical": practical
        }},
        upsert=True
    )

    return jsonify({"message": "Marks saved ✅"})


@app.route('/get_marks')
def get_marks():
    docs = marks_col.find({})
    data = []
    for d in docs:
        data.append({
            "_id": str(d["_id"]),
            "name": d.get("name", ""),
            "subject_id": d.get("subject_id", ""),
            "theory": d.get("theory", 0),
            "practical": d.get("practical", 0)
        })
    return jsonify(data)


# ================= CGPA =================
@app.route('/get_cgpa/<name>')
def get_cgpa(name):
    # Get all marks for this student
    docs = list(marks_col.find({"name": name}))

    if not docs:
        return jsonify({"cgpa": 0.0, "subjects": []})

    subject_grades = []
    for d in docs:
        theory = d.get("theory", 0) or 0
        practical = d.get("practical", 0) or 0
        total = theory + practical

        # Grade point: total / 10, capped at 10
        gp = min(total / 10.0, 10.0)

        # Get subject name
        sub_name = ""
        if d.get("subject_id"):
            try:
                sub_doc = subjects_col.find_one({"_id": ObjectId(d["subject_id"])})
                if sub_doc:
                    sub_name = sub_doc.get("name", "")
            except Exception:
                pass

        subject_grades.append({
            "subject": sub_name,
            "theory": theory,
            "practical": practical,
            "total": total,
            "grade_point": round(gp, 2)
        })

    cgpa = sum(sg["grade_point"] for sg in subject_grades) / len(subject_grades)

    return jsonify({
        "cgpa": round(cgpa, 2),
        "subjects": subject_grades
    })


# ================= FILES =================
@app.route('/uploads/<filename>')
def uploads(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)


@app.route('/teacher_dashboard_data')
def teacher_dashboard_data():
    total_students   = users_col.count_documents({"role": "student"})
    total_assignments = assignments_col.count_documents({})
    total_notes      = notes_col.count_documents({})
    total_subjects   = subjects_col.count_documents({})

    docs = submissions_col.find(
        {},
        {"_id": 0, "student_name": 1, "assignment_title": 1, "time": 1}
    ).sort("time", DESCENDING).limit(5)

    submissions = [[d["student_name"], d["assignment_title"], d["time"]] for d in docs]

    return jsonify({
        "students":    total_students,
        "assignments": total_assignments,
        "notes":       total_notes,
        "subjects":    total_subjects,
        "submissions": submissions
    })


# ================= CHANGE PASSWORD =================
@app.route('/change_password', methods=['POST'])
def change_password_api():
    data     = request.json
    enrollment = data.get('enrollment')
    old_pass   = data.get('old')
    new_pass   = data.get('new')

    if not enrollment or not old_pass or not new_pass:
        return jsonify({"message": "All fields required ❌"})

    user = users_col.find_one({"enrollment": enrollment, "password": old_pass})

    if not user:
        return jsonify({"message": "Old password incorrect ❌"})

    users_col.update_one(
        {"enrollment": enrollment},
        {"$set": {"password": new_pass}}
    )

    return jsonify({"message": "Password Updated ✅"})


# ================= RUN =================
if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5003)
