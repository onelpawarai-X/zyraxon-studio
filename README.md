# ZYRAXON Studio

Daily recordings of the ZYRAXON agent working on real GitHub tasks,
driven on a virtual desktop and captured at 1920x1080 (session 3 at 4K).

## Sessions

| Session | Date | Task | Video |
|---|---|---|---|
| 1 | 2026-10-19 | httpeek issue #6 — `httpeek history` | [final-manual.mp4](https://github.com/onelpawarai-X/zyraxon-studio/releases/download/v1.0.0/final-manual.mp4) |
| 2 | 2026-10-20 | httpeek issue #6 — `httpeek history` (full run) | [zyraxon-daily-2026-10-20.mp4](https://github.com/onelpawarai-X/zyraxon-studio/releases/download/v1.0.1/zyraxon-daily-2026-10-20.mp4) |
| 3 | 2026-10-22 | Session export → wipe → import (4K) | [zyraxon-session-port-4k.mp4](https://github.com/onelpawarai-X/zyraxon-studio/releases/download/v1.0.2/zyraxon-session-port-4k.mp4) |

### Session 2 assets — [release v1.0.1](https://github.com/onelpawarai-X/zyraxon-studio/releases/tag/v1.0.1)

| Asset | Size | What it is |
|---|---|---|
| `zyraxon-daily-2026-10-20.mp4` | 169 MB | Final video — 1920x1080, 37:10, h264 + aac |
| `voice-full.m4a` | 9.6 MB | Bengali narration only (`bn-BD-PradeepNeural`, -6%) |
| `mix.m4a` | 61 MB | Narration + music + sfx mix, as used in the final render |

Production notes:

- Voice: `bn-BD-PradeepNeural`, rate -6%
- Music: `music/Remain_positive.mp3` at volume 0.12
- Loudness: -19.7 LUFS integrated, peak -0.7 dB
- Overlay track encoded lossless (qtrle, alpha) to keep render memory bounded

### Session 3 assets — [release v1.0.2](https://github.com/onelpawarai-X/zyraxon-studio/releases/tag/v1.0.2)

| Asset | Size | What it is |
|---|---|---|
| `zyraxon-session-port-4k.mp4` | 26 MB | Final video — 3840x2160, 8:43, h264 |

The run proves session portability end to end: the agent fixes a real Python
whitespace bug in a demo repo, the conversation is exported to a
`.zyraxon-session.json` file, the sessions database is wiped, the app is
reopened, and the exported file is dragged into the Settings panel to restore
the entire conversation — history, tool calls and all.

1. App opens, new session, **ZYRAXON Apex** selected
2. Bug-fix task given (`count_words()` whitespace bug)
3. Agent fixes it — 4/4 tests pass (with permission approvals)
4. Settings → Session portability → **Export** (`.zyraxon-session.json`, 69 KB)
5. Database **wiped**, app closed and reopened
6. Panel empty — "No sessions in this project yet"
7. File **dragged and dropped** → "12 messages restored"
8. Question asked in the restored session — the agent answers with the full prior history intact
