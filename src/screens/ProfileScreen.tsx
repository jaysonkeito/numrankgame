// src/screens/ProfileScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Switch, Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { C, getRank, initials } from '../types';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [sound,   setSound]   = useState(true);
  const [vibrate, setVibrate] = useState(true);
  const [notifs,  setNotifs]  = useState(true);
  const [rankUp,  setRankUp]  = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const rank      = getRank(user?.pts ?? 0);
  const nextRank  = rank.max === Infinity ? null : getRank(rank.max + 1);
  const pct       = rank.max === Infinity
    ? 100
    : Math.min(100, Math.round(((user?.pts ?? 0) - rank.min) / (rank.max - rank.min) * 100));
  const ptsToNext = nextRank ? rank.max - (user?.pts ?? 0) : 0;

  const confirmLogout = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
              // AuthContext clears user → AppNavigator switches to AuthStack automatically
            } catch (e) {
              console.error('[Profile] logout error:', e);
              setLoggingOut(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView style={s.screen} showsVerticalScrollIndicator={false}>

      {/* Profile card */}
      <View style={s.card}>
        <View style={s.topRow}>
          <View style={s.rel}>
            <View style={s.bigAv}>
              <Text style={s.bigAvT}>{initials(user?.username ?? 'NU')}</Text>
            </View>
            <View style={s.onlineDot} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.username}>{user?.username}</Text>
            <Text style={s.sub}>{user?.location || 'Philippines'} · {rank.name}</Text>
            <Text style={s.pts}>{user?.pts ?? 0} pts total</Text>
          </View>
        </View>

        {/* 9-digit Player ID — prominently displayed */}
        <View style={s.idSection}>
          <Text style={s.idLabel}>Your Player ID</Text>
          <View style={s.idBox}>
            <Text style={s.idNum}>{user?.id ?? '—'}</Text>
          </View>
          <Text style={s.idHint}>Share this ID so others can find and add you as a friend.</Text>
        </View>

        {/* Rank progress */}
        <View style={s.progSection}>
          <View style={s.progLblRow}>
            <Text style={s.progLbl}>{rank.name}</Text>
            {nextRank && <Text style={s.progLbl}>{nextRank.name}</Text>}
          </View>
          <View style={s.progWrap}>
            <View style={[s.progFill, { width: `${pct}%` as any }]} />
          </View>
          <Text style={s.progHint}>
            {nextRank
              ? `${ptsToNext} pts needed to reach ${nextRank.name}`
              : '🏆 You have reached the highest rank!'
            }
          </Text>
        </View>
      </View>

      {/* Game settings */}
      <Text style={s.sectionLbl}>GAME</Text>
      <View style={s.sectionCard}>
        <Row label="Sound effects"    value={sound}   onToggle={setSound}   last={false} />
        <Row label="Vibration"        value={vibrate} onToggle={setVibrate} last={true}  />
      </View>

      <Text style={s.sectionLbl}>NOTIFICATIONS</Text>
      <View style={s.sectionCard}>
        <Row label="Multiplayer lobby ready" value={notifs} onToggle={setNotifs} last={false} />
        <Row label="Rank up alert"           value={rankUp} onToggle={setRankUp} last={true}  />
      </View>

      <Text style={s.sectionLbl}>ACCOUNT</Text>
      <View style={s.sectionCard}>
        <View style={[s.actionRow, s.border]}>
          <Text style={s.actionLbl}>Email</Text>
          <Text style={s.actionVal} numberOfLines={1}>{user?.email ?? '—'}</Text>
        </View>
        <View style={[s.actionRow, s.border]}>
          <Text style={s.actionLbl}>Username</Text>
          <Text style={s.actionVal}>{user?.username ?? '—'}</Text>
        </View>
        {/* Sign out button */}
        <TouchableOpacity
          style={[s.actionRow, s.signOutRow]}
          onPress={confirmLogout}
          disabled={loggingOut}
        >
          <Text style={s.signOutTxt}>
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </Text>
          <Text style={s.signOutArrow}>→</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function Row({
  label, value, onToggle, last,
}: {
  label: string; value: boolean; onToggle: (v: boolean) => void; last: boolean;
}) {
  return (
    <View style={[s.actionRow, !last && s.border]}>
      <Text style={s.actionTxt}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: C.border, true: C.gold }}
        thumbColor="#fff"
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 52 },

  card:    { borderWidth: 0.5, borderColor: C.border, borderRadius: 16, padding: 16, marginBottom: 20 },
  topRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  rel:     { position: 'relative' },
  bigAv:   { width: 56, height: 56, borderRadius: 28, backgroundColor: C.goldBg, borderWidth: 2, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  bigAvT:  { fontSize: 20, fontWeight: '600', color: C.goldD },
  onlineDot:{ width: 12, height: 12, borderRadius: 6, backgroundColor: C.green, borderWidth: 2, borderColor: C.bg, position: 'absolute', bottom: 0, right: 0 },
  username:{ fontSize: 17, fontWeight: '600', color: C.text },
  sub:     { fontSize: 13, color: C.text2, marginTop: 2 },
  pts:     { fontSize: 13, fontWeight: '500', color: C.goldD, marginTop: 2 },

  idSection:{ marginBottom: 16 },
  idLabel:  { fontSize: 12, color: C.text2, marginBottom: 8, fontWeight: '500' },
  idBox:    { backgroundColor: C.bg2, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center', marginBottom: 6 },
  idNum:    { fontSize: 22, fontWeight: '700', color: C.text, letterSpacing: 3, fontFamily: 'monospace' },
  idHint:   { fontSize: 12, color: C.text3, textAlign: 'center' },

  progSection:  { },
  progLblRow:   { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progLbl:      { fontSize: 12, color: C.text2, fontWeight: '500' },
  progWrap:     { height: 7, backgroundColor: C.bg2, borderRadius: 20, overflow: 'hidden' },
  progFill:     { height: 7, backgroundColor: C.gold, borderRadius: 20 },
  progHint:     { fontSize: 12, color: C.text3, marginTop: 6, textAlign: 'right' },

  sectionLbl:  { fontSize: 11, color: C.text3, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  sectionCard: { borderWidth: 0.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, marginBottom: 20 },

  actionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  border:     { borderBottomWidth: 0.5, borderBottomColor: C.border },
  actionTxt:  { fontSize: 14, color: C.text },
  actionLbl:  { fontSize: 14, color: C.text2 },
  actionVal:  { fontSize: 14, color: C.text, flex: 1, textAlign: 'right' },

  signOutRow: { paddingVertical: 16 },
  signOutTxt: { fontSize: 15, fontWeight: '500', color: C.redD },
  signOutArrow:{ fontSize: 16, color: C.redD },
});
