# Pocket Console Arena

Local multiplayer web arcade platform where smartphones act as wireless controllers over a local Wi-Fi network while a laptop or desktop screen displays the main game arena.

## Key Features

- **Smartphone Controller (`ControllerScreen`)**:
  - Join rooms using a room code (`PS-xxx`) or by scanning the QR code displayed on the host screen.
  - Choose a character before joining (`Racer`, `Cyber`, `Turbo`, `Nitro`).
  - Responsive touch controls with D-pad movement, `BOOST`, and cooldown-based `DASH`, plus automatic input release when switching tabs or disconnecting.
- **Host Arena (`HostScreen` & `ArenaCanvas`)**:
  - Real-time multiplayer synchronization for up to 4 players via Socket.io.
  - **4 Game Modes**:
    - **Orb Hunt**: Collect glowing orbs to score points before time runs out.
    - **Tag Arena**: Evade the `[IT]` player to earn survival points and pass the `IT` tag on contact.
    - **Meteor Dodge**: Dodge incoming meteors with warning indicators and dash/invulnerability windows.
    - **Street Rush**: Race across four lanes, dodge traffic/barriers, and collect coins.
  - **Round Timer & Leaderboard**: 60-second rounds with live score rankings, winner announcement, and instant round reset.
  - **QR Code Quick Join & Fullscreen View**: Scan the QR code from a phone on the same Wi-Fi network and toggle fullscreen on the game screen.
- **Web Audio Synthesizer (`ArcadeSoundEngine`)**:
  - Built-in background synth loops and sound effects (pickup, dash, tag, hit, and game over) using the Web Audio API with no external audio files required.

## Tech Stack

- **Backend**: Node.js, Express, Socket.io, CORS
- **Frontend**: React, Vite, Tailwind CSS, Lucide React, `qrcode.react`, HTML5 Canvas

## Project Structure

```text
pocket-console-arena/
├── client/
│   └── src/
│       ├── components/
│       │   └── ArenaCanvas.jsx
│       ├── pages/
│       │   ├── ControllerScreen.jsx
│       │   └── HostScreen.jsx
│       ├── utils/
│       │   └── sound.js
│       └── socket.js
└── server/
    └── index.js