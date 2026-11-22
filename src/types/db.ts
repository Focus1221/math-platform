export type UserRole = 'student' | 'teacher';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  grade_number: number | null;
  class_name: string;
}

export interface Course {
  id: string;
  slug: string;
  grade_number: number;
  subject: string;
  title: string;
  academic_year: string;
  total_hours: number;
  is_published: boolean;
}

export interface Topic {
  id: string;
  course_id: string;
  order_index: number;
  quarter: 1 | 2 | 3 | 4;
  section: string;
  title: string;
  dates: string;
  hours: number;
  objectives: string[];
  theory_md: string;
  sim_type: string;
  badges: string[];
  is_assessment: boolean;
  value_key: 'adal' | 'taza' | 'const';
  value_example: string;
  teacher_notes: string;
}

export interface Material {
  id: string;
  topic_id: string;
  kind: 'pdf' | 'presentation' | 'video' | 'link' | 'iframe_game';
  title: string;
  description: string;
  url: string | null;
  storage_path: string | null;
  file_name: string | null;
}

export interface HomeworkTask {
  id: string;
  topic_id: string;
  order_index: number;
  type: 'test' | 'input' | 'open';
  difficulty: 'base' | 'standard' | 'pro';
  question_md: string;
  options: string[];
  points: number;
}

export interface Submission {
  id: string;
  task_id: string;
  student_id: string;
  answer_text: string;
  photo_path: string | null;
  is_correct: boolean | null;
  score: number;
  status: 'checked' | 'pending_review' | 'graded';
  teacher_comment: string;
  updated_at: string;
}