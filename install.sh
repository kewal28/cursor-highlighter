#!/usr/bin/env bash
#
# Cursor HighLighter installer for macOS.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/kewal28/cursor-highlighter/main/install.sh | bash
#
# What it does:
#   1. Detects your Mac's architecture (Apple Silicon or Intel).
#   2. Downloads the matching DMG from the latest GitHub release.
#   3. Mounts the DMG, copies "Cursor HighLighter.app" to /Applications,
#      unmounts the DMG.
#   4. Strips the com.apple.quarantine attribute so macOS doesn't refuse
#      to open the unsigned build.
#   5. Launches the app.
#

set -euo pipefail

APP_NAME="Cursor HighLighter"
REPO="kewal28/cursor-highlighter"
INSTALL_DIR="/Applications"

# --- Colors ------------------------------------------------------------------
if [[ -t 1 ]] && command -v tput >/dev/null; then
  BOLD="$(tput bold)" RESET="$(tput sgr0)"
  GREEN="$(tput setaf 2)" YELLOW="$(tput setaf 3)" RED="$(tput setaf 1)" BLUE="$(tput setaf 4)"
else
  BOLD="" RESET="" GREEN="" YELLOW="" RED="" BLUE=""
fi

info() { echo "${BLUE}${BOLD}==>${RESET}${BOLD} $*${RESET}"; }
ok()   { echo "${GREEN}${BOLD}✓${RESET}   $*"; }
warn() { echo "${YELLOW}${BOLD}!${RESET}   $*" >&2; }
die()  { echo "${RED}${BOLD}✗${RESET}   $*" >&2; exit 1; }

# --- Sanity checks -----------------------------------------------------------
[[ "$(uname -s)" == "Darwin" ]] || die "This installer only supports macOS."
command -v curl >/dev/null || die "curl not found — install it and try again."

case "$(uname -m)" in
  arm64)   ARCH="arm64" ;;
  x86_64)  ARCH="x64" ;;
  *)       die "Unsupported architecture: $(uname -m)" ;;
esac
info "Detected macOS $(sw_vers -productVersion) on ${ARCH}"

# --- Resolve latest release --------------------------------------------------
info "Looking up the latest release…"
LATEST_JSON="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")"
VERSION="$(echo "$LATEST_JSON" | awk -F'"' '/"tag_name":/ {print $4; exit}' | sed 's/^v//')"
[[ -n "$VERSION" ]] || die "Could not determine the latest version from GitHub."
ok "Latest version: v${VERSION}"

DMG_NAME="cursor-highlighter-${VERSION}-mac-${ARCH}.dmg"
DMG_URL="https://github.com/${REPO}/releases/download/v${VERSION}/${DMG_NAME}"

# --- Download ----------------------------------------------------------------
TMPDIR="$(mktemp -d -t cursor-highlighter)"
trap 'rm -rf "$TMPDIR"' EXIT

info "Downloading ${DMG_NAME}…"
curl -fL --progress-bar -o "${TMPDIR}/${DMG_NAME}" "$DMG_URL" \
  || die "Download failed. Try again, or grab the DMG directly from https://github.com/${REPO}/releases"
ok "Downloaded $(du -h "${TMPDIR}/${DMG_NAME}" | cut -f1)"

# --- Mount, copy, unmount ----------------------------------------------------
info "Mounting DMG…"
MOUNT_OUT="$(hdiutil attach "${TMPDIR}/${DMG_NAME}" -nobrowse -noverify -noautoopen)"
MOUNT_POINT="$(echo "$MOUNT_OUT" | awk '/\/Volumes\// {for (i=3; i<=NF; ++i) printf "%s%s", $i, (i<NF?" ":""); exit}')"
[[ -n "$MOUNT_POINT" ]] || die "Could not determine DMG mount point."
ok "Mounted at ${MOUNT_POINT}"

SRC="${MOUNT_POINT}/${APP_NAME}.app"
[[ -d "$SRC" ]] || {
  hdiutil detach "$MOUNT_POINT" -quiet || true
  die "'${APP_NAME}.app' not found inside the DMG at ${SRC}"
}

DEST="${INSTALL_DIR}/${APP_NAME}.app"

# If an existing app is present and running, ask to quit it.
if pgrep -f "${APP_NAME}.app/Contents/MacOS/" >/dev/null 2>&1; then
  info "Quitting the running instance…"
  osascript -e "tell application \"${APP_NAME}\" to quit" >/dev/null 2>&1 || true
  sleep 1
fi

# If an existing app is present, remove it first (so cp doesn't merge).
if [[ -d "$DEST" ]]; then
  info "Replacing existing install at ${DEST}…"
  rm -rf "$DEST" 2>/dev/null || {
    warn "Need elevated permissions to remove old install."
    sudo rm -rf "$DEST"
  }
fi

info "Copying ${APP_NAME}.app → ${INSTALL_DIR}…"
cp -R "$SRC" "$DEST" 2>/dev/null || {
  warn "Need elevated permissions to write to ${INSTALL_DIR}."
  sudo cp -R "$SRC" "$DEST"
}
ok "Installed ${DEST}"

info "Unmounting DMG…"
hdiutil detach "$MOUNT_POINT" -quiet || true

# --- Strip quarantine --------------------------------------------------------
info "Clearing quarantine flag so macOS trusts the build…"
xattr -cr "$DEST" 2>/dev/null || sudo xattr -cr "$DEST"
ok "Quarantine cleared"

# --- Done --------------------------------------------------------------------
echo
echo "${BOLD}${GREEN}✓ Cursor HighLighter v${VERSION} installed.${RESET}"
echo
echo "Launching…"
open -a "$APP_NAME"
echo
echo "${BOLD}First-run permissions (macOS):${RESET}"
echo "  1. System Settings → Privacy & Security → Accessibility  →  enable Cursor HighLighter"
echo "  2. System Settings → Privacy & Security → Input Monitoring →  enable Cursor HighLighter"
echo "     (Input Monitoring is what makes on-screen keystrokes work.)"
echo
echo "The ring will follow your cursor once permissions are granted."
echo "Toggle it any time with ${BOLD}⌘⇧H${RESET} or via the menu-bar icon."
