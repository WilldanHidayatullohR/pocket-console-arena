import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Gamepad2,
  Zap,
  Wind,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import { socket } from '../socket';

const ALL_BUTTONS = ['up', 'down', 'left', 'right', 'action', 'dash'];
const DASH_COOLDOWN_MS = 1500;

const CHARACTERS = [
  { id: 'racer', name: 'Racer', badge: 'bg-rose-500' },
  { id: 'cyber', name: 'Cyber', badge: 'bg-blue-500' },
  { id: 'turbo', name: 'Turbo', badge: 'bg-emerald-500' },
  { id: 'nitro', name: 'Nitro', badge: 'bg-amber-400' },
];

export default function ControllerScreen({ initialRoom = '' }) {
  const [roomCode, setRoomCode] = useState(initialRoom.toUpperCase());
  const [nickname, setNickname] = useState('');
  const [character, setCharacter] = useState('racer');
  const [joined, setJoined] = useState(false);
  const [playerInfo, setPlayerInfo] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [activeButtons, setActiveButtons] = useState({});
  const [dashCooldown, setDashCooldown] = useState(false);

  const pressedRef = useRef({});
  const dashTimeoutRef = useRef(null);

  const sendInput = useCallback(
    (button, pressed) => {
      if (!joined || !roomCode) return;
      const nextPressed = Boolean(pressed);

      if (pressedRef.current[button] === nextPressed) return;
      pressedRef.current[button] = nextPressed;

      socket.emit('controller_input', {
        roomCode,
        button,
        pressed: nextPressed,
      });

      setActiveButtons((prev) => {
        if (prev[button] === nextPressed) return prev;
        return { ...prev, [button]: nextPressed };
      });

      if (nextPressed && typeof navigator !== 'undefined' && navigator.vibrate) {
        if (button === 'dash') {
          navigator.vibrate([25, 20, 35]);
        } else if (button === 'action') {
          navigator.vibrate(40);
        } else {
          navigator.vibrate(18);
        }
      }
    },
    [joined, roomCode]
  );

  const triggerDash = useCallback(() => {
    if (!joined || !roomCode || dashCooldown) return;

    sendInput('dash', true);
    setDashCooldown(true);

    window.setTimeout(() => {
      sendInput('dash', false);
    }, 160);

    if (dashTimeoutRef.current) {
      window.clearTimeout(dashTimeoutRef.current);
    }
    dashTimeoutRef.current = window.setTimeout(() => {
      setDashCooldown(false);
    }, DASH_COOLDOWN_MS);
  }, [joined, roomCode, dashCooldown, sendInput]);

  const releaseAllInputs = useCallback(() => {
    if (!joined || !roomCode) return;
    ALL_BUTTONS.forEach((btn) => {
      if (pressedRef.current[btn]) {
        pressedRef.current[btn] = false;
        socket.emit('controller_input', {
          roomCode,
          button: btn,
          pressed: false,
        });
      }
    });
    setActiveButtons({});
  }, [joined, roomCode]);

  useEffect(() => {
    return () => {
      if (dashTimeoutRef.current) {
        window.clearTimeout(dashTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onHostClosed = () => {
      pressedRef.current = {};
      setActiveButtons({});
      setDashCooldown(false);
      setJoined(false);
      setPlayerInfo(null);
      setErrorMsg('Host (layar laptop) menutup room.');
    };

    const onDisconnect = () => {
      pressedRef.current = {};
      setActiveButtons({});
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        releaseAllInputs();
      }
    };

    const onWindowBlur = () => {
      releaseAllInputs();
    };

    socket.on('host_disconnected', onHostClosed);
    socket.on('disconnect', onDisconnect);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      socket.off('host_disconnected', onHostClosed);
      socket.off('disconnect', onDisconnect);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [releaseAllInputs]);

  const handleJoin = (e) => {
    e.preventDefault();
    setErrorMsg('');
    pressedRef.current = {};
    setActiveButtons({});
    setDashCooldown(false);

    socket.emit(
      'join_room',
      { roomCode, nickname, character },
      (res) => {
        if (!res?.ok) {
          setErrorMsg(res?.message || 'Gagal masuk room.');
          return;
        }
        setJoined(true);
        setPlayerInfo(res.player);
        setRoomCode(res.roomCode);
      }
    );
  };

  const handleLeave = () => {
    releaseAllInputs();
    setDashCooldown(false);
    setJoined(false);
    setPlayerInfo(null);
    setErrorMsg('');
  };

  const bindButton = (button) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      sendInput(button, true);
    },
    onPointerUp: (e) => {
      e.preventDefault();
      sendInput(button, false);
    },
    onPointerCancel: () => sendInput(button, false),
    onContextMenu: (e) => e.preventDefault(),
  });

  if (!joined) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 select-none">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Gamepad2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Stik HP Controller</h1>
              <p className="text-xs text-slate-400">Masukkan kode room dari layar laptop</p>
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Kode Room
              </label>
              <input
                type="text"
                maxLength={8}
                placeholder="Contoh: PS-482"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-center text-lg font-mono font-bold tracking-widest uppercase focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Nama Panggilan (Opsional)
              </label>
              <input
                type="text"
                maxLength={14}
                placeholder="Misal: Wildan"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Pilih Karakter
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CHARACTERS.map((c) => {
                  const active = character === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCharacter(c.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        active
                          ? 'bg-slate-800 border-indigo-400 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ${c.badge}`} />
                      <span>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-400 bg-rose-950/50 border border-rose-800/60 rounded-xl p-2.5 text-center">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99] font-bold text-sm transition cursor-pointer"
            >
              Masuk ke Room
            </button>
          </form>
        </div>
      </div>
    );
  }

  const dpadBtnClass = (btn) =>
    `w-16 h-16 rounded-2xl flex items-center justify-center border transition touch-none ${
      activeButtons[btn]
        ? 'bg-indigo-600 border-indigo-400 scale-95 text-white'
        : 'bg-slate-800/90 border-slate-700 text-slate-200 active:bg-slate-700'
    }`;

  const isBoostActive = Boolean(activeButtons.action);
  const isDashActive = Boolean(activeButtons.dash);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 select-none touch-none overflow-hidden">
      {/* Top Bar Info Pemain */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span
            className="w-4 h-4 rounded-full border border-white/30"
            style={{ backgroundColor: playerInfo?.color || '#3b82f6' }}
          />
          <span className="text-sm font-bold">{playerInfo?.name}</span>
          {playerInfo?.character && (
            <span className="text-[11px] uppercase px-2 py-0.5 rounded-md bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 font-semibold">
              {playerInfo.character}
            </span>
          )}
          <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
            {roomCode}
          </span>
        </div>

        <button
          type="button"
          onClick={handleLeave}
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-400 px-2 py-1 rounded-lg"
        >
          <LogOut className="w-3.5 h-3.5" />
          Keluar
        </button>
      </div>

      {/* Area Stik Kiri (D-Pad) & Kanan (DASH + BOOST) */}
      <div className="flex-1 flex items-center justify-between px-2 sm:px-8 max-w-4xl w-full mx-auto gap-6">
        {/* D-Pad Kiri */}
        <div className="grid grid-cols-3 gap-2 place-items-center">
          <div />
          <button type="button" className={dpadBtnClass('up')} {...bindButton('up')}>
            <ArrowUp className="w-7 h-7" />
          </button>
          <div />

          <button type="button" className={dpadBtnClass('left')} {...bindButton('left')}>
            <ArrowLeft className="w-7 h-7" />
          </button>
          <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-slate-700" />
          </div>
          <button type="button" className={dpadBtnClass('right')} {...bindButton('right')}>
            <ArrowRight className="w-7 h-7" />
          </button>

          <div />
          <button type="button" className={dpadBtnClass('down')} {...bindButton('down')}>
            <ArrowDown className="w-7 h-7" />
          </button>
          <div />
        </div>

        {/* Tombol Aksi Kanan: DASH & BOOST */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              disabled={dashCooldown}
              onPointerDown={(e) => {
                e.preventDefault();
                triggerDash();
              }}
              onContextMenu={(e) => e.preventDefault()}
              className={`w-18 h-18 rounded-full flex flex-col items-center justify-center gap-0.5 font-extrabold text-[11px] border-2 transition touch-none ${
                dashCooldown
                  ? 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
                  : isDashActive
                  ? 'bg-sky-400 border-sky-200 scale-95 text-slate-950'
                  : 'bg-sky-600/90 border-sky-400/50 text-white shadow-md shadow-sky-950/60'
              }`}
            >
              <Wind className="w-5 h-5" />
              <span>{dashCooldown ? 'WAIT' : 'DASH'}</span>
            </button>
            <span className="text-[10px] text-slate-400">Loncat kilat</span>
          </div>

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              {...bindButton('action')}
              className={`w-28 h-28 rounded-full flex flex-col items-center justify-center gap-1 font-extrabold text-sm border-4 transition touch-none ${
                isBoostActive
                  ? 'bg-emerald-500 border-emerald-200 scale-95 text-slate-950'
                  : 'bg-emerald-600/90 border-emerald-400/50 text-white shadow-lg shadow-emerald-950/60'
              }`}
            >
              <Zap className="w-8 h-8" />
              <span>BOOST</span>
            </button>
            <span className="text-[11px] text-slate-400">Tahan ngebut</span>
          </div>
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-500">
        Putar HP ke mode landscape biar makin nyaman digenggam kayak stik PS
      </div>
    </div>
  );
}