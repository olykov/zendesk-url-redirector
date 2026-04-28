"use client";

import { useRef, useState } from "react";
import { FileUp, FileText, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { autoMap, parseCsv } from "./csv";
import type { FileState, MappingConfig } from "./types";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 50_000;

export function StepUpload({
  file,
  onFile,
  onNext,
  onClear,
}: {
  file: FileState | null;
  onFile: (f: FileState, mapping: Partial<MappingConfig>) => void;
  onNext: () => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(f: File) {
    setError(null);
    if (!/\.(csv|tsv|txt)$/i.test(f.name)) {
      setError("Unsupported file type. Use .csv or .tsv.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError(`File too large (${(f.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`);
      return;
    }
    const text = await f.text();
    const parsed = parseCsv(text);
    if (parsed.rows.length === 0 && parsed.headers.length === 0) {
      setError("File is empty.");
      return;
    }
    if (parsed.rows.length > MAX_ROWS) {
      setError(`Too many rows (${parsed.rows.length}). Max ${MAX_ROWS.toLocaleString()}.`);
      return;
    }
    const fileState: FileState = {
      name: f.name,
      size: f.size,
      delimiter: parsed.delimiter,
      headers: parsed.headers,
      rows: parsed.rows,
      loadedAt: Date.now(),
    };
    const auto = autoMap(parsed.headers);
    onFile(fileState, {
      fromIdx: auto.fromIdx,
      toIdx: auto.toIdx,
      statusIdx: auto.statusIdx,
    });
  }

  if (file) {
    return (
      <div className="space-y-4">
        <div className="rounded-[8px] border border-line bg-surface p-4 flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-surface-2 border border-line">
            <FileText className="h-4 w-4 text-fg-2" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[13px] text-fg truncate">{file.name}</span>
            </div>
            <div className="mt-1 text-[12px] text-fg-3 tabular flex flex-wrap gap-x-3 gap-y-0.5">
              <span>{(file.size / 1024).toFixed(1)} KB</span>
              <span>{file.rows.length.toLocaleString()} rows</span>
              <span>{file.headers.length} columns</span>
              <span>delimiter: <code className="font-mono">{file.delimiter === "\t" ? "TAB" : file.delimiter}</code></span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClear}
            className="grid h-7 w-7 place-items-center rounded-[4px] text-fg-3 hover:bg-surface-2 hover:text-fg transition-colors"
            title="Replace file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="rounded-[8px] border border-line overflow-hidden">
          <div className="px-4 py-2 bg-surface border-b border-line text-[10.5px] uppercase tracking-[0.1em] text-fg-4 font-semibold">
            Preview · first {Math.min(5, file.rows.length)} of {file.rows.length} rows
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px] tabular">
              <thead>
                <tr className="border-b border-line bg-bg/40">
                  {file.headers.map((h, i) => (
                    <th key={i} className="px-3 py-1.5 text-left font-mono text-[11px] text-fg-3">
                      {h || <span className="text-fg-4">col {i + 1}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {file.rows.slice(0, 5).map((r, ri) => (
                  <tr key={ri} className="border-b border-line last:border-b-0">
                    {file.headers.map((_, ci) => (
                      <td key={ci} className="px-3 py-1.5 font-mono text-fg-2 truncate max-w-[260px]">
                        {r[ci] ?? ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" onClick={onNext}>
            Continue to mapping
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) void handle(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={
          "flex flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed cursor-pointer " +
          "px-8 py-16 transition-colors " +
          (dragOver
            ? "border-fg-3 bg-surface-2"
            : "border-line bg-surface/30 hover:border-line-strong hover:bg-surface")
        }
      >
        <div className="grid h-10 w-10 place-items-center rounded-full border border-line bg-surface-2">
          <FileUp className="h-4 w-4 text-fg-2" />
        </div>
        <div className="text-center">
          <div className="text-[14px] font-medium text-fg">Drop a CSV or TSV file</div>
          <div className="mt-1 text-[12.5px] text-fg-3">
            or click to browse · max 10 MB · up to {MAX_ROWS.toLocaleString()} rows
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handle(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-[6px] border border-danger/40 bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
