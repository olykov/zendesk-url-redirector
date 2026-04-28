"use client";

import { useEffect, useState } from "react";
import type { ApplyState, FileState, MappingConfig, ReviewState, ValidatedRow, WizardStep } from "./types";

const STORAGE_KEY = "redirector.batch.v1";

export interface WizardState {
  step: WizardStep;
  file: FileState | null;
  mapping: MappingConfig;
  validated: ValidatedRow[] | null;
  review: ReviewState | null;
  apply: ApplyState | null;
  applyOptions: {
    skipExisting: boolean;
    skipConflicts: boolean;
    throttleMs: number;
  };
}

const DEFAULT_STATE: WizardState = {
  step: "upload",
  file: null,
  mapping: {
    fromIdx: null,
    toIdx: null,
    statusIdx: null,
    hasHeader: true,
    defaultStatus: "301",
    trim: true,
    skipEmpty: true,
  },
  validated: null,
  review: null,
  apply: null,
  applyOptions: {
    skipExisting: true,
    skipConflicts: true,
    throttleMs: 50,
  },
};

export function useWizardState() {
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as WizardState;
        // file rows can be huge — keep them, but if file is older than 24h, drop
        if (parsed.file && Date.now() - parsed.file.loadedAt > 24 * 60 * 60 * 1000) {
          parsed.file = null;
          parsed.step = "upload";
          parsed.validated = null;
          parsed.review = null;
          parsed.apply = null;
        }
        setState({ ...DEFAULT_STATE, ...parsed });
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota / serialization — ignore, wizard still works */
    }
  }, [state, hydrated]);

  function reset() {
    setState(DEFAULT_STATE);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  return { state, setState, hydrated, reset };
}
