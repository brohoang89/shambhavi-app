'use strict';

/* =========================================================
   1. DỮ LIỆU CÁC BƯỚC
   ========================================================= */
const WARMUP_STEPS = [
  { id: 'vay-canh-buom', name: 'Vẫy cánh bướm', seconds: 135, audio: 'next-vay-canh-buom.mp3' },
  { id: 'ru-em-phai', name: 'Ru em – chân phải', seconds: 135, audio: 'next-ru-em-phai.mp3' },
  { id: 'ru-em-trai', name: 'Ru em – chân trái', seconds: 135, audio: 'next-ru-em-trai.mp3' },
  { id: 'meo-ruon', name: 'Mèo rướn', seconds: 270, audio: 'next-meo-ruon.mp3' },
];

const MAIN_STEPS = [
  { id: 'tho-luan-phien', name: 'Thở luân phiên', seconds: 420, audio: 'next-tho-luan-phien.mp3' },
  { id: 'phat-am-aum', name: 'Phát âm AUM', isAUM: true, audio: 'next-phat-am-aum.mp3' },
  { id: 'tho-rung-dong', name: 'Thở rung động', seconds: 240, audio: 'next-tho-rung-dong.mp3' },
  { id: 'khoa-bandhas', name: 'Khóa Bandhas', seconds: 120, audio: 'next-khoa-bandhas.mp3' },
  { id: 'tha-long', name: 'Thả lỏng, quan sát hơi thở', seconds: 360, audio: 'next-tha-long.mp3' },
];

const END_AUDIO = 'end-hoan-thanh.mp3';

const LS_SESSIONS = 'shambhavi_sessions_v1';
const LS_LAST_X = 'shambhavi_last_x_v1';

const RING_R = 92;
const RING_CIRC = 2 * Math.PI * RING_R;

/* =========================================================
   2. TIỆN ÍCH CHUNG
   ========================================================= */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatMMSS(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function formatDurationVN(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} giờ ${m} phút`;
  if (m > 0) return `${m} phút ${sec} giây`;
  return `${sec} giây`;
}

function formatDateVN(isoString) {
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* =========================================================
   3. CHUÔNG TỔNG HỢP BẰNG WEB AUDIO API (không cần file)
   ========================================================= */
let audioCtx = null;

function ensureAudioContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Chuông lớn — dùng khi chuyển động tác & kết thúc bài tập. Âm ấm, ngân dài.
function playBigBell() {
  const ctx = ensureAudioContext();
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.34;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2600;
  out.connect(filter);
  filter.connect(ctx.destination);

  const baseFreq = 216;
  const partials = [
    { ratio: 1, amp: 1, decay: 2.3 },
    { ratio: 2.01, amp: 0.55, decay: 1.9 },
    { ratio: 2.76, amp: 0.35, decay: 1.5 },
    { ratio: 3.9, amp: 0.22, decay: 1.1 },
    { ratio: 5.4, amp: 0.12, decay: 0.8 },
  ];
  partials.forEach((p) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = baseFreq * p.ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(p.amp, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + p.decay + 0.05);
  });
}

// Chuông nhỏ — dùng riêng cho các nhịp A/U/M/Hít vào trong bước AUM. Âm cao, ngắn, rõ ràng khác biệt.
function playSmallBell() {
  const ctx = ensureAudioContext();
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.26;
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 300;
  out.connect(filter);
  filter.connect(ctx.destination);

  const baseFreq = 880;
  const partials = [
    { ratio: 1, amp: 1, decay: 0.55 },
    { ratio: 2.4, amp: 0.4, decay: 0.35 },
    { ratio: 3.1, amp: 0.2, decay: 0.22 },
  ];
  partials.forEach((p) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = baseFreq * p.ratio;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(p.amp, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);
    osc.connect(g);
    g.connect(out);
    osc.start(now);
    osc.stop(now + p.decay + 0.05);
  });
}

/* =========================================================
   4. PHÁT AUDIO GIỌNG NÓI (file do người dùng cung cấp)
   ========================================================= */
function playVoice(filename) {
  return new Promise((resolve) => {
    if (!filename) {
      resolve();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const audio = new Audio(`audio/${filename}`);
    audio.addEventListener('ended', finish);
    audio.addEventListener('error', () => setTimeout(finish, 900));
    audio.play().catch(() => setTimeout(finish, 900));
    // an toàn: nếu file quá dài hoặc bị treo, vẫn tiếp tục sau tối đa 15s
    setTimeout(finish, 15000);
  });
}

async function announceMainStep(step) {
  playBigBell();
  await sleep(550);
  await playVoice(step.audio);
}

async function playEndingSequence() {
  for (let i = 0; i < 3; i++) {
    playBigBell();
    await sleep(650);
  }
  await sleep(400);
  await playVoice(END_AUDIO);
}

/* =========================================================
   5. WAKE LOCK (giữ sáng màn hình trong lúc tập)
   ========================================================= */
let wakeLockRef = null;
let isSessionActive = false;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLockRef = await navigator.wakeLock.request('screen');
    }
  } catch (e) {
    /* không có wake lock cũng không sao, chỉ mất tính năng phụ trợ */
  }
}

function releaseWakeLock() {
  try {
    if (wakeLockRef) wakeLockRef.release();
  } catch (e) { /* ignore */ }
  wakeLockRef = null;
}

document.addEventListener('visibilitychange', async () => {
  if (isSessionActive && document.visibilityState === 'visible' && !wakeLockRef) {
    await requestWakeLock();
  }
});

window.addEventListener('beforeunload', (e) => {
  if (isSessionActive) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* =========================================================
   6. LƯU TRỮ: LỊCH SỬ TẬP & GIÁ TRỊ X GẦN NHẤT
   ========================================================= */
function loadSessions() {
  try {
    return JSON.parse(localStorage.getItem(LS_SESSIONS) || '[]');
  } catch (e) {
    return [];
  }
}

function saveSessionRecord(record) {
  const list = loadSessions();
  list.push(record);
  localStorage.setItem(LS_SESSIONS, JSON.stringify(list));
}

function loadLastX() {
  const v = parseInt(localStorage.getItem(LS_LAST_X), 10);
  return Number.isFinite(v) && v > 0 ? v : 5;
}

function saveLastX(v) {
  localStorage.setItem(LS_LAST_X, String(v));
}

function computeStats(sessions) {
  const now = new Date();
  const total = sessions.length;
  const weekAgoMs = now.getTime() - 7 * 24 * 3600 * 1000;
  const week = sessions.filter((s) => new Date(s.date).getTime() >= weekAgoMs).length;
  const month = sessions.filter((s) => {
    const d = new Date(s.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  return { total, week, month };
}

/* =========================================================
   7. ĐIỀU HƯỚNG MÀN HÌNH
   ========================================================= */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('screen-active'));
  document.getElementById(`screen-${name}`).classList.add('screen-active');
  window.scrollTo(0, 0);
}

/* =========================================================
   8. MÀN HÌNH TRANG CHỦ
   ========================================================= */
function renderHome() {
  const stats = computeStats(loadSessions());
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-week').textContent = stats.week;
  document.getElementById('stat-month').textContent = stats.month;
  updateOfflineNote();
}

function updateOfflineNote() {
  const el = document.getElementById('offline-note');
  if (!('serviceWorker' in navigator)) {
    el.textContent = '';
    return;
  }
  if (navigator.serviceWorker.controller) {
    el.textContent = 'Đã sẵn sàng để dùng khi không có mạng.';
  } else {
    el.textContent = 'Đang chuẩn bị dữ liệu ngoại tuyến…';
  }
}

/* =========================================================
   9. MÀN HÌNH THIẾT LẬP
   ========================================================= */
let selectedMode = null;

function openSetupScreen() {
  ensureAudioContext(); // mở khoá audio sớm bằng thao tác chạm của người dùng
  selectedMode = null;
  document.querySelectorAll('.choice-card').forEach((c) => c.classList.remove('selected'));
  document.getElementById('btn-confirm-start').disabled = true;
  document.getElementById('input-x').value = loadLastX();
  showScreen('setup');
}

function wireSetupScreen() {
  document.querySelectorAll('.choice-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.choice-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedMode = card.dataset.mode;
      document.getElementById('btn-confirm-start').disabled = false;
    });
  });

  document.getElementById('btn-confirm-start').addEventListener('click', () => {
    if (!selectedMode) return;
    let xValue = parseInt(document.getElementById('input-x').value, 10);
    if (!Number.isFinite(xValue) || xValue < 1) xValue = 5;
    saveLastX(xValue);
    ensureAudioContext();
    startSession(selectedMode, xValue);
  });

  document.getElementById('btn-setup-back').addEventListener('click', () => {
    showScreen('home');
  });
}

/* =========================================================
   10. ENGINE BUỔI TẬP
   ========================================================= */
function buildStepList(mode) {
  const list = [];
  if (mode === 'full') list.push(...WARMUP_STEPS.map((s) => ({ ...s })));
  list.push(...MAIN_STEPS.map((s) => ({ ...s })));
  return list;
}

function aumTotalSeconds(x) {
  return 21 * (3 * x + 4);
}

function setStepNameUI(text) {
  document.getElementById('session-step-name').textContent = text;
}
function setPhaseLabelUI(text) {
  document.getElementById('session-phase').textContent = text;
}
function updateProgressLabel(idx, total) {
  document.getElementById('session-progress').textContent = `Bước ${idx}/${total}`;
}

function updateTimerUI(remainingSeconds, totalSeconds) {
  const circleEl = document.getElementById('timer-progress-circle');
  const frac = totalSeconds > 0 ? Math.min(1, Math.max(0, remainingSeconds / totalSeconds)) : 0;
  const offset = RING_CIRC * (1 - frac);
  circleEl.style.strokeDashoffset = String(offset);
  document.getElementById('timer-number').textContent = formatMMSS(remainingSeconds);
}

function runCountdown(totalSeconds) {
  return new Promise((resolve) => {
    const start = performance.now();
    const durationMs = totalSeconds * 1000;
    function frame(now) {
      const elapsed = now - start;
      const remainingMs = Math.max(0, durationMs - elapsed);
      updateTimerUI(remainingMs / 1000, totalSeconds);
      if (remainingMs <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

async function runAUMStep(xValue) {
  const phases = [
    { label: 'Phát âm A', seconds: xValue },
    { label: 'Phát âm U', seconds: xValue },
    { label: 'Phát âm M', seconds: xValue },
    { label: 'Hít vào', seconds: 4 },
  ];
  for (let cycle = 1; cycle <= 21; cycle++) {
    for (const phase of phases) {
      setPhaseLabelUI(`${phase.label} · chu kỳ ${cycle}/21`);
      playSmallBell();
      await runCountdown(phase.seconds);
    }
  }
}

async function startSession(mode, xValue) {
  const steps = buildStepList(mode);
  showScreen('session');
  isSessionActive = true;
  await requestWakeLock();

  const sessionStartDate = new Date();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    updateProgressLabel(i + 1, steps.length);
    setPhaseLabelUI('');
    setStepNameUI(step.name);
    updateTimerUI(step.isAUM ? aumTotalSeconds(xValue) : step.seconds, step.isAUM ? aumTotalSeconds(xValue) : step.seconds);

    await announceMainStep(step);

    if (step.isAUM) {
      await runAUMStep(xValue);
    } else {
      await runCountdown(step.seconds);
    }
  }

  setPhaseLabelUI('');
  setStepNameUI('Hoàn thành');
  await playEndingSequence();

  isSessionActive = false;
  releaseWakeLock();

  const totalActualSeconds = Math.round((Date.now() - sessionStartDate.getTime()) / 1000);
  saveSessionRecord({
    date: sessionStartDate.toISOString(),
    mode,
    xValue,
    totalSeconds: totalActualSeconds,
  });

  showCompleteScreen(totalActualSeconds, mode);
}

function showCompleteScreen(totalSeconds, mode) {
  const modeLabel = mode === 'full' ? 'Tập đầy đủ (có khởi động)' : 'Chỉ bài thiền';
  document.getElementById('complete-summary').textContent =
    `${modeLabel} · Tổng thời gian ${formatDurationVN(totalSeconds)}`;
  showScreen('complete');
}

/* =========================================================
   11. MÀN HÌNH NHẬT KÝ
   ========================================================= */
function renderLog() {
  const sessions = loadSessions().slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  const listEl = document.getElementById('log-list');
  const emptyEl = document.getElementById('log-empty');
  listEl.innerHTML = '';

  if (sessions.length === 0) {
    emptyEl.style.display = 'block';
    return;
  }
  emptyEl.style.display = 'none';

  sessions.forEach((s) => {
    const item = document.createElement('div');
    item.className = 'log-item';
    const modeLabel = s.mode === 'full' ? 'Đầy đủ' : 'Chỉ bài thiền';
    item.innerHTML = `
      <div class="log-item-left">
        <span class="log-date">${formatDateVN(s.date)}</span>
        <span class="log-meta">${modeLabel} · AUM ${s.xValue}s/âm</span>
      </div>
      <span class="log-duration">${formatDurationVN(s.totalSeconds)}</span>
    `;
    listEl.appendChild(item);
  });
}

/* =========================================================
   12. SERVICE WORKER (PWA / OFFLINE)
   ========================================================= */
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('sw.js')
        .then(() => updateOfflineNote())
        .catch(() => {});
    });
    navigator.serviceWorker.addEventListener('controllerchange', updateOfflineNote);
  }
}

/* =========================================================
   13. KHỞI TẠO
   ========================================================= */
function init() {
  renderHome();
  registerServiceWorker();
  wireSetupScreen();

  document.getElementById('btn-open-setup').addEventListener('click', openSetupScreen);
  document.getElementById('btn-open-log').addEventListener('click', () => {
    renderLog();
    showScreen('log');
  });
  document.getElementById('btn-log-back').addEventListener('click', () => {
    renderHome();
    showScreen('home');
  });
  document.getElementById('btn-complete-home').addEventListener('click', () => {
    renderHome();
    showScreen('home');
  });
}

document.addEventListener('DOMContentLoaded', init);
