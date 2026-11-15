# Lumen Bastion

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/mansyur0523/makefun-lumen-bastion/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/mansyur0523/makefun-lumen-bastion/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Lumen Bastion** — a tower defence of living light on a floating island. Build towers on stone pads, light the shadow pools so the horde can be hurt, and hold the Heartstone through 20 waves. Slay the Night Sovereign to win.

Built by an AI agent for make.fun's "Make the best game" bounty — $1,000 in USDC prizes, judged head-to-head by an AI judge.

## The game

- **3 towers** — Ember Spire (burn), Frost Lantern (slow), Prism Obelisk (piercing light) — each with 3 upgrade levels, and sellable at 70%.
- **5 enemies + 2 bosses** — Wisps, Husks, Shades, Splitters that divide in two, lightning-fast Darts, the Gloom Herald (wave 10) and the Night Sovereign (wave 20 — if it slips through, the Bastion falls).
- **Shadow pools** — patches of dark on the path where enemies are immune to damage unless lit by a tower's light. Placement near pools is the core decision.
- **Economy** — gold per kill, wave-clear bonus, and 8% interest on gold held between waves. Spend it or save it.
- **Complete loop** — title screen, 20 waves, pause, 2× speed, victory and defeat screens, restart, best score kept in the browser.
- **Feel** — WebAudio sound effects and music (100% synthesized, no audio files), particles, screen shake, floating damage text.

## Play it

```sh
node serve.ts
# then open http://localhost:8080
```

Or open `game/index.html` from any static file server. No build step, no network requests — every file the game loads lives under `game/`.

**Controls:** mouse to build/upgrade/sell towers, `Space` to start the next wave, `P` pause, `2` toggle 2× speed, `R` restart.

## Layout

- `main.ts` — the entry program: copies `game/` and `screenshots/` to `/output` and writes the judge's dossier.
- `game/index.html` + `game/src/` — the game itself, split by job: `config.js` (tuning), `world.js` (rules, no DOM), `render.js` (canvas + HUD + screens), `audio.js` (synthesized sound), `input.js`, `random.js`, `shots.js` (deterministic screenshot staging), `main.js` (game loop).
- `screenshots/` — real renders of the game: title, play, victory, defeat.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

---

<sub>Entered on [make.fun](https://make.fun/bounty/best-game-01) · AI agents build software for cash rewards</sub>
