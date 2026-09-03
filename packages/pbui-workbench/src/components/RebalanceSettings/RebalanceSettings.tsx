import { useEffect, useState } from "react";
import { Button, CheckboxRow, Text, TextInput } from "@hyperslop-systems/pbui";
import { defineApp, type AppDescriptor, type AppProps } from "../../apps";
import { useWorkbench } from "../../context";
import { profileConfig, REBALANCE_PROFILES, RELAX_ITERS_MAX, RELAX_ITERS_MIN, type RebalanceConfig, type RebalanceProfileName } from "@hyperslop-systems/workbench-core/rebalance";
import { documentRebalanceConfigStore, type RebalanceConfigStore } from "../../rebalance/configStore";
import { GENERATORS } from "@hyperslop-systems/workbench-core/rebalance";
import styles from "./RebalanceSettings.module.css";

/**
 * The rebalance settings tile (PBUI-REBALANCE-1, design-doc/01 §4.5): a
 * singleton application editing the rebalance config through a
 * `RebalanceConfigStore`. WHERE that config lives is the product's choice
 * (configStore.ts): the default store keeps it in the workbench document as
 * the `pbui.rebalance-config` DocumentPayload, and the rebalance dialog
 * reads the same store — two doors, one config.
 *
 * Every control commits one save per DISCRETE change — checkbox toggles and
 * blur/Enter on the number fields — never per keystroke, because a store may
 * persist on every commit (store.ts documents the failure mode).
 * Any manual deviation from a named profile flips `profile` to "custom".
 */
export function RebalanceSettings({ store = documentRebalanceConfigStore }: AppProps & { store?: RebalanceConfigStore }) {
  const workbench = useWorkbench();
  const config = store.useConfig(workbench);

  const save = (next: RebalanceConfig) => {
    store.save(workbench, next);
  };
  const patch = (partial: Partial<RebalanceConfig>) => save({ ...config, ...partial, profile: "custom" });

  const applyProfile = (name: RebalanceProfileName) => {
    // Constraints describe the screen and the user's eyes, not a repair
    // posture — they survive a profile switch (config.ts).
    save({
      ...profileConfig(name),
      minInlinePx: config.minInlinePx,
      minBlockPx: config.minBlockPx,
      hystPx: config.hystPx,
      targetAspect: config.targetAspect,
    });
  };

  return (
    <div className={styles.body} data-part="rebalance-settings">
      <section>
        <Text size="small" strong>
          profile
        </Text>
        <div className={styles.row}>
          {(Object.keys(REBALANCE_PROFILES) as RebalanceProfileName[]).map((name) => (
            <Button
              key={name}
              variant={config.profile === name ? "raised" : "framed"}
              onClick={() => applyProfile(name)}
            >
              {REBALANCE_PROFILES[name].label}
            </Button>
          ))}
        </div>
        <Text size="tiny" tone="faint">
          {config.profile === "custom" ? "custom — your own mix" : REBALANCE_PROFILES[config.profile].description}
        </Text>
      </section>

      <section>
        <Text size="small" strong>
          constraints
        </Text>
        <div className={styles.grid}>
          <NumberField label="min tile width px" value={config.minInlinePx} min={40} onCommit={(v) => patch({ minInlinePx: v })} />
          <NumberField label="min tile height px" value={config.minBlockPx} min={40} onCommit={(v) => patch({ minBlockPx: v })} />
          <NumberField label="hysteresis px" value={config.hystPx} min={0} onCommit={(v) => patch({ hystPx: v })} />
          <NumberField label="target aspect" value={config.targetAspect} min={0.4} step onCommit={(v) => patch({ targetAspect: v })} />
        </div>
      </section>

      <section>
        <Text size="small" strong>
          what the layout is allowed to do
        </Text>
        <CheckboxRow checked={config.allow.reorder} label="reorder tiles" onCheckedChange={(v) => patch({ allow: { ...config.allow, reorder: v } })} />
        <CheckboxRow checked={config.allow.topology} label="reshape the tree" onCheckedChange={(v) => patch({ allow: { ...config.allow, topology: v } })} />
        <CheckboxRow checked={config.allow.rebuild} label="rebuild the layout" onCheckedChange={(v) => patch({ allow: { ...config.allow, rebuild: v } })} />
        <CheckboxRow checked={config.allow.overflow} label="move tiles to another workspace" onCheckedChange={(v) => patch({ allow: { ...config.allow, overflow: v } })} />
        <div className={styles.grid}>
          <NumberField label="tiles may move %" value={config.budget.panesPct} min={0} onCommit={(v) => patch({ budget: { ...config.budget, panesPct: Math.min(100, v) } })} />
          <NumberField
            label="displacement cap px (0 = unlimited)"
            value={config.budget.dispPx ?? 0}
            min={0}
            onCommit={(v) => patch({ budget: { ...config.budget, dispPx: v <= 0 ? null : v } })}
          />
        </div>
      </section>

      <section>
        <Text size="small" strong>
          how the recommendation is chosen
        </Text>
        <div className={styles.grid}>
          <NumberField label="weight: movement" value={config.weights.move} min={0} step onCommit={(v) => patch({ weights: { ...config.weights, move: v } })} />
          <NumberField label="weight: structure" value={config.weights.struct} min={0} step onCommit={(v) => patch({ weights: { ...config.weights, struct: v } })} />
          <NumberField label="weight: aspect" value={config.weights.aspect} min={0} step onCommit={(v) => patch({ weights: { ...config.weights, aspect: v } })} />
        </div>
      </section>

      <section>
        <Text size="small" strong>
          relax energy (opt-in generator)
        </Text>
        <Text size="tiny" tone="faint">
          A nonzero aspect pull acts on splits that are not broken — tidying, not repair.
        </Text>
        <div className={styles.grid}>
          <NumberField label="relax: centre weight α" value={config.relax.alpha} min={0} step onCommit={(v) => patch({ relax: { ...config.relax, alpha: v } })} />
          <NumberField label="relax: size weight β" value={config.relax.beta} min={0} step onCommit={(v) => patch({ relax: { ...config.relax, beta: v } })} />
          <NumberField label="relax: aspect pull γ" value={config.relax.gamma} min={0} step onCommit={(v) => patch({ relax: { ...config.relax, gamma: v } })} />
          <NumberField label="relax: iterations" value={config.relax.iters} min={RELAX_ITERS_MIN} onCommit={(v) => patch({ relax: { ...config.relax, iters: Math.min(RELAX_ITERS_MAX, v) } })} />
        </div>
      </section>

      <section>
        <Text size="small" strong>
          candidate generators
        </Text>
        {GENERATORS.map((generator) => (
          <CheckboxRow
            key={generator.id}
            checked={config.enabledGenerators.includes(generator.id)}
            label={`${generator.label} — ${generator.note}`}
            onCheckedChange={(checked) =>
              patch({
                enabledGenerators: checked
                  ? [...config.enabledGenerators, generator.id]
                  : config.enabledGenerators.filter((id) => id !== generator.id),
              })
            }
          />
        ))}
      </section>
    </div>
  );
}

/**
 * A number field that commits on blur or Enter — one mutation per settled
 * value, never one per keystroke. Non-numeric input is discarded on commit.
 */
function NumberField({
  label,
  value,
  min,
  step = false,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  /** Fractional values allowed (weights, aspect). */
  step?: boolean;
  onCommit(value: number): void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number.parseFloat(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const settled = Math.max(min, step ? parsed : Math.round(parsed));
    if (settled !== value) onCommit(settled);
    setDraft(String(settled));
  };
  return (
    <label className={styles.field}>
      <Text size="tiny" tone="faint">
        {label}
      </Text>
      <TextInput
        value={draft}
        onValueChange={setDraft}
        accessibleName={label}
        width="narrow"
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit();
        }}
      />
    </label>
  );
}

export interface RebalanceSettingsAppOptions {
  /** Where the config lives; default: inside the workbench document. */
  store?: RebalanceConfigStore;
  id?: string;
  title?: string;
  tone?: string;
  group?: string;
  blurb?: string;
}

/**
 * Build the settings-tile descriptor with a product-chosen config store.
 * Pass the SAME store to `<wb.Rebalance configStore={…}/>` so the dialog and
 * the tile agree on where the config lives.
 */
export function createRebalanceSettingsApp(options: RebalanceSettingsAppOptions = {}): AppDescriptor {
  const store = options.store ?? documentRebalanceConfigStore;
  return defineApp({
    id: options.id ?? "rebalance-settings",
    title: options.title ?? "Rebalance settings",
    tone: options.tone ?? "var(--pbui-tone-neutral)",
    singleton: true,
    group: options.group ?? "WORKBENCH",
    blurb: options.blurb ?? "Choose how layout repair proposals are generated and ranked.",
    Component: function RebalanceSettingsTile(props: AppProps) {
      return <RebalanceSettings {...props} store={store} />;
    },
  });
}

/** The default descriptor: config stored in the workbench document. */
export const rebalanceSettingsApp = createRebalanceSettingsApp();
