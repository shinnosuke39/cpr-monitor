// モニター画面：波形を描き、数値と音を出す
(function () {
  const { ROOM, DEFAULT_STATE, clone, merge, createSync, keepAwake } = window.CPR;
  let S = clone(DEFAULT_STATE);
  let lastStateAt = 0;
  const myId = Math.random().toString(36).slice(2, 8);
  const $ = (id) => document.getElementById(id);
  $('roomLab').textContent = '部屋：' + ROOM;

  // ---------- 波のもと ----------
  const g = (x, mu, sd, a) => a * Math.exp(-((x - mu) * (x - mu)) / (2 * sd * sd));
  const rnd = (a, b) => a + Math.random() * (b - a);

  function sinusBeat(x, period, wide) {
    const s = Math.min(1, period / 0.62);
    const w = wide ? 1.7 : 1;
    return g(x, 0.06 * s, 0.02 * s, 0.12) +
      g(x, 0.155 * s, 0.007 * w, -0.12) + g(x, 0.17 * s, 0.009 * w, 1.0) + g(x, 0.186 * s + (wide ? 0.01 : 0), 0.009 * w, -0.28) +
      g(x, 0.36 * s + (wide ? 0.03 : 0), 0.045 * s, wide ? 0.18 : 0.26);
  }
  function vtBeat(x, period) {
    const s = Math.min(1, period / 0.3);
    return g(x, 0.07 * s, 0.035 * s, 1.1) + g(x, 0.17 * s, 0.045 * s, -0.75);
  }
  function vf(t) {
    const A = 0.42 + 0.18 * Math.sin(0.6 * t) + 0.1 * Math.sin(1.7 * t + 1);
    return A * (0.6 * Math.sin(2 * Math.PI * 5.3 * t + 0.8 * Math.sin(0.9 * t)) +
      0.4 * Math.sin(2 * Math.PI * 3.7 * t + 1.3) +
      0.25 * Math.sin(2 * Math.PI * 7.9 * t + 2 * Math.sin(0.37 * t)));
  }
  function plethBeat(x, period) {
    const s = Math.min(1, period / 0.6);
    const up = 0.11 * s;
    if (x < up) { const p = x / up; return p * p * (3 - 2 * p); }
    const y = x - up;
    return Math.exp(-y / (0.3 * s)) * (1 - 0.12 * Math.exp(-Math.pow((y - 0.16 * s) / (0.04 * s), 2))) + 0.1 * Math.exp(-Math.pow((y - 0.22 * s) / (0.05 * s), 2));
  }

  // ---------- 拍・圧迫・呼吸のタイミング ----------
  const beats = [];      // {t, period}
  const comps = [];      // {t, period, a}
  const breaths = [];    // {t, period, v}
  let nextBeat = 0, nextComp = 0, nextBreath = 0;
  let curRhythm = null;
  let pendingPleth = []; // 脈波を少し遅れて出す

  function schedule(t) {
    const rh = S.rhythm;
    if (rh !== curRhythm) { curRhythm = rh; nextBeat = t + 0.25; }
    // 心拍
    const beating = (rh === 'sinus' || rh === 'pea' || rh === 'vt') && S.hr > 0;
    if (beating && t >= nextBeat) {
      const period = 60 / Math.max(10, S.hr);
      beats.push({ t: nextBeat, period });
      onBeat(nextBeat, period);
      nextBeat = Math.max(nextBeat + period * (1 + rnd(-0.015, 0.015)), t);
    } else if (!beating) nextBeat = Math.max(nextBeat, t);
    // 心臓マッサージ
    if (S.compressing) {
      if (t >= nextComp) {
        const period = 60 / Math.max(60, S.cprRate || 110) * (1 + rnd(-0.03, 0.03));
        comps.push({ t: Math.max(nextComp, t - 0.05), period, a: rnd(1.0, 1.2) });
        nextComp = t + period;
        compBeep();
      }
    } else nextComp = t;
    // 換気
    if (S.rr > 0) {
      if (t >= nextBreath) {
        const period = 60 / S.rr;
        breaths.push({ t: Math.max(nextBreath, t - 0.05), period, v: breathCo2(), auto: true });
        onBreath();
        nextBreath = Math.max(nextBreath + period, t);
      }
    } else nextBreath = t + 0.5;
    while (beats.length && beats[0].t < t - 4) beats.shift();
    while (comps.length && comps[0].t < t - 3) comps.shift();
    while (breaths.length > 2 && breaths[1].t < t - 15) breaths.shift();
  }

  function sampleEcg(t) {
    let v = 0;
    const rh = S.rhythm;
    if (rh === 'vf') v = vf(t);
    else if (rh === 'asystole') v = 0.025 * Math.sin(2 * Math.PI * 0.22 * t) + 0.01 * Math.sin(2 * Math.PI * 1.3 * t);
    else {
      for (let i = beats.length - 1; i >= 0; i--) {
        const b = beats[i]; const x = t - b.t;
        if (x < 0) continue; if (x > 1.2) break;
        v += rh === 'vt' ? vtBeat(x, b.period) : sinusBeat(x, b.period, rh === 'pea');
      }
    }
    if (S.compressing) {
      // 心臓マッサージ中：体が揺れて電極が動くので、波形が大きく乱れる（ジャミジャミ）
      let c = 0;
      for (let i = comps.length - 1; i >= 0; i--) {
        const k = comps[i]; const x = t - k.t;
        if (x < 0) continue; if (x > k.period * 1.5) break;
        const ph = x / k.period;
        c += ph < 0.45 ? k.a * Math.sin(Math.PI * ph / 0.45) * 0.82 : -0.35 * k.a * Math.exp(-(ph - 0.45) * 4) * Math.sin(Math.PI * Math.min(1, (ph - 0.45) * 3));
        if (x < 0.03) c += 0.5 * (1 - x / 0.03); // 押した瞬間のトゲ
      }
      // 圧迫と同じ周期の規則的な大きい波に、少しの乱れと基線のゆれ（文献：救急 p.19、PMC3607813）
      const jam = 0.05 * Math.sin(2 * Math.PI * 31 * t + 3 * Math.sin(5 * t)) + rnd(-0.05, 0.05);
      v = v * 0.25 + c + jam + 0.12 * Math.sin(2 * Math.PI * 0.4 * t);
      v = Math.max(-1.2, Math.min(1.15, v)); // 振り切れ
    }
    return v + rnd(-0.008, 0.008);
  }

  function perfusing() { return S.rhythm === 'sinus' && S.hr > 0; }

  function samplePleth(t) {
    if (S.compressing) {
      let c = 0;
      for (let i = comps.length - 1; i >= 0; i--) {
        const k = comps[i]; const x = t - k.t; if (x < 0) continue; if (x > k.period) break;
        c += 0.35 * k.a * Math.sin(Math.PI * x / k.period);
      }
      return 0.15 + c + rnd(-0.05, 0.05);
    }
    if (!perfusing()) return 0.1 + 0.01 * Math.sin(t * 1.1) + rnd(-0.004, 0.004);
    let v = 0.1;
    for (let i = beats.length - 1; i >= 0; i--) {
      const b = beats[i]; const x = t - b.t - 0.18;
      if (x < 0) continue; if (x > 1.5) break;
      v += plethBeat(x, b.period) * 0.75;
    }
    return v;
  }

  let co2Peak = 0;
  function sampleCo2(t) {
    if (!breaths.length) return 0;
    let b = null;
    for (let i = breaths.length - 1; i >= 0; i--) { if (breaths[i].t <= t) { b = breaths[i]; break; } }
    if (!b) return 0;
    const x = t - b.t;
    const v = b.v;
    if (x < 0.3) { const p = x / 0.3; return co2Peak * (1 - p * p * (3 - 2 * p)); }
    if (x < 0.9) return 0;
    if (x < 1.3) { const p = (x - 0.9) / 0.4; return v * 0.88 * (p * p * (3 - 2 * p)); }
    const val = v * (0.88 + 0.12 * Math.min(1, (x - 1.3) / 2));
    co2Peak = val;
    return val;
  }

  // ---------- 描画 ----------
  function makeChan(id, color, speedSec, map, lw) {
    const cv = $(id), ctx = cv.getContext('2d');
    const ch = { cv, ctx, color, speedSec, map, lw, x: 0, lastY: null, w: 0, h: 0, k: 1 };
    ch.resize = () => {
      const r = cv.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
      cv.width = Math.max(10, Math.round(r.width * dpr)); cv.height = Math.max(10, Math.round(r.height * dpr));
      ch.w = cv.width; ch.h = cv.height; ch.k = cv.width / 643; ch.x = 0; ch.lastY = null;
      ctx.clearRect(0, 0, ch.w, ch.h);
    };
    return ch;
  }
  let co2Max = 50;
  const chEcg = makeChan('cvEcg', '#ffff1e', 3.4, (v, h) => h * 0.58 - v * h * 0.42, 1.4);
  const chSp = makeChan('cvSpo2', '#ff2cff', 3.4, (v, h) => h * 0.88 - v * h * 0.62, 2.0);
  const chFl = makeChan('cvFlow', '#f4f4c8', 16, (v, h) => h * 0.55 - v * h * 0.36, 1.6);
  const chCo2 = makeChan('cvCo2', '#22e4ff', 16, (v, h) => h * 0.95 - (v / co2Max) * h * 0.78, 2.0);
  const chans = [chEcg, chSp, chFl, chCo2];

  // 800×600 の画面を、ウィンドウいっぱい（縦横比はそのまま）に拡大する
  function fitStage() {
    const st = $('stage');
    const k = Math.min(window.innerWidth / 800, window.innerHeight / 600);
    st.style.transform = 'scale(' + k + ')';
  }
  function resizeAll() { fitStage(); chans.forEach(c => c.resize()); drawBpGraph(); }
  window.addEventListener('resize', resizeAll);

  function drawChan(ch, t0, t1, on, sampler) {
    const pxPerSec = ch.w / ch.speedSec;
    let x0 = ch.x, x1 = ch.x + (t1 - t0) * pxPerSec;
    const ctx = ch.ctx; const gap = Math.round(12 * ch.k);
    ctx.lineWidth = ch.lw * ch.k; ctx.strokeStyle = ch.color; ctx.lineJoin = 'round';
    let px = Math.floor(x0) + 1;
    ctx.beginPath();
    let started = false;
    for (; px <= Math.floor(x1); px++) {
      const t = t0 + (px - x0) / pxPerSec;
      let col = px % ch.w;
      if (col === 0) { ch.lastY = null; if (started) { ctx.stroke(); ctx.beginPath(); started = false; } }
      ctx.clearRect(col, 0, 1, ch.h); ctx.clearRect((col + 1) % ch.w, 0, 1, ch.h);
      for (let gp = 2; gp <= gap; gp++) ctx.clearRect((col + gp) % ch.w, 0, 1, ch.h);
      if (!on) { ch.lastY = null; continue; }
      const y = ch.map(sampler(t), ch.h);
      if (ch.lastY === null) { ctx.moveTo(col, y); started = true; }
      else { if (!started) { ctx.moveTo(col - 1, ch.lastY); started = true; } ctx.lineTo(col, y); }
      ch.lastY = y;
    }
    if (started) ctx.stroke();
    ch.x = x1 % ch.w;
  }

  // 換気の流れ（Flow）：吸気は上向きの台形、呼気は下向きの鋭い山
  function sampleFlow(t) {
    let b = null;
    for (let i = breaths.length - 1; i >= 0; i--) { if (breaths[i].t <= t) { b = breaths[i]; break; } }
    if (!b) return 0;
    const x = t - b.t; const a = Math.min(1.2, Math.max(0.3, (S.vt || 100) / 150));
    const ti = 0.9;
    if (x < ti) { const r = Math.min(1, x / 0.08) * Math.min(1, (ti - x) / 0.06); return a * 0.85 * r + 0.02 * Math.sin(x * 30) * r; }
    const e = x - ti;
    if (e < 0.06) return -a * 1.25 * (e / 0.06);
    return -a * 1.25 * Math.exp(-(e - 0.06) / 0.35);
  }

  // NIBP のカフ圧グラフ（測ったときの記録）
  let bpGraphSeq = -1;
  function drawBpGraph() {
    const cv = $('cvBp'); const r = cv.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    cv.width = Math.max(10, Math.round(r.width * dpr)); cv.height = Math.max(10, Math.round(r.height * dpr));
    const ctx = cv.getContext('2d'); const W = cv.width, H = cv.height; ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#d8d8d8'; ctx.lineWidth = Math.max(1, W / 204);
    ctx.beginPath(); ctx.moveTo(1, 0); ctx.lineTo(1, H - 1); ctx.lineTo(W, H - 1); ctx.stroke();
    if (!S.conn.nibp || !S.nibp.seq || S.nibp.none) return;
    ctx.strokeStyle = 'rgba(216,216,216,.6)';
    [0.35, 0.62].forEach(f => { ctx.beginPath(); ctx.moveTo(2, H * f); ctx.lineTo(W, H * f); ctx.stroke(); });
    const n = 30; const bw = W / 36;
    let seed = S.nibp.seq * 97;
    const rr = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < n; i++) {
      const p = i / n; const env = Math.exp(-Math.pow((p - 0.32) / 0.2, 2));
      const hgt = H * 0.9 * env * (0.7 + 0.3 * rr());
      ctx.fillStyle = (i === 7 || i === 9) ? '#ff2cff' : '#2cff3c';
      ctx.fillRect(4 + i * bw * 1.15, H - 2 - hgt, Math.max(1, bw * 0.35), hgt);
    }
    ctx.strokeStyle = '#ff3030'; ctx.lineWidth = Math.max(1, W / 160);
    ctx.beginPath(); ctx.moveTo(4, H * 0.25); ctx.lineTo(W * 0.95, H * 0.9); ctx.stroke();
  }

  // 右の縦の目盛り（脈の強さなど）
  function makeBar(id, n) { const el = $(id); el.innerHTML = ''; for (let i = 0; i < n; i++) el.appendChild(document.createElement('i')); return el; }
  const spBar = makeBar('spBar', 10), vtBar = makeBar('vtBar', 10), coBar = makeBar('coBar', 9);
  function setBar(el, frac, color) {
    const items = el.children; const k = Math.round(Math.max(0, Math.min(1, frac)) * items.length);
    for (let i = 0; i < items.length; i++) items[i].style.background = i < k ? color : '#2a2a2a';
  }

  // ---------- 音 ----------
  let ac = null, master = null, flatOsc = null, flatGain = null, noiseBuf = null;
  function initAudio() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = S.sound.volume; master.connect(ac.destination);
    flatOsc = ac.createOscillator(); flatOsc.type = 'sine'; flatOsc.frequency.value = 980;
    flatGain = ac.createGain(); flatGain.gain.value = 0; flatOsc.connect(flatGain); flatGain.connect(master); flatOsc.start();
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  function tone(freq, dur, vol, type, when) {
    if (!ac) return;
    const t = when || ac.currentTime;
    const o = ac.createOscillator(), gn = ac.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vol, t + 0.006);
    gn.gain.setValueAtTime(vol, t + dur - 0.02); gn.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function breathSound() {
    if (!ac) return;
    const mk = (f, start, len, vol) => {
      const src = ac.createBufferSource(); src.buffer = noiseBuf;
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 0.7;
      const gn = ac.createGain(); const t = ac.currentTime + start;
      gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vol, t + len * 0.4); gn.gain.linearRampToValueAtTime(0, t + len);
      src.connect(bp); bp.connect(gn); gn.connect(master); src.start(t); src.stop(t + len + 0.05);
    };
    mk(900, 0, 0.9, 0.35);   // 吸気（送気の音）
    mk(500, 1.1, 1.3, 0.18); // 呼気
  }
  function onBeat() {
    beatFlashAt = performance.now() / 1000;
    if (!ac || !S.sound.beat || !S.conn.ecg || S.compressing) return;
    const sp = (S.conn.spo2 && perfusing()) ? S.spo2 : 95;
    tone(520 + Math.max(0, sp - 80) * 22, 0.07, 0.42, 'sine');
  }
  // 1回ごとに少しずつ違う値（同じ数字に張りつかない）
  function breathCo2() { const b = S.etco2; return b <= 0 ? 0 : Math.max(0, b + rnd(-1.2, 1.2)); }
  let lastBreathV = null;
  // スマホの呼吸ボタン：押した瞬間に1回分の呼吸を始める
  let taps = [];
  // 押されたらその瞬間に呼吸を合わせる。あとは覚えた呼吸数（S.rr）で自動に続く
  function tapBreath() {
    const t = performance.now() / 1000;
    const period = S.rr > 0 ? 60 / S.rr : 6;
    const last = breaths.length ? breaths[breaths.length - 1] : null;
    if (last && last.auto && t - last.t < period * 0.5) { last.t = t; last.auto = false; } // 自動の1回とほぼ同時なら、押した時刻に合わせ直す
    else { breaths.push({ t, period, v: breathCo2() }); onBreath(); }
    nextBreath = t + period;
  }
  function compBeep() {
    // 圧迫のゆれを心拍とまちがえて数えるので、不規則にピッと鳴る
    if (!ac || !S.sound.beat || !S.sound.cprBeep || !S.conn.ecg) return;
    if (hrMode === 'none' && Math.random() < 0.6) return;
    tone(880, 0.06, 0.38, 'sine');
    if (hrMode === 'double') tone(880, 0.06, 0.38, 'sine', ac.currentTime + 60 / (S.cprRate || 110) / 2);
  }
  function onBreath() {
    if (!ac || !S.sound.breath) return;
    breathSound();
  }
  let lastAlarm = 0;
  function audioTick(now) {
    if (!ac) return;
    master.gain.setTargetAtTime(S.sound.volume, ac.currentTime, 0.05);
    const flat = S.conn.ecg && !S.compressing && S.rhythm === 'asystole' && S.sound.flat;
    flatGain.gain.setTargetAtTime(flat ? 0.22 : 0, ac.currentTime, 0.03);
    const a = alarmState();
    if (a && S.sound.alarm && now - lastAlarm > 3.2) {
      lastAlarm = now;
      const t = ac.currentTime;
      [0, 0.2, 0.4].forEach((d, i) => tone(i === 2 ? 1046 : 880, 0.13, 0.22, 'triangle', t + d));
      [0.9, 1.1].forEach((d) => tone(880, 0.13, 0.22, 'triangle', t + d));
    }
  }
  function alarmState() {
    if (S.conn.ecg && !S.compressing && (S.rhythm === 'vf' || S.rhythm === 'vt' || S.rhythm === 'asystole')) return S.rhythm;
    if (S.conn.spo2 && !S.compressing && perfusing() && S.spo2 < 90) return 'spo2';
    return null;
  }

  // ---------- 数値 ----------
  function dispCo2() { return S.etco2; }
  let hrMode = 'single', hrModeUntil = 0;
  let nibpShowAt = 0, nibpStartAt = 0, lastNibpSeq = -1, cvrr = 3.2, cvAt = 0, beatFlashAt = 0;
  const NIBP_SEC = 6;
  function setNum(id, text, on) { const el = $(id); el.textContent = text; el.classList.toggle('off', !on); }
  function show(id, on) { $(id).classList.toggle('off', !on); }
  function updateNums(now) {
    const c = S.conn;
    // HR
    let hr = '---';
    if (S.compressing) {
      // 機械が圧迫を心拍と数える：圧迫の回数（約110）か、1回を2拍に数えてその倍（約220）。ときどき「---」
      if (now > hrModeUntil) { const r = Math.random(); hrMode = r < 0.5 ? 'single' : (r < 0.88 ? 'double' : 'none'); hrModeUntil = now + rnd(4, 9); }
      const base = S.cprRate || 110;
      hr = hrMode === 'none' ? '---' : String(Math.round((hrMode === 'double' ? base * 2 : base) + rnd(-6, 6)));
    }
    else if (S.rhythm === 'vf') hr = '---';
    else if (S.rhythm === 'asystole') hr = '0';
    else hr = String(Math.max(0, Math.round(S.hr + rnd(-1.4, 1.4))));
    setNum('vHr', hr, c.ecg);
    if (now - cvAt > 8) { cvAt = now; cvrr = rnd(2.4, 4.6); }
    const cvOk = c.ecg && S.rhythm === 'sinus' && !S.compressing;
    setNum('vCv', cvOk ? cvrr.toFixed(2) : '---', c.ecg);
    // SpO2・PR
    const spOk = !S.compressing && perfusing();
    setNum('vSpo2', spOk ? String(Math.round(S.spo2)) : '---', c.spo2);
    setNum('vPr', spOk ? String(Math.round(S.hr + rnd(-1.4, 1.4))) : '---', c.spo2);
    show('spBar', c.spo2); show('spDot', c.spo2);
    // VT・MV
    const vtv = Math.round((S.vt || 0) * (1 + rnd(-0.03, 0.03)));
    setNum('vVt', S.rr > 0 ? String(vtv) : '---', c.vent);
    const rrNow = S.rr;
    setNum('vMv', rrNow > 0 ? ((S.vt || 0) * rrNow / 1000).toFixed(1) : '---', c.vent);
    show('vtBar', c.vent);
    // CO2
    const lb = breaths.length ? breaths[breaths.length - 1] : null;
    const breathingNow = lb && (performance.now() / 1000 - lb.t) < 20;
    setNum('vCo2', String(Math.round(breathingNow ? lb.v : S.etco2)), c.etco2);
    setNum('vIn', '0/', c.etco2);
    setNum('vRr', String(Math.round(S.rr)), c.etco2);
    show('coBar', c.etco2); show('lung', c.etco2);
    // NIBP
    const n = S.nibp;
    if (n.seq !== lastNibpSeq) { if (lastNibpSeq !== -1 && n.seq > 0) { nibpStartAt = now; nibpShowAt = now + NIBP_SEC; } lastNibpSeq = n.seq; bpGraphSeq = -1; }
    const measuring = c.nibp && now < nibpShowAt;
    if (measuring) {
      const p = (now - nibpStartAt) / NIBP_SEC;
      setNum('cuffNow', String(Math.round(p < 0.2 ? 210 * p / 0.2 : 210 - (210 - 30) * (p - 0.2) / 0.8)), true);
    } else setNum('cuffNow', '---', c.nibp);
    show('cuff', c.nibp);
    if (!c.nibp || !n.seq || measuring) {
      setNum('vBp', '---/---', c.nibp); setNum('vMap', '---', c.nibp); setNum('bpTime', '', false);
    } else if (n.none) {
      setNum('vBp', '-/-', true); setNum('vMap', '-', true); setNum('bpTime', fmtTime(n.at), true);
    } else {
      setNum('vBp', n.sys + '/' + String(n.dia).padStart(3, '\u2007'), true);
      setNum('vMap', String(Math.round((n.sys + 2 * n.dia) / 3)), true);
      setNum('bpTime', fmtTime(n.at), true);
    }
    const gkey = (c.nibp && !measuring ? 1 : 0) + ':' + n.seq + ':' + n.none;
    if (gkey !== bpGraphSeq) { bpGraphSeq = gkey; drawBpGraph(); }
    // TEMP・O2・ISO
    setNum('vTmp', Number(S.temp).toFixed(1), c.temp);
    setNum('vO2', String(Math.round(S.fio2)), c.gas);
    setNum('vIso', Number(S.isoIn).toFixed(1) + '/' + Number(S.isoEx).toFixed(1), c.gas);
    // 名前の欄
    $('name').textContent = S.showCase ? (S.caseLabel || '') : '';
    // アラーム
    const a = alarmState();
    $('bell').classList.toggle('alarm', !!a);
    $('boxHr').classList.toggle('alarmbox', !!a && a !== 'spo2');
    $('boxSpo2').classList.toggle('alarmbox', a === 'spo2');
    const msg = $('msg');
    if (a && S.showAlarmText) {
      msg.style.display = 'flex'; msg.textContent = { vf: 'VF', vt: 'VT', asystole: 'ASYSTOLE', spo2: 'SpO2 低下' }[a];
    } else msg.style.display = 'none';
  }
  function fmtTime(ms) { if (!ms) return ''; const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  // ---------- 同期 ----------
  const sync = createSync((m, via) => {
    if (!m) return;
    if (m.type === 'breath') { if (S.rrMode === 'tap') tapBreath(); return; }
    if (m.type === 'state') {
      if (m.state.seq < (S.seq || 0) && m.state.epoch === S.epoch) return;
      S = merge(DEFAULT_STATE, m.state);
      lastStateAt = Date.now();
      sync.send({ type: 'ack', seq: m.state.seq, sentAt: m.state.sentAt, id: myId });
    }
  }, () => { });
  function hello() { sync.send({ type: 'hello', id: myId }); }
  setTimeout(hello, 600); setTimeout(hello, 2000);

  // ---------- ループ ----------
  let lastT = performance.now() / 1000, lastNum = 0, lastHello = 0;
  function loop() {
    const now = performance.now() / 1000;
    let t0 = lastT, t1 = now;
    if (t1 - t0 > 1.0) t0 = t1 - 0.02; // 裏に回っていたとき
    lastT = now;
    schedule(t1);
    co2Max = S.etco2 > 45 ? 80 : 50;
    drawChan(chEcg, t0, t1, S.conn.ecg, sampleEcg);
    drawChan(chSp, t0, t1, S.conn.spo2, samplePleth);
    drawChan(chFl, t0, t1, S.conn.vent, sampleFlow);
    drawChan(chCo2, t0, t1, S.conn.etco2, sampleCo2);
    // 縦の目盛りとハート
    if (S.conn.spo2) setBar(spBar, samplePleth(t1) / 1.0, '#ff2cff');
    if (S.conn.vent) setBar(vtBar, Math.abs(sampleFlow(t1)), '#d9f2b0');
    if (S.conn.etco2) setBar(coBar, sampleCo2(t1) / co2Max * 1.2, '#22e4ff');
    const beatOn = now - beatFlashAt < 0.15;
    $('heart').style.opacity = S.conn.ecg ? (beatOn ? 1 : 0.35) : 0;
    $('spDot').style.opacity = S.conn.spo2 ? (beatOn && perfusing() && !S.compressing ? 1 : 0.4) : 0;
    if (now - lastNum > (now < nibpShowAt ? 0.2 : 1)) { lastNum = now; updateNums(now); }
    else if (S.nibp.seq !== lastNibpSeq) updateNums(now);
    audioTick(now);
    // つながり表示
    const age = Date.now() - lastStateAt;
    $('clock').style.color = age < 6000 ? '#fff' : (lastStateAt ? '#ffb000' : '#888');
    if (age > 5000 && now - lastHello > 3) { lastHello = now; hello(); }
    requestAnimationFrame(loop);
  }

  function clock() { const d = new Date(); $('clock').textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  setInterval(clock, 1000); clock();

  // 全画面（Safari の古い版にも対応）
  function isFs() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function goFs() {
    const el = document.documentElement;
    try {
      if (el.requestFullscreen) return el.requestFullscreen().catch(() => { });
      if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
    } catch (e) { }
  }
  function fsUi() { $('fsBtn').classList.toggle('hide', isFs() || idle); }
  let idle = false, idleTimer = null;
  function wake() { idle = false; document.body.classList.remove('idle'); fsUi(); clearTimeout(idleTimer); idleTimer = setTimeout(() => { idle = true; document.body.classList.add('idle'); fsUi(); }, 3000); }
  document.addEventListener('mousemove', wake); wake();
  $('fsBtn').addEventListener('click', () => { initAudio(); if (ac.state === 'suspended') ac.resume(); goFs(); });
  document.addEventListener('webkitfullscreenchange', () => { fsUi(); setTimeout(resizeAll, 200); });

  $('startBtn').addEventListener('click', async () => {
    initAudio(); if (ac.state === 'suspended') ac.resume();
    goFs();
    window.__wantAwake = true; keepAwake();
    $('start').style.display = 'none';
    setTimeout(resizeAll, 300);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'f') goFs(); });
  document.addEventListener('fullscreenchange', () => { fsUi(); setTimeout(resizeAll, 200); });

  // テスト用：URLに ?demo=1 で全部つないだ状態にする
  if (new URLSearchParams(location.search).get('demo')) {
    S.conn = { ecg: true, spo2: true, etco2: true, vent: true, nibp: true, temp: true, gas: true };
    S.isoIn = 1.6; S.isoEx = 1.3; S.vt = 158; S.caseLabel = 'DEMO 10kg';
    S.nibp = { sys: 112, dia: 68, seq: 1, at: Date.now(), none: false };
    const r = new URLSearchParams(location.search).get('rh'); if (r) S.rhythm = r;
    if (new URLSearchParams(location.search).get('cpr')) S.compressing = true;
    lastNibpSeq = 1;
  }
  window.__mon = { get S() { return S; }, set(o) { S = merge(S, o); } };

  resizeAll();
  requestAnimationFrame(loop);
})();
