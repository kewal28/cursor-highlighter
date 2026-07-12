# typed: false
# frozen_string_literal: true
#
# Homebrew Cask template for Cursor HighLighter.
#
# To publish: create a new repository named `homebrew-cursor-highlighter`
# under your GitHub account, drop this file into `Casks/cursor-highlighter.rb`,
# and update the `sha256` values after each release.
#
# Users can then install with:
#
#   brew install --cask kewal28/cursor-highlighter/cursor-highlighter
#

cask "cursor-highlighter" do
  version "1.0.0"

  on_arm do
    sha256 "REPLACE_WITH_ARM64_DMG_SHA256"
    url "https://github.com/kewal28/cursor-highlighter/releases/download/v#{version}/cursor-highlighter-#{version}-mac-arm64.dmg",
        verified: "github.com/kewal28/cursor-highlighter/"
  end

  on_intel do
    sha256 "REPLACE_WITH_X64_DMG_SHA256"
    url "https://github.com/kewal28/cursor-highlighter/releases/download/v#{version}/cursor-highlighter-#{version}-mac-x64.dmg",
        verified: "github.com/kewal28/cursor-highlighter/"
  end

  name "Cursor HighLighter"
  desc "Menu bar app that draws a ring around the cursor and shows keystrokes"
  homepage "https://github.com/kewal28/cursor-highlighter"

  auto_updates false
  depends_on macos: ">= :monterey"

  app "Cursor HighLighter.app"

  zap trash: [
    "~/Library/Application Support/Cursor HighLighter",
    "~/Library/Preferences/com.kewalkanojia.cursorhighlighter.plist",
    "~/Library/Logs/Cursor HighLighter",
    "~/Library/Saved Application State/com.kewalkanojia.cursorhighlighter.savedState",
  ]
end
