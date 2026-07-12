# Homebrew tap for Cursor HighLighter

This folder contains a Homebrew **Cask** template so you can publish a tap.

## Publish the tap

1. Create a new **public** GitHub repo named exactly:

   ```
   homebrew-cursor-highlighter
   ```

   (The `homebrew-` prefix is what makes it a tap.)

2. Copy `cursor-highlighter.rb` into a `Casks/` folder in that repo:

   ```
   Casks/cursor-highlighter.rb
   ```

3. After each Cursor HighLighter release, update `version` and the two
   `sha256` values in the Cask. You can compute them with:

   ```bash
   shasum -a 256 dist/cursor-highlighter-*-mac-arm64.dmg
   shasum -a 256 dist/cursor-highlighter-*-mac-x64.dmg
   ```

4. Commit and push. Users can install with:

   ```bash
   brew install --cask kewal28/cursor-highlighter/cursor-highlighter
   ```

## Optional — automate

The `.github/workflows/release.yml` in this repo can be extended with a step
that opens a PR against `homebrew-cursor-highlighter` on each release,
updating the version + SHAs automatically. See
[`dawidd6/action-homebrew-bump-formula`](https://github.com/dawidd6/action-homebrew-bump-formula).
