"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { FileState, MappingConfig } from "./types";

export function StepMap({
  file,
  mapping,
  onChange,
  onBack,
  onNext,
}: {
  file: FileState;
  mapping: MappingConfig;
  onChange: (next: MappingConfig) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const update = (patch: Partial<MappingConfig>) => onChange({ ...mapping, ...patch });
  const ready = mapping.fromIdx !== null && mapping.toIdx !== null;
  const cols = file.headers.map((h, i) => ({ value: i, label: h || `col ${i + 1}` }));

  return (
    <div className="space-y-6">
      <section className="rounded-[8px] border border-line bg-surface p-5">
        <div className="text-[10.5px] uppercase tracking-[0.12em] text-fg-4 font-semibold mb-4">
          Column mapping
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="map-from">From column</Label>
            <Select
              id="map-from"
              value={mapping.fromIdx ?? ""}
              onChange={(e) =>
                update({ fromIdx: e.target.value === "" ? null : Number(e.target.value) })
              }
            >
              <option value="">— select —</option>
              {cols.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="map-to">To column</Label>
            <Select
              id="map-to"
              value={mapping.toIdx ?? ""}
              onChange={(e) =>
                update({ toIdx: e.target.value === "" ? null : Number(e.target.value) })
              }
            >
              <option value="">— select —</option>
              {cols.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="map-status">Status column (optional)</Label>
            <Select
              id="map-status"
              value={mapping.statusIdx ?? ""}
              onChange={(e) =>
                update({ statusIdx: e.target.value === "" ? null : Number(e.target.value) })
              }
            >
              <option value="">use default below</option>
              {cols.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="default-status">Default status</Label>
            <Select
              id="default-status"
              value={mapping.defaultStatus}
              onChange={(e) =>
                update({ defaultStatus: (e.target.value as "301" | "302") })
              }
            >
              <option value="301">301 — permanent</option>
              <option value="302">302 — temporary</option>
            </Select>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <Toggle
            checked={mapping.skipEmpty}
            onChange={(v) => update({ skipEmpty: v })}
            label="Skip rows where From is empty"
          />
          <Toggle
            checked={mapping.trim}
            onChange={(v) => update({ trim: v })}
            label="Trim whitespace from values"
          />
        </div>
      </section>

      {/* Live preview of mapped values */}
      <section className="rounded-[8px] border border-line overflow-hidden">
        <div className="px-4 py-2 bg-surface border-b border-line text-[10.5px] uppercase tracking-[0.1em] text-fg-4 font-semibold">
          Mapped preview · first {Math.min(5, file.rows.length)} rows
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] tabular">
            <thead>
              <tr className="border-b border-line bg-bg/40">
                <th className="px-3 py-1.5 text-left font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4">
                  From
                </th>
                <th className="px-3 py-1.5 text-left font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4">
                  To
                </th>
                <th className="px-3 py-1.5 text-left font-medium text-[10.5px] uppercase tracking-[0.08em] text-fg-4 w-[70px]">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {file.rows.slice(0, 5).map((r, i) => {
                const f = mapping.fromIdx !== null ? r[mapping.fromIdx] ?? "" : "";
                const t = mapping.toIdx !== null ? r[mapping.toIdx] ?? "" : "";
                const s = mapping.statusIdx !== null ? r[mapping.statusIdx] ?? "" : "";
                return (
                  <tr key={i} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-1.5 font-mono text-fg-2 truncate max-w-[320px]">
                      {f || <span className="text-fg-4">—</span>}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-fg-2 truncate max-w-[320px]">
                      {t || <span className="text-fg-4">—</span>}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-fg-2">
                      {s || <span className="text-fg-4">{mapping.defaultStatus}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onNext} disabled={!ready}>
          Validate rows
        </Button>
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2.5 text-[13px] text-fg-2 cursor-pointer select-none">
      <span
        className={
          "relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors " +
          (checked ? "bg-fg-3" : "bg-line")
        }
      >
        <span
          className={
            "absolute top-0.5 h-3 w-3 rounded-full bg-bg transition-transform " +
            (checked ? "translate-x-3.5" : "translate-x-0.5")
          }
        />
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      {label}
    </label>
  );
}
