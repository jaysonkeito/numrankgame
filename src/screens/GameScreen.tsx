// src/screens/GameScreen.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Animated, Vibration, SafeAreaView, StatusBar,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { C, Slot, GameState } from '../types';

const TOTAL             = 20;
const TIMER_S           = 8;
const LOBBY_SEARCH_TIME = 30;

type Screen     = 'home' | 'solo' | 'multiplayer' | 'highscore';
type LobbyState = 'searching' | 'ready' | 'playing';

interface SavedGame { slots: Slot[]; gamePts: number; placed: number }

// ── Pure game logic ───────────────────────────────────────────────────────────
function isValid(slots: Slot[], idx: number, val: number): boolean {
  let left: number | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (slots[i] !== null) { left = slots[i] as number; break; }
  }
  let right: number | null = null;
  for (let i = idx + 1; i < TOTAL; i++) {
    if (slots[i] !== null) { right = slots[i] as number; break; }
  }
  if (left  !== null && val <= left)  return false;
  if (right !== null && val >= right) return false;
  return true;
}

function countCorrect(slots: Slot[]): number {
  const f = slots.filter(v => v !== null) as number[];
  let n = 0;
  for (let i = 0; i < f.length; i++) {
    if (i === 0 || f[i] > f[i - 1]) n++; else break;
  }
  return n;
}

function isJackpot(slots: Slot[]): boolean {
  if (slots.some(v => v === null)) return false;
  for (let i = 1; i < slots.length; i++) {
    if ((slots[i] as number) <= (slots[i - 1] as number)) return false;
  }
  return true;
}

/** Returns true if there is at least one empty slot where val can be placed. */
function hasValidSlot(slots: Slot[], val: number): boolean {
  for (let idx = 0; idx < TOTAL; idx++) {
    if (slots[idx] !== null) continue;
    if (isValid(slots, idx, val)) return true;
  }
  return false;
}

// ── Slot cell ─────────────────────────────────────────────────────────────────
const SlotCell = React.memo(({
  item, index, gameState, onPlace,
}: {
  item: Slot; index: number; gameState: GameState; onPlace: (i: number) => void;
}) => {
  const scale    = useRef(new Animated.Value(1)).current;
  const canPlace = gameState === 'rolled' && item === null;
  const isDone   = gameState === 'over' || gameState === 'jackpot';

  const press = () => {
    if (!canPlace) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.92, duration: 60, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 60, useNativeDriver: true }),
    ]).start();
    onPlace(index);
  };

  return (
    <TouchableOpacity onPress={press} disabled={!canPlace} activeOpacity={0.7}>
      <Animated.View style={[
        s.slot,
        item !== null && s.slotFilled,
        canPlace      && s.slotActive,
        isDone && item === null && s.slotDim,
        { transform: [{ scale }] },
      ]}>
        <Text style={s.slotIdx}>{index + 1}</Text>
        <View style={s.slotCenter}>
          {item !== null
            ? <Text style={s.slotVal}>{item}</Text>
            : <Text style={[s.slotPH, canPlace && s.slotPHActive]}>
                {canPlace ? 'tap to place' : '—'}
              </Text>
          }
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

// ── Timer ring ────────────────────────────────────────────────────────────────
function TimerRing({ seconds }: { seconds: number }) {
  const urgent = seconds <= 3;
  return (
    <View style={s.timerWrap}>
      <View style={[s.timerCircle, urgent && s.timerUrgent]}>
        <Text style={[s.timerNum, urgent && s.timerNumUrgent]}>{seconds}</Text>
      </View>
      <Text style={s.timerLbl}>seconds to place</Text>
    </View>
  );
}

// ── Multiplayer player card ───────────────────────────────────────────────────
function PlayerCard({
  name, rank, isMe, isReady, isEliminated, score,
}: {
  name: string; rank: string; isMe: boolean;
  isReady: boolean; isEliminated: boolean; score?: number;
}) {
  return (
    <View style={[s.mpCard, isMe && s.mpCardMe, isEliminated && s.mpCardElim]}>
      <View style={[s.mpAv, isMe && s.mpAvMe]}>
        <Text style={[s.mpAvTxt, isEliminated && { color: C.text3 }]}>
          {name.substring(0, 2).toUpperCase()}
        </Text>
      </View>
      <Text style={[s.mpName, isEliminated && s.mpNameElim]} numberOfLines={1}>
        {isMe ? 'You' : name}
      </Text>
      <Text style={[s.mpRkTxt, isEliminated && s.mpNameElim]}>{rank}</Text>
      {isEliminated && score !== undefined && (
        <Text style={s.mpScore}>{score}pts</Text>
      )}
      {!isEliminated && isReady && <View style={s.mpReadyDot} />}
      {isMe && !isEliminated && <Text style={s.mpMeLbl}>You</Text>}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
interface Props { playerPts?: number; playerRank?: string }

export default function GameScreen({ playerPts = 0, playerRank = 'Beginner' }: Props) {
  const { user, addPoints } = useAuth();

  const [screen,       setScreen]       = useState<Screen>('home');
  const [slots,        setSlots]        = useState<Slot[]>(Array(TOTAL).fill(null));
  const [currentNum,   setCurrentNum]   = useState<number | null>(null);
  const [gameState,    setGameState]    = useState<GameState>('idle');
  const [gamePts,      setGamePts]      = useState(0);
  const [placed,       setPlaced]       = useState(0);
  const [savedGame,    setSavedGame]    = useState<SavedGame | null>(null);
  const [soloHighest,  setSoloHighest]  = useState(0);

  // Multiplayer
  const [lobbyState,   setLobbyState]   = useState<LobbyState>('searching');
  const [searchTimer,  setSearchTimer]  = useState(LOBBY_SEARCH_TIME);
  const [gameTimer,    setGameTimer]    = useState(TIMER_S);
  const [showTimer,    setShowTimer]    = useState(false);
  const [readyCount,   setReadyCount]   = useState(0);
  const [iAmReady,     setIAmReady]     = useState(false);
  const [eliminated,   setEliminated]   = useState<Set<number>>(new Set());
  const [playerScores, setPlayerScores] = useState<Record<number, number>>({});
  const [lobbyPlayers, setLobbyPlayers] = useState<{ name: string; rank: string; isMe: boolean }[]>([]);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollAnim  = useRef(new Animated.Value(1)).current;

  useEffect(() => () => {
    if (timerRef.current)  clearInterval(timerRef.current);
    if (searchRef.current) clearInterval(searchRef.current);
  }, []);

  const totalPts  = user?.pts ?? playerPts;
  const rankLabel = user?.rank ?? playerRank;
  const myName    = user?.username ?? 'You';

  // ── Multiplayer search ────────────────────────────────────────────────────
  const startSearching = useCallback(() => {
    setLobbyState('searching');
    setSearchTimer(LOBBY_SEARCH_TIME);
    setReadyCount(0);
    setIAmReady(false);
    setEliminated(new Set());
    setPlayerScores({});
    setLobbyPlayers([{ name: myName, rank: rankLabel, isMe: true }]);
    if (searchRef.current) clearInterval(searchRef.current);
    if (timerRef.current)  clearInterval(timerRef.current);

    // Simulate players joining (replace with real Firestore matchmaking in production)
    let joined = 0;
    const joinInterval = setInterval(() => {
      joined++;
      setLobbyPlayers(prev => {
        if (prev.length >= 10) { clearInterval(joinInterval); return prev; }
        const next = [...prev, { name: `Player ${joined}`, rank: rankLabel, isMe: false }];
        if (next.length === 10) {
          clearInterval(joinInterval);
          // All found — move to ready room and start 30s countdown
          setTimeout(() => {
            setLobbyState('ready');
            setSearchTimer(LOBBY_SEARCH_TIME);
            if (searchRef.current) clearInterval(searchRef.current);
            searchRef.current = setInterval(() => {
              setSearchTimer(prev => {
                if (prev <= 1) {
                  clearInterval(searchRef.current!);
                  startSearching(); // restart if not all ready
                  return LOBBY_SEARCH_TIME;
                }
                return prev - 1;
              });
            }, 1000);
          }, 300);
        }
        return next;
      });
    }, 600);
  }, [myName, rankLabel]);

  const handleReadyUp = () => {
    if (iAmReady) return;
    setIAmReady(true);
    const newCount = readyCount + 1;
    setReadyCount(newCount);
    if (newCount >= 10) {
      clearInterval(searchRef.current!);
      setLobbyState('playing');
      resetGameState();
    }
  };

  // ── Turn timer ────────────────────────────────────────────────────────────
  const startTurnTimer = useCallback(() => {
    setGameTimer(TIMER_S);
    setShowTimer(true);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setGameTimer(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setShowTimer(false);
          setCurrentNum(null);
          setGameState('idle');
          Vibration.vibrate(150);
          return TIMER_S;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopTurnTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setShowTimer(false);
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetGameState = () => {
    setSlots(Array(TOTAL).fill(null));
    setCurrentNum(null);
    setGameState('idle');
    setGamePts(0);
    setPlaced(0);
  };

  // ── End game helper ───────────────────────────────────────────────────────
  const endGame = useCallback((currentSlots: Slot[], isSolo: boolean) => {
    const earned = countCorrect(currentSlots);
    setGamePts(earned);
    if (isSolo) {
      addPoints(earned);
      setSoloHighest(prev => earned > prev ? earned : prev);
      setSavedGame(null);
    }
    setGameState('over');
    setCurrentNum(null);
    Vibration.vibrate([0, 80, 80, 160]);
  }, [addPoints]);

  // ── Roll ──────────────────────────────────────────────────────────────────
  const handleRoll = useCallback(() => {
    if (gameState !== 'idle') return;
    const n = Math.floor(Math.random() * 999) + 1;
    setCurrentNum(n);
    setGameState('rolled');

    Animated.sequence([
      Animated.timing(rollAnim, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(rollAnim, { toValue: 1,   duration: 100, useNativeDriver: true }),
    ]).start();

    if (screen === 'multiplayer') startTurnTimer();

    // Check after animation if this number has ANY valid slot
    setTimeout(() => {
      setSlots(cur => {
        if (!hasValidSlot(cur, n)) {
          // Impossible to place — auto end game
          stopTurnTimer();
          endGame(cur, screen === 'solo');
        }
        return cur;
      });
    }, 350);
  }, [gameState, screen, rollAnim, startTurnTimer, stopTurnTimer, endGame]);

  // ── Place ─────────────────────────────────────────────────────────────────
  const handlePlace = useCallback((idx: number) => {
    if (gameState !== 'rolled' || currentNum === null || slots[idx] !== null) return;
    stopTurnTimer();

    const valid     = isValid(slots, idx, currentNum);
    const newSlots  = [...slots];
    newSlots[idx]   = currentNum;
    const newPlaced = placed + 1;
    setPlaced(newPlaced);

    if (!valid) {
      setSlots(newSlots);
      endGame(slots, screen === 'solo');
      return;
    }

    setSlots(newSlots);
    setCurrentNum(null);
    setGameState('idle');

    if (newPlaced === TOTAL && isJackpot(newSlots)) {
      const earned = TOTAL * 2;
      setGamePts(earned);
      if (screen === 'solo') {
        addPoints(earned);
        setSoloHighest(prev => earned > prev ? earned : prev);
        setSavedGame(null);
      }
      setGameState('jackpot');
      Vibration.vibrate([0, 100, 50, 100, 50, 300]);
    } else {
      const correct = countCorrect(newSlots);
      setGamePts(correct);
      if (screen === 'solo') {
        setSavedGame({ slots: newSlots, gamePts: correct, placed: newPlaced });
      }
    }
  }, [gameState, currentNum, slots, placed, screen, stopTurnTimer, endGame, addPoints]);

  const handleNewGame = () => { resetGameState(); if (screen === 'solo') setSavedGame(null); };
  const handleContinue = () => {
    if (!savedGame) return;
    setSlots(savedGame.slots);
    setGamePts(savedGame.gamePts);
    setPlaced(savedGame.placed);
    setGameState('idle');
    setCurrentNum(null);
    setScreen('solo');
  };

  const statusCfg = (() => {
    switch (gameState) {
      case 'idle':    return { text: 'Roll a number, then tap a slot.',                              bg: C.bg2,     col: C.text2  };
      case 'rolled':  return { text: `Place ${currentNum} — tap a valid slot.`,                     bg: C.goldBg,  col: C.goldD  };
      case 'over':    return { text: `Game over! ${countCorrect(slots)} correct = ${gamePts} pts.`,  bg: C.redBg,   col: C.redD   };
      case 'jackpot': return { text: `JACKPOT! 20 × 2 = ${gamePts} pts!`,                           bg: C.greenBg, col: C.greenD };
    }
  })();

  // ════════════════════════════════════════════════════════════════════════════
  // HOME — 2×2 grid, all 4 cards visible without scrolling
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 'home') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={s.home}>

          <View style={s.homeHdr}>
            <View>
              <Text style={s.homeLogo}>NumRank</Text>
              <Text style={s.homeWelcome}>Welcome, {myName}</Text>
            </View>
            <View style={s.homeHdrR}>
              {user?.id ? <View style={s.idBadge}><Text style={s.idTxt}>{user.id}</Text></View> : null}
              <View style={s.rankPill}><Text style={s.rankTxt}>{rankLabel}</Text></View>
            </View>
          </View>

          <View style={s.ptsSummary}>
            <View style={s.ptsCard}>
              <Text style={s.ptsLbl}>Total Points</Text>
              <Text style={s.ptsVal}>{totalPts}</Text>
            </View>
            <View style={s.ptsCard}>
              <Text style={s.ptsLbl}>Best Solo</Text>
              <Text style={s.ptsVal}>{soloHighest}</Text>
            </View>
          </View>

          {/* 2×2 grid — each card gets equal flex, no scrolling needed */}
          <View style={s.menuGrid}>
            <View style={s.menuRow}>
              <TouchableOpacity
                style={[s.mCard, s.mGold]}
                onPress={() => { resetGameState(); setSavedGame(null); setScreen('solo'); }}
              >
                <Text style={s.mIcon}>▶</Text>
                <Text style={s.mLbl}>New Game</Text>
                <Text style={s.mSub}>Solo · start fresh</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.mCard, s.mGreen, !savedGame && s.mDisabled]}
                onPress={savedGame ? handleContinue : undefined}
                disabled={!savedGame}
              >
                <Text style={s.mIcon}>↩</Text>
                <Text style={s.mLbl}>Continue</Text>
                <Text style={s.mSub}>{savedGame ? `${savedGame.placed}/20 placed` : 'No saved game'}</Text>
              </TouchableOpacity>
            </View>

            <View style={s.menuRow}>
              <TouchableOpacity style={[s.mCard, s.mBlue]} onPress={() => setScreen('highscore')}>
                <Text style={s.mIcon}>★</Text>
                <Text style={s.mLbl}>Highest Score</Text>
                <Text style={s.mSub}>Solo & Multiplayer</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[s.mCard, s.mPurple]}
                onPress={() => { startSearching(); setScreen('multiplayer'); }}
              >
                <Text style={s.mIcon}>👥</Text>
                <Text style={s.mLbl}>Multiplayer</Text>
                <Text style={s.mSub}>Up to 10 players</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HIGHEST SCORE
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 'highscore') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.sub}>
          <View style={s.subHdr}>
            <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
              <Text style={s.backTxt}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.subTitle}>Highest Score</Text>
          </View>
          <View style={s.hsCard}>
            <Text style={s.hsLbl}>Best Solo Game</Text>
            <Text style={s.hsNum}>{soloHighest}</Text>
            <Text style={s.hsSub}>points in a single game</Text>
          </View>
          <View style={[s.hsCard, { marginTop: 12 }]}>
            <Text style={s.hsLbl}>Total Ranking Points</Text>
            <Text style={s.hsNum}>{totalPts}</Text>
            <Text style={s.hsSub}>accumulated across all games</Text>
          </View>
          <View style={[s.hsCard, s.hsGray, { marginTop: 12 }]}>
            <Text style={[s.hsLbl, { color: C.text2 }]}>Best Multiplayer Game</Text>
            <Text style={[s.hsNum, { color: C.text2 }]}>—</Text>
            <Text style={[s.hsSub, { color: C.text3 }]}>play multiplayer to set a score</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MULTIPLAYER — SEARCHING
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 'multiplayer' && lobbyState === 'searching') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.sub}>
          <TouchableOpacity onPress={() => { clearInterval(searchRef.current!); setScreen('home'); }} style={s.backBtn}>
            <Text style={s.backTxt}>← Leave</Text>
          </TouchableOpacity>
          <View style={s.searchWrap}>
            <View style={s.searchBubble}><Text style={{ fontSize: 38 }}>👥</Text></View>
            <Text style={s.searchTitle}>Finding players…</Text>
            <Text style={s.searchSub}>Looking for players near your rank ({rankLabel})</Text>
            <View style={s.searchStatusPill}>
              <Text style={s.searchStatusTxt}>{lobbyPlayers.length} / 10 players found</Text>
            </View>
            <View style={s.playerGrid}>
              {Array.from({ length: 10 }).map((_, i) => {
                const p = lobbyPlayers[i];
                return (
                  <View key={i} style={[s.mpCard, p?.isMe && s.mpCardMe, !p && s.mpCardEmpty]}>
                    {p ? (
                      <>
                        <View style={[s.mpAv, p.isMe && s.mpAvMe]}>
                          <Text style={s.mpAvTxt}>{p.name.substring(0,2).toUpperCase()}</Text>
                        </View>
                        <Text style={s.mpName} numberOfLines={1}>{p.isMe ? 'You' : p.name}</Text>
                        <Text style={s.mpRkTxt}>{p.rank}</Text>
                      </>
                    ) : (
                      <>
                        <View style={s.mpAvEmpty}><Text style={s.mpAvEmptyTxt}>?</Text></View>
                        <Text style={s.mpNameElim}>waiting</Text>
                      </>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MULTIPLAYER — READY ROOM
  // ════════════════════════════════════════════════════════════════════════════
  if (screen === 'multiplayer' && lobbyState === 'ready') {
    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.lobbyScroll}>
          <TouchableOpacity onPress={() => { clearInterval(searchRef.current!); setScreen('home'); }} style={s.backBtn}>
            <Text style={s.backTxt}>← Leave</Text>
          </TouchableOpacity>

          <Text style={s.lobbyTitle}>Lobby</Text>
          <Text style={s.lobbySub}>All players found! Ready up within {searchTimer}s</Text>

          <View style={s.readyBar}>
            <Text style={s.readyBarTxt}>
              <Text style={{ color: C.goldD, fontWeight: '700' }}>{readyCount + (iAmReady ? 1 : 0)}</Text>
              {' / 10 Ready'}
            </Text>
            <View style={[s.readyTimer, searchTimer <= 10 && s.readyTimerUrgent]}>
              <Text style={[s.readyTimerTxt, searchTimer <= 10 && { color: C.redD }]}>{searchTimer}s</Text>
            </View>
          </View>

          <View style={s.playerGrid}>
            {lobbyPlayers.map((p, i) => (
              <PlayerCard
                key={i}
                name={p.name}
                rank={p.rank}
                isMe={p.isMe}
                isReady={p.isMe ? iAmReady : i < readyCount}
                isEliminated={false}
              />
            ))}
          </View>

          <TouchableOpacity
            style={[s.readyBtn, iAmReady && s.readyBtnDone]}
            onPress={handleReadyUp}
            disabled={iAmReady}
          >
            <Text style={[s.readyBtnTxt, iAmReady && { color: C.greenD }]}>
              {iAmReady ? '✓  You are Ready!' : 'Ready Up'}
            </Text>
          </TouchableOpacity>

          {iAmReady && (
            <Text style={s.readyNote}>
              You are #{readyCount} to ready — first to ready rolls first (first come, first serve).
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SOLO / MULTIPLAYER GAME — vertical portrait
  // ════════════════════════════════════════════════════════════════════════════
  const isMulti = screen === 'multiplayer';

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.gameWrap}>

        <View style={s.gameHdr}>
          <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
            <Text style={s.backTxt}>← Menu</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.gameTitle}>{isMulti ? 'Multiplayer' : 'Solo Game'}</Text>
            <Text style={s.gameSub}>{rankLabel} · {totalPts} pts</Text>
          </View>
          <View style={s.rankPill}><Text style={s.rankTxt}>{rankLabel}</Text></View>
        </View>

        {isMulti && lobbyState === 'playing' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mpBar}>
            {lobbyPlayers.map((p, i) => (
              <PlayerCard
                key={i}
                name={p.name}
                rank={p.rank}
                isMe={p.isMe}
                isReady={true}
                isEliminated={eliminated.has(i)}
                score={playerScores[i]}
              />
            ))}
          </ScrollView>
        )}

        <View style={s.statsRow}>
          <View style={s.statCard}><Text style={s.statLbl}>Total pts</Text><Text style={s.statVal}>{totalPts}</Text></View>
          <View style={s.statCard}><Text style={s.statLbl}>This game</Text><Text style={s.statVal}>{gamePts}</Text></View>
          <View style={s.statCard}><Text style={s.statLbl}>Placed</Text><Text style={s.statVal}>{placed}/20</Text></View>
        </View>

        <View style={[s.statusBanner, { backgroundColor: statusCfg.bg }]}>
          <Text style={[s.statusTxt, { color: statusCfg.col }]}>{statusCfg.text}</Text>
        </View>

        {showTimer && <TimerRing seconds={gameTimer} />}

        <View style={s.rollArea}>
          <Animated.Text style={[s.currentNum, { transform: [{ scale: rollAnim }] }]}>
            {currentNum ?? '—'}
          </Animated.Text>
          <TouchableOpacity
            style={[s.rollBtn, gameState !== 'idle' && s.rollBtnOff]}
            onPress={handleRoll}
            disabled={gameState !== 'idle'}
          >
            <Text style={s.rollBtnTxt}>Roll Number</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={s.slotScroll} showsVerticalScrollIndicator={false}>
          {slots.map((item, i) => (
            <SlotCell key={i} item={item} index={i} gameState={gameState} onPlace={handlePlace} />
          ))}

          {(gameState === 'over' || gameState === 'jackpot') && (
            <View style={s.endBtns}>
              <TouchableOpacity style={s.newGameBtn} onPress={handleNewGame}>
                <Text style={s.newGameTxt}>New Game</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.menuBtn} onPress={() => setScreen('home')}>
                <Text style={s.menuBtnTxt}>Back to Menu</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Home
  home:       { flex: 1, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  homeHdr:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 },
  homeLogo:   { fontSize: 24, fontWeight: '700', color: C.goldD, letterSpacing: -0.5 },
  homeWelcome:{ fontSize: 12, color: C.text2, marginTop: 2 },
  homeHdrR:   { alignItems: 'flex-end', gap: 5 },
  idBadge:    { backgroundColor: C.bg2, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  idTxt:      { fontSize: 10, color: C.text2, fontFamily: 'monospace' },
  rankPill:   { backgroundColor: C.goldBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  rankTxt:    { fontSize: 11, fontWeight: '600', color: C.goldD },

  ptsSummary: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  ptsCard:    { flex: 1, backgroundColor: C.bg2, borderRadius: 12, padding: 12, alignItems: 'center' },
  ptsLbl:     { fontSize: 11, color: C.text3, marginBottom: 2 },
  ptsVal:     { fontSize: 22, fontWeight: '700', color: C.text },

  // 2×2 grid — two rows, each row flex:1 so both share remaining space equally
  menuGrid: { flex: 1, gap: 10 },
  menuRow:  { flex: 1, flexDirection: 'row', gap: 10 },
  mCard:    { flex: 1, borderRadius: 14, padding: 14, borderWidth: 0.5, borderColor: C.border, justifyContent: 'flex-end' },
  mGold:    { backgroundColor: C.goldBg, borderColor: C.gold },
  mGreen:   { backgroundColor: C.greenBg, borderColor: C.green },
  mBlue:    { backgroundColor: '#E6F1FB', borderColor: '#378ADD' },
  mPurple:  { backgroundColor: '#EEEDFE', borderColor: '#7F77DD' },
  mDisabled:{ opacity: 0.45 },
  mIcon:    { fontSize: 24, marginBottom: 8 },
  mLbl:     { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  mSub:     { fontSize: 11, color: C.text2 },

  // Sub-screens shared
  sub:      { flex: 1, padding: 20 },
  subHdr:   { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  subTitle: { fontSize: 20, fontWeight: '700', color: C.text },
  backBtn:  { paddingVertical: 4 },
  backTxt:  { fontSize: 14, color: C.info, fontWeight: '500' },

  // Highest score
  hsCard: { backgroundColor: C.goldBg, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 0.5, borderColor: C.gold },
  hsGray: { backgroundColor: C.bg2, borderColor: C.border },
  hsLbl:  { fontSize: 13, color: C.goldD, fontWeight: '600', marginBottom: 6 },
  hsNum:  { fontSize: 48, fontWeight: '800', color: C.goldD, letterSpacing: -2 },
  hsSub:  { fontSize: 12, color: C.goldD, marginTop: 4 },

  // Searching
  searchWrap:      { flex: 1, alignItems: 'center', paddingTop: 16 },
  searchBubble:    { width: 76, height: 76, borderRadius: 38, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  searchTitle:     { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 5 },
  searchSub:       { fontSize: 13, color: C.text2, textAlign: 'center', marginBottom: 14 },
  searchStatusPill:{ backgroundColor: C.bg2, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, marginBottom: 16 },
  searchStatusTxt: { fontSize: 14, color: C.text2, fontWeight: '600' },

  // Lobby
  lobbyScroll: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  lobbyTitle:  { fontSize: 22, fontWeight: '700', color: C.text, textAlign: 'center', marginBottom: 4, marginTop: 4 },
  lobbySub:    { fontSize: 13, color: C.text2, textAlign: 'center', marginBottom: 14 },

  readyBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bg2, borderRadius: 12, padding: 14, marginBottom: 14 },
  readyBarTxt:     { fontSize: 15, color: C.text },
  readyTimer:      { backgroundColor: C.goldBg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  readyTimerUrgent:{ backgroundColor: C.redBg },
  readyTimerTxt:   { fontSize: 14, fontWeight: '700', color: C.goldD },

  // Player grid (shared: searching + lobby)
  playerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 18 },
  mpCard:     { width: 60, alignItems: 'center', padding: 6, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.bg },
  mpCardMe:   { borderColor: C.gold, backgroundColor: C.goldBg },
  mpCardElim: { opacity: 0.38, backgroundColor: C.bg2 },
  mpCardEmpty:{ opacity: 0.28 },
  mpAv:       { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bg2, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  mpAvMe:     { backgroundColor: C.goldBg },
  mpAvEmpty:  { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bg2, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  mpAvTxt:    { fontSize: 11, fontWeight: '700', color: C.goldD },
  mpAvEmptyTxt:{ fontSize: 14, color: C.text3 },
  mpName:     { fontSize: 9, color: C.text, fontWeight: '600', textAlign: 'center' },
  mpNameElim: { fontSize: 9, color: C.text3, textAlign: 'center' },
  mpRkTxt:    { fontSize: 8, color: C.text3, textAlign: 'center' },
  mpScore:    { fontSize: 9, fontWeight: '700', color: C.redD, textAlign: 'center', marginTop: 2 },
  mpReadyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green, marginTop: 3 },
  mpMeLbl:    { fontSize: 8, color: C.goldD, fontWeight: '700', marginTop: 2 },

  readyBtn:    { backgroundColor: C.goldBg, borderWidth: 1.5, borderColor: C.gold, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  readyBtnDone:{ backgroundColor: C.greenBg, borderColor: C.green },
  readyBtnTxt: { fontSize: 17, fontWeight: '700', color: C.goldD },
  readyNote:   { fontSize: 12, color: C.text2, textAlign: 'center', lineHeight: 18 },

  // Game play
  gameWrap:  { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  gameHdr:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  gameTitle: { fontSize: 15, fontWeight: '700', color: C.text },
  gameSub:   { fontSize: 10, color: C.text3 },

  mpBar: { maxHeight: 95, marginBottom: 6 },

  statsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  statCard: { flex: 1, backgroundColor: C.bg2, borderRadius: 8, padding: 8, alignItems: 'center' },
  statLbl:  { fontSize: 10, color: C.text3, marginBottom: 2 },
  statVal:  { fontSize: 14, fontWeight: '700', color: C.text },

  statusBanner: { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 7, alignItems: 'center' },
  statusTxt:    { fontSize: 12, textAlign: 'center' },

  timerWrap:      { alignItems: 'center', marginBottom: 6 },
  timerCircle:    { width: 42, height: 42, borderRadius: 21, borderWidth: 3, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  timerUrgent:    { borderColor: C.red },
  timerNum:       { fontSize: 16, fontWeight: '700', color: C.goldD },
  timerNumUrgent: { color: C.redD },
  timerLbl:       { fontSize: 10, color: C.text3, marginTop: 2 },

  rollArea:   { alignItems: 'center', marginBottom: 8 },
  currentNum: { fontSize: 52, fontWeight: '800', color: C.goldD, minHeight: 60, letterSpacing: -2, textAlign: 'center' },
  rollBtn:    { paddingHorizontal: 30, paddingVertical: 10, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.bg },
  rollBtnOff: { opacity: 0.4 },
  rollBtnTxt: { fontSize: 14, fontWeight: '500', color: C.text },

  slotScroll: { flex: 1 },
  slot: {
    height: 42, flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 24, marginBottom: 4, borderRadius: 10,
    borderWidth: 0.5, borderColor: C.border, backgroundColor: C.bg,
    paddingHorizontal: 12,
  },
  slotFilled:  { backgroundColor: C.bg2 },
  slotActive:  { backgroundColor: C.goldBg, borderColor: C.gold },
  slotDim:     { opacity: 0.3 },
  slotIdx:     { fontSize: 11, color: C.text3, width: 22, fontWeight: '600' },
  slotCenter:  { flex: 1, alignItems: 'center' },
  slotVal:     { fontSize: 15, fontWeight: '700', color: C.text },
  slotPH:      { fontSize: 11, color: C.text3 },
  slotPHActive:{ color: C.goldD, fontWeight: '500' },

  endBtns:      { paddingHorizontal: 24, paddingVertical: 14, gap: 8 },
  newGameBtn:   { paddingVertical: 13, borderRadius: 10, backgroundColor: C.goldBg, borderWidth: 0.5, borderColor: C.gold, alignItems: 'center' },
  newGameTxt:   { fontSize: 14, fontWeight: '700', color: C.goldD },
  menuBtn:      { paddingVertical: 11, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, alignItems: 'center' },
  menuBtnTxt:   { fontSize: 14, color: C.text2 },
});
