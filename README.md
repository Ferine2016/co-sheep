# co-sheep

A desktop companion sheep that watches your screen and delivers snarky commentary. Think unhinged Clippy meets a judgmental pixel art sheep.

![Tauri](https://img.shields.io/badge/Tauri-v2-blue) ![Platform](https://img.shields.io/badge/platform-macOS-lightgrey)

## What it does

- A pixel sheep parachutes onto your desktop and wanders around
- Every few minutes, it captures your screen and sends it through a two-pass AI vision pipeline
- **Pass 1** (Haiku): cheap classification — is anything interesting happening?
- **Pass 2** (Sonnet): commentary with expressive animations — only when warranted
- The sheep forms persistent opinions about you that grow stronger over time
- It keeps daily tallies ("that's the 5th time on Twitter today") and a markdown diary
- You can drag it, pet it, double-click it, or drop files on it

## Interactions

- **Drag & drop** — pick up the sheep, it wiggles. Drop it mid-air and it deploys a parachute
- **Double-click** — random quip and animation, no API call needed
- **Petting** — hover over the sheep for 2+ seconds, it falls asleep with floating hearts
- **File drop** — drag a file onto the sheep and it "eats" it with a comment based on file type

## Animations

The AI picks an animation to match the mood of its commentary:

| Animation | Mood |
|-----------|------|
| bounce | excited, amused |
| spin | mind-blown |
| backflip | extreme excitement |
| headshake | disapproval |
| zoom | panic, urgency |
| vibrate | rage, frustration |

## Memory System

The sheep has a structured brain (`~/.co-sheep/opinions.json`) inspired by OpenClaw's memory architecture:

- **Opinions** — beliefs about you with conviction scores that strengthen with repeated observation
- **Daily counters** — tracks recurring patterns within a day (auto-resets at midnight)
- **Interaction tracking** — remembers being petted, poked, and fed files
- **Daily diary** — raw timestamped observations at `~/.co-sheep/journal/`

The "Sheep's Brain" viewer (accessible from the menu) lets you inspect opinions, tallies, and diary entries.

## Settings

Accessible from the macOS menu bar or tray icon:

- **Sheep name** — rename your sheep anytime
- **API key** — enter directly in settings or set `ANTHROPIC_API_KEY` env var
- **Commentary interval** — 30 seconds to 10 minutes
- **Personality** — Snarky, Wholesome, Chaotic, or Passive-Aggressive
- **Language** — defaults to Nynorsk, with 10 language options

Settings are stored at `~/.co-sheep/config.json`.

## Requirements

- macOS (uses CoreGraphics for cursor tracking and screen capture)
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (stable)
- An [Anthropic API key](https://console.anthropic.com/)

## Setup

```bash
# Install dependencies
npm install

# Run in development
npm run tauri dev

# Build for production
npm run tauri build
```

Set your API key either in the Settings window or via environment:
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

The `.app` bundle will be at `src-tauri/target/release/bundle/macos/co-sheep.app`.

## Screen Recording Permission

co-sheep needs screen recording permission to see your screen. On first launch:

1. macOS will prompt you to grant permission
2. Go to **System Settings > Privacy & Security > Screen Recording**
3. Add the co-sheep binary or `.app` bundle
4. Restart co-sheep

## How it works

```
[configurable timer, default ~2.5 min]
    |
    v
[xcap: capture screen -> resize 1568px -> JPEG q70 -> base64]
    |
    v
[Pass 1: Haiku classifies screenshot]
    |
    +-- not interesting -> skip, log to diary
    |
    +-- interesting
         |
         v
       [Pass 2: Sonnet generates comment + animation + opinion + count]
         |
         v
       [Speech bubble + animation on sheep]
       [Update opinions.json + daily journal]
```

## Project structure

```
co-sheep/
├── src/                    # TypeScript frontend
│   ├── main.ts             # Canvas loop, drag, interactions, event wiring
│   ├── sheep.ts            # State machine, physics, 6 animation types
│   ├── sprite.ts           # Sprite sheet loader and animator
│   ├── speech-bubble.ts    # DOM speech bubble with typewriter effect
│   └── types.ts            # Shared types
├── src-tauri/src/          # Rust backend
│   ├── lib.rs              # App builder, tray, menu bar, commands
│   ├── vision.rs           # Two-pass AI vision pipeline
│   ├── capture.rs          # Screen capture via xcap
│   ├── personality.rs      # Personality presets + system prompt
│   ├── memory.rs           # Opinion system, daily journal, brain viewer
│   ├── onboarding.rs       # Config, first-launch flow, settings
│   ├── cursor.rs           # CoreGraphics cursor tracking
│   └── permissions.rs      # macOS screen recording permission
└── public/
    ├── naming.html         # Naming dialog window
    ├── settings.html       # Settings window
    ├── memory.html         # Brain viewer window
    └── assets/sprites/     # Pixel art sprite sheets
```

## Cost

With the default 2.5 minute interval running all day: roughly $1-3/day in API costs. Haiku classification keeps costs low by only invoking Sonnet when something interesting is on screen.

## License

MIT
