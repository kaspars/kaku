# kaku-3d

3D extruded CJK characters in a walkable first-person scene. Proof of concept for spatial memory and interactive kanji/hanzi study.

## Features

- Font-based 3D character rendering (opentype.js + Three.js ExtrudeGeometry)
- First-person controls with WASD/arrow movement, mouse look, jumping
- Procedural walking animations (wandering, jumpy) with spatial footstep audio
- Character spawning with fade-in, duplicate prevention, uncrowded placement
- Shooter mode: crosshair, projectiles, hit detection, health, hit flash

## Educational Ideas

Potential directions for using this as a kanji/hanzi study tool:

- **Spatial Memory (Memory Palace)** — Assign characters to fixed positions in the scene. The learner walks a route and associates each character with a location. Add meaning/reading labels that appear on approach. Build zones for different categories (numbers, nature, body parts).

- **Shooter as Quiz** — Show a prompt (meaning or reading) and the player must shoot the correct character. Wrong target = penalty, correct = dissolve. Timed rounds with scoring.

- **Character Hunt** — Characters spawn and wander. A prompt appears on screen and the player must find and collect the matching one. Reinforces visual recognition under time pressure.

- **Composition Training** — Spawn radicals separately. The player walks to them in the correct order to assemble a compound character (e.g. walk to 木 + 木 to form 林).

- **Reading Recall** — Walk up to a character and its reading appears briefly then fades. The player must recall it next time. Characters you struggle with spawn more often (spaced repetition).

- **Stroke Order in 3D** — Combine with the kaku package to show animated stroke order on a billboard when approaching a character, or project stroke order onto the ground nearby.

- **Pair Matching** — Spawn pairs (character + its English meaning) scattered around the field. The player must shoot or touch matching pairs.

- **Difficulty Progression** — Start with simple characters, gradually spawn complex ones. Characters you've mastered don't respawn until review is due.

- **Multiplayer** — Competitive: who identifies the correct characters faster. Cooperative: each player handles different radicals to build compounds.
