export type QuestionType = 'multiple_choice' | 'single_choice' | 'drag_and_drop' | 'simulation';

export type MedalStatus = 'unanswered' | 'bronze' | 'silver' | 'gold';

export interface QuestionOption {
  id: string; // e.g. "A", "B", "C", "D" or item label
  text: string;
}

export interface QuestionItem {
  id: string;
  questionNumber: number;
  scenarioId?: string | number | null;
  scenarioTitle?: string | null;
  taskNumber?: number | null;
  part: string;
  sourceFile: string;
  type: QuestionType;
  category: string;
  subcategory?: string | null;
  questionText: string;
  diagramDescription?: string | null;
  commandOutputs?: string | null;
  options?: QuestionOption[];
  correctAnswers: string[];
  solution?: string | null;
  verificationCommands?: string[] | null;
  explanation: string;
  keyPoints?: string[] | null;
  notes?: string | null;
}

export interface UserProgressRecord {
  questionId: string;
  medal: MedalStatus;
  consecutiveCorrect: number;
  totalAttempts: number;
  correctCount: number;
  incorrectCount: number;
  lastAttemptAt?: number;
  lastResult?: 'correct' | 'incorrect';
  isBookmarked: boolean;
  userNote?: string;
  lastSelectedAnswers?: string[];
}

export interface StudyFilter {
  category?: string;
  part?: string;
  medal?: MedalStatus | 'all';
  onlyMistakes?: boolean;
  onlyBookmarked?: boolean;
  searchQuery?: string;
  questionType?: QuestionType | 'all';
}

export interface ExamSession {
  id: string;
  startedAt: number;
  durationMinutes: number;
  questionIds: string[];
  userAnswers: Record<string, string[]>;
  submitted: boolean;
  score?: number;
  totalQuestions: number;
  passed?: boolean;
}
