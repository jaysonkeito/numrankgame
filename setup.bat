@echo off
echo ========================================
echo  NumRank - Project Setup
echo ========================================
echo.
echo Step 1: Installing base Expo packages...
npm install
echo.
echo Step 2: Installing Firebase + AsyncStorage...
npx expo install firebase @react-native-async-storage/async-storage
echo.
echo Step 3: Installing Navigation...
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs
echo.
echo Step 4: Installing gesture handler + screens...
npx expo install react-native-gesture-handler react-native-safe-area-context react-native-screens
echo.
echo ========================================
echo  Setup complete! Run: npx expo start
echo ========================================
pause
