// All sound is synthesised with WebAudio — no audio files, no copyright.
// A soft chime for loot, a rising tick while spotted, a low sting for capture,
// a little arpeggio for the getaway.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let tickTimer = 0;

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch {
        ctx = null;
      }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, start, dur, type = 'sine', vol = 0.12) {
    if (muted) return;
    const ac = ensure();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, ac.currentTime + start);
    gain.gain.linearRampToValueAtTime(vol, ac.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(ac.currentTime + start);
    osc.stop(ac.currentTime + start + dur + 0.05);
  }

  return {
    unlock() { ensure(); },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    get muted() { return muted; },
    pickup(swan) {
      tone(660, 0, 0.18);
      tone(880, 0.08, 0.22);
      if (swan) { tone(1320, 0.16, 0.3); tone(1760, 0.24, 0.35); }
    },
    // Called every frame while the thief is seen; ticks faster as alarm climbs.
    spottedTick(alarm, dt) {
      if (muted) return;
      tickTimer -= dt;
      if (tickTimer <= 0) {
        tone(1180, 0, 0.07, 'square', 0.05);
        tickTimer = Math.max(0.12, 0.6 - alarm / 180);
      }
    },
    caught() {
      tone(220, 0, 0.5, 'sawtooth', 0.14);
      tone(165, 0.12, 0.6, 'sawtooth', 0.14);
      tone(110, 0.24, 0.9, 'sawtooth', 0.14);
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.35, 'triangle', 0.12));
    },
    click() { tone(440, 0, 0.06, 'triangle', 0.08); },
  };
}
