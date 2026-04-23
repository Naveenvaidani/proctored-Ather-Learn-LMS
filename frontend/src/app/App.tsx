/* eslint-disable */
/* eslint-disable react/forbid-dom-props */
import { Suspense } from "react";
import { AnimatePresence } from "motion/react";
import { useLocation } from "react-router-dom";
import { AppRouter } from "./router";
import { GlobalShell } from "../layouts/GlobalShell";
import { ScreenSkeleton } from "../components/ui/ScreenSkeleton";

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <div key={location.pathname}>
        <Suspense fallback={<ScreenSkeleton />}>
          <AppRouter />
        </Suspense>
      </div>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <GlobalShell>
      <AnimatedRoutes />
    </GlobalShell>
  );
}


