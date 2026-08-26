#!/usr/bin/env python3
"""Fail-closed static contract audit for PBUI-TOOLCALL-1 Phase 5.

Behavioral claims belong to tests and browser evidence. This script protects the
cross-file invariants that are otherwise easy to regress during a release sweep:
exact hardened dependencies, one gateway vocabulary, no legacy approval/undo
doors, durable effect schema, explicit lifecycle/title API, and focus ownership.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

TICKET = Path(__file__).resolve().parents[1]
ROOT = TICKET.parents[4]
checks: list[tuple[str, bool, str]] = []


def text(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def check(name: str, condition: bool, evidence: str) -> None:
    checks.append((name, condition, evidence))


def contains_all(name: str, relative: str, needles: list[str]) -> None:
    source = text(relative)
    missing = [needle for needle in needles if needle not in source]
    check(name, not missing, f"{relative}: " + ("all markers present" if not missing else f"missing {missing}"))


chat_package = json.loads(text("packages/pbui-chat/package.json"))
demo_package = json.loads(text("packages/pbui-chat/demo/package.json"))
check(
    "exact hardened chat-provider dependency",
    chat_package["dependencies"].get("@go-go-golems/chat-provider") == "0.6.0"
    and demo_package["dependencies"].get("@go-go-golems/chat-provider") == "0.6.0",
    "pbui-chat and demo both pin @go-go-golems/chat-provider exactly to 0.6.0",
)
check(
    "hardened Pinocchio dependency",
    bool(re.search(r"github\.com/go-go-golems/pinocchio\s+v0\.11\.16\b", text("go.mod"))),
    "go.mod pins github.com/go-go-golems/pinocchio v0.11.16",
)

production_tools = "\n".join(
    text(path)
    for path in [
        "packages/pbui-chat/src/tools/workbenchTools.ts",
        "packages/pbui-chat/src/tools/sandboxTools.ts",
        "packages/pbui-chat/src/tools/conversationTools.ts",
        "packages/pbui-chat/src/createPbuiChat.tsx",
    ]
)
legacy = [token for token in ["isApproved", "isRawApproved", "const spent", "new Set<string>()"] if token in production_tools]
check("no legacy approval authorities", not legacy, f"legacy markers found: {legacy}" if legacy else "no callback/spent-set authority remains")

workbench_tools = text("packages/pbui-chat/src/tools/workbenchTools.ts")
unsafe_undo = [token for token in ["undoToken", "history():", "undo(token", "replaceDocument(ring"] if token in workbench_tools]
check(
    "no unsafe whole-document agent undo",
    not unsafe_undo,
    f"unsafe undo markers found: {unsafe_undo}" if unsafe_undo else "no undo token/history/restore surface is advertised",
)
contains_all(
    "workbench gateway coverage",
    "packages/pbui-chat/src/tools/workbenchTools.ts",
    [
        'name: "workbench_describe"',
        'name: "workbench_create_workspace"',
        'name: "workbench_open_tile"',
        'name: "workbench_switch_workspace"',
        'name: "workbench_perform"',
        'name: "workbench_apply"',
        'effectKind: "workbench.verb_batch"',
        'effectKind: "workbench.mutation_batch"',
        "effectGateway.execute",
        "expectedRevision",
        "wb.plan(verbs)",
    ],
)
contains_all(
    "sandbox gateway coverage",
    "packages/pbui-chat/src/tools/sandboxTools.ts",
    [
        'name: "sandbox_create_app"',
        'name: "sandbox_update_app"',
        'name: "sandbox_open"',
        'name: "sandbox_define_action"',
        'name: "sandbox_remove"',
        "effectGateway.execute",
        "executeGated(",
        "performGated(",
    ],
)
contains_all(
    "conversation gateway coverage",
    "packages/pbui-chat/src/tools/conversationTools.ts",
    ['name: "conversation_list"', 'name: "conversation_send"', "effectGateway.execute", 'effectScope: "conversation"'],
)
contains_all(
    "transactional approval lifecycle",
    "packages/pbui-chat/src/tools/agentEffectGateway.ts",
    ["approvalLedger.reserve", "approvalLedger.finalize", "approvalLedger.release", "pendingReports", "EffectConflictError"],
)
contains_all(
    "durable effect outbox",
    "packages/pbui-chat/src/tools/agentEffectGateway.ts",
    ["EffectOutboxStorage", "restoreOutbox", "persistOutbox", "outboxError", "#maxTerminalEntries"],
)
contains_all(
    "canonical durable effect protocol",
    "proto/hyperslop/pbui/chat/v1/chat.proto",
    [
        "message EffectEnvelope",
        "message EffectPerformedCommand",
        "EffectEnvelope effect",
        "string effect_id",
        "string invocation_key",
        "string approval_id",
        "string before_revision",
        "string after_revision",
    ],
)
contains_all(
    "authenticated effect route registration",
    "pkg/chatserver/server.go",
    ["POST /api/chat/sessions/{id}/effects", "requireSession(SessionEffectWrite", "HandleEffectPerformed"],
)
contains_all(
    "strict effect handler",
    "pkg/chatserver/handlers.go",
    ["EffectCommandFromJSON", "effect conversation does not match session", "CommandEffectPerformed", "effect_recorded"],
)
contains_all(
    "explicit conversation lifecycle",
    "packages/pbui-chat/src/conversations/registry.ts",
    ['"closed"', '"opening"', '"open"', '"failed"', '"closing"'],
)
contains_all(
    "versioned title synchronization",
    "packages/pbui-chat/src/conversations/registry.ts",
    ["titleRevision", "titleSync", "retryTitle", "flushTitles", "expectedRevision"],
)
contains_all(
    "persistent title API",
    "pkg/chatserver/sessions.go",
    ["TitleRevision", "TitleRevisionConflict", "Retitle", "expectedRevision", "title_revision"],
)
contains_all(
    "focus return ownership",
    "src/focus.ts",
    ["captureFocusReturn", "queueFocusReturn", "fallbacks", "TRANSIENT_SELECTOR"],
)
contains_all(
    "Dialog focus restoration",
    "src/components/Dialog/Dialog.tsx",
    ["returnFocus", "returnFocusTo", "captureFocusReturn", "queueFocusReturn"],
)
contains_all(
    "ObjectMenu focus restoration",
    "src/presentation/createPbui.tsx",
    ["captureFocusReturn", "queueFocusReturn", "returnFocus", "event.currentTarget"],
)
contains_all(
    "rendered pane constraints",
    "packages/pbui-workbench/src/verbs.ts",
    ["DEFAULT_PANE_CONSTRAINTS", "dividerSize", "distributableSize", "ratioBounds", "layoutFits", "canSplitPlacement"],
)

critical = [
    "packages/pbui-chat/src/tools/agentEffectGateway.ts",
    "packages/pbui-chat/src/tools/approvalLedger.ts",
    "packages/pbui-chat/src/tools/workbenchTools.ts",
    "packages/pbui-chat/src/tools/sandboxTools.ts",
    "packages/pbui-chat/src/tools/conversationTools.ts",
    "packages/pbui-chat/src/conversations/registry.ts",
    "packages/pbui-workbench/src/createWorkbench.tsx",
    "packages/pbui-workbench/src/verbs.ts",
    "src/focus.ts",
]
placeholders: list[str] = []
for relative in critical:
    for number, line in enumerate(text(relative).splitlines(), 1):
        if re.search(r"\b(?:TODO|FIXME|HACK)\b", line):
            placeholders.append(f"{relative}:{number}:{line.strip()}")
check("no placeholders in hardened paths", not placeholders, "; ".join(placeholders) if placeholders else "no TODO/FIXME/HACK markers")

passed = sum(1 for _, ok, _ in checks if ok)
for name, ok, evidence in checks:
    print(f"{'PASS' if ok else 'FAIL'}\t{name}\t{evidence}")
print(f"SUMMARY\t{passed}/{len(checks)} contracts passed")
if passed != len(checks):
    sys.exit(1)
