import { useEffect } from "react";
import { useUiStore } from "../store/ui-store";

export function useAdaptiveSignal() {
  const behaviorSignal = useUiStore((s) => s.behaviorSignal);
  const setBehaviorSignal = useUiStore((s) => s.setBehaviorSignal);

  useEffect(() => {
    if (behaviorSignal !== "critical") {
      return;
    }

    const timer = setTimeout(() => setBehaviorSignal("warning"), 4000);
    return () => clearTimeout(timer);
  }, [behaviorSignal, setBehaviorSignal]);

  return { behaviorSignal, setBehaviorSignal };
}
