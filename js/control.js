// 操作画面（iPad）：ここが「正本」。変えるたびにモニターへ送る
(function () {
  const { ROOM, DEFAULT_STATE, clone, merge, createSync, keepAwake } = window.CPR;
  const SCN = window.CPR_SCENARIOS;
  const $ = (id) => document.getElementById(id);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const KEY = 'cprmon-control-' + ROOM;

  // ---- 状態（前回の続きから） ----
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { }
  let S = merge(DEFAULT_STATE, (saved && saved.S) || {});
  let U = Object.assign({ caseIdx: 0, cueIdx: -1, scRunning: false, scStartAt: 0, scElapsed: 0,
    cprStartAt: 0, quality: 'mid', qOffset: 0, auto: true }, (saved && saved.U) || {});
  S.epoch = S.epoch || Date.now();

  function persist() { try { localStorage.setItem(KEY, JSON.stringify({ S, U })); } catch (e) { } }

  // ---- 送る ----
  let sendTimer = null;
  const sync = createSync(onMsg, onStatus);
  function push() {
    persist(); render();
    if (sendTimer) return;
    sendTimer = setTimeout(() => { sendTimer = null; sendNow(); }, 40);
  }
  function sendNow() {
    S.seq = (S.seq || 0) + 1; S.sentAt = Date.now();
    sync.send({ type: 'state', state: S });
  }
  setInterval(sendNow, 2000); // 2秒ごとに今の状態を送る（あとから開いたモニター用）

  // モニターからの返事で、届くまでの時間を出す
  const monitors = {};
  function onMsg(m) {
    if (!m) return;
    if (m.type === 'hello') sendNow();
    if (m.type === 'breath') { onTap(m.at || Date.now()); }
    if (m.type === 'ack') monitors[m.id] = { at: Date.now(), lag: (Date.now() - m.sentAt) / 2 };
  }
  let netStatus = 'connecting';
  function onStatus(s) { netStatus = s; renderNet(); if (s === 'online') sendNow(); }
  function renderNet() {
    const live = Object.values(monitors).filter(x => Date.now() - x.at < 6000);
    const el = $('net');
    if (live.length) {
      const lag = Math.max(...live.map(x => x.lag));
      el.textContent = 'モニター ' + live.length + '台 つながっています（' + (lag / 1000).toFixed(2) + '秒）';
      el.className = 'pill ok';
    } else if (netStatus === 'online') { el.textContent = 'ネットOK・モニター待ち'; el.className = 'pill'; }
    else { el.textContent = netStatus === 'offline' ? 'ネットにつながっていません' : 'つないでいます…'; el.className = 'pill ng'; }
  }
  setInterval(renderNet, 1000);
  $('room').textContent = '部屋：' + ROOM;

  // ---- スマホの呼吸ボタン（もう1人の先生）----
  let taps = [], lastTapAt = 0, tapCount = 0;
  // 押された間隔を覚えて、呼吸数にする（押すのをやめても、そのリズムでモニターが自動で続ける）
  function onTap(at) {
    taps.push(Date.now()); lastTapAt = Date.now(); tapCount++;
    taps = taps.filter(t => Date.now() - t < 90000);
    const r = tapRr();
    if (r > 0 && S.rrMode === 'tap') { S.rr = r; push(); } else render();
  }
  function tapRr() {
    const iv = [];
    for (let i = taps.length - 1; i >= 1 && iv.length < 6; i--) { const d = taps[i] - taps[i - 1]; if (d >= 1500 && d <= 20000) iv.push(d); }
    if (!iv.length) return 0;
    return Math.round(60000 / (iv.reduce((a, b) => a + b, 0) / iv.length));
  }
  setInterval(() => { if (S.rrMode === 'tap') render(); }, 1000);
  document.querySelectorAll('[data-rr]').forEach(b => b.onclick = () => { S.rrMode = b.dataset.rr; push(); });

  // ---- ボタンを作る ----
  const CONN = [['ecg', '心電図'], ['spo2', 'SpO₂'], ['etco2', 'EtCO₂'], ['nibp', '血圧'], ['temp', '体温'], ['vent', '換気量'], ['gas', 'O₂・ISO']];
  CONN.forEach(([k, label]) => {
    const b = document.createElement('button'); b.textContent = label; b.dataset.conn = k;
    b.onclick = () => { S.conn[k] = !S.conn[k]; push(); };
    $('conn').appendChild(b);
  });
  const RH = [['sinus', '洞調律'], ['asystole', '心静止'], ['pea', 'PEA'], ['vf', 'VF'], ['vt', 'VT']];
  RH.forEach(([k, label]) => {
    const b = document.createElement('button'); b.textContent = label; b.dataset.rh = k;
    b.onclick = () => {
      S.rhythm = k;
      if (k === 'vt' && S.hr < 150) S.hr = 220;
      if (k === 'pea' && (S.hr > 100 || S.hr < 20)) S.hr = 60;
      if (k === 'sinus' && S.hr < 40) S.hr = 120;
      U.dirty = true; push();
    };
    $('rhythm').appendChild(b);
  });
  const TARGET = { good: 26, mid: 18, poor: 10 };
  const Q = [['good', '圧迫 上手（高め）'], ['mid', 'ふつう'], ['poor', '下手（低め）'], ['manual', '自動にしない']];
  Q.forEach(([k, label]) => {
    const b = document.createElement('button'); b.textContent = label; b.dataset.q = k;
    b.onclick = () => {
      U.quality = k; U.qOffset = 0;
      // 押したらすぐ、その高さへ寄せる（あとは自動で揺れながら近づく）
      if (k !== 'manual' && S.compressing) { S.etco2 = Math.round((S.etco2 + (TARGET[k] - S.etco2) * 0.45) * 10) / 10; U.fastUntil = Date.now() + 8000; }
      push();
    };
    $('co2mode').appendChild(b);
  });
  const nudge = (d) => { U.qOffset += d; S.etco2 = clamp(Math.round(S.etco2 + d), 0, 99); U.dirty = true; push(); };
  [['少し上げ気味', 3], ['少し下げ気味', -3]].forEach(([label, d]) => {
    const b = document.createElement('button'); b.textContent = label; b.onclick = () => nudge(d); $('co2mode').appendChild(b);
  });
  const SND = [['beat', '心拍音'], ['cprBeep', '圧迫中のピッ（圧迫を拍と数える）'], ['breath', '呼吸音'], ['flat', '心静止のピー'], ['alarm', 'アラーム']];
  SND.forEach(([k, label]) => {
    const b = document.createElement('button'); b.textContent = label; b.dataset.snd = k;
    b.onclick = () => { S.sound[k] = !S.sound[k]; push(); };
    $('sounds').appendChild(b);
  });
  $('vol').oninput = (e) => { S.sound.volume = Number(e.target.value); push(); };

  // ＋−ボタン
  const LIM = { hr: [0, 300], etco2: [0, 99], rr: [0, 40], vt: [0, 600], spo2: [50, 100], sys: [0, 250], dia: [0, 200], temp: [30, 43], fio2: [21, 100], isoIn: [0, 5], isoEx: [0, 5] };
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  document.querySelectorAll('[data-step]').forEach(b => {
    const [k, d] = b.dataset.step.split(':'); const step = Number(d);
    b.onclick = () => {
      const r = (x) => Math.round(x * 10) / 10;
      if (k === 'sys' || k === 'dia') S.nibp[k] = clamp(S.nibp[k] + step, ...LIM[k]);
      else S[k] = r(clamp(S[k] + step, ...LIM[k]));
      if (k === 'etco2') U.qOffset += step; // 手で動かしたら、自動の目標も一緒に動かす
      U.dirty = true; push();
    };
  });

  // 血圧
  $('nibpGo').onclick = () => { S.nibp.seq = (S.nibp.seq || 0) + 1; S.nibp.at = Date.now(); S.nibp.none = false; push(); };
  $('nibpNone').onclick = () => { S.nibp.seq = (S.nibp.seq || 0) + 1; S.nibp.at = Date.now(); S.nibp.none = true; push(); };

  // 心臓マッサージ
  // EtCO₂は急に飛ばさない：止めたらその値からゆっくり下がり、再開したらそこからゆっくり上がる
  function setCompress(on) {
    if (on === S.compressing) return;
    if (on) {
      if (U.quality !== 'manual' && S.etco2 < 6 && S.rr > 0) S.etco2 = 6; // 圧迫開始直後は低めから
      U.cprStartAt = Date.now();
    } else U.cprStartAt = 0;
    S.compressing = on; push();
  }
  $('cpr').onclick = () => { keepAwake(); window.__wantAwake = true; setCompress(!S.compressing); };
  $('cprMini').onclick = () => $('cpr').onclick();
  $('nextMini').onclick = () => goCue(U.cueIdx + 1);

  // EtCO2 の自動（圧迫中だけ）：上手→高め、下手→低め に少しずつ近づき、揺れる
  setInterval(() => {
    if (U.quality === 'manual') return;
    const ventilated = S.rr > 0;
    let v = S.etco2;
    if (S.compressing && ventilated) {
      // 圧迫中：圧迫の質の高さへ、揺れながら近づく
      const target = clamp(TARGET[U.quality] + U.qOffset, 3, 60);
      const rate = Date.now() < (U.fastUntil || 0) ? 0.35 : 0.13;
      v = v + (target - v) * rate + rnd(-1.1, 1.1);
    } else if (!S.compressing && S.rhythm !== 'sinus' && ventilated) {
      // 心停止のまま圧迫を止めている（心電図の確認中など）：ゆっくり下がる
      v = v + (3 - v) * 0.07 + rnd(-0.3, 0.2);
    } else return;
    S.etco2 = Math.round(clamp(v, 0, 70) * 10) / 10;
    push();
  }, 2000);

  // ---- シナリオ ----
  SCN.forEach((c, i) => { const o = document.createElement('option'); o.value = i; o.textContent = c.title; $('scSel').appendChild(o); });
  $('scSel').onchange = (e) => { U.caseIdx = Number(e.target.value); U.cueIdx = -1; U.sceneIdx = -1; U.scRunning = false; U.scElapsed = 0; S.caseLabel = SCN[U.caseIdx].patient; push(); buildScenario(); };
  function applyScene(sc, idx) {
    if (sc.cmp != null) setCompress(sc.cmp);
    if (sc.rhythm) S.rhythm = sc.rhythm;
    if (sc.hr != null) S.hr = sc.hr;
    ['spo2', 'temp'].forEach(k => { if (sc[k] != null) S[k] = sc[k]; });
    if (sc.rr != null && S.rrMode !== 'tap') S.rr = sc.rr; // スマホで覚えた呼吸数は上書きしない
    // EtCO₂：自動のときは、最初（CPA）とROSCだけシーンの値にする。途中は自動の動きにまかせる
    if (sc.etco2 != null && (U.quality === 'manual' || sc.co2Set)) S.etco2 = sc.etco2;
    U.sceneIdx = idx; U.dirty = false;
    if (sc.bp === null) { /* 測れない：表示はそのまま（つないでいなければ出ない） */ }
    else if (sc.bp) { S.nibp.sys = sc.bp[0]; S.nibp.dia = sc.bp[1]; }
    $('memo').textContent = 'いま：シーン' + (idx + 1) + '「' + sc.name + '」 ' + (sc.memo || '');
    push();
  }
  function goCue(i) {
    const c = SCN[U.caseIdx]; if (i < 0 || i >= c.cues.length) return;
    U.cueIdx = i; const cue = c.cues[i];
    if (cue[1] >= 0) applyScene(c.scenes[cue[1]], cue[1]);
    else { $('memo').textContent = cue[2]; push(); }
  }
  function buildScenario() {
    const c = SCN[U.caseIdx]; $('scSel').value = U.caseIdx;
    const box = $('cues'); box.innerHTML = '';
    c.cues.forEach((cue, i) => {
      const d = document.createElement('div'); d.className = 'cue';
      const b = document.createElement('button');
      const sc = cue[1] >= 0 ? 'シーン' + (cue[1] + 1) + ' ' + c.scenes[cue[1]].name : '';
      b.innerHTML = '<span class="tm">' + (cue[0] || '→') + '</span><span>' + cue[2] + '<br><span class="sc">' + sc + '</span></span>';
      b.onclick = () => goCue(i);
      d.appendChild(b); box.appendChild(d);
    });
    const sb = $('scenes'); sb.innerHTML = '';
    c.scenes.forEach((s, i) => { const b = document.createElement('button'); b.textContent = (i + 1) + ' ' + s.name; b.dataset.scene = i; b.onclick = () => applyScene(s, i); sb.appendChild(b); });
    render();
  }
  $('scNext').onclick = () => goCue(U.cueIdx + 1);
  $('scStart').onclick = () => {
    if (!U.scRunning) { U.scRunning = true; U.scStartAt = Date.now() - U.scElapsed; if (U.cueIdx < 0) goCue(0); }
    push();
  };
  $('scStop').onclick = () => {
    if (U.scRunning) { U.scRunning = false; U.scElapsed = Date.now() - U.scStartAt; }
    else { U.scElapsed = 0; U.cueIdx = -1; } // 止まっているときにもう一度押す＝0にもどす
    push();
  };

  // ---- 表示 ----
  $('showCase').onclick = () => { S.showCase = !S.showCase; push(); };
  $('showAlarm').onclick = () => { S.showAlarmText = !S.showAlarmText; push(); };
  $('allOff').onclick = () => { Object.keys(S.conn).forEach(k => S.conn[k] = false); S.compressing = false; U.cprStartAt = 0; push(); };
  $('resetAll').onclick = () => {
    if (!confirm('値とつなぎを最初の状態にもどします。よいですか？')) return;
    const ep = Date.now(); S = clone(DEFAULT_STATE); S.epoch = ep; S.caseLabel = SCN[U.caseIdx].patient;
    U.cueIdx = -1; U.scRunning = false; U.scElapsed = 0; U.cprStartAt = 0; push();
  };

  function fmt(ms) { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function render() {
    document.querySelectorAll('[data-conn]').forEach(b => b.classList.toggle('on', !!S.conn[b.dataset.conn]));
    document.querySelectorAll('[data-rh]').forEach(b => b.classList.toggle('sel', S.rhythm === b.dataset.rh));
    document.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('sel', U.quality === b.dataset.q));
    document.querySelectorAll('[data-snd]').forEach(b => b.classList.toggle('on', !!S.sound[b.dataset.snd]));
    $('cpr').classList.toggle('on', S.compressing);
    $('cprMini').classList.toggle('on', S.compressing);
    $('cprMini').textContent = S.compressing ? '圧迫中（止める）' : '圧迫 開始';
    $('cpr').textContent = S.compressing ? '心臓マッサージ中（押すと止める）' : '心臓マッサージ 開始';
    $('v_hr').textContent = Math.round(S.hr);
    $('v_etco2').textContent = Math.round(S.etco2);
    $('v_rr').textContent = S.rr; $('v_vt').textContent = S.vt;
    $('v_spo2').textContent = S.spo2; $('v_sys').textContent = S.nibp.sys; $('v_dia').textContent = S.nibp.dia;
    $('v_temp').textContent = Number(S.temp).toFixed(1);
    $('v_fio2').textContent = S.fio2; $('v_isoIn').textContent = Number(S.isoIn).toFixed(1); $('v_isoEx').textContent = Number(S.isoEx).toFixed(1);
    $('vol').value = S.sound.volume; $('volv').textContent = Math.round(S.sound.volume * 100) + '%';
    $('showCase').classList.toggle('on', S.showCase); $('showAlarm').classList.toggle('on', S.showAlarmText);
    document.querySelectorAll('[data-scene]').forEach(b => b.classList.toggle('cur', Number(b.dataset.scene) === U.sceneIdx));
    $('dirty').style.display = (U.sceneIdx != null && U.sceneIdx >= 0 && U.dirty) ? 'inline-block' : 'none';
    document.querySelectorAll('[data-rr]').forEach(b => b.classList.toggle('sel', (S.rrMode || 'auto') === b.dataset.rr));
    $('tapRr').textContent = S.rrMode === 'tap' ? (tapCount < 2 ? 'スマホで2回以上押されると、そのリズムを覚えます' : ('スマホで覚えた呼吸：' + S.rr + '回/分（' + tapCount + '回押された）。押すのをやめても、このリズムで自動で続きます')) : '';
    document.querySelectorAll('.cue').forEach((d, i) => { d.classList.toggle('now', i === U.cueIdx); d.classList.toggle('done', i < U.cueIdx); });
    $('scStart').textContent = U.scRunning ? '▶ 進行中' : (U.scElapsed ? '▶ 再開' : '▶ 時計スタート');
    $('scStop').textContent = U.scRunning ? '一時停止' : '0にもどす';
  }
  function tick() {
    const cpr = U.cprStartAt ? Date.now() - U.cprStartAt : 0;
    $('cprTimer').textContent = fmt(cpr);
    $('cprTimer').classList.toggle('due', cpr >= 120000);
    const el = U.scRunning ? Date.now() - U.scStartAt : U.scElapsed;
    $('scTimer').textContent = fmt(el);
    // 次の時刻までのカウントダウン
    const c = SCN[U.caseIdx]; let nx = null;
    for (let i = U.cueIdx + 1; i < c.cues.length; i++) { if (c.cues[i][0]) { nx = i; break; } }
    const box = $('nextCue');
    if (nx == null) { box.textContent = ''; box.className = 'pill'; }
    else {
      const [m, s2] = c.cues[nx][0].split(':').map(Number); const due = (m * 60 + s2) * 1000;
      const left = due - el;
      box.textContent = '次 ' + c.cues[nx][0] + '：' + c.cues[nx][2] + (U.scRunning || el ? '（' + (left >= 0 ? 'あと' + fmt(left) : fmt(-left) + '過ぎ') + '）' : '');
      box.className = 'pill' + (left < 0 ? ' late' : (left <= 10000 && (U.scRunning || el) ? ' soon' : ''));
    }
  }
  setInterval(tick, 250);

  if (!S.caseLabel) S.caseLabel = SCN[U.caseIdx].patient;
  buildScenario();
  render(); tick();
  window.__ctl = { get S() { return S; }, get U() { return U; } };
})();
