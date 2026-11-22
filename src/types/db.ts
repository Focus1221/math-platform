export type UserRole = 'student' | 'teacher';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  grade_number: number | null;
  class_name: string;
  classroom_id?: string | null;
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
  slides?: LessonSlide[] | null;
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

export interface ClassScheduleItem {
  id: string;
  classroom_id: string;
  topic_id: string;
  lesson_date: string;
  hw_due_date: string | null;
  note: string;
}
export type SlideVisual =
  | {
      kind: 'formula_hero';
      formula: string;
      caption?: string;
    }
  | {
      kind: 'fraction_bar';
      numerator: number;
      denominator: number;
      label?: string;
      compareNumerator?: number;
      compareDenominator?: number;
    }
  | {
      kind: 'number_line';
      min: number;
      max: number;
      points: { value: number; label: string; highlight?: boolean }[];
      jump?: { from: number; to: number; label?: string };
    }
  | {
      kind: 'percent_grid';
      percent: number;
      label?: string;
    }
  | {
      kind: 'angle';
      degrees: number;
      label?: string;
    }
  | {
      kind: 'venn';
      leftLabel: string;
      rightLabel: string;
      leftItems: string[];
      rightItems: string[];
      bothItems: string[];
    }
  | {
      kind: 'compare';
      leftTitle: string;
      leftText: string;
      rightTitle: string;
      rightText: string;
    };

export type SlideType =
  | 'intro'
  | 'concept'
  | 'example'
  | 'trap'
  | 'quiz'
  | 'summary';

export interface LessonSlide {
  id: string;
  type: SlideType;
  title: string;
  body_md: string;
  visual?: SlideVisual | null;
  steps?: string[];
  wrong_md?: string;
  right_md?: string;
  quiz_options?: string[];
  quiz_correct_index?: number;
  quiz_explanation?: string;
  takeaways?: string[];
}