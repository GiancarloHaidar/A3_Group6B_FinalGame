// ============================================================
// constants.js
// All tunable values in one place — edit freely
// ============================================================

// ── Player dimensions ────────────────────────────────────────
const PLAYER_W = 28; // px
const PLAYER_H = 40; // px

// ── Movement ─────────────────────────────────────────────────
const MOVE_SPEED = 3.8; // px/frame max horizontal speed
const GROUND_FRICTION = 0.25; // lerp factor when input is held or in air
const JUMP_FORCE = -11.5; // negative = upward (px/frame)
const GRAVITY = 0.5; // px/frame² added each frame
const MAX_FALL_SPEED = 18; // terminal velocity (px/frame)

// ── Fast-fall ────────────────────────────────────────────────
const FAST_FALL_MULTIPLIER = 3.0; // gravity multiplier when holding DOWN/S in air

// ── Energy / Fatigue ─────────────────────────────────────────
const ENERGY_MAX = 100;
const ENERGY_DRAIN_HORIZ = 0.0095; // per px of horizontal travel
const ENERGY_DRAIN_JUMP = 0.47; // flat cost per jump
const ENERGY_DRAIN_FALL_OVER = 0.095; // extra drain per frame of hard fall
const ENERGY_FALL_THRESHOLD = 9; // px/frame downward before fall drain starts
const ENERGY_MOVE_DEADZONE = 0.4; // px/frame — below this, no horiz drain
const ENERGY_LOW_THRESHOLD = 25; // energy below this → bar turns red
const ENERGY_SPEED_MIN = 0.35; // min fraction of MOVE_SPEED at zero energy

const ENERGY_CHECKPOINT_ADD = 0.4; // +40% of max at checkpoint
const ENERGY_CHECKPOINT_CAP = 0.7; // hard cap at 70% of max

// ── Balance Instability ──────────────────────────────────────
// Design intent: MS-style balance symptoms are present from the very
// first step. Fatigue amplifies them but does NOT create them.
// Three independent layers, all active from frame one.
//
// ══════════════════════════════════════════════════════════════
// LAYER 1 — Delayed stabilization (always-on drift after key release)
// ══════════════════════════════════════════════════════════════
// When no horizontal input is held AND the player is grounded, vx
// decays toward zero using BALANCE_FRICTION_BASE rather than the
// snappier GROUND_FRICTION. This is ALWAYS active.
//
// As energy falls toward BALANCE_FATIGUE_TIRED, friction linearly
// reduces further to BALANCE_FRICTION_TIRED.
//
// Lerp friction → stop distance at MOVE_SPEED 3.8 px/frame:
//   0.18 → ~11 frames to stop  (~0.5 platform width of coast)
//   0.10 → ~20 frames to stop  (~1 platform width of coast)
//   0.06 → ~33 frames to stop  (~1.5 platform widths of coast)
//
const BALANCE_FRICTION_BASE = 0.18;
// The always-on release drift. 0.18 produces a clear, readable coast
// that is obviously not an instant stop without ever being dangerous.
// ↑ 0.22 = tighter (less noticeable early drift)
// ↓ 0.12 = more pronounced early drift

const BALANCE_FRICTION_TIRED = 0.07;
// Minimum friction floor when energy is fully depleted. At this value
// the player coasts ~1.5 platform-widths before stopping.
// ↓ 0.05 = near-ice feel at exhaustion

const BALANCE_FATIGUE_TIRED = 0.35;
// Energy fraction (0–1) at which FRICTION_TIRED is fully reached.
// 0.35 = last 35% of the energy bar. Below this, drift is maximal.
// ↑ 0.50 = fatigue effect begins sooner (halfway through the bar)

// ── Overshoot micro-lurch ────────────────────────────────────
// On the first frame after releasing horizontal input while grounded,
// a tiny nudge is applied counter to vx — the "body catching itself"
// stumble. ALWAYS active; fatigue widens it slightly.
//
const BALANCE_OVERSHOOT_BASE = 0.04;
// Always-on lurch magnitude (fraction of current vx subtracted).
// 0.04 = a barely-visible twitch. Raise to 0.07 for a clear stumble.
// Keep below 0.12 to avoid feeling like a rubber-band snap.

const BALANCE_OVERSHOOT_TIRED = 0.11;
// Overshoot strength at full fatigue. Interpolated from BASE→TIRED
// as energy falls from 1.0 to BALANCE_FATIGUE_TIRED.

// ══════════════════════════════════════════════════════════════
// LAYER 2 — Active sway (always-on sinusoidal body wobble)
// ══════════════════════════════════════════════════════════════
// A sine wave is added to vx every frame the player is grounded.
// It has a FIXED BASELINE (always on) and a FATIGUE ADDITION (grows
// as energy drops). Both are present regardless of movement speed,
// so even a standing player feels a subtle side-to-side nudge.
//
//   totalAmp = SWAY_AMP_BASE  +  SWAY_AMP_FATIGUE × fatigueT
//   where fatigueT = 1 − (energy / ENERGY_MAX)
//
// Because the wave is sinusoidal, it pushes equally left and right
// across one cycle. A stationary player on a 130 px platform will
// feel a ±2–3 px oscillation and will never be walked off the edge.
//
const PLAYER_SWAY_AMP_BASE = 0.02;
// Always-on sway amplitude. 0.18 px/frame peak.
// Over a 5-second cycle this produces ±2–3 px of visible drift.
// ↑ 0.25 = more obvious idle wobble from the start
// ↓ 0.10 = very faint — still readable but barely felt

const PLAYER_SWAY_AMP_FATIGUE = 0.02;
// Additional amplitude added at full fatigue (fatigueT = 1).
// totalAmp at zero energy = 0.18 + 0.22 = 0.40 px/frame.
// ↑ 0.30 = more punishing exhausted state
// ↓ 0.12 = fatigue contribution stays subtle

const PLAYER_SWAY_FREQ = 0.02;
// Sway oscillation speed in radians/frame.
// 0.020 → ~5 s per full cycle. Slow, pendulum-like, clearly legible.
// ↑ 0.030 = quicker wobble, harder to predict
// ↓ 0.014 = very long slow drift, almost imperceptible per-frame

// Checkpoint rest: sway is partially suppressed while on a checkpoint.
// Not zero — the symptom never fully disappears, just eases slightly.
const PLAYER_SWAY_CHECKPOINT_DAMPEN = 0.2;
// 0.0 = fully silenced. 0.20 = 80% suppressed (faint wobble remains).
// ↑ 0.40 = checkpoint only reduces sway, barely a rest
// ↓ 0.0  = complete stillness at checkpoints (more forgiving)

// ══════════════════════════════════════════════════════════════
// LAYER 3 — Environmental platform wobble (altitude-scaled)
// ══════════════════════════════════════════════════════════════
// Platforms oscillate horizontally with an amplitude that grows with
// height. PLAT_WOBBLE_CURVE controls how quickly wobble builds:
//   1.0 = linear (starts immediately from ground)
//   1.6 = gentle start, noticeable from ~⅓ height, strong near top
//   2.5 = nearly zero below halfway, concentrated at summit
//
const PLAT_WOBBLE_AMP_MAX = 14;
// Maximum horizontal sweep at the summit (px).
// 12 px stays well within the narrowest platform margin (130 px).
// ↑ 18 = more summit challenge. Keep below 22 for fairness.

const PLAT_WOBBLE_FREQ = 0.018;
// Platform oscillation speed (radians/frame).
// 0.018 → ~5.8 s per full swing. Slow and trackable.
// ↑ 0.026 = livelier swing

const PLAT_WOBBLE_CURVE = 1.6;
// Exponent on altitude_t. See description above.
// ↓ 1.0 = wobble starts from the ground up
// ↑ 2.5 = wobble concentrated near the peak

// ══════════════════════════════════════════════════════════════
// Blurry Vision — intermittent MS visual symptom
// ══════════════════════════════════════════════════════════════
// Blur events fire at random intervals during gameplay, gated by energy.
// No blur fires at full energy. As energy drops, events become more
// frequent and more intense — mimicking MS visual fatigue.
//
// Lifecycle per event:
//   idle (countdown) → fade-in → hold → fade-out → idle (new countdown)
//
// All frame counts assume ~60 fps. Multiply by 1.5 for 90 fps targets.

const BLUR_INTENSITY_MAX = 2.0;
// Peak blur radius in CSS pixels at the height of an event at full energy.
// Fatigue will scale this up further via BLUR_ENERGY_SCALE.
// 2.0 = subtle onset. At zero energy this becomes 2.0 × (1 + 1.5) = 5 px.
// ↑ 3.0 = stronger early episodes
// ↓ 1.0 = barely perceptible at first, only severe at exhaustion

const BLUR_FADE_IN_FRAMES = 30;
// Frames to ramp from 0 → peak. 30 ≈ 0.5 s.
// ↑ 60 = very gradual onset (almost imperceptible creep).
// ↓ 10 = sudden snap in — more jarring.

const BLUR_HOLD_FRAMES = 50;
// Frames the blur stays at peak intensity before fading. 50 ≈ 0.8 s.
// ↑ 120 = long episode (~2 s at peak). More fatiguing.
// ↓ 15  = a brief flash.

const BLUR_FADE_OUT_FRAMES = 45;
// Frames to ramp from peak → 0. 45 ≈ 0.75 s.
// ↑ 90 = very slow clearing — unsettling.
// ↓ 15 = quick snap clear.

const BLUR_INTERVAL_MIN = 60;
// Minimum idle frames between events at full fatigue (zero energy).
// 120 ≈ 2 s. At exhaustion, blurs come fast and relentlessly.
// ↓ 60 = near-constant blur at exhaustion

const BLUR_INTERVAL_MAX = 180;
// Idle frames between events when energy first starts dropping.
// 360 ≈ 6 s. Early blur episodes are rare and easy to dismiss.
// ↑ 600 = first blur feels like a surprise, long gaps early on
// ↓ 240 = episodes feel frequent even at moderate energy

const BLUR_ENERGY_SCALE = 1.5;
// Extra blur multiplier driven by fatigue.
// Final peak = INTENSITY_MAX × (1 + ENERGY_SCALE × fatigueT)
//   where fatigueT = 1 − energyFraction  (0 = full, 1 = exhausted)
// 1.5 = at zero energy, blur is 2.5× as strong (e.g. 2.0 → 5.0 px).
// ↓ 0.5 = fatigue has only a mild effect on intensity
// ↑ 2.0 = blur triples at exhaustion — use with a low INTENSITY_MAX

// ── UI layout ────────────────────────────────────────────────
const UI_TOP_RESERVE = 56; // px

// ── Camera ───────────────────────────────────────────────────
const CAM_LERP = 0.1;
const CAM_ANCHOR_Y = 0.55;

// ── Level / play column ──────────────────────────────────────
const PLAY_WIDTH = 800;
const LEVEL_HEIGHT = 4000;

// ── Level 2 flag ─────────────────────────────────────────────
const FLAG_SCALE = 0.1; // resize — 1.0 = full size (~900px tall), 0.3 = manageable
const FLAG_X = 150; // px from left edge of play column
const FLAG_OFFSET_Y = 18; // px vertical nudge (positive = lower, negative = higher)

// ── Vignette (Level 2 only) ──────────────────────────────────
// A radial darkening drawn over the world buffer, under the UI.
// Simulates reduced visual field / peripheral focus loss (MS symptom).
// Intensity grows as energy drops — the more fatigued, the darker the edges.
//
const VIGNETTE_ALPHA_BASE = 90;
// Darkness at the very edge of the screen at full energy (0–255).
// 80 = clearly visible but not oppressive from the first step.
// ↑ 120 = heavier immediate framing effect
// ↓ 40  = barely noticeable until fatigue sets in

const VIGNETTE_ALPHA_FATIGUE = 100;
// Additional alpha added at full fatigue (fatigueT = 1).
// totalAlpha = BASE + FATIGUE × fatigueT.  Max = 80 + 110 = 190.
// 110 keeps edges dark but the play area centre remains legible.
// ↑ 150 = very dramatic exhausted state
// ↓ 60  = fatigue contribution stays subtle

const VIGNETTE_INNER_RADIUS = 0.42;
// Fraction of the half-diagonal at which the gradient starts (clear zone).
// 0.42 = centre ~42% of the screen radius stays fully clear.
// ↑ 0.55 = smaller clear window, edges encroach more
// ↓ 0.30 = wider clear zone, vignette only at extreme edges

const VIGNETTE_FATIGUE_SHRINK = 0.3;
// How much the inner radius shrinks as fatigue rises.
// innerRadius = BASE − SHRINK × fatigueT
// 0.10 = at exhaustion the clear zone narrows by 10% of half-diagonal.
// ↑ 0.18 = tunnel-vision feel at exhaustion

// ── Input delay (Level 2 & 3) ────────────────────────────────
// A FIFO queue holds input events for INPUT_DELAY_MS before applying them.
// Simulates slowed nerve-signal transmission (MS symptom).
// The delay is fixed — it does not scale with fatigue — so it feels like
// a consistent processing lag rather than random unresponsiveness.
//
const INPUT_DELAY_MS = 150;
// Milliseconds between key event and effect on the player.
// 100 ms is perceptible but not frustrating (~6 frames at 60 fps).
// ↑ 140 = more noticeable, direction changes feel sluggish
// ↓ 60  = barely detectable — use if 100 feels too punishing

// ══════════════════════════════════════════════════════════════
// Level 3 — Mars → Deep Space
// ══════════════════════════════════════════════════════════════

// ── Spaceship flyover (Level 3 only) ─────────────────────────
// A spaceship sprite flies horizontally across the screen at random
// intervals, causing a screen-shake effect that simulates MS vertigo
// and visual distortion. The shake persists for the duration of the
// flyover plus a short decay.
//
const SHIP_INTERVAL_MIN = 480; // ~8 s minimum between flyovers
const SHIP_INTERVAL_MAX = 900; // ~15 s max gap
const SHIP_SPEED = 4.5; // px/frame horizontal speed
const SHIP_SCALE = 0.08; // scale of spaceship.png
const SHIP_SHAKE_INTENSITY = 4; // max px offset during flyover
const SHIP_SHAKE_DECAY = 30; // frames of shake after ship exits

// ── Shooting stars (Level 3 only) ────────────────────────────
// Bright streaks that fly diagonally across the visible screen.
// More frequent at higher altitudes. Purely cosmetic.
const SHOOTSTAR_INTERVAL_MIN = 90; // ~1.5 s minimum between spawns
const SHOOTSTAR_INTERVAL_MAX = 240; // ~4 s max gap
const SHOOTSTAR_SPEED = 6; // px/frame diagonal speed
const SHOOTSTAR_SCALE = 0.06; // scale of shooting_star.png
const SHOOTSTAR_MAX_ACTIVE = 3; // cap simultaneous stars

// ── Asteroids (Level 3 only) ─────────────────────────────────
// Slow-drifting asteroid sprites in the background. Density increases
// with altitude. They are background-only — no collision.
const ASTEROID_COUNT = 14; // total asteroids placed in level
const ASTEROID_DRIFT_SPEED = 0.3; // px/frame max drift
const ASTEROID_ROTATE_SPEED = 0.008; // radians/frame rotation
const ASTEROID_SCALE_MIN = 0.03;
const ASTEROID_SCALE_MAX = 0.07;

// ── Planet decorations (Level 3 only) ────────────────────────
// Static background planets placed at fixed y-positions in level space.
const PLANET_SCALE_EARTH = 0.12;
const PLANET_SCALE_SATURN = 0.14;
const PLANET_SCALE_VENUS = 0.1;
const PLANET_SCALE_MERCURY = 0.08;
