import type { Dispatch, RefObject, SetStateAction } from "react";

export interface Student {
  user_id: string;
  student_name: string;
  grade: string | null;
}

export interface FileInfo {
  file_name: string;
  storage_path: string;
  uploaded_by_role: "teacher" | "student";
  uploaded_at: string;
}

export interface AssignmentWithFiles {
  id: string;
  title: string;
  subject: string | null;
  description: string | null;
  due_date: string | null;
  status: string;
  created_at: string;
  student_user_id: string;
  has_attachments: boolean;
  attachments: FileInfo[];
  submission_attachments: FileInfo[];
  student_name?: string;
}

export interface TeacherSalary {
  id: string;
  created_at: string;
  teacher_name: string | null;
  num_classes: number | null;
  total_hours: number | null;
  salary_per_hour: number | null;
  amount: number | null;
  status: string | null;
  note: string | null;
  deleted_at?: string | null;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  hours: number | null;
  topic: string | null;
  student_user_id: string;
  student_name?: string;
  deleted_at?: string | null;
}

export interface MeetLink {
  student_user_id: string;
  teacher_user_id: string;
  zoom_link?: string | null;
  student_name?: string;
  deleted_at?: string | null;
}

export interface StudentFee {
  id: string;
  created_at: string;
  month: string;
  student_name: string | null;
  total_amount: number | null;
  status: string | null;
  deleted_at?: string | null;
}

export interface AttendanceForm {
  date: string;
  status: "present" | "absent";
  hours: string;
  topic: string;
}

export interface AssignmentForm {
  title: string;
  subject: string;
  description: string;
  dueDate: string;
}

export interface MeetForm {
  zoomLink: string;
  classLabel: string;
}

export interface ProfileForm {
  subjects: string;
  availability: string;
  bio: string;
}

export interface FeeForm {
  month: string;
  totalHours: string;
  feePerHour: string;
  classDates: string;
  subjects: string;
}

export interface TabContext {
  // Data
  students: Student[];
  assignments: AssignmentWithFiles[];
  attendanceRecords: AttendanceRecord[];
  meetLinks: MeetLink[];
  recentFees: StudentFee[];
  salaries: TeacherSalary[];
  selectedStudent: string;
  setSelectedStudent: Dispatch<SetStateAction<string>>;
  selectedConversationId: string | null;

  // Forms
  attendanceForm: AttendanceForm;
  setAttendanceForm: Dispatch<SetStateAction<AttendanceForm>>;
  assignmentForm: AssignmentForm;
  setAssignmentForm: Dispatch<SetStateAction<AssignmentForm>>;
  meetForm: MeetForm;
  setMeetForm: Dispatch<SetStateAction<MeetForm>>;
  profileForm: ProfileForm;
  setProfileForm: Dispatch<SetStateAction<ProfileForm>>;
  feeForm: FeeForm;
  setFeeForm: Dispatch<SetStateAction<FeeForm>>;

  // Submitting / uploads
  submitting: boolean;
  setSubmitting: Dispatch<SetStateAction<boolean>>;
  uploading: boolean;
  uploadProgress: number;
  pendingFiles: File[];
  setPendingFiles: Dispatch<SetStateAction<File[]>>;
  fileInputRef: RefObject<HTMLInputElement>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removePendingFile: (i: number) => void;

  // Filters
  filterMonth: string;
  setFilterMonth: Dispatch<SetStateAction<string>>;
  filterStudent: string;
  setFilterStudent: Dispatch<SetStateAction<string>>;
  filteredAttendance: AttendanceRecord[];
  setFilteredAttendance: Dispatch<SetStateAction<AttendanceRecord[]>>;
  filterLoading: boolean;
  manageFilterStudent: string;
  setManageFilterStudent: Dispatch<SetStateAction<string>>;
  manageFilterSubject: string;
  setManageFilterSubject: Dispatch<SetStateAction<string>>;

  // Handlers
  handleAddAttendance: (e: React.FormEvent) => void;
  handleAddAssignment: (e: React.FormEvent) => void;
  handleUpdateProfile: (e: React.FormEvent) => void;
  handleSendFeeToAdmin: (e: React.FormEvent) => void;
  handleSalaryResponse: (id: string, status: "confirmed" | "needs_correction") => void;
  handleSoftDelete: (table: string, id: string) => void;
  handleMarkAssignmentViewed: (assignmentId: string, studentUserId: string) => void;
  openDeleteDialog: (table: string, id: string, name: string) => void;
  openEditAttendance: (record: AttendanceRecord) => void;
  openEditMeet: (link: MeetLink) => void;
  isOverdue: (dueDate: string | null) => boolean;
  fetchData: () => Promise<void> | void;

  MONTHS: string[];
}
