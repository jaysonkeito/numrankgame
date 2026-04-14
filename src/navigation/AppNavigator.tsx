// src/navigation/AppNavigator.tsx
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { C } from '../types';

import LoginScreen    from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import GameScreen     from '../screens/GameScreen';
import SocialScreen   from '../screens/SocialScreen';
import RanksScreen    from '../screens/RanksScreen';
import ProfileScreen  from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const ICONS: Record<string, string> = {
  Play: '▶', Social: '👥', Ranks: '☰', Profile: '○',
};

function MainTabs() {
  const { user } = useAuth();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: C.bg,
          borderTopWidth:  0.5,
          borderTopColor:  C.border,
          height:          60,
          paddingBottom:   8,
        },
        tabBarActiveTintColor:   C.goldD,
        tabBarInactiveTintColor: C.text3,
        tabBarLabelStyle:        { fontSize: 11 },
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: 16, color: focused ? C.goldD : C.text3 }}>
            {ICONS[route.name] ?? '•'}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Play">
        {() => (
          <GameScreen
            playerPts={user?.pts ?? 0}
            playerRank={user?.rank ?? 'Beginner'}
          />
        )}
      </Tab.Screen>
      <Tab.Screen name="Social"  component={SocialScreen}  />
      <Tab.Screen name="Ranks"   component={RanksScreen}   />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login"    component={LoginScreen}    />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

function SplashScreen() {
  return (
    <View style={s.splash}>
      <Text style={s.logo}>NumRank</Text>
      <Text style={s.sub}>Place numbers. Climb ranks.</Text>
      <ActivityIndicator color={C.gold} size="large" style={{ marginTop: 32 }} />
    </View>
  );
}

export default function AppNavigator() {
  const { isLoggedIn, loading } = useAuth();
  if (loading) return <SplashScreen />;
  return (
    <NavigationContainer>
      {isLoggedIn ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

const s = StyleSheet.create({
  splash: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  logo:   { fontSize: 44, fontWeight: '700', color: C.goldD, letterSpacing: -1 },
  sub:    { fontSize: 14, color: C.text3, marginTop: 6 },
});
