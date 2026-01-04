# Running for Freedom

Endless runner built with Phaser 3. Player runs through a cyberpunk cityscape collecting colored items while maintaining color balance to keep speed.

## Tech Stack

- Phaser 3.60.0 (CDN)
- Vanilla JS (single file: `game.js`)
- No build process

## Run Locally

```bash
python3 -m http.server 8000
# or: npx serve
```

Open `http://localhost:8000`

## Core Mechanics

### Color Balance System

- Collect red, blue, green, yellow items that fill a 13-segment queue (FIFO)
- If any color exceeds another by >10%, an imbalance penalty slows the character
- Larger imbalance = greater speed penalty

### Spawn Feedback Loop

- Upcoming colors are weighted toward what you've already collected
- Over-collected colors spawn more frequently, making balance progressively harder
- No random spawns — purely weighted selection

## Controls

| Key | Action |
|-----|--------|
| SPACE/UP | Jump (double jump) |
| DOWN | Duck |
| M | Toggle music |
| P | Pause |
| O | Toggle obstacles |
| D | Debug panel |
