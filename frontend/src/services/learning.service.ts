import { apiRequest } from "./http";

export interface CourseOverview {
  id: string;
  title: string;
  progress: number;
  activeModule: string;
}

export interface DashboardPayload {
  greeting: string;
  recommendations: string[];
  courses: CourseOverview[];
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface StartGenAIJobBody {
  type: "VIDEO";
  url: string;
  uploadParameters: {
    courseId: string;
    versionId: string;
    videoItemBaseName: string;
    quizItemBaseName: string;
    questionsPerQuiz: number;
  };
}

export interface GenAIJobStatus {
  _id?: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "ABORTED";
  sourceUrl: string;
  currentTask?: {
    type: string;
    status: string;
  };
}

export function fetchDashboard() {
  return apiRequest<DashboardPayload>("/users/dashboard");
}

export function fetchCourse(courseId: string) {
  return apiRequest<{
    id: string;
    title: string;
    modules: Array<{ id: string; title: string; type: "video" | "article" | "interactive" }>;
  }>(`/courses/${courseId}`);
}

export function fetchQuiz(quizId: string) {
  return apiRequest<{
    id: string;
    title: string;
    durationSeconds: number;
    questions: QuizQuestion[];
  }>(`/quizzes/${quizId}`);
}

export function submitQuiz(quizId: string, answers: Record<string, string>) {
  return apiRequest<{ score: number; feedback: string }>(`/quizzes/${quizId}/submit`, {
    method: "POST",
    body: JSON.stringify({ answers })
  });
}

export function startGenAIJob(body: StartGenAIJobBody) {
  return apiRequest<{ jobId: string }>("/genai/jobs", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function fetchGenAIJobStatus(jobId: string) {
  return apiRequest<GenAIJobStatus>(`/genai/jobs/${jobId}`);
}
