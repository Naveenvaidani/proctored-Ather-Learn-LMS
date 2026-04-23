import { useEffect, useRef, useState } from "react";
import { FaceMetrics } from "../features/engagement/types";

const defaultFaceMetrics: FaceMetrics = {
  faceDetected: false,
  faceCount: 0,
  eyeGaze: "ON_SCREEN",
  headPose: "STABLE",
  multipleFaces: false,
  yaw: 0,
  pitch: 0,
  roll: 0,
  confidenceScore: 0,
  landmarkCount: 0,
};

export function useFaceTracking(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const frameLoopRef = useRef<number | null>(null);
  const lastFrameSentRef = useRef<number>(0);
  const workerReadyRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<FaceMetrics>(defaultFaceMetrics);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    workerReadyRef.current = false;
    setStreamError(null);
    setIsReady(false);

    const worker = new Worker("/workers/faceMeshWorker.js");
    workerRef.current = worker;

    worker.onmessage = (event) => {
      const { type, metrics: workerMetrics, error } = event.data || {};

      if (type === "INIT_SUCCESS") {
        workerReadyRef.current = true;
        if (streamRef.current) {
          setIsReady(true);
        }
        return;
      }

      if (type === "INIT_ERROR") {
        setStreamError(error || "Face tracking failed");
        return;
      }

      if (type === "ERROR") {
        // Frame-level model glitches are recoverable; do not tear down camera UI.
        return;
      }

      if (type === "FACE_RESULT" && workerMetrics) {
        setStreamError(null);
        setMetrics((prev) => {
          const faceCount = typeof workerMetrics.faceCount === "number" ? workerMetrics.faceCount : prev.faceCount;
          const landmarkCount = typeof workerMetrics.landmarkCount === "number" ? workerMetrics.landmarkCount : prev.landmarkCount;

          return {
            ...prev,
            ...workerMetrics,
            faceDetected: Boolean(workerMetrics.faceDetected || faceCount > 0 || landmarkCount > 0),
            multipleFaces: Boolean(workerMetrics.multipleFaces || faceCount > 1),
            faceCount,
            landmarkCount,
          };
        });
      }
    };

    worker.postMessage({ type: "INIT" });

    const start = async () => {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 360 } },
          audio: false,
        });

        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = media;
        if (videoRef.current) {
          videoRef.current.srcObject = media;
        }
        if (workerReadyRef.current) {
          setIsReady(true);
        }
      } catch (error) {
        setStreamError(error instanceof Error ? error.message : "Failed to access webcam");
      }
    };

    void start();

    const frameIntervalMs = 90;
    const captureFrame = async (now: number) => {
      if (!cancelled && workerReadyRef.current && streamRef.current && videoRef.current && canvasRef.current && videoRef.current.readyState >= 3) {
        if (now - lastFrameSentRef.current >= frameIntervalMs) {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 360;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            try {
              const imageBitmap = await createImageBitmap(canvas);
              lastFrameSentRef.current = now;
              worker.postMessage(
                {
                  type: "PROCESS_FRAME",
                  imageBitmap,
                  timestamp: now,
                },
                [imageBitmap],
              );
            } catch {
              // Ignore single-frame capture errors; the next frame will retry.
            }
          }
        }
      }

      frameLoopRef.current = window.requestAnimationFrame(captureFrame);
    };

    frameLoopRef.current = window.requestAnimationFrame(captureFrame);

    return () => {
      cancelled = true;
      if (frameLoopRef.current) {
        window.cancelAnimationFrame(frameLoopRef.current);
        frameLoopRef.current = null;
      }
      worker.terminate();
      workerRef.current = null;
      workerReadyRef.current = false;
      setIsReady(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [enabled]);

  return {
    videoRef,
    canvasRef,
    metrics,
    streamError,
    isReady,
  };
}
