/* eslint-disable */
/* eslint-disable react/forbid-dom-props */
import { lazy } from "react";
import { Navigate, useRoutes } from "react-router-dom";

const AuthPage = lazy(() => import("../features/auth/AuthPage"));
const CoursePage = lazy(() => import("../features/course/CoursePage"));
const ProctoringPage = lazy(() => import("../features/proctoring/ProctoringPage"));
const ResultsPage = lazy(() => import("../features/results/ResultsPage"));

export function AppRouter() {
  return useRoutes([
    { path: "/", element: <Navigate to="/course/1" replace /> },
    { path: "/auth", element: <AuthPage /> },
    { path: "/dashboard", element: <Navigate to="/course/1" replace /> },
    { path: "/course/:courseId", element: <CoursePage /> },
    { path: "/quiz/:quizId", element: <Navigate to="/course/1" replace /> },
    { path: "/proctoring", element: <ProctoringPage /> },
    { path: "/voice", element: <Navigate to="/proctoring" replace /> },
    { path: "/results", element: <ResultsPage /> },
    { path: "*", element: <Navigate to="/course/1" replace /> }
  ]);
}


