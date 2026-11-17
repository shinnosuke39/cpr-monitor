// 共通：状態の形・同期（ネット経由＋同じ端末内）
(function () {
  const params = new URLSearchParams(location.search);
  const ROOM = (params.get('room') || 'cpr1').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'cpr1';

  const DEFAULT_STATE = {
    conn: { ecg: false, spo2: false, etco2: false, vent: false, nibp: false, temp: false, gas: false },
    rhythm: 'sinus',      // sinus / asystole / pea / vf / vt
    hr: 120,
    compressing: false,
    cprRate: 110,
    spo2: 97,
    etco2: 38,
    etco2Mode: 'manual',  // manual / up / down / wobble
    rr: 10,
    nibp: { sys: 110, dia: 70, seq: 0, at: 0, none: false },
    temp: 38.0,
    vt: 100,          // 1回換気量 mL
    fio2: 98,
    isoIn: 0.0, isoEx: 0.0,
    sound: { beat: true, breath: true, alarm: true, flat: true, volume: 0.7 },
    showAlarmText: false,
    caseLabel: '',
    showCase: true,
    shock: 0,
    seq: 0,
    sentAt: 0
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(base, add) {
    const out = clone(base);
    for (const k in add) {
      if (add[k] && typeof add[k] === 'object' && !Array.isArray(add[k]) && out[k] && typeof out[k] === 'object') {
        out[k] = merge(out[k], add[k]);
      } else out[k] = add[k];
    }
    return out;
  }

  // 同期：Supabase Realtime（ネット経由）＋ BroadcastChannel（同じMacの別の窓）
  function createSync(onMessage, onStatus) {
    const name = 'cprmon-' + ROOM;
    let bc = null, ch = null, status = 'connecting';
    const setStatus = (s) => { status = s; onStatus && onStatus(s); };
    try {
      bc = new BroadcastChannel(name);
      bc.onmessage = (e) => onMessage(e.data, 'local');
    } catch (e) { }
    try {
      const cfg = window.CPR_CONFIG;
      const client = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: false } });
      ch = client.channel(name, { config: { broadcast: { self: false } } });
      ch.on('broadcast', { event: 'm' }, (p) => onMessage(p.payload, 'net'));
      ch.subscribe((s) => {
        if (s === 'SUBSCRIBED') setStatus('online');
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') setStatus('offline');
      });
    } catch (e) { setStatus('offline'); }
    return {
      send(msg) {
        if (bc) { try { bc.postMessage(msg); } catch (e) { } }
        if (ch && status === 'online') { ch.send({ type: 'broadcast', event: 'm', payload: msg }); }
      },
      get status() { return status; }
    };
  }

  // 画面を消さない（対応するブラウザだけ）
  let wakeLock = null;
  async function keepAwake() {
    try {
      if ('wakeLock' in navigator && !wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      }
    } catch (e) { }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && window.__wantAwake) keepAwake(); });

  window.CPR = { ROOM, DEFAULT_STATE, clone, merge, createSync, keepAwake };
})();
