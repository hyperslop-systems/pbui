#!/usr/bin/env python3
"""devctl plugin for the pbui-chat server (NDJSON stdio protocol v2).

Two shapes, selected by PBUI_CHAT_MODE:

  dev   go run ./cmd/pbui-chat serve  +  vite dev server for packages/pbui-chat/demo
  prod  build.run compiles the SPA and `go build -tags embed` into bin/pbui-chat,
        then launch.plan runs that binary alone with SQLite stores.

stdout carries protocol frames only; everything human goes to stderr.
"""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


def emit(obj):
    sys.stdout.write(json.dumps(obj, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def respond(rid, output):
    emit({"type": "response", "request_id": rid, "ok": True, "output": output})


def fail(rid, code, message):
    emit({"type": "response", "request_id": rid, "ok": False, "error": {"code": code, "message": message}})


def log(msg):
    print(f"[pbui-chat] {msg}", file=sys.stderr, flush=True)


emit({
    "type": "handshake",
    "protocol_version": "v2",
    "plugin_name": "pbui-chat",
    "capabilities": {
        "ops": ["config.mutate", "validate.run", "build.run", "launch.plan", "command.run"],
        "commands": [
            {"name": "ui-build", "help": "Build the pbui-chat demo SPA into pkg/chatui/embed"},
            {"name": "vocab", "help": "Re-export vocabulary.json from the TypeScript demo registry"},
            {"name": "prompt", "help": "Print the generated PBUI system-prompt section"},
        ],
    },
})

DEFAULTS = {
    "mode": "dev",
    "backend_host": "127.0.0.1",
    "backend_port": "8090",
    "vite_host": "127.0.0.1",
    "vite_port": "5174",
    "log_level": "debug",
    "chunk_delay": "20ms",
    "real_runtime": "false",
    "profile": "gpt-5-mini-low",
    "profile_registry": str(Path.home() / ".config" / "pinocchio" / "profiles.yaml"),
}


def cfg_from_env():
    return {
        "mode": os.environ.get("PBUI_CHAT_MODE", DEFAULTS["mode"]),
        "backend_host": os.environ.get("PBUI_CHAT_HOST", DEFAULTS["backend_host"]),
        "backend_port": os.environ.get("PBUI_CHAT_PORT", DEFAULTS["backend_port"]),
        "vite_host": os.environ.get("PBUI_CHAT_VITE_HOST", DEFAULTS["vite_host"]),
        "vite_port": os.environ.get("PBUI_CHAT_VITE_PORT", DEFAULTS["vite_port"]),
        "log_level": os.environ.get("PBUI_CHAT_LOG_LEVEL", DEFAULTS["log_level"]),
        "chunk_delay": os.environ.get("PBUI_CHAT_CHUNK_DELAY", DEFAULTS["chunk_delay"]),
        "real_runtime": os.environ.get("PBUI_CHAT_REAL_RUNTIME", DEFAULTS["real_runtime"]),
        "profile": os.environ.get("PROFILE_SLUG", DEFAULTS["profile"]),
        "profile_registry": os.environ.get("PROFILE_REGISTRY", DEFAULTS["profile_registry"]),
    }


def truthy(value):
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def repo_root_from(req):
    ctx = req.get("ctx") or {}
    return Path(ctx.get("repo_root") or os.getcwd()).resolve()


def validate(repo, cfg):
    errors, warnings = [], []
    for exe in ["go", "pnpm", "node"]:
        if shutil.which(exe) is None:
            errors.append({"code": "E_MISSING_EXE", "message": f"{exe} not found on PATH"})
    if not (repo / "cmd" / "pbui-chat").exists():
        errors.append({"code": "E_REPO", "message": "cmd/pbui-chat not found; run devctl from the pbui repo root"})
    if not (repo / "packages" / "pbui-chat" / "demo" / "package.json").exists():
        errors.append({"code": "E_REPO", "message": "packages/pbui-chat/demo/package.json not found"})
    if cfg["mode"] not in {"dev", "prod"}:
        errors.append({"code": "E_MODE", "message": "PBUI_CHAT_MODE must be dev or prod"})
    if not (repo / "node_modules").exists():
        warnings.append({"code": "W_NODE_MODULES", "message": "node_modules missing; run: pnpm install --filter '!@hyperslop-systems/datalab-ui'"})
    if truthy(cfg["real_runtime"]) and not Path(cfg["profile_registry"]).exists():
        errors.append({"code": "E_PROFILE_REGISTRY", "message": f"profile registry not found: {cfg['profile_registry']}"})
    if cfg["mode"] == "prod" and not (repo / "pkg" / "chatui" / "embed" / "index.html").exists():
        warnings.append({"code": "W_UI_BUNDLE", "message": "pkg/chatui/embed/index.html missing; build.run will create it"})
    return errors, warnings


def serve_flags(cfg, prod):
    flags = [
        "serve",
        "--host", cfg["backend_host"],
        "--port", cfg["backend_port"],
        "--chunk-delay", cfg["chunk_delay"],
    ]
    if prod:
        flags += ["--timeline-db", "var/devctl/pbui-chat-timeline.db", "--turns-db", "var/devctl/pbui-chat-turns.db"]
    if truthy(cfg["real_runtime"]):
        flags += ["--real-runtime", "--profile", cfg["profile"], "--profile-registries", cfg["profile_registry"]]
    return flags


def dev_backend_command(cfg):
    parts = ["mkdir -p var/devctl && exec go run ./cmd/pbui-chat --log-level", json.dumps(cfg["log_level"])]
    parts += [json.dumps(f) for f in serve_flags(cfg, prod=False)]
    return ["bash", "--noprofile", "--norc", "-lc", " ".join(parts)]


def prod_command(cfg):
    parts = ["mkdir -p var/devctl && exec ./bin/pbui-chat --log-level", json.dumps(cfg["log_level"])]
    parts += [json.dumps(f) for f in serve_flags(cfg, prod=True)]
    return ["bash", "--noprofile", "--norc", "-lc", " ".join(parts)]


def vite_command(cfg):
    return ["pnpm", "dev", "--", "--host", cfg["vite_host"], "--port", cfg["vite_port"]]


def run(cmd, repo, deadline_ms, cwd=None):
    log("run: " + " ".join(cmd))
    timeout = max(1, int(deadline_ms or 900000) // 1000)
    result = subprocess.run(cmd, cwd=str(cwd or repo), stdout=sys.stderr, stderr=sys.stderr, timeout=timeout)
    return result.returncode


def build_steps(repo, cfg, dry_run, deadline_ms):
    steps = []
    if dry_run:
        return [{"name": "ui", "status": "skipped"}, {"name": "binary", "status": "skipped"}], []
    code = run(["pnpm", "--filter", "@hyperslop-systems/pbui", "build"], repo, deadline_ms)
    steps.append({"name": "pbui-lib", "status": "ok" if code == 0 else "failed", "exit_code": code})
    if code != 0:
        return steps, []
    code = run(["pnpm", "--filter", "@hyperslop-systems/pbui-chat-demo", "build"], repo, deadline_ms)
    steps.append({"name": "ui", "status": "ok" if code == 0 else "failed", "exit_code": code})
    if code != 0:
        return steps, []
    env = dict(os.environ, GOWORK="off")
    log("run: go build -tags embed -o bin/pbui-chat ./cmd/pbui-chat")
    result = subprocess.run(["go", "build", "-tags", "embed", "-o", "bin/pbui-chat", "./cmd/pbui-chat"], cwd=str(repo), env=env, stdout=sys.stderr, stderr=sys.stderr, timeout=max(1, int(deadline_ms or 900000) // 1000))
    steps.append({"name": "binary", "status": "ok" if result.returncode == 0 else "failed", "exit_code": result.returncode})
    artifacts = [{"name": "pbui-chat", "path": str(repo / "bin" / "pbui-chat")}] if result.returncode == 0 else []
    return steps, artifacts


for raw in sys.stdin:
    raw = raw.strip()
    if not raw:
        continue
    req = {}
    try:
        req = json.loads(raw)
        rid = req.get("request_id", "")
        op = req.get("op", "")
        ctx = req.get("ctx") or {}
        repo = repo_root_from(req)
        cfg = cfg_from_env()
        prod = cfg["mode"] == "prod"
        backend_url = f"http://{cfg['backend_host']}:{cfg['backend_port']}"
        vite_url = f"http://{cfg['vite_host']}:{cfg['vite_port']}"

        if op == "config.mutate":
            respond(rid, {"config_patch": {"set": {
                "services.pbui-chat.mode": cfg["mode"],
                "services.pbui-chat.backend_url": backend_url,
                "services.pbui-chat.ui_url": backend_url if prod else vite_url,
                "services.pbui-chat.real_runtime": truthy(cfg["real_runtime"]),
                "services.pbui-chat.profile": cfg["profile"] if truthy(cfg["real_runtime"]) else "scripted",
                "services.pbui-chat.log_level": cfg["log_level"],
            }, "unset": []}})
        elif op == "validate.run":
            errors, warnings = validate(repo, cfg)
            respond(rid, {"valid": len(errors) == 0, "errors": errors, "warnings": warnings})
        elif op == "build.run":
            if not prod:
                respond(rid, {"steps": [{"name": "ui", "status": "skipped", "detail": "dev mode serves the UI from vite"}], "artifacts": []})
            else:
                steps, artifacts = build_steps(repo, cfg, bool(ctx.get("dry_run")), ctx.get("deadline_ms"))
                respond(rid, {"steps": steps, "artifacts": artifacts})
        elif op == "launch.plan":
            if prod:
                services = [{
                    "name": "pbui-chat",
                    "cwd": str(repo),
                    "command": prod_command(cfg),
                    "env": {"CGO_ENABLED": os.environ.get("CGO_ENABLED", "1")},
                    "health": {"type": "http", "url": f"{backend_url}/healthz", "timeout_ms": 60000},
                }]
            else:
                services = [
                    {
                        "name": "pbui-chat-api",
                        "cwd": str(repo),
                        "command": dev_backend_command(cfg),
                        "env": {"CGO_ENABLED": os.environ.get("CGO_ENABLED", "1"), "GOWORK": os.environ.get("GOWORK", "off")},
                        "health": {"type": "http", "url": f"{backend_url}/healthz", "timeout_ms": 180000},
                    },
                    {
                        "name": "pbui-chat-vite",
                        "cwd": str(repo / "packages" / "pbui-chat" / "demo"),
                        "command": vite_command(cfg),
                        "env": {"VITE_PBUI_CHAT_BACKEND_TARGET": backend_url},
                        "health": {"type": "http", "url": vite_url, "timeout_ms": 120000},
                    },
                ]
            respond(rid, {"services": services})
        elif op == "command.run":
            payload = req.get("input") or {}
            name = payload.get("name", "")
            argv = list(payload.get("argv") or [])
            dry = bool(ctx.get("dry_run"))
            if name == "ui-build":
                code = 0 if dry else run(["pnpm", "--filter", "@hyperslop-systems/pbui-chat-demo", "build"] + argv, repo, ctx.get("deadline_ms"))
                respond(rid, {"exit_code": code})
            elif name == "vocab":
                code = 0 if dry else run(["pnpm", "--filter", "@hyperslop-systems/pbui-chat-demo", "vocab"] + argv, repo, ctx.get("deadline_ms"))
                respond(rid, {"exit_code": code})
            elif name == "prompt":
                code = 0 if dry else run(["go", "run", "./cmd/pbui-chat", "prompt"] + argv, repo, ctx.get("deadline_ms"))
                respond(rid, {"exit_code": code})
            else:
                fail(rid, "E_UNSUPPORTED", f"unsupported command: {name}")
        else:
            fail(rid, "E_UNSUPPORTED", f"unsupported op: {op}")
    except Exception as e:  # noqa: BLE001
        fail(req.get("request_id", ""), "E_PLUGIN", str(e))
