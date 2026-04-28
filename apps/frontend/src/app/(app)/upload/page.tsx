"use client";

import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/upload/stepper";
import { StepUpload } from "@/components/upload/step-upload";
import { StepMap } from "@/components/upload/step-map";
import { StepValidate } from "@/components/upload/step-validate";
import { StepReview } from "@/components/upload/step-review";
import { StepApply } from "@/components/upload/step-apply";
import { useWizardState } from "@/components/upload/state";
import type { WizardStep } from "@/components/upload/types";

export default function UploadPage() {
  const { state, setState, hydrated, reset } = useWizardState();
  const qc = useQueryClient();

  if (!hydrated) {
    return <div className="h-32" />;
  }

  function go(step: WizardStep) {
    setState({ ...state, step });
  }

  function reachable(step: WizardStep): boolean {
    if (step === "upload") return true;
    if (state.file === null) return false;
    if (step === "map") return true;
    if (state.mapping.fromIdx === null || state.mapping.toIdx === null) return false;
    if (step === "validate") return true;
    if (!state.validated || state.validated.length === 0) return false;
    if (step === "review") return true;
    return state.apply !== null;
  }

  return (
    <div className="space-y-1">
      <PageHeader
        eyebrow="Manage"
        title="Batch upload"
        description="Import many redirects from a CSV. Map columns, validate, dedupe against the local mirror, then apply."
        actions={
          state.file && (
            <Button variant="ghost" onClick={reset}>
              <RotateCcw className="h-3.5 w-3.5" />
              Start over
            </Button>
          )
        }
      />

      <Stepper current={state.step} onJump={go} reachable={reachable} />

      {state.step === "upload" && (
        <StepUpload
          file={state.file}
          onFile={(file, mappingPatch) =>
            setState({
              ...state,
              file,
              mapping: { ...state.mapping, ...mappingPatch },
              validated: null,
              review: null,
              apply: null,
            })
          }
          onClear={() =>
            setState({
              ...state,
              file: null,
              validated: null,
              review: null,
              apply: null,
            })
          }
          onNext={() => go("map")}
        />
      )}

      {state.step === "map" && state.file && (
        <StepMap
          file={state.file}
          mapping={state.mapping}
          onChange={(mapping) =>
            setState({ ...state, mapping, validated: null, review: null })
          }
          onBack={() => go("upload")}
          onNext={() => go("validate")}
        />
      )}

      {state.step === "validate" && state.file && (
        <StepValidate
          file={state.file}
          mapping={state.mapping}
          onBack={() => go("map")}
          onNext={(validated) =>
            setState({ ...state, validated, review: null, step: "review" })
          }
        />
      )}

      {state.step === "review" && state.validated && (
        <StepReview
          validated={state.validated}
          preview={state.review}
          onPreview={(review) => setState({ ...state, review })}
          applyOptions={state.applyOptions}
          onChangeOptions={(applyOptions) => setState({ ...state, applyOptions })}
          onBack={() => go("validate")}
          onApplied={(apply) => {
            qc.invalidateQueries({ queryKey: ["redirects"] });
            setState({ ...state, apply, step: "apply" });
          }}
        />
      )}

      {state.step === "apply" && state.apply && (
        <StepApply
          apply={state.apply}
          onReset={() => {
            reset();
            qc.invalidateQueries({ queryKey: ["redirects"] });
          }}
        />
      )}
    </div>
  );
}
