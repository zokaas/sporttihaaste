// Puolivälin tarinan äänet, tehty Web Audiolla (ei äänitiedostoja eikä lisenssejä):
// matala uhkaava humina, tömähdys, nouseva jännite ja sydämenlyönnit. Ääni käynnistyy vain käyttäjän valinnasta.
// Taajuudet on valittu puhelimen kaiuttimelle (alle ~150 Hz ei juuri kuulu), ja iPhonessa ääni
// avataan napautuksesta myös äänettömällä kytkimellä (äänisessio "playback" ja hiljainen <audio>).

type Sound = {
  ctx: AudioContext;
  master: GainNode;
  drone: GainNode;
  filter: BiquadFilterNode;
  stopDrone: () => void;
  beat: number;
};

let s: Sound | null = null;

function noiseBuffer(ctx: AudioContext, seconds: number) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

let silent: HTMLAudioElement | null = null;

/** Hiljainen WAV (0,5 s): sen soittaminen kääntää iPhonen äänisession toistoksi, jolloin Web Audio kuuluu myös äänettömällä. */
function silentWav() {
  const rate = 8000;
  const n = rate / 2;
  const buf = new ArrayBuffer(44 + n);
  const v = new DataView(buf);
  const str = (o: number, t: string) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); str(36, 'data'); v.setUint32(40, n, true);
  for (let i = 0; i < n; i++) v.setUint8(44 + i, 128);
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}

/**
 * Avaa äänen käyttäjän napautuksesta: herättää keskeytetyn äänikontekstin ja ohittaa iPhonen äänettömän kytkimen.
 * Kutsutaan jokaisesta napautuksesta, koska selain sallii äänen vain eleen aikana.
 */
export function unlockSound() {
  if (!s) return;
  if (s.ctx.state !== 'running') void s.ctx.resume();
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = 'playback';
  } catch { /* ei tukea */ }
  try {
    if (!silent) { silent = new Audio(silentWav()); silent.loop = true; silent.setAttribute('playsinline', ''); }
    if (silent.paused) void silent.play().catch(() => {});
  } catch { /* ei tukea */ }
}

/** Käynnistää äänet (kutsutaan napautuksesta, jotta selain sallii äänen). */
export function startSound() {
  if (s) { unlockSound(); return; }
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 1;
  // Kompressori nostaa hiljaisia ääniä ja estää säröä puhelimen pienessä kaiuttimessa.
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.ratio.value = 4;
  master.connect(comp).connect(ctx.destination);
  // Humina: hieman eritaajuiset sahat alipäästösuotimen läpi, suodin huojuu hitaasti. Yläsävelet kuuluvat puhelimessakin.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  filter.Q.value = 5;
  const drone = ctx.createGain();
  drone.gain.value = 0;
  drone.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 2.5);
  filter.connect(drone).connect(master);
  const oscs = [55, 55.6, 82.4, 110].map((f) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.connect(filter);
    o.start();
    return o;
  });
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.12;
  lfoGain.gain.value = 140;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
  s = { ctx, master, drone, filter, beat: 0, stopDrone: () => { oscs.forEach((o) => o.stop()); lfo.stop(); } };
  unlockSound();
}

export function stopSound() {
  if (!s) return;
  window.clearTimeout(s.beat);
  const cur = s;
  s = null;
  cur.master.gain.linearRampToValueAtTime(0, cur.ctx.currentTime + 0.4);
  window.setTimeout(() => { cur.stopDrone(); void cur.ctx.close(); }, 500);
  silent?.pause();
}

/** Uhkan taso 1–3: humina voimistuu ja kirkastuu tarinan edetessä. */
export function setDread(level: number) {
  if (!s) return;
  const t = s.ctx.currentTime;
  s.drone.gain.linearRampToValueAtTime([0.06, 0.08, 0.1, 0.13][level] ?? 0.08, t + 1.5);
  s.filter.frequency.linearRampToValueAtTime([300, 420, 600, 850][level] ?? 420, t + 1.5);
}

/** Tömähdys (✝ kaatuneen päälle, sydämenlyönti). */
export function thud(at = 0, strength = 1) {
  if (!s) return;
  const { ctx, master } = s;
  const t = ctx.currentTime + at;
  // Matala pamaus (tuntuu kuulokkeissa) + keskitaajuinen kopsahdus ja rapsahdus (kuuluvat puhelimen kaiuttimesta).
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(50, t + 0.25);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.7 * strength, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.5);
  const k = ctx.createOscillator();
  const kg = ctx.createGain();
  k.type = 'triangle';
  k.frequency.setValueAtTime(320, t);
  k.frequency.exponentialRampToValueAtTime(140, t + 0.12);
  kg.gain.setValueAtTime(0.0001, t);
  kg.gain.exponentialRampToValueAtTime(0.45 * strength, t + 0.005);
  kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  k.connect(kg).connect(master);
  k.start(t);
  k.stop(t + 0.2);
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 0.15);
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 1800;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.3 * strength, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
  n.connect(nf).connect(ng).connect(master);
  n.start(t);
}

/** Nouseva jännite laskurin ajaksi. */
export function riser(seconds = 1.8) {
  if (!s) return;
  const { ctx, master } = s;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(880, t + seconds);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + seconds * 0.9);
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.3);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + seconds + 0.4);
}

/** Sydämenlyönnit, jotka kiihtyvät (loppupomo). */
export function heartbeat(seconds = 6) {
  if (!s) return;
  window.clearTimeout(s.beat);
  const start = Date.now();
  const beat = () => {
    if (!s) return;
    const k = Math.min(1, (Date.now() - start) / (seconds * 1000));
    thud(0, 0.6 + k * 0.4);
    thud(0.18, 0.4 + k * 0.3);
    s.beat = window.setTimeout(beat, 1100 - k * 550);
  };
  beat();
}

export function stopHeartbeat() {
  if (s) window.clearTimeout(s.beat);
}
