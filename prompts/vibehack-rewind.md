---
description: Rewind engagement state to a previous git checkpoint (requires pi-rewind-hook)
model: claude-haiku-4-5
---

The user invoked /vibehack-rewind. This command requires the pi-rewind-hook extension.

If pi-rewind-hook is detected (check engagement state for `detectedExtensions: ["pi-rewind-hook", ...]`), defer to its rewind mechanism.

Otherwise, print:
> ⚠ /vibehack-rewind requires the pi-rewind-hook extension. Install via: `npm i -g pi-rewind-hook`
