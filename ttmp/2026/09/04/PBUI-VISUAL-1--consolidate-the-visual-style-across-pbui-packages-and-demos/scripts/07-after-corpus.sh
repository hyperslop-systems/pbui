#!/usr/bin/env bash
# Re-shoot the whole corpus into various/screenshots-after/ (or $1), using the
# same scripts and port map as the before-corpus. Servers must be running in
# tmux session pbui-visual (see the diary, Step 1, and the playbook).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
out="${1:-$here/../various/screenshots-after}"
mkdir -p "$out"
declare -A PORTS=([core]=6006 [pbui-chat]=6007 [pbui-workbench]=6008 [pbui-sandbox]=6009 [pbui-editor]=6010 [pbui-plotscript]=6011 [pbui-ecommerce]=6012 [datalab-ui]=6013)
for p in 6006 6007 6008 6009 6010 6011 6012 6013 5173 5174 5175 5176; do
  until curl -s -o /dev/null -w '%{http_code}' "http://localhost:$p/" | grep -qE '200|302'; do sleep 2; done
done
echo "servers up"
for name in core pbui-chat pbui-workbench pbui-sandbox pbui-editor pbui-plotscript pbui-ecommerce datalab-ui; do
  echo "== storybook $name"
  node "$here/01-screenshot-storybook.mjs" "http://localhost:${PORTS[$name]}" "$out/$name" | tail -1
done
echo "== demos"; OUT_ROOT="$out/demos" node "$here/03-screenshot-demos.mjs" | grep -c wrote
echo "== workbench interactions"; node "$here/04-screenshot-workbench-interactions.mjs" "$out/workbench-interactions" | tail -1
echo "== interactions"; node "$here/05-screenshot-interactions.mjs" "$out/interactions" | tail -1
echo "AFTER-CORPUS-DONE"
