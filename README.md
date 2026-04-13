# MeetMind

Real-time AI meeting copilot for Google Meet. Captures audio, transcribes with Deepgram Nova 3, and surfaces live AI suggestions via Claude in a floating overlay.

## Architecture

```
[ Google Meet Tab ]  →  [ Chrome Extension ]  →  [ Node.js Backend ]  →  [ Deepgram API ]
                                                          ↓
[ Electron Overlay ]  ←  [ Node.js Backend ]  ←  [ Anthropic API ]
```

- **Chrome Extension** — Captures Google Meet tab audio via `tabCapture` API, streams PCM audio over WebSocket
- **Node.js Backend** — Receives audio, pipes to Deepgram for real-time transcription, sends context to Claude for suggestions
- **Electron Overlay** — Floating always-on-top window displaying AI suggestion cards

## Prerequisites

- Node.js v18+
- Google Chrome
- [Deepgram API key](https://console.deepgram.com) (free tier available)
- [Anthropic API key](https://console.anthropic.com)

## Setup

### 1. Clone and configure

```bash
git clone https://github.com/[user]/meetmind
cd meetmind
cp .env.example .env
# Edit .env and add your API keys
```

### 2. Start the backend

```bash
cd backend
npm install
npm start
```

You should see:
```
[Server] Extension WebSocket listening on ws://localhost:7777
[Server] Overlay WebSocket listening on ws://localhost:7778
[Server] MeetMind backend ready. Waiting for connections...
```

### 3. Start the overlay

```bash
cd overlay
npm install
npm start
```

A floating window will appear in the top-right corner of your screen.

### 4. Load the Chrome Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer Mode** (top right toggle)
3. Click **Load Unpacked** and select the `chrome-extension/` folder
4. Pin the MeetMind extension in your toolbar

### 5. Start a meeting

1. Join a Google Meet call
2. Click the MeetMind extension icon
3. Click **Start Listening**
4. Suggestions will appear in the overlay within seconds of conversation

## Controls

| Action | How |
|---|---|
| Start/stop listening | Click extension popup |
| Show/hide overlay | `Ctrl+Shift+M` (or `Cmd+Shift+M` on Mac) |
| Move overlay | Drag the title bar |

## How It Works

1. Chrome Extension captures tab audio using `tabCapture` + offscreen document
2. Audio is converted to 16kHz PCM and streamed via WebSocket to the backend (port 7777)
3. Backend forwards audio to Deepgram Nova 3 (multilingual, with speaker diarization)
4. Every ~2 final transcript segments, the backend sends context to Claude Sonnet
5. Claude returns 2-3 suggestions (questions, responses, or insights)
6. Suggestions are pushed via WebSocket to the Electron overlay (port 7778)

## Cost Estimates

| Service | Rate | 1-hour meeting |
|---|---|---|
| Deepgram Nova 3 | ~$0.0043/min | ~$0.26 |
| Claude Sonnet | ~$0.003/call | ~$2.00 |
| **Total** | | **~$2.26/hour** |

## Troubleshooting

- **Extension says "Failed to start capture"** — Make sure you're on a Google Meet tab and the backend is running
- **No suggestions appearing** — Check the backend terminal for errors; verify API keys in `.env`
- **Overlay not visible** — Press `Ctrl+Shift+M` to toggle; check it hasn't moved off-screen
- **Audio not captured** — Chrome may require you to grant tab capture permission each session via the popup

## Project Structure

```
meetmind/
├── chrome-extension/       # Browser extension (audio capture)
│   ├── manifest.json
│   ├── background.js       # Service worker
│   ├── offscreen.html/js   # Audio processing
│   ├── popup.html/js       # Start/stop UI
│   └── icons/
├── backend/                # Node.js server
│   ├── server.js           # WebSocket orchestration
│   ├── transcriber.js      # Deepgram streaming
│   ├── ai.js               # Claude suggestions
│   └── .env.example
├── overlay/                # Electron floating window
│   ├── main.js             # Window management
│   └── index.html          # Suggestion UI
└── README.md
```
