# NumRank — Complete Setup Guide

## Prerequisites
- Node.js installed (https://nodejs.org — LTS version)
- VS Code
- A Firebase project already configured (see firebase.ts)

---

## Step 1 — Open the project folder in VS Code
Open VS Code → File → Open Folder → select this NumRankGame folder

## Step 2 — Open terminal in VS Code
Terminal → New Terminal

## Step 3 — Run all install commands in order

```bash
npm install
```
```bash
npx expo install firebase @react-native-async-storage/async-storage
```
```bash
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
```
```bash
npx expo install react-native-gesture-handler react-native-safe-area-context react-native-screens
```

## Step 4 — Start the app

```bash
npx expo start
```

Then press:
- `w` — open in web browser (instant, no phone needed)
- `a` — open in Android emulator (needs Android Studio)
- Scan the QR code with Expo Go app on your phone

---

## Windows shortcut
Double-click `setup.bat` to run all install commands automatically.

---

## File structure

```
NumRankGame/
├── App.tsx                           Root entry point
├── app.json                          Expo config
├── babel.config.js
├── package.json
├── tsconfig.json
└── src/
    ├── config/
    │   └── firebase.ts               ← Firebase connection (your keys are here)
    ├── context/
    │   └── AuthContext.tsx           Firebase Auth + Firestore profile
    ├── navigation/
    │   └── AppNavigator.tsx          Auth vs Main tab routing + splash
    ├── screens/
    │   ├── LoginScreen.tsx           Email + password login
    │   ├── RegisterScreen.tsx        New account + 9-digit Player ID
    │   ├── GameScreen.tsx            Full game with correct placement logic
    │   ├── SocialScreen.tsx          Friends, search, DMs, requests
    │   ├── RanksScreen.tsx           Tiers + live leaderboard
    │   └── ProfileScreen.tsx        Profile, rank progress, settings
    └── types/
        └── index.ts                  All types, colors, rank data, helpers
```

---

## Firebase collections (auto-created on first use)

| Collection | Purpose |
|---|---|
| `players/{uid}` | Player profile (username, pts, rank, playerId) |
| `players/{uid}/friends` | Friend list |
| `players/{uid}/friendRequests` | Incoming friend requests |
| `players/{uid}/conversations` | Message previews |
| `playerIds/{9digitId}` | ID → UID lookup for search |
| `chats/{chatId}/messages` | Chat messages between two players |

## Realtime Database (online presence)

| Path | Value |
|---|---|
| `presence/{uid}/online` | true / false |
| `presence/{uid}/lastSeen` | timestamp |

---

## Game rules reminder
- Roll a number (1–999), tap a slot to place it
- Must be greater than the nearest filled slot to the LEFT
- Must be less than the nearest filled slot to the RIGHT
- Wrong placement → game over, correct placements = pts earned
- All 20 filled in order → JACKPOT (20 × 2 = 40 pts)
- Multiplayer: 8-second timer per number, miss it = 0 pts, continue
