// Puolivälin tarinan äänet, tehty Web Audiolla (ei äänitiedostoja eikä lisenssejä):
// matala uhkaava humina, tömähdys, nouseva jännite ja sydämenlyönnit. Ääni käynnistyy vain käyttäjän valinnasta.

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

/** Käynnistää äänet (kutsutaan napautuksesta, jotta selain sallii äänen). */
export function startSound() {
  if (s) { void s.ctx.resume(); return; }
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);
  // Humina: kaksi hieman eritaajuista matalaa sahaa alipäästösuotimen läpi, suodin huojuu hitaasti.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 140;
  filter.Q.value = 6;
  const drone = ctx.createGain();
  drone.gain.value = 0;
  drone.gain.linearRampToValueAtTime(0.09, ctx.currentTime + 2.5);
  filter.connect(drone).connect(master);
  const oscs = [41.2, 41.6, 61.8].map((f) => {
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
  lfoGain.gain.value = 60;
  lfo.connect(lfoGain).connect(filter.frequency);
  lfo.start();
  s = { ctx, master, drone, filter, beat: 0, stopDrone: () => { oscs.forEach((o) => o.stop()); lfo.stop(); } };
}

export function stopSound() {
  if (!s) return;
  window.clearTimeout(s.beat);
  const cur = s;
  s = null;
  cur.master.gain.linearRampToValueAtTime(0, cur.ctx.currentTime + 0.4);
  window.setTimeout(() => { cur.stopDrone(); void cur.ctx.close(); }, 500);
}

/** Uhkan taso 1–3: humina voimistuu ja kirkastuu tarinan edetessä. */
export function setDread(level: number) {
  if (!s) return;
  const t = s.ctx.currentTime;
  s.drone.gain.linearRampToValueAtTime([0.07, 0.09, 0.12, 0.16][level] ?? 0.09, t + 1.5);
  s.filter.frequency.linearRampToValueAtTime([110, 140, 190, 260][level] ?? 140, t + 1.5);
}

/** Tömähdys (✝ kaatuneen päälle, sydämenlyönti). */
export function thud(at = 0, strength = 1) {
  if (!s) return;
  const { ctx, master } = s;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(110, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.25);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.7 * strength, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.5);
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 0.15);
  const nf = ctx.createBiquadFilter();
  nf.type = 'lowpass';
  nf.frequency.value = 900;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.25 * strength, t);
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
  o.frequency.setValueAtTime(70, t);
  o.frequency.exponentialRampToValueAtTime(420, t + seconds);
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
