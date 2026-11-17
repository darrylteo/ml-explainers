/*
 * Cosmic sound engine for the ML explainers. Everything is synthesized with the Web Audio API:
 * no audio files, works offline.
 *
 *   Sound.bindButtons({ music: '#musicBtn', sfx: '#soundBtn' })
 *   Sound.mood('intro' | 'build' | 'forest' | 'predict')
 *   Sound.peg(depth, lvl, pan)   Sound.leaf(good, lvl, pan)   Sound.land(step, lvl, pan) ...
 *
 * Signal path: voices -> music / sfx buses -> master -> compressor -> speakers,
 * with sends into a long synthesized hall reverb and a ping-pong delay.
 * Music is a generative ambient piece: a slow lydian chord loop of detuned pads,
 * a sub bass, a drifting "space wind", and FM-bell arpeggios whose density follows the mood.
 * Sound effects are tuned to whichever chord is playing, so they always sit in key.
 */
(function () {
  'use strict';
  const LS = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const LSset = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // D lydian-flavoured loop: Dmaj9 → Bm11 → Gmaj9#11 → A6sus
  const CHORDS = [
    { bass: 38, tones: [57, 62, 64, 66, 69, 73] },
    { bass: 35, tones: [57, 59, 62, 64, 66, 69] },
    { bass: 31, tones: [55, 59, 61, 62, 66, 69] },
    { bass: 33, tones: [57, 59, 64, 66, 69, 71] },
  ];
  const BPM = 76, STEP = 60 / BPM / 2, CHORD_STEPS = 16;
  const MOODS = {
    intro:   { cutoff: 650,  arp: .14, oct: 24, beat: false, pad: .9 },
    build:   { cutoff: 1050, arp: .32, oct: 12, beat: false, pad: 1 },
    forest:  { cutoff: 2300, arp: .9,  oct: 12, beat: true,  pad: 1.1 },
    predict: { cutoff: 800,  arp: .1,  oct: 24, beat: false, pad: .75 },
  };

  const E = {
    ctx: null, master: null, music: null, sfx: null, rvIn: null, dlIn: null, noise: null,
    musicOn: LS('mlx-music') !== 'off', sfxOn: LS('mlx-sfx') !== 'off',
    mood: 'intro', chord: 0, step: 0, nextT: 0, timer: 0, padFilters: [], last: {}, buttons: null,
  };

  function buildReverb(ctx, seconds) {
    const sr = ctx.sampleRate, len = Math.floor(sr * seconds), buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let y = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len, a = .92 - .8 * t;                     // darken the tail over time
        const x = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6);
        y += a * (x - y); d[i] = y * (i < sr * .012 ? i / (sr * .012) : 1);
      }
    }
    return buf;
  }
  function init() {
    if (E.ctx) return E.ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const ctx = E.ctx = new AC({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = .004; comp.release.value = .25;
    E.master = ctx.createGain(); E.master.gain.value = .85; E.master.connect(comp); comp.connect(ctx.destination);
    E.music = ctx.createGain(); E.music.gain.value = E.musicOn ? .6 : 0; E.music.connect(E.master);
    E.sfx = ctx.createGain(); E.sfx.gain.value = E.sfxOn ? .9 : 0; E.sfx.connect(E.master);
    // hall reverb
    const conv = ctx.createConvolver(); conv.buffer = buildReverb(ctx, 5.5);
    E.rvIn = ctx.createGain(); E.rvIn.gain.value = 1;
    const rvOut = ctx.createGain(); rvOut.gain.value = .9;
    E.rvIn.connect(conv); conv.connect(rvOut); rvOut.connect(E.master);
    // ping-pong delay (dotted eighth), darkened in the loop, feeding the reverb a little
    E.dlIn = ctx.createGain();
    const dL = ctx.createDelay(2), dR = ctx.createDelay(2), fb = ctx.createGain(), lp = ctx.createBiquadFilter(), merge = ctx.createChannelMerger(2), wet = ctx.createGain();
    dL.delayTime.value = STEP * 1.5; dR.delayTime.value = STEP * 1.5; fb.gain.value = .42; lp.type = 'lowpass'; lp.frequency.value = 2600; wet.gain.value = .45;
    E.dlIn.connect(dL); dL.connect(lp); lp.connect(dR); dR.connect(fb); fb.connect(dL);
    dL.connect(merge, 0, 0); dR.connect(merge, 0, 1); merge.connect(wet); wet.connect(E.master);
    const toRv = ctx.createGain(); toRv.gain.value = .3; wet.connect(toRv); toRv.connect(E.rvIn);
    // shared noise buffer
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    E.noise = nb;
    startWind();
    return ctx;
  }
  function out(node, bus, pan, rv, dl) {
    const ctx = E.ctx, p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    let last = node;
    if (p) { p.pan.value = clamp(pan || 0, -1, 1); node.connect(p); last = p; }
    last.connect(bus);
    if (rv) { const g = ctx.createGain(); g.gain.value = rv; last.connect(g); g.connect(E.rvIn); }
    if (dl) { const g = ctx.createGain(); g.gain.value = dl; last.connect(g); g.connect(E.dlIn); }
  }
  function ready(kind) {
    const c = E.ctx; if (!c || c.state !== 'running') return false;
    return kind === 'music' ? E.musicOn : E.sfxOn;
  }

  /* ---------- voices ---------- */
  // FM bell: glassy when ratio is non-integer, warm when ratio ~1
  function bell(freq, t, o) {
    const ctx = E.ctx, { vol = .2, dur = 1.6, ratio = 3.5, index = 2, pan = 0, rv = .55, dl = .25, bus = E.sfx } = o || {};
    const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), amp = ctx.createGain();
    car.frequency.value = freq; mod.frequency.value = freq * ratio;
    mg.gain.setValueAtTime(freq * index, t); mg.gain.exponentialRampToValueAtTime(freq * index * .04 + 1, t + dur * .5);
    amp.gain.setValueAtTime(.0001, t); amp.gain.exponentialRampToValueAtTime(vol, t + .006); amp.gain.exponentialRampToValueAtTime(.0001, t + dur);
    mod.connect(mg); mg.connect(car.frequency); car.connect(amp);
    out(amp, bus, pan, rv, dl);
    car.start(t); mod.start(t); car.stop(t + dur + .05); mod.stop(t + dur + .05);
  }
  function sine(freq, t, o) {
    const ctx = E.ctx, { vol = .2, dur = .4, f2 = freq, type = 'sine', pan = 0, rv = .2, dl = 0, bus = E.sfx, attack = .004 } = o || {};
    const osc = ctx.createOscillator(), amp = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t); if (f2 !== freq) osc.frequency.exponentialRampToValueAtTime(f2, t + dur);
    amp.gain.setValueAtTime(.0001, t); amp.gain.exponentialRampToValueAtTime(vol, t + attack); amp.gain.exponentialRampToValueAtTime(.0001, t + dur);
    osc.connect(amp); out(amp, bus, pan, rv, dl);
    osc.start(t); osc.stop(t + dur + .05);
  }
  function noise(t, o) {
    const ctx = E.ctx, { vol = .1, dur = .6, f1 = 400, f2 = 3000, q = 1.2, pan = 0, pan2 = null, rv = .5, bus = E.sfx, type = 'bandpass' } = o || {};
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), amp = ctx.createGain();
    src.buffer = E.noise; src.loop = true; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f1, t); f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    amp.gain.setValueAtTime(.0001, t); amp.gain.exponentialRampToValueAtTime(vol, t + dur * .55); amp.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f); f.connect(amp);
    const ctxp = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (ctxp) { ctxp.pan.setValueAtTime(pan, t); if (pan2 != null) ctxp.pan.linearRampToValueAtTime(pan2, t + dur); amp.connect(ctxp); ctxp.connect(bus); const g = ctx.createGain(); g.gain.value = rv; ctxp.connect(g); g.connect(E.rvIn); }
    else out(amp, bus, 0, rv, 0);
    src.start(t, Math.random()); src.stop(t + dur + .05);
  }
  function startWind() {
    const ctx = E.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    src.buffer = E.noise; src.loop = true; f.type = 'bandpass'; f.Q.value = 3; f.frequency.value = 700;
    lfo.frequency.value = .035; lg.gain.value = 500; lfo.connect(lg); lg.connect(f.frequency);
    g.gain.value = .028; src.connect(f); f.connect(g); g.connect(E.music);
    const s = ctx.createGain(); s.gain.value = .5; g.connect(s); s.connect(E.rvIn);
    src.start(); lfo.start();
  }

  /* ---------- generative music ---------- */
  function pad(chord, t, dur) {
    const ctx = E.ctx, m = MOODS[E.mood];
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = .8; f.frequency.value = m.cutoff;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .09; lg.gain.value = m.cutoff * .35; lfo.connect(lg); lg.connect(f.frequency);
    const amp = ctx.createGain(), peak = .05 * m.pad, end = t + dur + 4;
    amp.gain.setValueAtTime(.0001, t); amp.gain.exponentialRampToValueAtTime(peak, t + 2.6);
    amp.gain.setValueAtTime(peak, t + dur); amp.gain.exponentialRampToValueAtTime(.0001, end);
    f.connect(amp); out(amp, E.music, 0, .75, .08);
    chord.tones.forEach((mn, k) => {
      [-8, 8].forEach(det => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(mn); o.detune.value = det + (Math.random() * 4 - 2);
        const pg = ctx.createGain(); pg.gain.value = .5; o.connect(pg); pg.connect(f); o.start(t); o.stop(end + .1);
      });
      if (k >= chord.tones.length - 2) {   // airy octave shimmer on the top tones
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(mn + 12);
        const pg = ctx.createGain(); pg.gain.value = .35; o.connect(pg); pg.connect(amp); o.start(t); o.stop(end + .1);
      }
    });
    lfo.start(t); lfo.stop(end + .1);
    E.padFilters.push({ f, until: end });
    E.padFilters = E.padFilters.filter(p => p.until > ctx.currentTime);
    // sub bass
    const b = ctx.createOscillator(), bg = ctx.createGain(); b.type = 'sine'; b.frequency.value = mtof(chord.bass);
    bg.gain.setValueAtTime(.0001, t); bg.gain.exponentialRampToValueAtTime(.16 * m.pad, t + 1.8);
    bg.gain.setValueAtTime(.16 * m.pad, t + dur); bg.gain.exponentialRampToValueAtTime(.0001, t + dur + 2.5);
    b.connect(bg); bg.connect(E.music); b.start(t); b.stop(t + dur + 2.6);
  }
  function kick(t) {
    const ctx = E.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + .28);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.32, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + .45);
    o.connect(g); out(g, E.music, 0, .08, 0); o.start(t); o.stop(t + .5);
  }
  function schedStep(step, t) {
    const m = MOODS[E.mood];
    if (step % CHORD_STEPS === 0) { E.chord = (step / CHORD_STEPS) % CHORDS.length; pad(CHORDS[E.chord], t, CHORD_STEPS * STEP); }
    const ch = CHORDS[E.chord], s = step % CHORD_STEPS;
    if (m.beat && s % 4 === 0) kick(t);
    if (m.beat && s % 4 === 2) noise(t, { vol: .025, dur: .12, f1: 7000, f2: 9000, q: .7, type: 'highpass', rv: .3, bus: E.music });
    if (Math.random() < m.arp) {
      const tones = ch.tones, idx = m.beat ? (s * 3) % tones.length : Math.floor(Math.random() * tones.length);
      const oct = m.beat && s % 8 >= 4 ? 24 : m.oct;
      bell(mtof(tones[idx] + oct), t, { vol: m.beat ? .07 : .06, dur: 2.4, ratio: m.beat ? 2.01 : 3.5, index: 1.4, pan: Math.random() * 1.4 - .7, rv: .7, dl: .45, bus: E.music });
    }
  }
  function tick() {
    const ctx = E.ctx; if (!ctx) return;
    if (!E.musicOn) { E.nextT = ctx.currentTime + .1; return; }
    while (E.nextT < ctx.currentTime + .3) { schedStep(E.step, E.nextT); E.step++; E.nextT += STEP; }
  }
  function startMusic() {
    if (!E.ctx || E.timer) return;
    E.step = 0; E.nextT = E.ctx.currentTime + .15;
    E.timer = setInterval(tick, 60); tick();
  }

  /* ---------- note helpers for effects (always in the current chord) ---------- */
  function chordNote(i, base = 12) {
    const tones = CHORDS[E.chord].tones, n = tones.length;
    const k = ((i % n) + n) % n, oct = Math.floor(i / n);
    return mtof(tones[k] + base + 12 * oct);
  }
  function gate(key, ms) { const now = performance.now(); if (now - (E.last[key] || 0) < ms) return false; E.last[key] = now; return true; }
  const gapOf = lvl => lvl >= 1 ? 0 : lvl > .5 ? 14 : 26;
  const now = () => E.ctx.currentTime + .005;

  const Sound = {
    unlock() {
      const ctx = init(); if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      startMusic();
    },
    mood(m) {
      if (!MOODS[m]) return; E.mood = m;
      if (!E.ctx) return;
      const t = E.ctx.currentTime;
      E.padFilters.forEach(p => p.f.frequency.setTargetAtTime(MOODS[m].cutoff, t, 1.2));
    },
    setMusic(on) {
      E.musicOn = on; LSset('mlx-music', on ? 'on' : 'off');
      if (on) Sound.unlock();
      if (E.ctx) E.music.gain.setTargetAtTime(on ? .6 : 0, E.ctx.currentTime, .4);
      Sound.renderButtons();
    },
    setSfx(on) {
      E.sfxOn = on; LSset('mlx-sfx', on ? 'on' : 'off');
      if (on) Sound.unlock();
      if (E.ctx) E.sfx.gain.setTargetAtTime(on ? .9 : 0, E.ctx.currentTime, .05);
      Sound.renderButtons();
      if (on) setTimeout(() => Sound.select(), 40);
    },
    bindButtons(sel) {
      E.buttons = { music: document.querySelector(sel.music), sfx: document.querySelector(sel.sfx) };
      if (E.buttons.music) E.buttons.music.addEventListener('click', () => Sound.setMusic(!E.musicOn));
      if (E.buttons.sfx) E.buttons.sfx.addEventListener('click', () => Sound.setSfx(!E.sfxOn));
      const unlock = () => Sound.unlock();
      window.addEventListener('pointerdown', unlock, true); window.addEventListener('keydown', unlock, true);
      Sound.renderButtons();
    },
    renderButtons() {
      const b = E.buttons; if (!b) return;
      if (b.music) { b.music.textContent = E.musicOn ? '♫ Music on' : '♫ Music off'; b.music.setAttribute('aria-pressed', E.musicOn); b.music.classList.toggle('on', E.musicOn); }
      if (b.sfx) { b.sfx.textContent = E.sfxOn ? 'Sound on' : 'Sound off'; b.sfx.setAttribute('aria-pressed', E.sfxOn); b.sfx.classList.toggle('on', E.sfxOn); }
    },

    /* building */
    ui() { if (!ready('sfx') || !gate('ui', 40)) return; bell(chordNote(4, 24), now(), { vol: .05, dur: .4, ratio: 2, index: .6, rv: .3, dl: 0 }); },
    tick(i) { if (!ready('sfx')) return; bell(chordNote(i, 12), now(), { vol: .16, dur: 1.4, ratio: 3.5, index: 1.6, pan: (i % 5) / 2.5 - .8, rv: .6, dl: .3 }); },
    select() { if (!ready('sfx') || !gate('sel', 60)) return; const t = now(); bell(chordNote(2, 12), t, { vol: .1, dur: .9, ratio: 2.01, index: .9, rv: .5, dl: .2 }); bell(chordNote(4, 12), t + .07, { vol: .08, dur: .9, ratio: 2.01, index: .9, rv: .5, dl: .2 }); },
    split() {
      if (!ready('sfx')) return; const t = now();
      [0, 2, 4, 6].forEach((k, j) => bell(chordNote(k, 12), t + j * .055, { vol: .13, dur: 1.8, ratio: 3.5, index: 1.8, pan: -.6 + j * .4, rv: .65, dl: .3 }));
      noise(t, { vol: .05, dur: .5, f1: 500, f2: 4000, q: 1.5, pan: -.6, pan2: .6, rv: .5 });
    },
    stop() { if (!ready('sfx')) return; const t = now(); bell(chordNote(0, 0), t, { vol: .16, dur: 1.6, ratio: 1.0, index: 1.2, rv: .6, dl: .2 }); },
    complete() {
      if (!ready('sfx')) return; const t = now();
      [0, 1, 2, 3, 4, 5, 7].forEach((k, j) => bell(chordNote(k, 12), t + j * .09, { vol: .12, dur: 2.6, ratio: 3.5, index: 1.5, pan: -.7 + j * .23, rv: .75, dl: .35 }));
      sine(mtof(CHORDS[E.chord].bass + 12), t, { vol: .18, dur: 2.2, rv: .5, attack: .3 });
    },
    add() {
      if (!ready('sfx')) return; const t = now();
      noise(t, { vol: .08, dur: 1.1, f1: 300, f2: 6000, q: 1, pan: -.8, pan2: .8, rv: .7 });
      [6, 4, 2, 0].forEach((k, j) => bell(chordNote(k, 24), t + .2 + j * .08, { vol: .09, dur: 2, ratio: 2.01, index: 1.1, pan: .6 - j * .4, rv: .7, dl: .35 }));
    },
    pop(i, pan) { if (!ready('sfx') || !gate('pop', 30)) return; bell(chordNote((i * 3) % 12, 24), now(), { vol: .06, dur: .9, ratio: 3.5, index: 1, pan: pan || 0, rv: .6, dl: .25 }); },
    riser(sec) {
      if (!ready('sfx')) return; const t = now();
      noise(t, { vol: .09, dur: sec, f1: 180, f2: 7000, q: .9, type: 'lowpass', rv: .6 });
      sine(mtof(CHORDS[E.chord].bass + 24), t, { vol: .06, dur: sec, f2: mtof(CHORDS[E.chord].bass + 36), type: 'triangle', rv: .6, attack: sec * .8 });
      setTimeout(() => Sound.impact(), sec * 1000 - 40);
    },
    impact() {
      if (!ready('sfx')) return; const t = now();
      sine(70, t, { vol: .35, dur: 1.4, f2: 34, rv: .4 });
      [0, 2, 4].forEach((k, j) => bell(chordNote(k, 12), t + j * .03, { vol: .1, dur: 3, ratio: 2.01, index: 1.2, pan: -.5 + j * .5, rv: .8, dl: .4 }));
    },

    /* plinko */
    peg(depth, lvl, pan) {
      if (!ready('sfx') || !gate('peg', gapOf(lvl))) return;
      const f = chordNote(depth * 2 + Math.floor(Math.random() * 2), 12);
      bell(f, now(), { vol: .2 * lvl + .02, dur: lvl >= 1 ? 1.8 : 1, ratio: 3.5, index: 2.2, pan, rv: .7, dl: lvl >= 1 ? .35 : .15 });
    },
    leaf(good, lvl, pan) {
      if (!ready('sfx') || !gate('leaf', gapOf(lvl))) return;
      const t = now(), f = chordNote(good ? 2 : 0, -12);
      bell(f, t, { vol: .3 * lvl + .03, dur: lvl >= 1 ? 1.4 : .6, ratio: 1.0, index: 2.5, pan, rv: .5, dl: .1 });
      if (lvl >= 1) noise(t, { vol: .04, dur: .12, f1: 2000, f2: 900, q: 2, pan, rv: .3 });
    },
    whoosh(pan) { if (!ready('sfx')) return; noise(now(), { vol: .07, dur: .45, f1: 400, f2: 3500, q: 1.6, pan: pan || 0, pan2: 0, rv: .5 }); },
    land(step, lvl, pan) {
      if (!ready('sfx') || !gate('land', gapOf(lvl))) return;
      const f = chordNote(clamp(step, 0, 14), 12);
      bell(f, now(), { vol: .16 * Math.max(lvl, .45), dur: lvl >= 1 ? 2.2 : 1.1, ratio: 2.01, index: 1.2, pan, rv: .75, dl: .3 });
    },
    verdict(major) {
      if (!ready('sfx')) return; const t = now();
      sine(55, t, { vol: .4, dur: 2.5, f2: 30, rv: .5 });
      noise(t, { vol: .07, dur: 1.6, f1: 8000, f2: 600, q: .7, type: 'lowpass', rv: .8 });
      const seq = major ? [0, 1, 2, 3, 4, 5, 7, 9] : [5, 4, 2, 1, 0, -1, -3, -5];
      seq.forEach((k, j) => bell(chordNote(k, 12), t + .05 + j * .085, { vol: .13, dur: 3.2, ratio: 3.5, index: 1.6, pan: -.8 + j * .22, rv: .8, dl: .4 }));
    },
  };
  Sound._engine = E;   // for debugging and automated level checks
  window.Sound = Sound;
})();
