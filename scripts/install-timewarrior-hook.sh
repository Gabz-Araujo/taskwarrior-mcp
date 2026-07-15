#!/usr/bin/env bash
set -euo pipefail

# Installs taskwarrior's official timewarrior hook so that `task start` / `task stop`
# (and this server's start_task / stop_task tools) feed time tracking into
# timewarrior. It locates the hook that ships with your installed timewarrior and
# copies it into taskwarrior's hooks directory. It does not reimplement the hook.

data_dir="${TASKDATA:-$HOME/.task}"
hooks_dir="$data_dir/hooks"

find_hook() {
  local bin prefix candidate
  if command -v timew >/dev/null 2>&1; then
    bin="$(readlink -f "$(command -v timew)")"
    prefix="$(dirname "$(dirname "$bin")")"
    candidate="$prefix/share/doc/timew/ext/on-modify.timewarrior"
    [ -f "$candidate" ] && { echo "$candidate"; return 0; }
  fi
  for candidate in \
    /usr/share/doc/timew/ext/on-modify.timewarrior \
    /usr/local/share/doc/timew/ext/on-modify.timewarrior; do
    [ -f "$candidate" ] && { echo "$candidate"; return 0; }
  done
  return 1
}

if ! hook="$(find_hook)"; then
  echo "Could not find on-modify.timewarrior." >&2
  echo "Install timewarrior (the hook ships under share/doc/timew/ext/)." >&2
  exit 1
fi

mkdir -p "$hooks_dir"
dest="$hooks_dir/on-modify.timewarrior"
cp "$hook" "$dest"
chmod +x "$dest"

echo "Installed: $hook"
echo "      -> $dest"
echo
echo "Done. 'task start'/'task stop' now record intervals in timewarrior,"
echo "so get_time_summary reflects real tracked time."
echo "(The hook is a Python script — ensure python3 is on PATH when taskwarrior runs.)"
echo "If you use a custom rc.data.location, move the hook into <that dir>/hooks/."
