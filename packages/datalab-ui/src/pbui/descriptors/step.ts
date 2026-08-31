import type { PresentationDescriptor } from "../registry";

/**
 * `<step>` — one verb in the pipeline.
 *
 * "Disable (keep in the chain)" is deliberately worded to say what it does NOT
 * do. A step is an experiment you can switch off, which is the difference
 * between a pipeline and a recording.
 */
export const stepDescriptor: PresentationDescriptor<string> = {
  ptype: "step",
  tone: "var(--pbui-tone-step)",

  label: (stepId) => stepId,

  describe: (stepId) => ({ presentationType: "step", id: stepId }),
};
