import { useMemo, useState } from "react";
import { BrowserLauncherStep } from "../browser-launcher";
import { LlmConfigStep } from "../llm-config";
import { NodeRuntimeStep } from "../node-runtime";
import { OpenClawInstallerStep } from "../openclaw-installer";
import { PlatformStep } from "../platform";
import { ServiceManagerStep } from "../service-manager";

interface SetupWizardProps {
  onFinish: () => void;
}

const STEPS = [
  "Platform",
  "Node Runtime",
  "OpenClaw Install",
  "LLM Config",
  "Gateway Launch",
  "Browser",
];

export function SetupWizard({ onFinish }: SetupWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const progress = useMemo(() => ((stepIndex + 1) / STEPS.length) * 100, [stepIndex]);

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-xl shadow-slate-900/5 backdrop-blur sm:p-8">
      <header className="space-y-3">
        <p className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
          Setup Wizard
        </p>
        <h1 className="text-3xl font-semibold text-slate-900">Prepare OpenClawini</h1>
        <p className="text-sm text-slate-600">
          Complete each step once. After this, you will land in the main control panel.
        </p>
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-brand transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-slate-500">
            Step {stepIndex + 1} of {STEPS.length}: {STEPS[stepIndex]}
          </p>
        </div>
      </header>

      {stepIndex === 0 ? <PlatformStep onContinue={() => setStepIndex(1)} /> : null}
      {stepIndex === 1 ? <NodeRuntimeStep onContinue={() => setStepIndex(2)} /> : null}
      {stepIndex === 2 ? <OpenClawInstallerStep onContinue={() => setStepIndex(3)} /> : null}
      {stepIndex === 3 ? <LlmConfigStep onContinue={() => setStepIndex(4)} /> : null}
      {stepIndex === 4 ? <ServiceManagerStep onContinue={() => setStepIndex(5)} /> : null}
      {stepIndex === 5 ? <BrowserLauncherStep onFinish={onFinish} /> : null}
    </section>
  );
}
