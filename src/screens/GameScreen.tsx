// src/screens/GameScreen.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Animated, Vibration, SafeAreaView, StatusBar, Modal,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { C, Slot, GameState } from '../types';

const TOTAL   = 20;
const TIMER_S = 8;
const LOBBY_SEARCH_TIME = 30;

type Screen = 'home' | 'solo' | 'multiplayer' | 'highscore';
type LobbyState = 'searching' | 'ready' | 'playing' | 'spectating';

interface SavedGame { slots: Slot[]; gamePts: number; placed: number }

// ── Game logic ────────────────────────────────────────────────────────────────
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

// ── Slot cell (vertical, centered) ───────────────────────────────────────────
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
function TimerRing({ seconds, total }: { seconds: number; total: number }) {
  const urgent = seconds <= 5;
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
  name, rank, isMe, isReady, isEliminated, score, readyOrder,
}: {
  name: string; rank: string; isMe: boolean;
  isReady: boolean; isEliminated: boolean;
  score?: number; readyOrder?: number;
}) {
  return (
    <View style={[s.mpCard, isMe && s.mpCardMe, isEliminated && s.mpCardElim]}>
      <View style={[s.mpAvatar, isMe && s.mpAvatarMe, isEliminated && s.mpAvatarElim]}>
        <Text style={[s.mpAvatarTxt, isEliminated && { color: C.text3 }]}>
          {name.substring(0, 2).toUpperCase()}
        </Text>
      </View>
      <Text style={[s.mpName, isEliminated && s.mpNameElim]} numberOfLines={1}>{name}</Text>
      <Text style={[s.mpRank, isEliminated && s.mpNameElim]}>{rank}</Text>
      {isEliminated && score !== undefined && (
        <Text style={s.mpScore}>{score}pts</Text>
      )}
      {!isEliminated && isReady && (
        <View style={s.mpReadyDot} />
      )}
      {isMe && !isEliminated && (
        <Text style={s.mpMeLbl}>You</Text>
      )}
    </View>
  );
}

// ── Simulated multiplayer players ─────────────────────────────────────────────
const FAKE_PLAYERS = [
  { name: 'KaitoM',  rank: 'Junior'   },
  { name: 'GraceG',  rank: 'Junior'   },
  { name: 'SofiaR',  rank: 'Senior'   },
  { name: 'MarcL',   rank: 'Beginner' },
  { name: 'AnnaB',   rank: 'Junior'   },
  { name: 'PedroS',  rank: 'Beginner' },
  { name: 'LizaA',   rank: 'Junior'   },
  { name: 'TomK',    rank: 'Junior'   },
  { name: 'JenP',    rank: 'Beginner' },
];

// ── Main GameScreen ───────────────────────────────────────────────────────────
interface Props { playerPts?: number; playerRank?: string }

export default function GameScreen({ playerPts = 0, playerRank = 'Beginner' }: Props) {
  const { user, addPoints } = useAuth();

  const [screen,      setScreen]      = useState<Screen>('home');
  const [slots,       setSlots]       = useState<Slot[]>(Array(TOTAL).fill(null));
  const [currentNum,  setCurrentNum]  = useState<number | null>(null);
  const [gameState,   setGameState]   = useState<GameState>('idle');
  const [gamePts,     setGamePts]     = useState(0);
  const [placed,      setPlaced]      = useState(0);
  const [savedGame,   setSavedGame]   = useState<SavedGame | null>(null);
  const [soloHighest, setSoloHighest] = useState(0);

  // Multiplayer state
  const [lobbyState,   setLobbyState]   = useState<LobbyState>('searching');
  const [searchTimer,  setSearchTimer]  = useState(LOBBY_SEARCH_TIME);
  const [gameTimer,    setGameTimer]    = useState(TIMER_S);
  const [showTimer,    setShowTimer]    = useState(false);
  const [readyCount,   setReadyCount]   = useState(0);
  const [iAmReady,     setIAmReady]     = useState(false);
  const [myReadyOrder, setMyReadyOrder] = useState<number>(0);
  const [eliminated,   setEliminated]   = useState<Set<number>>(new Set());
  const [playerScores, setPlayerScores] = useState<Record<number, number>>({});
  const [foundPlayers, setFoundPlayers] = useState(false);

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const searchRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollAnim    = useRef(new Animated.Value(1)).current;

  useEffect(() => () => {
    if (timerRef.current)  clearInterval(timerRef.current);
    if (searchRef.current) clearInterval(searchRef.current);
  }, []);

  // ── Searching for players ─────────────────────────────────────────────────
  const startSearching = () => {
    setLobbyState('searching');
    setSearchTimer(LOBBY_SEARCH_TIME);
    setFoundPlayers(false);
    setReadyCount(0);
    setIAmReady(false);
    setEliminated(new Set());
    setPlayerScores({});
    if (searchRef.current) clearInterval(searchRef.current);

    // Simulate finding players after 3-5 seconds
    const findDelay = Math.floor(Math.random() * 3000) + 2000;
    setTimeout(() => {
      setFoundPlayers(true);
      setLobbyState('ready');
      setSearchTimer(LOBBY_SEARCH_TIME);

      // Simulate other players readying up
      let fakeReady = 0;
      const fakeReadyInterval = setInterval(() => {
        fakeReady++;
        setReadyCount(prev => Math.min(prev + 1, 9));
        if (fakeReady >= 9) clearInterval(fakeReadyInterval);
      }, Math.random() * 2000 + 1000);

      // 30-second countdown
      searchRef.current = setInterval(() => {
        setSearchTimer(prev => {
          if (prev <= 1) {
            clearInterval(searchRef.current!);
            // If not all ready, restart search
            setFoundPlayers(false);
            setLobbyState('searching');
            setReadyCount(0);
            setIAmReady(false);
            startSearching();
            return LOBBY_SEARCH_TIME;
          }
          return prev - 1;
        });
      }, 1000);
    }, findDelay);
  };

  const handleReadyUp = () => {
    if (iAmReady) return;
    setIAmReady(true);
    setReadyCount(prev => prev + 1);
    setMyReadyOrder(readyCount + 1); // first come first serve

    // If all 10 ready, start game
    if (readyCount + 1 >= 10) {
      clearInterval(searchRef.current!);
      startMultiplayerGame();
    }
  };

  const startMultiplayerGame = () => {
    clearInterval(searchRef.current!);
    setLobbyState('playing');
    resetGameState();
  };

  // ── Multiplayer game timer ────────────────────────────────────────────────
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

  // ── Game actions ──────────────────────────────────────────────────────────
  const resetGameState = () => {
    setSlots(Array(TOTAL).fill(null));
    setCurrentNum(null);
    setGameState('idle');
    setGamePts(0);
    setPlaced(0);
  };

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
  }, [gameState, screen, rollAnim, startTurnTimer]);

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
      const earned = countCorrect(slots);
      setGamePts(earned);
      if (screen === 'solo') {
        addPoints(earned);
        if (earned > soloHighest) setSoloHighest(earned);
      }
      setGameState('over');
      setCurrentNum(null);
      Vibration.vibrate([0, 80, 80, 160]);

      // Save game for Continue
      if (screen === 'solo') setSavedGame(null); // game over, no continue
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
        if (earned > soloHighest) setSoloHighest(earned);
      }
      setGameState('jackpot');
      Vibration.vibrate([0, 100, 50, 100, 50, 300]);
      if (screen === 'solo') setSavedGame(null);
    } else {
      const correct = countCorrect(newSlots);
      setGamePts(correct);
      // Auto-save for Continue Game
      if (screen === 'solo') {
        setSavedGame({ slots: newSlots, gamePts: correct, placed: newPlaced });
      }
    }
  }, [gameState, currentNum, slots, placed, screen, soloHighest, stopTurnTimer, addPoints]);

  const handleNewGame = () => {
    resetGameState();
    if (screen === 'solo') setSavedGame(null);
  };

  const handleContinueGame = () => {
    if (!savedGame) return;
    setSlots(savedGame.slots);
    setGamePts(savedGame.gamePts);
    setPlaced(savedGame.placed);
    setGameState('idle');
    setCurrentNum(null);
    setScreen('solo');
  };

  const totalPts  = user?.pts ?? playerPts;
  const rankLabel = user?.rank ?? playerRank;

  // ── Status config ─────────────────────────────────────────────────────────
  const statusCfg = (() => {
    switch (gameState) {
      case 'idle':    return { text: 'Roll a number, then tap a slot.',               bg: C.bg2,     col: C.text2  };
      case 'rolled':  return { text: `Place ${currentNum} — tap any valid slot.`,    bg: C.goldBg,  col: C.goldD  };
      case 'over':    return { text: `Game over! ${countCorrect(slots)} correct = ${gamePts} pts.`, bg: C.redBg, col: C.redD };
      case 'jackpot': return { text: `JACKPOT! 20 × 2 = ${gamePts} pts!`,            bg: C.greenBg, col: C.greenD };
    }
  })();

  // ─────────────────────────────────────────────────────────────────────────
  // HOME SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'home') {
    return (
      <SafeAreaView style={s.safe}>
        <StatusBar barStyle="dark-content" />
        <View style={s.homeContainer}>
          {/* Header */}
          <View style={s.homeHeader}>
            <View>
              <Text style={s.homeLogoTxt}>NumRank</Text>
              <Text style={s.homeWelcome}>Welcome, {user?.username ?? 'Player'}</Text>
            </View>
            <View style={s.homeHeaderRight}>
              {user?.id ? <View style={s.idBadge}><Text style={s.idTxt}>{user.id}</Text></View> : null}
              <View style={s.rankPill}><Text style={s.rankTxt}>{rankLabel}</Text></View>
            </View>
          </View>

          {/* Points summary */}
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

          {/* Menu options */}
          <View style={s.menuGrid}>
            {/* New Game */}
            <TouchableOpacity style={[s.menuCard, s.menuCardGold]} onPress={() => { resetGameState(); setSavedGame(null); setScreen('solo'); }}>
              <Text style={s.menuIcon}>▶</Text>
              <Text style={s.menuLabel}>New Game</Text>
              <Text style={s.menuSub}>Solo · start fresh</Text>
            </TouchableOpacity>

            {/* Continue Game */}
            <TouchableOpacity
              style={[s.menuCard, s.menuCardGreen, !savedGame && s.menuCardDisabled]}
              onPress={savedGame ? handleContinueGame : undefined}
              disabled={!savedGame}
            >
              <Text style={s.menuIcon}>⟳</Text>
              <Text style={s.menuLabel}>Continue</Text>
              <Text style={s.menuSub}>{savedGame ? `${savedGame.placed}/20 placed` : 'No saved game'}</Text>
            </TouchableOpacity>

            {/* Highest Score */}
            <TouchableOpacity style={[s.menuCard, s.menuCardBlue]} onPress={() => setScreen('highscore')}>
              <Text style={s.menuIcon}>★</Text>
              <Text style={s.menuLabel}>Highest Score</Text>
              <Text style={s.menuSub}>Solo & Multiplayer</Text>
            </TouchableOpacity>

            {/* Multiplayer */}
            <TouchableOpacity style={[s.menuCard, s.menuCardPurple]} onPress={() => { startSearching(); setScreen('multiplayer'); }}>
              <Text style={s.menuIcon}>👥</Text>
              <Text style={s.menuLabel}>Multiplayer</Text>
              <Text style={s.menuSub}>Up to 10 players</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HIGHEST SCORE SCREEN
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'highscore') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.hsContainer}>
          <View style={s.hsHeader}>
            <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
              <Text style={s.backTxt}>← Back</Text>
            </TouchableOpacity>
            <Text style={s.hsTitle}>Highest Score</Text>
          </View>
          <View style={s.hsCard}>
            <Text style={s.hsLabel}>Best Solo Game</Text>
            <Text style={s.hsScore}>{soloHighest}</Text>
            <Text style={s.hsSubLabel}>points in a single game</Text>
          </View>
          <View style={[s.hsCard, { marginTop: 12 }]}>
            <Text style={s.hsLabel}>Total Ranking Points</Text>
            <Text style={s.hsScore}>{totalPts}</Text>
            <Text style={s.hsSubLabel}>accumulated across all games</Text>
          </View>
          <View style={[s.hsCard, s.hsCardGray, { marginTop: 12 }]}>
            <Text style={[s.hsLabel, { color: C.text2 }]}>Best Multiplayer Game</Text>
            <Text style={[s.hsScore, { color: C.text2 }]}>—</Text>
            <Text style={[s.hsSubLabel, { color: C.text3 }]}>play multiplayer to set a score</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MULTIPLAYER LOBBY — SEARCHING
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'multiplayer' && lobbyState === 'searching') {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.lobbyContainer}>
          <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
            <Text style={s.backTxt}>← Leave</Text>
          </TouchableOpacity>
          <View style={s.searchingWrap}>
            <View style={s.searchingSpinner}>
              <Text style={s.searchingIcon}>👥</Text>
            </View>
            <Text style={s.searchingTitle}>Finding players…</Text>
            <Text style={s.searchingSub}>Looking for players near your rank ({rankLabel})</Text>
            <View style={s.searchingStatus}>
              <Text style={s.searchingStatusTxt}>0 / 10 players found</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MULTIPLAYER LOBBY — READY ROOM (players found, waiting for ready)
  // ─────────────────────────────────────────────────────────────────────────
  if (screen === 'multiplayer' && lobbyState === 'ready') {
    const allPlayers = [
      { name: user?.username ?? 'You', rank: rankLabel, isMe: true },
      ...FAKE_PLAYERS,
    ];
    const currentReady = readyCount + (iAmReady ? 0 : 0); // already counted

    return (
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.lobbyContainer}>
          <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
            <Text style={s.backTxt}>← Leave</Text>
          </TouchableOpacity>

          <Text style={s.lobbyTitle}>Multiplayer Lobby</Text>
          <Text style={s.lobbySub}>Players found! Click Ready within {searchTimer}s</Text>

          {/* Ready counter */}
          <View style={s.readyCounter}>
            <Text style={s.readyCounterTxt}>
              <Text style={{ color: C.goldD, fontWeight: '600' }}>{readyCount + (iAmReady ? 1 : 0)}</Text>
              {' / 10 Ready'}
            </Text>
            <View style={s.readyTimerBadge}>
              <Text style={[s.readyTimerTxt, searchTimer <= 10 && { color: C.redD }]}>{searchTimer}s</Text>
            </View>
          </View>

          {/* Player profiles */}
          <View style={s.playerGrid}>
            {allPlayers.map((p, i) => (
              <PlayerCard
                key={i}
                name={p.name}
                rank={p.rank}
                isMe={p.isMe}
                isReady={p.isMe ? iAmReady : i <= readyCount}
                isEliminated={false}
              />
            ))}
          </View>

          {/* Ready button */}
          <TouchableOpacity
            style={[s.readyBtn, iAmReady && s.readyBtnDone]}
            onPress={handleReadyUp}
            disabled={iAmReady}
          >
            <Text style={[s.readyBtnTxt, iAmReady && s.readyBtnTxtDone]}>
              {iAmReady ? '✓ Ready!' : 'Ready Up'}
            </Text>
          </TouchableOpacity>

          {iAmReady && (
            <Text style={s.readyNote}>
              You are #{readyCount + 1} to ready — you will roll {readyCount === 0 ? 'first!' : `after the first ${readyCount} player${readyCount > 1 ? 's' : ''}.`}
            </Text>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SOLO GAME + MULTIPLAYER GAME (same layout, vertical portrait)
  // ─────────────────────────────────────────────────────────────────────────
  const isMulti = screen === 'multiplayer';

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={s.gameContainer}>

        {/* Header */}
        <View style={s.gameHeader}>
          <TouchableOpacity onPress={() => setScreen('home')} style={s.backBtn}>
            <Text style={s.backTxt}>← Menu</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={s.gameTitle}>{isMulti ? 'Multiplayer' : 'Solo Game'}</Text>
            <Text style={s.gameSubtitle}>{rankLabel} · {totalPts} pts</Text>
          </View>
          <View style={s.rankPill}>
            <Text style={s.rankTxt}>{rankLabel}</Text>
          </View>
        </View>

        {/* Multiplayer player bar */}
        {isMulti && lobbyState === 'playing' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.mpBar}>
            {[{ name: user?.username ?? 'You', rank: rankLabel, isMe: true }, ...FAKE_PLAYERS].map((p, i) => (
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

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCard}><Text style={s.statLbl}>Total pts</Text><Text style={s.statVal}>{totalPts}</Text></View>
          <View style={s.statCard}><Text style={s.statLbl}>This game</Text><Text style={s.statVal}>{gamePts}</Text></View>
          <View style={s.statCard}><Text style={s.statLbl}>Placed</Text><Text style={s.statVal}>{placed}/20</Text></View>
        </View>

        {/* Status banner */}
        <View style={[s.status, { backgroundColor: statusCfg.bg }]}>
          <Text style={[s.statusTxt, { color: statusCfg.col }]}>{statusCfg.text}</Text>
        </View>

        {/* Timer */}
        {showTimer && <TimerRing seconds={gameTimer} total={TIMER_S} />}

        {/* Roll area */}
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

        {/* Vertical slots — portrait, centered */}
        <ScrollView style={s.slotScroll} showsVerticalScrollIndicator={false}>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <SlotCell
              key={i}
              item={slots[i]}
              index={i}
              gameState={gameState}
              onPlace={handlePlace}
            />
          ))}

          {/* New game button */}
          {(gameState === 'over' || gameState === 'jackpot') && (
            <View style={s.endActions}>
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
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  // Home
  homeContainer:  { flex: 1, padding: 20 },
  homeHeader:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 },
  homeLogoTxt:    { fontSize: 26, fontWeight: '600', color: C.goldD, letterSpacing: -0.5 },
  homeWelcome:    { fontSize: 13, color: C.text2, marginTop: 2 },
  homeHeaderRight:{ alignItems: 'flex-end', gap: 6 },
  idBadge:        { backgroundColor: C.bg2, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  idTxt:          { fontSize: 10, color: C.text2, fontFamily: 'monospace' },
  rankPill:       { backgroundColor: C.goldBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  rankTxt:        { fontSize: 12, fontWeight: '500', color: C.goldD },

  ptsSummary: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  ptsCard:    { flex: 1, backgroundColor: C.bg2, borderRadius: 12, padding: 14, alignItems: 'center' },
  ptsLbl:     { fontSize: 11, color: C.text3, marginBottom: 4 },
  ptsVal:     { fontSize: 24, fontWeight: '600', color: C.text },

  menuGrid:         { flex: 1, gap: 12 },
  menuCard:         { borderRadius: 16, padding: 18, borderWidth: 0.5, borderColor: C.border },
  menuCardGold:     { backgroundColor: C.goldBg, borderColor: C.gold },
  menuCardGreen:    { backgroundColor: C.greenBg, borderColor: C.green },
  menuCardBlue:     { backgroundColor: '#E6F1FB', borderColor: '#378ADD' },
  menuCardPurple:   { backgroundColor: '#EEEDFE', borderColor: '#7F77DD' },
  menuCardDisabled: { opacity: 0.5 },
  menuIcon:         { fontSize: 28, marginBottom: 6 },
  menuLabel:        { fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 2 },
  menuSub:          { fontSize: 12, color: C.text2 },

  // Highest score
  hsContainer: { flex: 1, padding: 20 },
  hsHeader:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
  hsTitle:     { fontSize: 20, fontWeight: '600', color: C.text },
  hsCard:      { backgroundColor: C.goldBg, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 0.5, borderColor: C.gold },
  hsCardGray:  { backgroundColor: C.bg2, borderColor: C.border },
  hsLabel:     { fontSize: 13, color: C.goldD, marginBottom: 8, fontWeight: '500' },
  hsScore:     { fontSize: 52, fontWeight: '700', color: C.goldD, letterSpacing: -2 },
  hsSubLabel:  { fontSize: 12, color: C.goldD, marginTop: 4 },

  // Lobby
  lobbyContainer: { flexGrow: 1, padding: 20, paddingBottom: 40 },
  lobbyTitle:     { fontSize: 22, fontWeight: '600', color: C.text, textAlign: 'center', marginBottom: 6, marginTop: 8 },
  lobbySub:       { fontSize: 13, color: C.text2, textAlign: 'center', marginBottom: 16 },

  searchingWrap:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  searchingSpinner:   { width: 80, height: 80, borderRadius: 40, backgroundColor: C.goldBg, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  searchingIcon:      { fontSize: 36 },
  searchingTitle:     { fontSize: 20, fontWeight: '600', color: C.text, marginBottom: 8 },
  searchingSub:       { fontSize: 13, color: C.text2, textAlign: 'center', marginBottom: 24 },
  searchingStatus:    { backgroundColor: C.bg2, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  searchingStatusTxt: { fontSize: 14, color: C.text2, fontWeight: '500' },

  readyCounter:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bg2, borderRadius: 12, padding: 14, marginBottom: 16 },
  readyCounterTxt:  { fontSize: 16, color: C.text },
  readyTimerBadge:  { backgroundColor: C.goldBg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  readyTimerTxt:    { fontSize: 14, fontWeight: '600', color: C.goldD },

  playerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 20 },
  mpCard:     { width: 64, alignItems: 'center', padding: 6, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.bg },
  mpCardMe:   { borderColor: C.gold, backgroundColor: C.goldBg },
  mpCardElim: { opacity: 0.45, backgroundColor: C.bg2 },
  mpAvatar:   { width: 36, height: 36, borderRadius: 18, backgroundColor: C.bg2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  mpAvatarMe: { backgroundColor: C.goldBg },
  mpAvatarElim:{ backgroundColor: C.bg2 },
  mpAvatarTxt:{ fontSize: 12, fontWeight: '600', color: C.goldD },
  mpName:     { fontSize: 10, color: C.text, fontWeight: '500', textAlign: 'center' },
  mpNameElim: { color: C.text3 },
  mpRank:     { fontSize: 9, color: C.text3, textAlign: 'center' },
  mpScore:    { fontSize: 10, fontWeight: '600', color: C.redD, textAlign: 'center', marginTop: 2 },
  mpReadyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green, marginTop: 3 },
  mpMeLbl:    { fontSize: 9, color: C.goldD, fontWeight: '600', marginTop: 2 },

  readyBtn:       { backgroundColor: C.goldBg, borderWidth: 1, borderColor: C.gold, borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12 },
  readyBtnDone:   { backgroundColor: C.greenBg, borderColor: C.green },
  readyBtnTxt:    { fontSize: 16, fontWeight: '600', color: C.goldD },
  readyBtnTxtDone:{ color: C.greenD },
  readyNote:      { fontSize: 12, color: C.text2, textAlign: 'center' },

  // Game play
  gameContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  gameHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  gameTitle:     { fontSize: 16, fontWeight: '600', color: C.text },
  gameSubtitle:  { fontSize: 11, color: C.text3 },

  mpBar: { maxHeight: 100, marginBottom: 8 },

  statsRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  statCard: { flex: 1, backgroundColor: C.bg2, borderRadius: 8, padding: 8, alignItems: 'center' },
  statLbl:  { fontSize: 10, color: C.text3, marginBottom: 2 },
  statVal:  { fontSize: 15, fontWeight: '600', color: C.text },

  status:    { borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8, alignItems: 'center' },
  statusTxt: { fontSize: 13, textAlign: 'center' },

  timerWrap:     { alignItems: 'center', marginBottom: 6 },
  timerCircle:   { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: C.gold, alignItems: 'center', justifyContent: 'center' },
  timerUrgent:   { borderColor: C.red },
  timerNum:      { fontSize: 17, fontWeight: '600', color: C.goldD },
  timerNumUrgent:{ color: C.redD },
  timerLbl:      { fontSize: 11, color: C.text3, marginTop: 2 },

  rollArea:   { alignItems: 'center', marginBottom: 10 },
  currentNum: { fontSize: 56, fontWeight: '700', color: C.goldD, minHeight: 66, letterSpacing: -2, textAlign: 'center' },
  rollBtn:    { paddingHorizontal: 32, paddingVertical: 11, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, backgroundColor: C.bg },
  rollBtnOff: { opacity: 0.4 },
  rollBtnTxt: { fontSize: 14, fontWeight: '500', color: C.text },

  // Vertical slots (portrait, centered)
  slotScroll: { flex: 1 },
  slot: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 4,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: C.border,
    backgroundColor: C.bg,
    paddingHorizontal: 14,
  },
  slotFilled:  { backgroundColor: C.bg2 },
  slotActive:  { backgroundColor: C.goldBg, borderColor: C.gold },
  slotDim:     { opacity: 0.35 },
  slotIdx:     { fontSize: 12, color: C.text3, width: 24, fontWeight: '500' },
  slotCenter:  { flex: 1, alignItems: 'center' },
  slotVal:     { fontSize: 16, fontWeight: '600', color: C.text },
  slotPH:      { fontSize: 12, color: C.text3 },
  slotPHActive:{ color: C.goldD, fontWeight: '500' },

  endActions: { paddingHorizontal: 20, paddingVertical: 16, gap: 10 },
  newGameBtn: { paddingVertical: 13, borderRadius: 10, backgroundColor: C.goldBg, borderWidth: 0.5, borderColor: C.gold, alignItems: 'center' },
  newGameTxt: { fontSize: 14, fontWeight: '600', color: C.goldD },
  menuBtn:    { paddingVertical: 11, borderRadius: 10, borderWidth: 0.5, borderColor: C.border, alignItems: 'center' },
  menuBtnTxt: { fontSize: 14, color: C.text2 },

  backBtn: { paddingVertical: 4, paddingHorizontal: 2 },
  backTxt: { fontSize: 14, color: C.info },
});
