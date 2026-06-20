"use client";

import { useI18n } from "@/lib/i18n";

type StepKey = "transcribe" | "organize" | "save";

type Props = {
  active: StepKey;
};

export function DumpProcessingSteps({ active }: Props) {
  const { t } = useI18n();
  const steps: { key: StepKey; label: string }[] = [
    { key: "transcribe", label: t("center.stepTranscribe") },
    { key: "organize", label: t("center.stepOrganize") },
    { key: "save", label: t("center.stepSave") },
  ];
  const order: StepKey[] = ["transcribe", "organize", "save"];
  const activeIndex = order.indexOf(active);

  return (
    <ol className="bd-dump-processing-steps" aria-label={t("center.processingStepsAria")}>
      {steps.map((step, i) => {
        const done = i < activeIndex;
        const current = step.key === active;
        return (
          <li
            key={step.key}
            className={`bd-dump-processing-step${done ? " bd-dump-processing-step--done" : ""}${current ? " bd-dump-processing-step--active" : ""}`}
            aria-current={current ? "step" : undefined}
          >
            <span className="bd-dump-processing-step-marker" aria-hidden>
              {done ? "✓" : i + 1}
            </span>
            <span>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
