// src/screens/RanksScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { C, RANKS, getRank } from '../types';

interface LBEntry { uid: string; username: string; pts: number; rank: string }

export default function RanksScreen() {
  const { user }  = useAuth();
  const [tab,     setTab]     = useState<'tiers' | 'lb'>('tiers');
  const [lb,      setLb]      = useState<LBEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const pts  = user?.pts ?? 0;
  const cur  = getRank(pts);

  useEffect(() => { if (tab === 'lb') loadLB(); }, [tab]);

  const loadLB = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, 'players'), orderBy('pts', 'desc'), limit(50))
      );
      setLb(snap.docs.map(d => ({
        uid:      d.id,
        username: d.data().username ?? '—',
        pts:      d.data().pts ?? 0,
        rank:     d.data().rank ?? 'Beginner',
      })));
    } catch (e) { console.error('[Ranks] loadLB:', e); }
    setLoading(false);
  };

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <View style={s.screen}>
      <View style={s.hdr}><Text style={s.title}>Rankings</Text></View>

      <View style={s.tabRow}>
        {(['tiers', 'lb'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabOn]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtOn]}>{t === 'tiers' ? 'Tiers' : 'Leaderboard'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* TIERS */}
        {tab === 'tiers' && RANKS.map(r => {
          const isMe = r.name === cur.name;
          const pct  = isMe
            ? Math.min(100, Math.round((pts - r.min) / (r.max === Infinity ? 500 : r.max - r.min) * 100))
            : pts > r.max ? 100 : 0;
          return (
            <View key={r.name} style={[s.rankCard, isMe && s.rankCardMe]}>
              <View style={[s.rankIcon, { backgroundColor: isMe ? C.goldBg : C.bg2 }]}>
                <Text style={{ fontSize: 20 }}>{r.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={s.rankName}>{r.name}</Text>
                  {isMe && <View style={s.youPill}><Text style={s.youPillT}>You</Text></View>}
                </View>
                <Text style={s.rankSub}>{r.scope} · {r.max === Infinity ? `${r.min}+` : `${r.min}–${r.max}`} pts</Text>
                {isMe && (
                  <View style={s.progWrap}>
                    <View style={[s.progFill, { width: `${pct}%` as any }]} />
                  </View>
                )}
              </View>
              {isMe && <Text style={s.rankPts}>{pts}</Text>}
            </View>
          );
        })}

        {/* LEADERBOARD */}
        {tab === 'lb' && (
          loading
            ? <ActivityIndicator color={C.gold} style={{ marginTop: 40 }} />
            : lb.length === 0
              ? <Text style={s.empty}>No players yet. Be the first!</Text>
              : lb.map((p, i) => (
                <View key={p.uid} style={[s.lbRow, p.uid === user?.uid && s.lbRowMe]}>
                  <Text style={[s.lbPos, i < 3 && s.lbPosTop]}>{i < 3 ? medals[i] : i + 1}</Text>
                  <View style={s.lbAv}><Text style={s.lbAvT}>{p.username.substring(0,2).toUpperCase()}</Text></View>
                  <Text style={[s.lbName, p.uid === user?.uid && { fontWeight: '500' }]}>
                    {p.username}{p.uid === user?.uid ? ' (You)' : ''}
                  </Text>
                  <Text style={s.lbPts}>{p.pts}</Text>
                </View>
              ))
        )}

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 52 },
  hdr:    { marginBottom: 14 },
  title:  { fontSize: 20, fontWeight: '500', color: C.text },
  empty:  { textAlign: 'center', color: C.text3, marginTop: 40, fontSize: 14 },

  tabRow:   { flexDirection: 'row', borderWidth: 0.5, borderColor: C.border, borderRadius: 8, overflow: 'hidden', marginBottom: 14 },
  tab:      { flex: 1, paddingVertical: 8, alignItems: 'center' },
  tabOn:    { backgroundColor: C.bg2 },
  tabTxt:   { fontSize: 13, color: C.text2 },
  tabTxtOn: { color: C.text, fontWeight: '500' },

  rankCard:   { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 0.5, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 8 },
  rankCardMe: { borderColor: C.gold, backgroundColor: '#FAEEDA22' },
  rankIcon:   { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rankName:   { fontSize: 15, fontWeight: '500', color: C.text },
  rankSub:    { fontSize: 12, color: C.text2, marginTop: 2 },
  rankPts:    { fontSize: 14, fontWeight: '500', color: C.goldD },
  youPill:    { backgroundColor: C.goldBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  youPillT:   { fontSize: 10, color: C.goldD, fontWeight: '500' },
  progWrap:   { height: 5, backgroundColor: C.bg2, borderRadius: 20, marginTop: 6, overflow: 'hidden' },
  progFill:   { height: 5, backgroundColor: C.gold, borderRadius: 20 },

  lbRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: C.border },
  lbRowMe:  { backgroundColor: C.goldBg + '44', borderRadius: 8, paddingHorizontal: 8 },
  lbPos:    { width: 24, textAlign: 'center', fontSize: 12, color: C.text2 },
  lbPosTop: { fontSize: 16 },
  lbAv:     { width: 30, height: 30, borderRadius: 15, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  lbAvT:    { fontSize: 11, fontWeight: '500', color: C.goldD },
  lbName:   { flex: 1, fontSize: 13, color: C.text },
  lbPts:    { fontSize: 13, fontWeight: '500', color: C.text },
});
