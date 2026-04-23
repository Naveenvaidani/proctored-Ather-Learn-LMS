import { useEffect, useRef } from "react";

interface PlaybackValidationFlags {
  faceDetected: boolean;
  multipleFaces: boolean;
  gazeOnScreen: boolean;
  headPoseValid: boolean;
  isTalking: boolean;
  noiseLevelHigh: boolean;
  tabActive: boolean;
  detectionHealthy: boolean;
  confidenceValid: boolean;
}

interface UsePlaybackControllerInput {
  enabled: boolean;
  playerRef: React.MutableRefObject<any>;
  playerReadyRef: React.MutableRefObject<boolean>;
  flags: PlaybackValidationFlags;
  stableRecoveryMs?: number;
}

const PLAYING_STATE = 1;

export function usePlaybackController({
  enabled,
  playerRef,
  playerReadyRef,
  flags,
  stableRecoveryMs = 2000,
}: UsePlaybackControllerInput) {
  const recoveryTimerRef = useRef<number | null>(null);
  const pausedDueToViolationRef = useRef(false);
  const eligibleRef = useRef(false);

  const eligibleToPlay =
    flags.detectionHealthy &&
    flags.confidenceValid &&
    flags.faceDetected &&
    !flags.multipleFaces &&
    flags.gazeOnScreen &&
    flags.headPoseValid &&
    !flags.isTalking &&
    !flags.noiseLevelHigh &&
    flags.tabActive;

  useEffect(() => {
    eligibleRef.current = enabled && eligibleToPlay;
  }, [enabled, eligibleToPlay]);

  useEffect(() => {
    const clearRecoveryTimer = () => {
      if (recoveryTimerRef.current !== null) {
        window.clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
    };

    const player = playerRef.current;
    if (!enabled || !playerReadyRef.current || !player) {
      clearRecoveryTimer();
      pausedDueToViolationRef.current = false;
      return;
    }

    if (!eligibleToPlay) {
      clearRecoveryTimer();
      pausedDueToViolationRef.current = true;
      try {
        player.pauseVideo?.();
      } catch {
        // Keep controller fail-safe if player blocks a command.
      }
      return;
    }

    clearRecoveryTimer();
    recoveryTimerRef.current = window.setTimeout(() => {
      if (!eligibleRef.current) {
        return;
      }

      const latestPlayer = playerRef.current;
      if (!latestPlayer || !playerReadyRef.current) {
        return;
      }

      const currentState = latestPlayer.getPlayerState?.();
      const needsPlay = pausedDueToViolationRef.current || currentState !== PLAYING_STATE;
      if (!needsPlay) {
        return;
      }

      try {
        latestPlayer.playVideo?.();
        pausedDueToViolationRef.current = false;
      } catch {
        // Autoplay policies can temporarily reject play; next state change will retry.
      }
    }, stableRecoveryMs);

    return clearRecoveryTimer;
  }, [eligibleToPlay, enabled, playerReadyRef, playerRef, stableRecoveryMs]);
}
