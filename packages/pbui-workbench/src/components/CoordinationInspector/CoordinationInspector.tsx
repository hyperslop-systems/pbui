import { AppBody, Button, EmptyState, Text, Toolbar } from "@hyperslop-systems/pbui";
import { badgesOfView, checkInvariants } from "@hyperslop-systems/pbui";
import { defineWorkbenchApp, type AppProps, type WorkbenchApp } from "../../app";
import { useWorkbench } from "../../context";
import { useLinkSnapshot } from "../../links/hooks";
import { linkRefsOf } from "../../links/linkRef";
import styles from "./CoordinationInspector.module.css";

/**
 * The coordination inspector (design §6.8.3 "lite" → Phase 7): one tile that
 * lists every bound port with its badge words, every wire with its kind,
 * every context with who drives it, every identity class, and the kernel's
 * invariant check — the same facts `describeWorkbench` hands an agent,
 * for a person. A singleton: it is a pure function of the link facts.
 */
export function CoordinationInspector(_props: AppProps) {
  const workbench = useWorkbench();
  const snapshot = useLinkSnapshot(workbench);
  const views = [...new Set([...snapshot.ports.values()].map((port) => port.viewId))];
  const bindings = views.flatMap((viewId) => badgesOfView(viewId, snapshot, workbench.links.deps));
  const links = linkRefsOf(snapshot);
  const contexts = [...snapshot.contexts.values()];
  const classes = [...snapshot.classes.values()];
  const violations = checkInvariants(snapshot, workbench.links.deps);
  const title = (port: string) => {
    const definition = snapshot.ports.get(port);
    return definition ? `${definition.tileTitle} · ${definition.declaration.name}` : port;
  };
  const empty = bindings.length === 0 && links.length === 0;

  return (
    <div data-part="coordination-inspector" className={styles.app}>
      <Toolbar tight>
        <Text size="tiny" strong>
          coordination
        </Text>
        <span className={styles.spacer} />
        <Text size="tiny" tone="faint">
          {bindings.length} bound · {links.length} wires · {classes.length} classes · {violations.length === 0 ? "invariants hold" : `${violations.length} violations`}
        </Text>
        <Button size="tiny" variant="framed" onClick={() => workbench.dispatch({ kind: "link.mode.open" })}>
          show wiring
        </Button>
      </Toolbar>
      <AppBody flush className={styles.body}>
        {empty ? (
          <div className={styles.pad}>
            <EmptyState message="nothing is linked yet" hint="right-click a value and choose “Link to…”, or press Mod+Shift+L for the patch bay" />
          </div>
        ) : (
          <div className={styles.pad}>
            <section>
              <Text size="tiny" strong>
                PORTS
              </Text>
              <table className={styles.table} data-part="inspector-bindings">
                <thead>
                  <tr>
                    <th>port</th>
                    <th>state</th>
                    <th>badge</th>
                    <th>reads</th>
                  </tr>
                </thead>
                <tbody>
                  {bindings.map((badge) => (
                    <tr key={badge.port} data-port={badge.port} data-state={badge.state}>
                      <td>{title(badge.port)}</td>
                      <td>{badge.state}</td>
                      <td>
                        {badge.glyph} {badge.text}
                      </td>
                      <td className={styles.faint}>{badge.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            {links.length > 0 ? (
              <section>
                <Text size="tiny" strong>
                  WIRES
                </Text>
                <table className={styles.table} data-part="inspector-links">
                  <thead>
                    <tr>
                      <th>kind</th>
                      <th>from</th>
                      <th>to</th>
                      <th>through</th>
                    </tr>
                  </thead>
                  <tbody>
                    {links.map((link) => (
                      <tr key={link.linkId} data-link-id={link.linkId} data-term={link.kind}>
                        <td>{link.kind}</td>
                        <td>{link.sourceTitle}</td>
                        <td>{link.destinationTitle}</td>
                        <td className={styles.faint}>{link.kind === "identity" ? (link.classId ?? "—") : (link.relationId ?? "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}
            {contexts.length > 0 ? (
              <section>
                <Text size="tiny" strong>
                  CONTEXTS
                </Text>
                <table className={styles.table} data-part="inspector-contexts">
                  <thead>
                    <tr>
                      <th>key</th>
                      <th>type</th>
                      <th>driven by</th>
                      <th>holds</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contexts.map((context) => (
                      <tr key={context.key}>
                        <td>{context.key}</td>
                        <td>&lt;{context.valueType}&gt;</td>
                        <td className={styles.faint}>{context.drivenBy.map(title).join(", ") || "—"}</td>
                        <td>{snapshot.values.context(context.key) ? "a value" : "nothing"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}
            {violations.length > 0 ? (
              <section data-part="inspector-violations">
                <Text size="tiny" strong>
                  VIOLATIONS
                </Text>
                <ul>
                  {violations.map((violation, index) => (
                    <li key={index}>
                      <code>{violation.code}</code> {violation.message}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </AppBody>
    </div>
  );
}

export interface CoordinationInspectorAppOptions {
  id?: string;
  title?: string;
  tone?: string;
  group?: string;
}

/** The inspector as an application: a singleton, offered in the WORKBENCH launcher group. */
export function createCoordinationInspectorApp(options: CoordinationInspectorAppOptions = {}): WorkbenchApp {
  return defineWorkbenchApp({
    manifest: { id: options.id ?? "coordination", viewCardinality: "one" },
    presentation: {
      title: options.title ?? "Coordination",
      tone: options.tone ?? "var(--pbui-tone-neutral)",
      group: options.group ?? "WORKBENCH",
      blurb: "every bound port, wire, context and class in this workbench, with the kernel's invariants",
      Component: CoordinationInspector,
    },
  });
}

export const coordinationInspectorApp = createCoordinationInspectorApp();
