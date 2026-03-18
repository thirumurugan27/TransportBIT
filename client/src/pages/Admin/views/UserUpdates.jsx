import React, {useMemo, useState} from "react";
import {
  GraduationCap,
  UserRound,
  PlusCircle,
  Building2,
  CheckCircle2,
  UserPlus,
  Upload,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import {apiPost, apiUpload} from "../../../utils/api";
import {useToast} from "../../../context/ToastContext";

const initialStudentForm = {
  username: "",
  password: "",
  full_name: "",
  phone: "",
  email: "",
  department: "",
  year: "",
  roll_number: "",
};

const initialFacultyForm = {
  username: "",
  password: "",
  full_name: "",
  phone: "",
  email: "",
  department: "",
  designation: "",
};

const TABS = {
  STUDENT: "STUDENT",
  FACULTY: "FACULTY",
};

function FormInput({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  min,
  max,
  placeholder,
}) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-secondarytext">
        {label}
      </span>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        min={min}
        max={max}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2.5 text-sm text-primarytext outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
    </label>
  );
}

export default function UserUpdates() {
  const {showToast} = useToast();
  const [activeTab, setActiveTab] = useState(TABS.STUDENT);

  const [studentForm, setStudentForm] = useState(initialStudentForm);
  const [facultyForm, setFacultyForm] = useState(initialFacultyForm);
  const [studentLoading, setStudentLoading] = useState(false);
  const [facultyLoading, setFacultyLoading] = useState(false);

  const [studentBulkFile, setStudentBulkFile] = useState(null);
  const [facultyBulkFile, setFacultyBulkFile] = useState(null);
  const [studentBulkLoading, setStudentBulkLoading] = useState(false);
  const [facultyBulkLoading, setFacultyBulkLoading] = useState(false);
  const [studentBulkResult, setStudentBulkResult] = useState(null);
  const [facultyBulkResult, setFacultyBulkResult] = useState(null);

  const onStudentChange = (e) => {
    const {name, value} = e.target;
    setStudentForm((prev) => ({...prev, [name]: value}));
  };

  const onFacultyChange = (e) => {
    const {name, value} = e.target;
    setFacultyForm((prev) => ({...prev, [name]: value}));
  };

  const submitStudent = async (e) => {
    e.preventDefault();
    setStudentLoading(true);
    try {
      const payload = {
        ...studentForm,
        year: studentForm.year ? parseInt(studentForm.year, 10) : 0,
        password: studentForm.password || "password",
      };

      const res = await apiPost("/api/admin/students/create", payload);
      const data = await res.json();

      if (!res.ok) {
        showToast(data?.error || "Failed to create student", "error");
        return;
      }

      showToast(data?.message || "Student created successfully", "success");
      setStudentForm(initialStudentForm);
    } catch (err) {
      console.error(err);
      showToast("Unexpected error while creating student", "error");
    } finally {
      setStudentLoading(false);
    }
  };

  const submitFaculty = async (e) => {
    e.preventDefault();
    setFacultyLoading(true);
    try {
      const payload = {
        ...facultyForm,
        password: facultyForm.password || "password",
      };

      const res = await apiPost("/api/admin/users/faculty/create", payload);
      const data = await res.json();

      if (!res.ok) {
        showToast(data?.error || "Failed to create faculty", "error");
        return;
      }

      showToast(data?.message || "Faculty created successfully", "success");
      setFacultyForm(initialFacultyForm);
    } catch (err) {
      console.error(err);
      showToast("Unexpected error while creating faculty", "error");
    } finally {
      setFacultyLoading(false);
    }
  };

  const submitStudentBulk = async (e) => {
    e.preventDefault();
    if (!studentBulkFile) {
      showToast("Please choose a CSV file for student bulk upload", "error");
      return;
    }

    setStudentBulkLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", studentBulkFile);

      const res = await apiUpload(
        "/api/admin/users/students/bulk-create-file",
        formData,
      );
      const data = await res.json();

      if (!res.ok) {
        showToast(data?.error || "Student bulk upload failed", "error");
        return;
      }

      setStudentBulkResult(data?.result || null);
      showToast(data?.message || "Student bulk upload processed", "success");
      setStudentBulkFile(null);
    } catch (err) {
      console.error(err);
      showToast("Unexpected error while uploading student CSV", "error");
    } finally {
      setStudentBulkLoading(false);
    }
  };

  const submitFacultyBulk = async (e) => {
    e.preventDefault();
    if (!facultyBulkFile) {
      showToast("Please choose a CSV file for faculty bulk upload", "error");
      return;
    }

    setFacultyBulkLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", facultyBulkFile);

      const res = await apiUpload(
        "/api/admin/users/faculty/bulk-create-file",
        formData,
      );
      const data = await res.json();

      if (!res.ok) {
        showToast(data?.error || "Faculty bulk upload failed", "error");
        return;
      }

      setFacultyBulkResult(data?.result || null);
      showToast(data?.message || "Faculty bulk upload processed", "success");
      setFacultyBulkFile(null);
    } catch (err) {
      console.error(err);
      showToast("Unexpected error while uploading faculty CSV", "error");
    } finally {
      setFacultyBulkLoading(false);
    }
  };

  const activeConfig = useMemo(() => {
    if (activeTab === TABS.STUDENT) {
      return {
        title: "Create Student",
        subtitle: "Add a student profile with academic details.",
        icon: GraduationCap,
        iconClass: "bg-primary/10 text-primary",
      };
    }

    return {
      title: "Create Faculty",
      subtitle: "Add a faculty profile with department and designation.",
      icon: UserRound,
      iconClass: "bg-pending/15 text-pending",
    };
  }, [activeTab]);

  const ActiveIcon = activeConfig.icon;

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-primary/15 bg-linear-to-r from-white to-primarybg px-5 py-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          User Management
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-primarytext">
          User Update
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-secondarytext">
          Manage student and faculty records with clean create forms and
          separate bulk uploads for each user type.
        </p>
      </div>

      <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex w-full flex-wrap items-center gap-2 rounded-md bg-primarybg p-1.5 sm:w-fit">
          <button
            type="button"
            onClick={() => setActiveTab(TABS.STUDENT)}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              activeTab === TABS.STUDENT
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:text-primary"
            }`}
          >
            <GraduationCap size={16} />
            Student
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(TABS.FACULTY)}
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              activeTab === TABS.FACULTY
                ? "bg-primary text-white shadow-sm"
                : "text-secondarytext hover:text-primary"
            }`}
          >
            <UserRound size={16} />
            Faculty
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_280px]">
          <div className="rounded-md border border-gray-200 p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className={`rounded-md p-2 ${activeConfig.iconClass}`}>
                <ActiveIcon size={20} />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-primarytext">
                  {activeConfig.title}
                </h3>
                <p className="text-sm text-secondarytext">
                  {activeConfig.subtitle}
                </p>
              </div>
            </div>

            {activeTab === TABS.STUDENT ? (
              <div className="space-y-5">
                <form onSubmit={submitStudent} className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FormInput
                      label="Full Name"
                      name="full_name"
                      value={studentForm.full_name}
                      onChange={onStudentChange}
                      required
                      placeholder="Enter full name"
                    />
                    <FormInput
                      label="Email"
                      name="email"
                      value={studentForm.email}
                      onChange={onStudentChange}
                      type="email"
                      required
                      placeholder="Enter email"
                    />
                    <FormInput
                      label="Phone"
                      name="phone"
                      value={studentForm.phone}
                      onChange={onStudentChange}
                      placeholder="Enter phone number"
                    />
                    <FormInput
                      label="Department"
                      name="department"
                      value={studentForm.department}
                      onChange={onStudentChange}
                      placeholder="e.g. Computer Science"
                    />
                    <FormInput
                      label="Year"
                      name="year"
                      value={studentForm.year}
                      onChange={onStudentChange}
                      type="number"
                      min={1}
                      max={8}
                      placeholder="1 - 8"
                    />
                    <FormInput
                      label="Roll Number"
                      name="roll_number"
                      value={studentForm.roll_number}
                      onChange={onStudentChange}
                      placeholder="Enter roll number"
                    />
                    <FormInput
                      label="Username"
                      name="username"
                      value={studentForm.username}
                      onChange={onStudentChange}
                      required
                      placeholder="Login username"
                    />
                    <FormInput
                      label="Password"
                      name="password"
                      value={studentForm.password}
                      onChange={onStudentChange}
                      placeholder="Default: password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={studentLoading}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primarydull disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <PlusCircle size={16} />
                    {studentLoading ? "Creating..." : "Create Student"}
                  </button>
                </form>

                <div className="rounded-md border border-primary/20 bg-primarybg/30 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <FileSpreadsheet size={16} className="text-primary" />
                    <h4 className="text-sm font-semibold text-primarytext">
                      Student Bulk Upload
                    </h4>
                  </div>

                  <form onSubmit={submitStudentBulk} className="space-y-3">
                    <a
                      href="/templates/student_bulk_upload_example.csv"
                      download="student_bulk_upload_example.csv"
                      className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:text-primarydull"
                    >
                      <Download size={14} /> Download Student Template
                    </a>

                    <label className="flex cursor-pointer items-center justify-between rounded-md border border-dashed border-primary/35 bg-white px-3 py-2.5 text-sm text-secondarytext">
                      <span className="truncate pr-2">
                        {studentBulkFile
                          ? studentBulkFile.name
                          : "Choose student CSV file"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-primary text-xs font-semibold">
                        <Upload size={14} /> Browse
                      </span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) =>
                          setStudentBulkFile(e.target.files?.[0] || null)
                        }
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={studentBulkLoading}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primarydull disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Upload size={14} />
                      {studentBulkLoading
                        ? "Uploading..."
                        : "Upload Student CSV"}
                    </button>
                  </form>

                  {studentBulkResult && (
                    <div className="mt-3 rounded-md border border-gray-200 bg-white p-3 text-xs text-secondarytext">
                      <p>Created: {studentBulkResult.created_count || 0}</p>
                      <p>Failed: {studentBulkResult.failed_count || 0}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <form onSubmit={submitFaculty} className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FormInput
                      label="Full Name"
                      name="full_name"
                      value={facultyForm.full_name}
                      onChange={onFacultyChange}
                      required
                      placeholder="Enter full name"
                    />
                    <FormInput
                      label="Email"
                      name="email"
                      value={facultyForm.email}
                      onChange={onFacultyChange}
                      type="email"
                      required
                      placeholder="Enter email"
                    />
                    <FormInput
                      label="Phone"
                      name="phone"
                      value={facultyForm.phone}
                      onChange={onFacultyChange}
                      placeholder="Enter phone number"
                    />
                    <FormInput
                      label="Department"
                      name="department"
                      value={facultyForm.department}
                      onChange={onFacultyChange}
                      placeholder="e.g. Mechanical"
                    />
                    <FormInput
                      label="Designation"
                      name="designation"
                      value={facultyForm.designation}
                      onChange={onFacultyChange}
                      placeholder="e.g. Assistant Professor"
                    />
                    <FormInput
                      label="Username"
                      name="username"
                      value={facultyForm.username}
                      onChange={onFacultyChange}
                      required
                      placeholder="Login username"
                    />
                    <FormInput
                      label="Password"
                      name="password"
                      value={facultyForm.password}
                      onChange={onFacultyChange}
                      placeholder="Default: password"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={facultyLoading}
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primarydull disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <PlusCircle size={16} />
                    {facultyLoading ? "Creating..." : "Create Faculty"}
                  </button>
                </form>

                <div className="rounded-md border border-primary/20 bg-primarybg/30 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <FileSpreadsheet size={16} className="text-primary" />
                    <h4 className="text-sm font-semibold text-primarytext">
                      Faculty Bulk Upload
                    </h4>
                  </div>

                  <form onSubmit={submitFacultyBulk} className="space-y-3">
                    <a
                      href="/templates/faculty_bulk_upload_example.csv"
                      download="faculty_bulk_upload_example.csv"
                      className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:text-primarydull"
                    >
                      <Download size={14} /> Download Faculty Template
                    </a>

                    <label className="flex cursor-pointer items-center justify-between rounded-md border border-dashed border-primary/35 bg-white px-3 py-2.5 text-sm text-secondarytext">
                      <span className="truncate pr-2">
                        {facultyBulkFile
                          ? facultyBulkFile.name
                          : "Choose faculty CSV file"}
                      </span>
                      <span className="inline-flex items-center gap-1 text-primary text-xs font-semibold">
                        <Upload size={14} /> Browse
                      </span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) =>
                          setFacultyBulkFile(e.target.files?.[0] || null)
                        }
                      />
                    </label>

                    <button
                      type="submit"
                      disabled={facultyBulkLoading}
                      className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primarydull disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Upload size={14} />
                      {facultyBulkLoading
                        ? "Uploading..."
                        : "Upload Faculty CSV"}
                    </button>
                  </form>

                  {facultyBulkResult && (
                    <div className="mt-3 rounded-md border border-gray-200 bg-white p-3 text-xs text-secondarytext">
                      <p>Created: {facultyBulkResult.created_count || 0}</p>
                      <p>Failed: {facultyBulkResult.failed_count || 0}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-md border border-gray-200 bg-primarybg/40 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-primarytext">
              <CheckCircle2 size={16} className="text-primary" />
              Form Guidance
            </h4>
            <ul className="mt-3 space-y-2 text-xs text-secondarytext">
              <li>Username and email should be unique.</li>
              <li>Leave password empty to use default value: password.</li>
              <li>For students, add year and roll number when available.</li>
              <li>For faculty, include department and designation.</li>
              <li>Bulk upload is available separately per tab.</li>
            </ul>

            <div className="mt-4 rounded-md border border-primary/20 bg-white p-3">
              <p className="flex items-center gap-2 text-xs font-medium text-secondarytext">
                <UserPlus size={14} className="text-primary" />
                Profile rows are linked automatically on successful create.
              </p>
            </div>

            {activeTab === TABS.FACULTY && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-primarybg px-2.5 py-2 text-xs font-medium text-secondarytext">
                <Building2 size={14} />
                Faculty profile row is created after user create.
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
