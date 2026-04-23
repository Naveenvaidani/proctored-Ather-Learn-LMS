import { ViolationType } from "../features/engagement/types";

/**
 * Configuration for HP engine behavior
 */
export interface EngagementEngineConfig {
  baseMercyMs: number; // Base mercy window in milliseconds (default 7000)
  maxNegativeHpPerTick: number; // Max HP loss per tick (default 18)
  penaltyMap: Record<ViolationType, number>; // Per-violation penalty values
  violationIntervalMs: Record<ViolationType, number>; // Min time between penalties per violation
  preeMercyThresholdMs: number; // Pre-mercy trigger threshold (default 2000)
  scalationThresholdMs: number; // Escalation trigger threshold (default 2x mercy)
  escalationMultiplier: number; // HP escalation multiplier (default 1.25)
  enableHPRecovery: boolean; // Allow HP to auto-increase (default false)
}

/**
 * Service for managing engagement engine configuration
 * Allows courses to customize HP penalty behavior
 */
export class EngagementConfigService {
  private static readonly STORAGE_KEY = "engagement:config";
  private static readonly PRESET_KEY = "engagement:preset";

  /**
   * Default configuration (FDA-aligned, strict)
   */
  static readonly DEFAULT_CONFIG: EngagementEngineConfig = {
    baseMercyMs: 7000,
    maxNegativeHpPerTick: 18,
    penaltyMap: {
      NO_FACE: 8,
      MULTIPLE_FACES: 10,
      LOOKING_AWAY: 3,
      HEAD_DOWN: 8,
      TALKING: 5,
      NOISE: 3,
      TAB_SWITCH: 12,
      INACTIVITY: 9,
    },
    violationIntervalMs: {
      NO_FACE: 1000,
      MULTIPLE_FACES: 1000,
      LOOKING_AWAY: 1000,
      HEAD_DOWN: 1000,
      TALKING: 1000,
      NOISE: 1000,
      TAB_SWITCH: 700,
      INACTIVITY: 1000,
    },
    preeMercyThresholdMs: 2000,
    scalationThresholdMs: 14000, // 2x mercy
    escalationMultiplier: 1.25,
    enableHPRecovery: false,
  };

  /**
   * Lenient preset (more forgiving for low-stakes modules)
   */
  static readonly LENIENT_PRESET: EngagementEngineConfig = {
    ...EngagementConfigService.DEFAULT_CONFIG,
    baseMercyMs: 10000, // 10s mercy window
    penaltyMap: {
      NO_FACE: 4,
      MULTIPLE_FACES: 6,
      LOOKING_AWAY: 2,
      HEAD_DOWN: 4,
      TALKING: 3,
      NOISE: 2,
      TAB_SWITCH: 8,
      INACTIVITY: 5,
    },
    maxNegativeHpPerTick: 12,
    enableHPRecovery: true, // Allow recovery
  };

  /**
   * Strict preset (high-stakes exams)
   */
  static readonly STRICT_PRESET: EngagementEngineConfig = {
    ...EngagementConfigService.DEFAULT_CONFIG,
    baseMercyMs: 5000, // 5s mercy window
    penaltyMap: {
      NO_FACE: 12,
      MULTIPLE_FACES: 14,
      LOOKING_AWAY: 5,
      HEAD_DOWN: 12,
      TALKING: 8,
      NOISE: 4,
      TAB_SWITCH: 15,
      INACTIVITY: 12,
    },
    maxNegativeHpPerTick: 24,
    preeMercyThresholdMs: 1000, // Faster pre-mercy trigger
  };

  /**
   * Get current configuration
   */
  static getConfig(): EngagementEngineConfig {
    const stored = localStorage.getItem(EngagementConfigService.STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return EngagementConfigService.DEFAULT_CONFIG;
      }
    }
    return EngagementConfigService.DEFAULT_CONFIG;
  }

  /**
   * Set custom configuration
   */
  static setConfig(config: Partial<EngagementEngineConfig>): void {
    const current = EngagementConfigService.getConfig();
    const merged = { ...current, ...config };
    localStorage.setItem(EngagementConfigService.STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent("engagement:config-changed", { detail: merged }));
  }

  /**
   * Apply a preset configuration
   */
  static applyPreset(preset: "default" | "lenient" | "strict"): void {
    let config: EngagementEngineConfig;

    switch (preset) {
      case "lenient":
        config = EngagementConfigService.LENIENT_PRESET;
        break;
      case "strict":
        config = EngagementConfigService.STRICT_PRESET;
        break;
      default:
        config = EngagementConfigService.DEFAULT_CONFIG;
    }

    localStorage.setItem(EngagementConfigService.STORAGE_KEY, JSON.stringify(config));
    localStorage.setItem(EngagementConfigService.PRESET_KEY, preset);
    window.dispatchEvent(new CustomEvent("engagement:config-changed", { detail: config }));
  }

  /**
   * Get currently active preset name
   */
  static getActivePreset(): string {
    return localStorage.getItem(EngagementConfigService.PRESET_KEY) || "default";
  }

  /**
   * Reset to default configuration
   */
  static resetToDefault(): void {
    localStorage.removeItem(EngagementConfigService.STORAGE_KEY);
    localStorage.removeItem(EngagementConfigService.PRESET_KEY);
    window.dispatchEvent(
      new CustomEvent("engagement:config-changed", {
        detail: EngagementConfigService.DEFAULT_CONFIG,
      })
    );
  }

  /**
   * Update a single penalty value
   */
  static updatePenalty(violation: ViolationType, penalty: number): void {
    const config = EngagementConfigService.getConfig();
    config.penaltyMap[violation] = penalty;
    EngagementConfigService.setConfig(config);
  }

  /**
   * Get recommended config for course type
   */
  static getConfigForCourseType(courseType: "practice" | "module" | "quiz" | "exam"): EngagementEngineConfig {
    switch (courseType) {
      case "practice":
        return EngagementConfigService.LENIENT_PRESET;
      case "exam":
        return EngagementConfigService.STRICT_PRESET;
      case "quiz":
        return {
          ...EngagementConfigService.DEFAULT_CONFIG,
          baseMercyMs: 6000,
        };
      default:
        return EngagementConfigService.DEFAULT_CONFIG;
    }
  }

  /**
   * Export configuration as JSON for backup/sharing
   */
  static exportConfig(): string {
    const config = EngagementConfigService.getConfig();
    return JSON.stringify(config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  static importConfig(jsonString: string): boolean {
    try {
      const config = JSON.parse(jsonString);
      // Validate structure
      if (!config.penaltyMap || !config.violationIntervalMs) {
        throw new Error("Invalid configuration structure");
      }
      EngagementConfigService.setConfig(config);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Hook to use engagement config with reactive updates
 */
import { useEffect, useState } from "react";

export function useEngagementConfig() {
  const [config, setConfig] = useState<EngagementEngineConfig>(EngagementConfigService.getConfig());
  const [preset, setPreset] = useState<string>(EngagementConfigService.getActivePreset());

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent;
      setConfig(customEvent.detail);
    };

    window.addEventListener("engagement:config-changed", handler);
    return () => window.removeEventListener("engagement:config-changed", handler);
  }, []);

  return {
    config,
    preset,
    applyPreset: (p: "default" | "lenient" | "strict") => {
      EngagementConfigService.applyPreset(p);
      setPreset(p);
    },
    updatePenalty: (violation: ViolationType, penalty: number) => {
      EngagementConfigService.updatePenalty(violation, penalty);
    },
    resetToDefault: () => {
      EngagementConfigService.resetToDefault();
      setPreset("default");
    },
  };
}
