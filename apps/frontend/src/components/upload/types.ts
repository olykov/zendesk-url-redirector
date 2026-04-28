import type { BatchApplyResponse, BatchPreviewResponse } from "@redirector/shared";

export type WizardStep = "upload" | "map" | "validate" | "review" | "apply";

export interface MappingConfig {
  fromIdx: number | null;
  toIdx: number | null;
  statusIdx: number | null;
  hasHeader: boolean;
  defaultStatus: "301" | "302";
  trim: boolean;
  skipEmpty: boolean;
}

export interface FileState {
  name: string;
  size: number;
  delimiter: "," | ";" | "\t";
  headers: string[];
  rows: string[][];
  loadedAt: number;
}

export type ValidatedRow =
  | { kind: "ready"; from: string; to: string; status: "301" | "302"; raw: string[]; lineNo: number }
  | { kind: "warning"; from: string; to: string; status: "301" | "302"; raw: string[]; lineNo: number; reason: string }
  | { kind: "invalid"; from: string; to: string; status: string; raw: string[]; lineNo: number; reason: string }
  | { kind: "duplicate-in-file"; from: string; to: string; status: "301" | "302"; raw: string[]; lineNo: number; firstSeenLine: number };

export type ReviewState = BatchPreviewResponse;
export type ApplyState = BatchApplyResponse;
