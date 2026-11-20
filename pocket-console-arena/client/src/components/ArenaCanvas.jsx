import { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import { soundEngine } from '../utils/sound';

function getSpawnPosition(slot, width, height, gameMode) {
  if (gameMode === 'street_rush') {
    const laneCount = 4;
    const laneWidth = (width * 0.64) / laneCount;
    const roadLeft = width * 0.18;
    const laneIdx = (slot - 1) % laneCount;
    return {
      x: roadLeft + laneWidth * (laneIdx + 0.5),
      y: height * 0.78,
    };
  }

  const spots = [
    { x: width * 0.25, y: height * 0.3 },
    { x: width * 0.75, y: height * 0.3 },
    { x: width * 0.25, y: height * 0.7 },
    { x: width * 0.75, y: height * 0.7 },
  ];
  return spots[(slot - 1) % spots.length] || { x: width / 2, y: height / 2 };
}

function createMeteor(width, height) {
  const edge = Math.floor(Math.random() * 4);
  let startX = 0;
  let startY = 0;

  if (edge === 0) {
    startX = 40 + Math.random() * (width - 80);
    startY = -16;
  } else if (edge === 1) {
    startX = width + 16;
    startY = 40 + Math.random() * (height - 80);
  } else if (edge === 2) {
    startX = 40 + Math.random() * (width - 80);
    startY = height + 16;
  } else {
    startX = -16;
    startY = 40 + Math.random() * (height - 80);
  }

  const targetX = width * 0.15 + Math.random() * (width * 0.7);
  const targetY = height * 0.15 + Math.random() * (height * 0.7);
  const angle = Math.atan2(targetY - startY, targetX - startX);
  const speed = 290 + Math.random() * 190;

  return {
    id: Math.random().toString(36).slice(2, 8),
    x: startX,
    y: startY,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    radius: 13,
    warningTimer: 0.45,
  };
}

function createTrafficItem(width, isCoin = false) {
  const laneCount = 4;
  const roadLeft = width * 0.18;
  const roadWidth = width * 0.64;
  const laneWidth = roadWidth / laneCount;
  const lane = Math.floor(Math.random() * laneCount);
  const centerX = roadLeft + laneWidth * (lane + 0.5);

  if (isCoin) {
    return {
      id: Math.random().toString(36).slice(2, 8),
      x: centerX,
      y: -18,
      radius: 9,
      kind: 'coin',
    };
  }

  const isCar = Math.random() > 0.35;
  return {
    id: Math.random().toString(36).slice(2, 8),
    x: centerX,
    y: -36,
    w: isCar ? 34 : 42,
    h: isCar ? 50 : 22,
    speedFactor: isCar ? 1.15 : 1.0,
    kind: isCar ? 'car' : 'barrier',
  };
}

function drawCharacterShape(ctx, p, isPlaying, timeLeft, now) {
  if (p.invulnTimer > 0 && Math.floor(now / 90) % 2 === 0) {
    ctx.globalAlpha = 0.45;
  }

  if ((p.inputs.action || p.dashTimer > 0) && isPlaying && timeLeft > 0) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius + (p.dashTimer > 0 ? 11 : 7), 0, Math.PI * 2);
    ctx.strokeStyle = p.dashTimer > 0 ? '#38bdf8' : p.color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.globalAlpha = p.invulnTimer > 0 && Math.floor(now / 90) % 2 === 0 ? 0.45 : 1;
  }

  const charType = p.character || 'racer';
  ctx.save();
  ctx.translate(p.x, p.y);

  if (charType === 'cyber') {
    ctx.fillStyle = p.color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-18, -18, 36, 36, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-12, -5, 24, 7);
  } else if (charType === 'turbo') {
    ctx.fillStyle = p.color;
    ctx.fillRect(-26, -5, 52, 10);

    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  } else if (charType === 'nitro') {
    ctx.beginPath();
    ctx.moveTo(0, -23);
    ctx.lineTo(22, 0);
    ctx.lineTo(0, 23);
    ctx.lineTo(-22, 0);
    ctx.closePath();
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(p.facingX * 7, p.facingY * 7, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fef08a';
    ctx.fill();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

export default function ArenaCanvas({
  players,
  roomCode,
  isPlaying,
  roundKey,
  gameMode = 'orb_hunt',
  duration = 60,
  onScoreUpdate,
  onTimeUp,
}) {
  const canvasRef = useRef(null);
  const entitiesRef = useRef({});
  const orbsRef = useRef([]);
  const meteorsRef = useRef([]);
  const trafficRef = useRef([]);
  const coinsRef = useRef([]);
  const roadScrollRef = useRef(0);
  const [timeLeft, setTimeLeft] = useState(duration);
  const finishedRef = useRef(false);
  const survivalTickRef = useRef(0);
  const meteorSpawnRef = useRef(0);
  const trafficSpawnRef = useRef(0);
  const coinSpawnRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const w = canvas?.width || 840;
    const h = canvas?.height || 460;

    const current = entitiesRef.current;
    const activeIds = new Set(players.map((p) => p.id));

    Object.keys(current).forEach((id) => {
      if (!activeIds.has(id)) delete current[id];
    });

    players.forEach((p, idx) => {
      const slot = p.slot || idx + 1;
      if (!current[p.id]) {
        const spawn = getSpawnPosition(slot, w, h, gameMode);
        current[p.id] = {
          id: p.id,
          name: p.name,
          color: p.color,
          character: p.character || 'racer',
          slot,
          x: spawn.x,
          y: spawn.y,
          vx: 0,
          vy: 0,
          facingX: 0,
          facingY: gameMode === 'street_rush' ? -1 : 1,
          dashTimer: 0,
          dashCooldown: 0,
          tagCooldown: 0,
          invulnTimer: 0,
          isIt: false,
          radius: 20,
          score: 0,
          inputs: {
            up: false,
            down: false,
            left: false,
            right: false,
            action: false,
            dash: false,
          },
        };
      } else {
        current[p.id].name = p.name;
        current[p.id].color = p.color;
        current[p.id].character = p.character || current[p.id].character;
        current[p.id].slot = slot;
      }
    });

    const allEntities = Object.values(current);
    if (gameMode === 'tag_arena' && allEntities.length > 0) {
      const hasIt = allEntities.some((e) => e.isIt);
      if (!hasIt) {
        allEntities[0].isIt = true;
      }
    } else if (gameMode !== 'tag_arena') {
      allEntities.forEach((e) => {
        e.isIt = false;
      });
    }
  }, [players, gameMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const w = canvas?.width || 840;
    const h = canvas?.height || 460;

    finishedRef.current = false;
    survivalTickRef.current = 0;
    meteorSpawnRef.current = 0;
    trafficSpawnRef.current = 0;
    coinSpawnRef.current = 0;
    roadScrollRef.current = 0;
    meteorsRef.current = [];
    trafficRef.current = [];
    coinsRef.current = [];
    setTimeLeft(duration);

    const list = Object.values(entitiesRef.current);
    list.forEach((entity, idx) => {
      const spawn = getSpawnPosition(entity.slot, w, h, gameMode);
      entity.x = spawn.x;
      entity.y = spawn.y;
      entity.vx = 0;
      entity.vy = 0;
      entity.facingX = 0;
      entity.facingY = gameMode === 'street_rush' ? -1 : 1;
      entity.dashTimer = 0;
      entity.dashCooldown = 0;
      entity.tagCooldown = 0;
      entity.invulnTimer = 0;
      entity.isIt = gameMode === 'tag_arena' && idx === 0;
      entity.score = 0;
      entity.inputs = {
        up: false,
        down: false,
        left: false,
        right: false,
        action: false,
        dash: false,
      };
    });

    orbsRef.current =
      gameMode === 'orb_hunt'
        ? Array.from({ length: 6 }, () => ({
            id: Math.random().toString(36).slice(2, 8),
            x: 60 + Math.random() * (w - 120),
            y: 60 + Math.random() * (h - 120),
            radius: 10,
          }))
        : [];

    if (onScoreUpdate) {
      onScoreUpdate(
        list.map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          score: 0,
        }))
      );
    }
  }, [roundKey, gameMode, duration, onScoreUpdate]);

  useEffect(() => {
    if (!isPlaying) return;
    if (timeLeft <= 0) {
      if (!finishedRef.current) {
        finishedRef.current = true;
        soundEngine.stopBgm();
        soundEngine.playGameOver();
        const finalList = Object.values(entitiesRef.current).map((p) => ({
          id: p.id,
          name: p.name,
          color: p.color,
          score: p.score,
        }));
        onTimeUp?.(finalList);
      }
      return;
    }

    const timerId = window.setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isPlaying, timeLeft, onTimeUp]);

  useEffect(() => {
    const onPlayerInput = ({ playerId, button, pressed }) => {
      const entity = entitiesRef.current[playerId];
      if (!entity) return;
      if (button in entity.inputs) {
        entity.inputs[button] = Boolean(pressed);
      }
    };

    socket.on('player_input', onPlayerInput);
    return () => socket.off('player_input', onPlayerInput);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animId;
    let lastTime = performance.now();

    const spawnOrb = () => ({
      id: Math.random().toString(36).slice(2, 8),
      x: 60 + Math.random() * (canvas.width - 120),
      y: 60 + Math.random() * (canvas.height - 120),
      radius: 10,
    });

    const loop = (now) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const w = canvas.width;
      const h = canvas.height;
      const list = Object.values(entitiesRef.current);

      if (gameMode === 'street_rush') {
        const roadLeft = w * 0.18;
        const roadWidth = w * 0.64;
        const laneWidth = roadWidth / 4;

        ctx.fillStyle = '#064e3b';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(roadLeft, 0, roadWidth, h);

        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(roadLeft - 4, 0, 4, h);
        ctx.fillRect(roadLeft + roadWidth, 0, 4, h);

        ctx.strokeStyle = 'rgba(248, 250, 252, 0.35)';
        ctx.setLineDash([22, 22]);
        ctx.lineDashOffset = -roadScrollRef.current;
        ctx.lineWidth = 2;
        for (let l = 1; l < 4; l++) {
          const lx = roadLeft + laneWidth * l;
          ctx.beginPath();
          ctx.moveTo(lx, 0);
          ctx.lineTo(lx, h);
          ctx.stroke();
        }
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < w; gx += 40) {
          ctx.beginPath();
          ctx.moveTo(gx, 0);
          ctx.lineTo(gx, h);
          ctx.stroke();
        }
        for (let gy = 0; gy < h; gy += 40) {
          ctx.beginPath();
          ctx.moveTo(0, gy);
          ctx.lineTo(w, gy);
          ctx.stroke();
        }
      }

      if (isPlaying && timeLeft > 0) {
        let scoreChanged = false;

        if (gameMode === 'street_rush') {
          roadScrollRef.current = (roadScrollRef.current + 320 * dt) % 44;

          survivalTickRef.current += dt;
          if (survivalTickRef.current >= 1 && list.length > 0) {
            survivalTickRef.current -= 1;
            list.forEach((p) => {
              p.score += p.inputs.action ? 15 : 10;
              scoreChanged = true;
            });
          }

          trafficSpawnRef.current += dt;
          if (trafficSpawnRef.current >= 0.72) {
            trafficSpawnRef.current = 0;
            trafficRef.current.push(createTrafficItem(w, false));
          }

          coinSpawnRef.current += dt;
          if (coinSpawnRef.current >= 1.1) {
            coinSpawnRef.current = 0;
            coinsRef.current.push(createTrafficItem(w, true));
          }
        } else if (
          list.length > 0 &&
          (gameMode === 'meteor_dodge' || (gameMode === 'tag_arena' && list.length > 1))
        ) {
          survivalTickRef.current += dt;
          if (survivalTickRef.current >= 1) {
            survivalTickRef.current -= 1;
            list.forEach((p) => {
              if (gameMode === 'meteor_dodge') {
                p.score += 10;
                scoreChanged = true;
              } else if (gameMode === 'tag_arena' && !p.isIt) {
                p.score += 5;
                scoreChanged = true;
              }
            });
          }
        }

        if (gameMode === 'meteor_dodge') {
          meteorSpawnRef.current += dt;
          const spawnInterval = timeLeft < 25 ? 0.55 : 0.85;
          if (meteorSpawnRef.current >= spawnInterval) {
            meteorSpawnRef.current = 0;
            meteorsRef.current.push(createMeteor(w, h));
          }
        }

        list.forEach((p) => {
          const { up, down, left, right, action, dash } = p.inputs;
          let dx = (right ? 1 : 0) - (left ? 1 : 0);
          let dy = (down ? 1 : 0) - (up ? 1 : 0);

          if (dx !== 0 || dy !== 0) {
            const len = Math.hypot(dx, dy);
            p.facingX = dx / len;
            p.facingY = dy / len;
          }

          if (dash && (p.dashCooldown || 0) <= 0) {
            p.dashTimer = 0.16;
            p.dashCooldown = 1.4;
            p.inputs.dash = false;
            soundEngine.playDash();
          }

          p.dashTimer = Math.max(0, (p.dashTimer || 0) - dt);
          p.dashCooldown = Math.max(0, (p.dashCooldown || 0) - dt);
          p.tagCooldown = Math.max(0, (p.tagCooldown || 0) - dt);
          p.invulnTimer = Math.max(0, (p.invulnTimer || 0) - dt);

          if (p.dashTimer > 0) {
            p.vx = p.facingX * 860;
            p.vy = p.facingY * 860;
          } else {
            if (dx !== 0 && dy !== 0) {
              const inv = 1 / Math.SQRT2;
              dx *= inv;
              dy *= inv;
            }
            const baseSpeed = p.isIt ? 285 : 265;
            const speed = action ? baseSpeed + 185 : baseSpeed;
            p.vx = dx * speed;
            p.vy = dy * speed;
          }

          p.x += p.vx * dt;
          p.y += p.vy * dt;

          if (gameMode === 'street_rush') {
            const roadLeft = w * 0.18 + p.radius + 6;
            const roadRight = w * 0.82 - p.radius - 6;
            p.x = Math.max(roadLeft, Math.min(roadRight, p.x));
            p.y = Math.max(60, Math.min(h - p.radius - 10, p.y));
          } else {
            p.x = Math.max(p.radius + 8, Math.min(w - p.radius - 8, p.x));
            p.y = Math.max(p.radius + 8, Math.min(h - p.radius - 8, p.y));
          }

          if (gameMode === 'orb_hunt') {
            orbsRef.current = orbsRef.current.filter((orb) => {
              const dist = Math.hypot(p.x - orb.x, p.y - orb.y);
              if (dist < p.radius + orb.radius + 4) {
                p.score += 10;
                scoreChanged = true;
                soundEngine.playOrbPickup();
                return false;
              }
              return true;
            });

            while (orbsRef.current.length < 6) {
              orbsRef.current.push(spawnOrb());
            }
          }
        });

        if (gameMode === 'street_rush') {
          coinsRef.current = coinsRef.current.filter((c) => {
            c.y += 280 * dt;
            let collected = false;
            list.forEach((p) => {
              if (!collected && Math.hypot(p.x - c.x, p.y - c.y) < p.radius + c.radius + 4) {
                p.score += 20;
                scoreChanged = true;
                collected = true;
                soundEngine.playOrbPickup();
              }
            });
            return !collected && c.y < h + 40;
          });

          trafficRef.current = trafficRef.current.filter((item) => {
            item.y += 295 * item.speedFactor * dt;

            list.forEach((p) => {
              if (p.dashTimer > 0 || p.invulnTimer > 0) return;
              const halfW = item.w / 2;
              const halfH = item.h / 2;
              const closestX = Math.max(item.x - halfW, Math.min(p.x, item.x + halfW));
              const closestY = Math.max(item.y - halfH, Math.min(p.y, item.y + halfH));
              const dist = Math.hypot(p.x - closestX, p.y - closestY);

              if (dist < p.radius - 2) {
                p.score = Math.max(0, p.score - 15);
                p.y = Math.min(h - p.radius - 10, p.y + 32);
                p.invulnTimer = 1.1;
                scoreChanged = true;
                soundEngine.playHit();
              }
            });

            return item.y < h + 80;
          });
        }

        if (gameMode === 'meteor_dodge') {
          meteorsRef.current = meteorsRef.current.filter((m) => {
            if (m.warningTimer > 0) {
              m.warningTimer = Math.max(0, m.warningTimer - dt);
              return true;
            }

            m.x += m.vx * dt;
            m.y += m.vy * dt;

            list.forEach((p) => {
              if (p.dashTimer > 0 || p.invulnTimer > 0) return;
              const dist = Math.hypot(p.x - m.x, p.y - m.y);
              if (dist < p.radius + m.radius - 2) {
                p.score = Math.max(0, p.score - 15);
                p.invulnTimer = 1.2;
                scoreChanged = true;
                soundEngine.playHit();
              }
            });

            return m.x > -80 && m.x < w + 80 && m.y > -80 && m.y < h + 80;
          });
        }

        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const a = list[i];
            const b = list[j];
            const dist = Math.hypot(b.x - a.x, b.y - a.y);
            const minDist = a.radius + b.radius;
            if (dist > 0 && dist < minDist) {
              const overlap = (minDist - dist) / 2;
              const nx = (b.x - a.x) / dist;
              const ny = (b.y - a.y) / dist;
              a.x -= nx * overlap;
              a.y -= ny * overlap;
              b.x += nx * overlap;
              b.y += ny * overlap;

              if (gameMode === 'tag_arena') {
                if (a.isIt && !b.isIt && a.tagCooldown <= 0) {
                  a.isIt = false;
                  b.isIt = true;
                  b.tagCooldown = 1.1;
                  a.score += 15;
                  scoreChanged = true;
                  soundEngine.playTag();
                } else if (b.isIt && !a.isIt && b.tagCooldown <= 0) {
                  b.isIt = false;
                  a.isIt = true;
                  a.tagCooldown = 1.1;
                  b.score += 15;
                  scoreChanged = true;
                  soundEngine.playTag();
                }
              }
            }
          }
        }

        if (scoreChanged && onScoreUpdate) {
          onScoreUpdate(
            list.map((p) => ({
              id: p.id,
              name: p.name,
              color: p.color,
              score: p.score,
            }))
          );
        }
      }

      if (gameMode === 'orb_hunt') {
        orbsRef.current.forEach((orb) => {
          ctx.beginPath();
          ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
          ctx.fillStyle = '#fbbf24';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#fef08a';
          ctx.stroke();
        });
      }

      if (gameMode === 'street_rush') {
        coinsRef.current.forEach((c) => {
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
          ctx.fillStyle = '#facc15';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#fef9c3';
          ctx.stroke();
        });

        trafficRef.current.forEach((item) => {
          ctx.save();
          ctx.translate(item.x, item.y);
          ctx.fillStyle = item.kind === 'car' ? '#f97316' : '#94a3b8';
          ctx.strokeStyle = '#f8fafc';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-item.w / 2, -item.h / 2, item.w, item.h, 6);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });
      }

      if (gameMode === 'meteor_dodge') {
        meteorsRef.current.forEach((m) => {
          if (m.warningTimer > 0) {
            ctx.save();
            ctx.setLineDash([6, 6]);
            ctx.strokeStyle = 'rgba(251, 113, 133, 0.55)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(Math.max(0, Math.min(w, m.x)), Math.max(0, Math.min(h, m.y)));
            ctx.lineTo(m.x + m.vx * 0.35, m.y + m.vy * 0.35);
            ctx.stroke();
            ctx.restore();
          }

          ctx.beginPath();
          ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
          ctx.fillStyle = '#fb7185';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#fecdd3';
          ctx.stroke();
        });
      }

      list.forEach((p) => {
        drawCharacterShape(ctx, p, isPlaying, timeLeft, now);

        if (gameMode === 'tag_arena' && p.isIt) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 9, 0, Math.PI * 2);
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        const tagPrefix = gameMode === 'tag_arena' && p.isIt ? '[IT] ' : '';
        ctx.fillStyle = p.isIt ? '#fda4af' : '#f8fafc';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${tagPrefix}${p.name} (${p.score})`, p.x, p.y - p.radius - 10);
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, timeLeft, gameMode, onScoreUpdate]);

  const modeBadge =
    gameMode === 'street_rush'
      ? '🏎️ Street Rush'
      : gameMode === 'tag_arena'
      ? '🏃 Tag Arena'
      : gameMode === 'meteor_dodge'
      ? '☄️ Meteor Dodge'
      : '⭐ Orb Hunt';

  const toggleArenaFullscreen = () => {
    const el = canvasRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xl w-full">
      <div className="absolute top-3 left-3 z-10 px-3 py-1 rounded-xl font-semibold text-xs border bg-slate-900/85 border-slate-700 text-slate-200 backdrop-blur-xs">
        {modeBadge}
      </div>

      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <div
          className={`px-3.5 py-1.5 rounded-xl font-mono font-extrabold text-sm border backdrop-blur-xs ${
            timeLeft <= 10
              ? 'bg-rose-950/85 border-rose-500 text-rose-300 animate-pulse'
              : 'bg-slate-900/85 border-slate-700 text-amber-300'
          }`}
        >
          ⏱ {timeLeft}s
        </div>

        <button
          type="button"
          onClick={toggleArenaFullscreen}
          title="Fullscreen Layar Game"
          className="px-2.5 py-1.5 rounded-xl font-bold text-xs border bg-slate-900/85 hover:bg-slate-800 border-slate-700 text-slate-200 backdrop-blur-xs transition cursor-pointer"
        >
          ⛶ Full
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={840}
        height={460}
        className="w-full h-auto max-h-[78vh] object-contain mx-auto block"
      />

      {!isPlaying && timeLeft > 0 && (
        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6">
          <div className="text-lg font-extrabold text-white mb-1">
            Menunggu Mulai Game
          </div>
          <p className="text-xs text-slate-300 max-w-md">
            Sambungkan HP ke kode <span className="font-mono font-bold text-amber-400">{roomCode}</span>, lalu klik <strong>Mulai Mabar</strong>.
          </p>
        </div>
      )}
    </div>
  );
}