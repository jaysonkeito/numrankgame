// src/screens/SocialScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, ActivityIndicator, FlatList,
} from 'react-native';
import {
  collection, doc, getDoc, getDocs, query, where,
  setDoc, onSnapshot, orderBy, addDoc, serverTimestamp, deleteDoc,
} from 'firebase/firestore';
import { ref, onValue } from 'firebase/database';
import { db, rtdb } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { C, FriendData, ChatMessage, Conversation, FriendRequest, initials } from '../types';

type Tab = 'friends' | 'search' | 'messages' | 'requests';

interface SearchResult {
  uid: string; id: string; username: string; rank: string;
  pts: number; online: boolean; isFriend: boolean; isPending: boolean;
}

// Helper: get online status from RTDB once
function getOnline(uid: string): Promise<boolean> {
  return new Promise(resolve =>
    onValue(ref(rtdb, `presence/${uid}`), s => resolve(s.val()?.online ?? false), { onlyOnce: true })
  );
}

function chatId(a: string, b: string) { return [a, b].sort().join('_'); }

export default function SocialScreen() {
  const { user, firebaseUser } = useAuth();
  const [tab,       setTab]       = useState<Tab>('friends');
  const [friends,   setFriends]   = useState<FriendData[]>([]);
  const [requests,  setRequests]  = useState<FriendRequest[]>([]);
  const [convos,    setConvos]    = useState<Conversation[]>([]);
  const [searchQ,   setSearchQ]   = useState('');
  const [results,   setResults]   = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [chatWith,  setChatWith]  = useState<{ uid: string; username: string; online: boolean } | null>(null);
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');

  const myUid = firebaseUser?.uid ?? '';

  // ── Friends ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!myUid) return;
    return onSnapshot(collection(db, 'players', myUid, 'friends'), async snap => {
      const list = await Promise.all(
        snap.docs.map(async d => {
          const data = d.data();
          const online = await getOnline(data.uid);
          return { uid: data.uid, id: data.id, username: data.username, rank: data.rank, pts: data.pts, online } as FriendData;
        })
      );
      setFriends(list);
    });
  }, [myUid]);

  // ── Requests ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!myUid) return;
    return onSnapshot(collection(db, 'players', myUid, 'friendRequests'), snap =>
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest)))
    );
  }, [myUid]);

  // ── Conversations ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!myUid) return;
    return onSnapshot(collection(db, 'players', myUid, 'conversations'), async snap => {
      const list = await Promise.all(
        snap.docs.map(async d => {
          const data = d.data();
          const online = await getOnline(data.withUid);
          return { withUid: data.withUid, withUsername: data.withUsername, lastMsg: data.lastMsg, lastTime: data.lastTime, online } as Conversation;
        })
      );
      list.sort((a, b) => b.lastTime - a.lastTime);
      setConvos(list);
    });
  }, [myUid]);

  // ── Search ────────────────────────────────────────────────────────────────
  const search = useCallback(async (q: string) => {
    if (!q.trim() || !myUid) { setResults([]); return; }
    setSearching(true);
    try {
      const friendSet = new Set(friends.map(f => f.uid));
      let snap;
      if (/^\d{9}$/.test(q.trim())) {
        // Search by exact 9-digit player ID
        snap = await getDocs(query(collection(db, 'players'), where('playerId', '==', q.trim())));
      } else {
        // Search by username prefix
        snap = await getDocs(query(
          collection(db, 'players'),
          where('username', '>=', q),
          where('username', '<=', q + '\uf8ff'),
        ));
      }
      const list = await Promise.all(
        snap.docs.filter(d => d.id !== myUid).map(async d => {
          const data    = d.data();
          const online  = await getOnline(d.id);
          const pending = await getDoc(doc(db, 'players', data.uid, 'friendRequests', myUid));
          return {
            uid: d.id, id: data.playerId, username: data.username,
            rank: data.rank, pts: data.pts, online,
            isFriend: friendSet.has(d.id), isPending: pending.exists(),
          } as SearchResult;
        })
      );
      setResults(list);
    } catch (e) { console.error('[Social] search:', e); }
    setSearching(false);
  }, [myUid, friends]);

  // ── Send friend request ───────────────────────────────────────────────────
  const sendRequest = async (toUid: string) => {
    if (!user || !myUid) return;
    await setDoc(doc(db, 'players', toUid, 'friendRequests', myUid), {
      fromUid: myUid, fromUsername: user.username,
      fromId: user.id, fromRank: user.rank, fromPts: user.pts,
      createdAt: serverTimestamp(),
    });
    setResults(prev => prev.map(r => r.uid === toUid ? { ...r, isPending: true } : r));
  };

  const acceptRequest = async (req: FriendRequest) => {
    if (!user || !myUid) return;
    await Promise.all([
      setDoc(doc(db, 'players', myUid, 'friends', req.fromUid), {
        uid: req.fromUid, username: req.fromUsername,
        id: req.fromId, rank: req.fromRank, pts: req.fromPts,
      }),
      setDoc(doc(db, 'players', req.fromUid, 'friends', myUid), {
        uid: myUid, username: user.username,
        id: user.id, rank: user.rank, pts: user.pts,
      }),
      deleteDoc(doc(db, 'players', myUid, 'friendRequests', req.fromUid)),
    ]);
  };

  const declineRequest = async (req: FriendRequest) => {
    if (!myUid) return;
    await deleteDoc(doc(db, 'players', myUid, 'friendRequests', req.fromUid));
  };

  // ── Open chat ─────────────────────────────────────────────────────────────
  const openChat = (uid: string, username: string, online: boolean) => {
    setChatWith({ uid, username, online });
    setChatInput('');
    const isFriend = friends.some(f => f.uid === uid);
    const cid = chatId(myUid, uid);
    const q = isFriend
      ? query(collection(db, 'chats', cid, 'messages'), orderBy('timestamp', 'asc'))
      : query(collection(db, 'chats', cid, 'messages'), orderBy('timestamp', 'asc'), where('visibleOffline', '==', true));
    onSnapshot(q, snap =>
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)))
    );
  };

  const sendMessage = async () => {
    if (!chatWith || !chatInput.trim() || !user || !myUid) return;
    const text     = chatInput.trim();
    const cid      = chatId(myUid, chatWith.uid);
    const isFriend = friends.some(f => f.uid === chatWith.uid);
    setChatInput('');
    await addDoc(collection(db, 'chats', cid, 'messages'), {
      fromUid: myUid, fromUsername: user.username, text,
      timestamp: serverTimestamp(), visibleOffline: isFriend,
    });
    const base = { lastMsg: text, lastTime: Date.now() };
    await Promise.all([
      setDoc(doc(db, 'players', myUid, 'conversations', chatWith.uid),
        { ...base, withUid: chatWith.uid, withUsername: chatWith.username }),
      setDoc(doc(db, 'players', chatWith.uid, 'conversations', myUid),
        { ...base, withUid: myUid, withUsername: user.username }),
    ]);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'friends',  label: 'Friends'  },
    { id: 'search',   label: 'Search'   },
    { id: 'messages', label: 'Messages' },
    { id: 'requests', label: requests.length > 0 ? `Requests (${requests.length})` : 'Requests' },
  ];

  return (
    <View style={s.screen}>
      <View style={s.hdr}><Text style={s.title}>Social</Text></View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {tabs.map(t => (
          <TouchableOpacity key={t.id} style={[s.tab, tab === t.id && s.tabOn]} onPress={() => setTab(t.id)}>
            <Text style={[s.tabTxt, tab === t.id && s.tabTxtOn]} numberOfLines={1}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* FRIENDS */}
        {tab === 'friends' && (
          friends.length === 0
            ? <Text style={s.empty}>No friends yet. Use Search to add players!</Text>
            : friends.map(f => (
              <View key={f.uid} style={s.card}>
                <View style={s.row}>
                  <View style={s.rel}><View style={s.av}><Text style={s.avT}>{initials(f.username)}</Text></View><View style={[s.dot, f.online ? s.dotOn : s.dotOff]} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pName}>{f.username}</Text>
                    <Text style={s.pSub}>{f.rank} · {f.pts} pts · <Text style={{ color: f.online ? C.green : C.text3 }}>{f.online ? 'Online' : 'Offline'}</Text></Text>
                  </View>
                  <TouchableOpacity style={s.btnSm} onPress={() => openChat(f.uid, f.username, f.online)}>
                    <Text style={s.btnSmT}>Message</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
        )}

        {/* SEARCH */}
        {tab === 'search' && (
          <View>
            <TextInput
              style={s.searchInput}
              placeholder="Username or 9-digit Player ID"
              placeholderTextColor={C.text3}
              value={searchQ}
              onChangeText={q => { setSearchQ(q); search(q); }}
              autoCapitalize="none"
            />
            {searching && <ActivityIndicator color={C.gold} style={{ marginVertical: 12 }} />}
            {results.map(p => (
              <View key={p.uid} style={s.card}>
                <View style={s.row}>
                  <View style={s.rel}><View style={s.av}><Text style={s.avT}>{initials(p.username)}</Text></View><View style={[s.dot, p.online ? s.dotOn : s.dotOff]} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pName}>{p.username}</Text>
                    <Text style={s.pSub}>{p.id} · {p.rank}</Text>
                  </View>
                  {p.isFriend
                    ? <View style={s.pillGreen}><Text style={s.pillGreenT}>Friends</Text></View>
                    : p.isPending
                      ? <View style={s.pillGold}><Text style={s.pillGoldT}>Pending</Text></View>
                      : <TouchableOpacity style={s.btnSm} onPress={() => sendRequest(p.uid)}><Text style={s.btnSmT}>Add</Text></TouchableOpacity>
                  }
                </View>
              </View>
            ))}
          </View>
        )}

        {/* MESSAGES */}
        {tab === 'messages' && (
          convos.length === 0
            ? <Text style={s.empty}>No messages yet.</Text>
            : convos.map(c => (
              <TouchableOpacity key={c.withUid} style={s.card} onPress={() => openChat(c.withUid, c.withUsername, c.online)}>
                <View style={s.row}>
                  <View style={s.rel}><View style={s.av}><Text style={s.avT}>{initials(c.withUsername)}</Text></View><View style={[s.dot, c.online ? s.dotOn : s.dotOff]} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pName}>{c.withUsername}</Text>
                    <Text style={s.pSub} numberOfLines={1}>{c.lastMsg}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
        )}

        {/* REQUESTS */}
        {tab === 'requests' && (
          requests.length === 0
            ? <Text style={s.empty}>No pending requests.</Text>
            : requests.map(r => (
              <View key={r.id} style={s.card}>
                <View style={s.row}>
                  <View style={s.av}><Text style={s.avT}>{initials(r.fromUsername)}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pName}>{r.fromUsername}</Text>
                    <Text style={s.pSub}>{r.fromId} · {r.fromRank}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={[s.btnSm, s.btnGreen]} onPress={() => acceptRequest(r)}><Text style={[s.btnSmT, { color: C.greenD }]}>Accept</Text></TouchableOpacity>
                    <TouchableOpacity style={s.btnSm} onPress={() => declineRequest(r)}><Text style={s.btnSmT}>Decline</Text></TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
        )}

      </ScrollView>

      {/* Chat modal */}
      <Modal visible={!!chatWith} animationType="slide" presentationStyle="pageSheet">
        <View style={s.chatScreen}>
          <View style={s.chatHdr}>
            <View style={s.rel}><View style={s.av}><Text style={s.avT}>{chatWith ? initials(chatWith.username) : ''}</Text></View><View style={[s.dot, chatWith?.online ? s.dotOn : s.dotOff]} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.pName}>{chatWith?.username}</Text>
              <Text style={s.pSub}>{chatWith?.online ? 'Online' : 'Offline'} · {friends.some(f => f.uid === chatWith?.uid) ? 'Friend' : 'Not friends'}</Text>
            </View>
            <TouchableOpacity style={s.btnSm} onPress={() => setChatWith(null)}><Text style={s.btnSmT}>Close</Text></TouchableOpacity>
          </View>

          {!friends.some(f => f.uid === chatWith?.uid) && !chatWith?.online && (
            <View style={s.notice}><Text style={s.noticeTxt}>Player is offline. Messages only visible when they are online.</Text></View>
          )}

          <FlatList
            data={messages}
            keyExtractor={m => m.id}
            style={s.msgList}
            renderItem={({ item }) => {
              const isMe = item.fromUid === myUid;
              return (
                <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
                  <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
                    <Text style={[s.bubbleTxt, isMe && { color: C.goldD }]}>{item.text}</Text>
                  </View>
                </View>
              );
            }}
          />

          <View style={s.chatInputRow}>
            <TextInput
              style={s.chatInput}
              placeholder="Type a message…"
              placeholderTextColor={C.text3}
              value={chatInput}
              onChangeText={setChatInput}
              returnKeyType="send"
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity style={s.sendBtn} onPress={sendMessage}>
              <Text style={s.sendBtnT}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16, paddingTop: 52 },
  hdr:    { marginBottom: 14 },
  title:  { fontSize: 20, fontWeight: '500', color: C.text },
  empty:  { textAlign: 'center', color: C.text3, marginTop: 40, fontSize: 14 },

  tabRow: { flexDirection: 'row', borderWidth: 0.5, borderColor: C.border, borderRadius: 8, overflow: 'hidden', marginBottom: 14 },
  tab:    { flex: 1, paddingVertical: 8, alignItems: 'center', paddingHorizontal: 2 },
  tabOn:  { backgroundColor: C.bg2 },
  tabTxt: { fontSize: 11, color: C.text2 },
  tabTxtOn:{ color: C.text, fontWeight: '500' },

  card: { borderWidth: 0.5, borderColor: C.border, borderRadius: 12, padding: 14, marginBottom: 8 },
  row:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rel:  { position: 'relative' },
  av:   { width: 32, height: 32, borderRadius: 16, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center' },
  avT:  { fontSize: 12, fontWeight: '500', color: C.goldD },
  dot:  { width: 9, height: 9, borderRadius: 5, borderWidth: 1.5, borderColor: C.bg, position: 'absolute', bottom: 0, right: 0 },
  dotOn:{ backgroundColor: C.green },
  dotOff:{ backgroundColor: C.border },

  pName: { fontSize: 14, fontWeight: '500', color: C.text },
  pSub:  { fontSize: 12, color: C.text2 },

  btnSm:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 0.5, borderColor: C.border },
  btnGreen:{ borderColor: C.green, backgroundColor: C.greenBg },
  btnSmT: { fontSize: 12, color: C.text },

  pillGold:  { backgroundColor: C.goldBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillGoldT: { fontSize: 11, color: C.goldD, fontWeight: '500' },
  pillGreen: { backgroundColor: C.greenBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pillGreenT:{ fontSize: 11, color: C.greenD, fontWeight: '500' },

  searchInput: { borderWidth: 0.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, marginBottom: 12 },

  chatScreen:   { flex: 1, backgroundColor: C.bg, paddingTop: 52 },
  chatHdr:      { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderBottomColor: C.border },
  notice:       { backgroundColor: C.bg2, margin: 16, borderRadius: 8, padding: 10 },
  noticeTxt:    { fontSize: 12, color: C.text2, textAlign: 'center' },
  msgList:      { flex: 1, padding: 16 },
  bubble:       { maxWidth: '75%', padding: 10, borderRadius: 12, marginBottom: 2 },
  bubbleMe:     { backgroundColor: C.goldBg, borderBottomRightRadius: 3 },
  bubbleThem:   { backgroundColor: C.bg2, borderBottomLeftRadius: 3 },
  bubbleTxt:    { fontSize: 14, color: C.text },
  chatInputRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 0.5, borderTopColor: C.border },
  chatInput:    { flex: 1, borderWidth: 0.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text },
  sendBtn:      { backgroundColor: C.goldBg, borderWidth: 0.5, borderColor: C.gold, borderRadius: 8, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  sendBtnT:     { fontSize: 13, fontWeight: '500', color: C.goldD },
});
