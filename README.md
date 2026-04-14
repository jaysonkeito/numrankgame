# NumRank — Complete Setup (Expo SDK 52 / Expo Go compatible)

## Why this version?
Expo Go on phones runs SDK 52+. This project has been upgraded from SDK 51 to SDK 52
so the QR code can be scanned directly with Expo Go without any issues.

---

## Fresh install steps

### Option A — Windows (easiest)
Double-click `setup.bat` — it does everything automatically.

### Option B — Manual (any OS)

Open terminal inside the NumRankGame folder and run these in order:

```bash
# 1. Delete old node_modules if upgrading from SDK 51
rm -rf node_modules package-lock.json

# 2. Install everything
npm install

# 3. Firebase
npm install firebase @react-native-async-storage/async-storage

# 4. Navigation
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs

# 5. React Native dependencies
npm install react-native-gesture-handler react-native-safe-area-context react-native-screens

# 6. Web support
npm install react-native-web react-dom @expo/metro-runtime
```

---

## Running the app

### For classmates to scan from anywhere (recommended)
```bash
npx expo start --tunnel
```
This creates a public URL. Anyone with Expo Go (Android or iOS) can scan the QR
regardless of what WiFi they are on.

### Same WiFi only
```bash
npx expo start
```

### Web browser
```bash
npx expo start --web
```

---

## Expo Go setup (for classmates)
1. Install **Expo Go** from Play Store or App Store
2. Open Expo Go
3. Tap "Scan QR code"
4. Scan the QR shown in the terminal

---

## File structure
```
NumRankGame/
├── App.tsx
├── app.json                  ← sdkVersion: 52.0.0
├── babel.config.js
├── package.json              ← expo ~52.0.46
├── tsconfig.json
├── setup.bat                 ← Windows auto-installer
└── src/
    ├── config/firebase.ts    ← Firebase config
    ├── context/AuthContext.tsx
    ├── navigation/AppNavigator.tsx
    ├── screens/
    │   ├── LoginScreen.tsx
    │   ├── RegisterScreen.tsx
    │   ├── GameScreen.tsx
    │   ├── SocialScreen.tsx
    │   ├── RanksScreen.tsx
    │   └── ProfileScreen.tsx
    └── types/index.ts
```

---

## Game rules
- Roll a number (1–999), tap any slot to place it
- Must be greater than nearest filled slot to the LEFT
- Must be less than nearest filled slot to the RIGHT
- If rolled number has no valid slot → game ends automatically
- Wrong placement → game over, correct placements = pts
- All 20 filled in order → JACKPOT (20 × 2 = 40 pts)
- Multiplayer: 8-second timer, first ready = first to roll
