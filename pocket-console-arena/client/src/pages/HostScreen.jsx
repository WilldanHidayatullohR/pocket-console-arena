import { useState, useEffect, useCallback } from 'react';
import {
  Tv,
  Users,
  Play,
  Pause,
  RotateCcw,
  Smartphone,
  Wifi,
  Trophy,
  QrCode,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { socket } from '../socket';
import { soundEngine } from '../utils/sound';
import ArenaCanvas from '../components/ArenaCanvas';

const ROUND_DURATION = 60;

export default function HostScreen() {
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState([]);
  const [scores, setScores] = useState([]);
  const [gameMode, setGameMode] = useState('orb_hunt');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [roundKey, setRoundKey] = useState(0);
  const [connected, setConnected] = useState(socket.connected);
  const [muted, setMuted] = useState(false);

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const isLocalhost = currentHost === 'localhost' || currentHost === '127.0.0.1';
  const [lanIp, setLanIp] = useState('192.168.1.6');

useEffect(() => {
    const requestRoom = () => {
      socket.emit('create_room', (res) => {
        if (res?.roomCode) {
          setRoomCode(res.roomCode);
        }
      });
    };

    const onConnect = () => {
      setConnected(true);
      requestRoom();
    };

    const onDisconnect = () => {
      setConnected(false);
      soundEngine.stopBgm();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      requestRoom();
    } else {
      socket.connect?.();
    }

    // Fallback kalau callback belum sempat balik dalam 1.5 detik
    const fallbackTimer = window.setTimeout(() => {
      setRoomCode((prev) => {
        if (prev) return prev;
        const num = Math.floor(100 + Math.random() * 900);
        return `PS-${num}`;
      });
    }, 1500);

    const onPlayersUpdated = (list) => {
      setPlayers(list);
      setScores((prev) =>
        list.map((p) => {
          const found = prev.find((s) => s.id === p.id);
          return { id: p.id, name: p.name, color: p.color, score: found?.score || 0 };
        })
      );
    };

    socket.on('players_updated', onPlayersUpdated);
    return () => {
      window.clearTimeout(fallbackTimer);
      soundEngine.stopBgm();
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('players_updated', onPlayersUpdated);
    };
  }, []);

  const togglePlay = () => {
    if (isGameOver) return;
    soundEngine.unlock();

    const next = !isPlaying;
    setIsPlaying(next);

    if (next) {
      soundEngine.startBgm(gameMode);
    } else {
      soundEngine.stopBgm();
    }

    if (roomCode) {
      socket.emit('game_state_change', {
        roomCode,
        status: next ? 'playing' : 'lobby',
      });
    }
  };

  const handleResetRound = useCallback(() => {
    soundEngine.unlock();
    soundEngine.stopBgm();
    setIsPlaying(false);
    setIsGameOver(false);
    setRoundKey((k) => k + 1);
    if (roomCode) {
      socket.emit('reset_round', { roomCode });
    }
  }, [roomCode]);

  const handleTimeUp = useCallback(
    (finalScores) => {
      soundEngine.stopBgm();
      setIsPlaying(false);
      setIsGameOver(true);
      if (Array.isArray(finalScores) && finalScores.length > 0) {
        setScores(finalScores);
      }
      if (roomCode) {
        socket.emit('game_state_change', {
          roomCode,
          status: 'finished',
        });
      }
    },
    [roomCode]
  );

  const handleModeChange = (nextMode) => {
    setGameMode(nextMode);
    soundEngine.stopBgm();
    setIsPlaying(false);
    setIsGameOver(false);
    setRoundKey((k) => k + 1);
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    soundEngine.setMuted(nextMuted);
    if (!nextMuted && isPlaying && !isGameOver) {
      soundEngine.startBgm(gameMode);
    }
  };

  const sortedLeaderboard = [...scores].sort((a, b) => b.score - a.score);
  const topScore = sortedLeaderboard[0]?.score ?? 0;
  const winners =
    topScore > 0 ? sortedLeaderboard.filter((item) => item.score === topScore) : [];

  const port = typeof window !== 'undefined' ? window.location.port || '5173' : '5173';
  const effectiveHost = isLocalhost ? (lanIp.trim() || '192.168.1.6') : currentHost;
  const controllerUrl = `http://${effectiveHost}:${port}/?mode=controller&room=${roomCode}`;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-5">
      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Control Bar Atas Ramping */}
        <header className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3">
          <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-300">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-semibold ${
                connected
                  ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                  : 'bg-rose-950/70 border-rose-700/60 text-rose-300'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              {connected ? 'Socket Aktif' : 'Terputus'}
            </span>

            <span className="hidden sm:inline-flex items-center gap-1.5 text-slate-400">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="font-mono text-slate-200">{controllerUrl}</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={gameMode}
              onChange={(e) => handleModeChange(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="orb_hunt">Mode: Orb Hunt</option>
              <option value="tag_arena">Mode: Tag Arena</option>
              <option value="meteor_dodge">Mode: Meteor Dodge</option>
              <option value="street_rush">Mode: Street Rush</option>
            </select>

            <button
              type="button"
              onClick={toggleMute}
              title={muted ? 'Nyalakan Musik' : 'Bisukan Musik'}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
            >
              {muted ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            <div className="bg-slate-950 border border-slate-700 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-400">Room</span>
              <span className="text-base font-mono font-extrabold text-amber-400 tracking-widest">
                {roomCode || '...'}
              </span>
            </div>

            <button
              type="button"
              disabled={isGameOver}
              onClick={togglePlay}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs md:text-sm transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isPlaying
                  ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isPlaying ? 'Jeda Game' : 'Mulai Mabar'}
            </button>

            <button
              type="button"
              onClick={handleResetRound}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs md:text-sm font-medium transition cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              Reset Ronde
            </button>
          </div>
        </header>

        {/* Area Utama: Layar Game Full/Lebar + Sidebar Kanan */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          <main className="xl:col-span-9 relative">
            <ArenaCanvas
              players={players}
              roomCode={roomCode}
              isPlaying={isPlaying}
              roundKey={roundKey}
              gameMode={gameMode}
              duration={ROUND_DURATION}
              onScoreUpdate={setScores}
              onTimeUp={handleTimeUp}
            />

            {isGameOver && (
              <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs rounded-2xl flex flex-col items-center justify-center p-6 text-center z-20">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-300 mb-3">
                  <Trophy className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-extrabold text-white">Waktu Habis!</h2>
                <p className="text-sm text-amber-300 font-semibold mt-1">
                  {winners.length > 0
                    ? `Pemenang: ${winners.map((w) => w.name).join(' & ')} (${topScore} pts)`
                    : 'Belum ada skor terkumpul di ronde ini'}
                </p>

                <div className="w-full max-w-xs mt-4 space-y-1.5">
                  {sortedLeaderboard.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between bg-slate-900/95 border border-slate-800 rounded-xl px-3.5 py-2 text-xs"
                    >
                      <span className="font-bold text-slate-200">
                        #{index + 1} {item.name}
                      </span>
                      <span className="font-mono font-extrabold text-amber-400">
                        {item.score} pts
                      </span>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={handleResetRound}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold text-sm text-white transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Main Ronde Baru
                </button>
              </div>
            )}
          </main>

          {/* Sidebar Kanan: Judul Host + QR Code + Pemain */}
          <aside className="xl:col-span-3 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
                <Tv className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-extrabold tracking-tight truncate">
                  Pocket Console Arena
                </h1>
                <p className="text-[11px] text-slate-400 truncate">Layar Host</p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-emerald-400" />
                  Scan QR Jadi Stik HP
                </h2>
                <span className="text-[11px] font-mono text-amber-400">{roomCode}</span>
              </div>

              {roomCode ? (
                <div className="flex flex-col items-center bg-white p-3 rounded-xl w-fit mx-auto shadow-md">
                  <QRCodeSVG value={controllerUrl} size={136} />
                </div>
              ) : (
                <div className="h-36 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-xs text-slate-500">
                  Menyiapkan QR...
                </div>
              )}

              {isLocalhost && (
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    IP Wi-Fi Laptop (buat QR di HP)
                  </label>
                  <input
                    type="text"
                    value={lanIp}
                    onChange={(e) => setLanIp(e.target.value)}
                    placeholder="192.168.1.6"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <p className="text-[11px] text-slate-400 text-center">
                Arahkan kamera HP (satu Wi-Fi) ke QR di atas buat langsung buka stik.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-400" />
                Pemain Terhubung ({players.length}/4)
              </h2>

              {players.length === 0 ? (
                <div className="text-xs text-slate-400 bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 text-center">
                  Belum ada HP yang masuk. Scan QR atau masukkan kode{' '}
                  <span className="font-mono font-bold text-amber-400">{roomCode}</span> di HP.
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedLeaderboard.map((p, idx) => {
                    const playerMeta = players.find((pl) => pl.id === p.id);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-xs font-mono text-slate-500 w-4">#{idx + 1}</span>
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                            style={{ backgroundColor: p.color }}
                          />
                          <div className="truncate">
                            <div className="text-xs font-bold truncate">{p.name}</div>
                            {playerMeta?.character && (
                              <div className="text-[10px] uppercase tracking-wide text-slate-400">
                                {playerMeta.character}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-xs font-mono font-extrabold text-amber-400 shrink-0 ml-2">
                          {p.score} pts
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}