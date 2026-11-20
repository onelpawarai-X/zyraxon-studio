# NOCTURNE — a generative light studio

A living field of light you can steer. Move or drag across the canvas to disturb the
particles, change the palette and motion, then keep what you love as an image.

## Run it

Open `index.html` in any modern browser, or serve the folder:

    python3 -m http.server 8080

## What's inside

- **Three motions** — Flow (curl-noise currents), Orbits (Keplerian ellipses), Silk (fine streams)
- **Five palettes** — each one retints the field, the aurora backdrop, the headline and the cursor halo
- **Density, speed, trail** sliders plus four mood presets and a Surprise button
- **Immersive mode** (`I`) — hides every panel so only the light remains
- **Save image** (`S`) — writes a real PNG of the current frame
- **Your pieces** — saved frames appear as thumbnails, kept in localStorage
- Settings are remembered between visits

## Keys

| key | action |
| --- | --- |
| `Space` | pause / resume |
| `S` | save a PNG |
| `H` | hide the text overlay |
| `P` | show / hide the studio panel |
| `I` | immersive view |
| `Esc` | leave immersive view |

## Notes

No libraries, no build step, no network calls. One canvas, one field, plain
HTML/CSS/JS. Particle count scales with viewport area and is capped, and the drawing
surface holds a fixed pixel budget so the field stays smooth on phones.

## একদিন ফিরব — a small choice game

শূন্য থেকে পাঁচ কোটি। Six years, six decisions, four numbers at the end.
Play it at [`ekdin-firbo/`](ekdin-firbo/) — https://onelpawarai-x.github.io/zyraxon-studio/ekdin-firbo/
