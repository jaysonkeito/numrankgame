@echo off
echo ========================================
echo  NumRank - Fresh Install (Expo SDK 52)
echo ========================================
echo.
echo Deleting old node_modules...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json
echo.
echo Step 1: Installing base packages...
npm install
echo.
echo Step 2: Installing Firebase...
npm install firebase @react-native-async-storage/async-storage
echo.
echo Step 3: Installing Navigation...
npm install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
echo.
echo Step 4: Installing React Native deps...
npm install react-native-gesture-handler react-native-safe-area-context react-native-screens
echo.
echo Step 5: Installing Web support...
npm install react-native-web react-dom @expo/metro-runtime
echo.
echo ========================================
echo  Done! Now run: npx expo start --tunnel
echo  Then scan QR with Expo Go on your phone
echo ========================================
pause
