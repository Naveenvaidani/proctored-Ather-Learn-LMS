import { useEffect, useRef, useState } from "react";
import { AudioMetrics } from "../features/engagement/types";

const defaultAudioMetrics: AudioMetrics = {
  vadState: "CLEAN",
  noiseLevel: 0,
  noiseBaseline: 0,
  noiseThreshold: 0,
  isCalibrated: false,
  voiceDetected: false,
  speechPattern: "NONE",
  noiseSpike: false,
  speechProbability: 0,
  webrtcSpeechProbability: 0,
  sileroSpeechProbability: 0,
  confidenceScore: 0,
  speechDurationMs: 0,
  noiseDurationMs: 0,
};

export function useVoiceAnalysis(enabled: boolean) {
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const workerReadyRef = useRef(false);
  const lastSendRef = useRef(0);
  const [isReady, setIsReady] = useState(false);

  const [metrics, setMetrics] = useState<AudioMetrics>(defaultAudioMetrics);
  const [bars, setBars] = useState<number[]>(Array.from({ length: 30 }, () => 0));
  const [streamError, setStreamError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let mounted = true;
    workerReadyRef.current = false;
    setStreamError(null);
    setIsReady(false);

    const start = async () => {
      try {
        const worker = new Worker("/workers/audioVadWorker.js");
        worker.onmessage = (event) => {
          const { type, metrics: workerMetrics, error } = event.data || {};

          if (type === "INIT_SUCCESS") {
            workerReadyRef.current = true;
            if (streamRef.current && audioContextRef.current) {
              setIsReady(true);
            }
            return;
          }

          if (type === "INIT_ERROR" || type === "ERROR") {
            setStreamError(error || "Failed to initialize voice analysis");
            return;
          }

          if (type === "VAD_RESULT" && workerMetrics) {
            setMetrics((prev) => ({ ...prev, ...workerMetrics }));
          }
        };
        workerRef.current = worker;
        worker.postMessage({ type: "INIT" });

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        const ctx = new AudioContext();
        audioContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyserRef.current = analyser;

        const source = ctx.createMediaStreamSource(stream);
        sourceRef.current = source;
        source.connect(analyser);
        await ctx.resume();
        if (workerReadyRef.current) {
          setIsReady(true);
        }

        const run = () => {
          const freq = new Uint8Array(analyser.frequencyBinCount);
          const time = new Float32Array(analyser.fftSize);
          analyser.getByteFrequencyData(freq);
          analyser.getFloatTimeDomainData(time);

          const energyBars = Array.from(freq.slice(0, 30)).map((v) => Math.max(4, (v / 255) * 100));
          setBars(energyBars);

          const now = performance.now();
          if (workerReadyRef.current && now - lastSendRef.current >= 60) {
            lastSendRef.current = now;
            worker.postMessage({
              type: "PROCESS_AUDIO",
              payload: {
                samples: Array.from(time),
                frequencyData: Array.from(freq),
                sampleRate: ctx.sampleRate,
                timestamp: now,
              },
            });
          }

          rafRef.current = requestAnimationFrame(run);
        };

        rafRef.current = requestAnimationFrame(run);
      } catch (error) {
        setStreamError(error instanceof Error ? error.message : "Failed to access microphone");
      }
    };

    void start();

    return () => {
      mounted = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      workerReadyRef.current = false;
      setIsReady(false);
      setMetrics(defaultAudioMetrics);
      setBars(Array.from({ length: 30 }, () => 0));
    };
  }, [enabled]);

  return {
    metrics,
    bars,
    streamError,
    isReady,
  };
}
