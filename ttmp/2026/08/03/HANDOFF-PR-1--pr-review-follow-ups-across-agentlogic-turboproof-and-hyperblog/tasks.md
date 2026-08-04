# Tasks

## TODO

- [x] T1 [P1] turboproof filestore Write TOCTOU: fingerprint check and os.Rename are not serialised (pkg/filestore/store.go:329) <!-- t:i71a -->
- [x] T2 [P1] turboproof one module-level handler for a view that mounts twice (ui/src/state/filesTile.ts:40) <!-- t:lktr -->
- [x] T3 [P1] turboproof directory rename orphans open descendants (ui/src/apps/FilesApp.tsx:191) <!-- t:2h6u -->
- [x] T4 [P1] turboproof rename writes back a stale document ref (ui/src/apps/FilesApp.tsx:199) <!-- t:poqa -->
- [x] T5 [P1] turboproof rejected batch discards valid edits with the refused prefix (ui/src/store/slice.ts:214) <!-- t:x4rm -->
- [x] T6 [P2] turboproof Fingerprint reads the whole file, bypassing files-max-bytes (pkg/filestore/store.go:277) <!-- t:06fx -->
- [x] T7 [P2] turboproof JSON body limit is smaller than the advertised file limit (pkg/cli/serve.go:104) <!-- t:9ojt -->
- [x] T8 [P2] turboproof file-root discovery caches its own transient failure (ui/src/state/fileRoots.ts:29) <!-- t:o8mu -->
- [x] T9 [P1] turboproof Windows roots produce invalid file URIs — ASK whether Windows is supported (ui/src/model/fileRefs.ts:80) <!-- t:aynr -->
- [x] T10 CI turboproof GoSec G302 on 0o644 — decide deliberately, scoped nosec not a blanket exclude (pkg/filestore/store.go:383) <!-- t:80uh -->
- [x] H1 [P1] hyperblog both readers share one cursor; server already models the binding (ui/src/apps/ReaderApp.tsx:19) <!-- t:gz7c -->
- [x] H2 [P1] hyperblog sign-out-everywhere is a GET against a POST route, silently fails (ui/src/api/client.ts:316) <!-- t:jbra -->
- [x] H3 [P1] hyperblog database file inherits the umask; holds emails and plaintext ID tokens (pkg/store/store.go:104) <!-- t:8vdp -->
- [x] H4 [P2] hyperblog PUT read-mark skips the tier check the rest of the paywall enforces (pkg/server/handlers_reading.go:141) <!-- t:sfbf -->
- [x] H5 [P2] hyperblog OIDC provider published across a data race while serving (pkg/server/server.go:211) <!-- t:d8sg -->
- [x] H6 [P2] hyperblog negative ttlDays silently creates a non-expiring token (pkg/server/handlers_me.go:268) <!-- t:sj34 -->
- [x] H7 [P2] hyperblog openLauncher has no case, so no working path to change a pane's view (Workbench.tsx:168) <!-- t:fl2p -->
- [x] H8 [P2] hyperblog split duplicates singleton tiles the server will reject (Workbench.tsx:147) <!-- t:pujl -->
- [x] H9 [P2] hyperblog session list shows idle-expired sessions for up to 16 days (pkg/store/accounts.go:320) <!-- t:qupu -->
- [x] H10 CI hyperblog: vault role hyperblog-private-dependencies missing — INFRA, ask first. Dependency graph off. govulncheck resolves after pbui#9 merges <!-- t:tq11 -->
- [x] A1 [P2] agentlogic transcript fetched from the current project, not the row's — regression, see git log -p (SourcePicker.tsx:216) <!-- t:ssbr -->
- [x] A2 [P2] agentlogic LinkAction variant=raised does not exist; link loses all styling (DevicePage.tsx:91) <!-- t:bivl -->
- [x] A3 [P2] agentlogic nested StepChip keyboard events swallowed by the row handler (ChangesPanel.tsx:98) <!-- t:tojd -->
- [x] X1 Port hyperblog's registry/catalog agreement test to agentlogic and turboproof (~30 min each) <!-- t:kvwl -->
