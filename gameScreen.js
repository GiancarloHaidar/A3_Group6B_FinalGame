// ============================================================
// gameScreen.js
// init, draw, and input handling for the "game" screen.
//
// Level 2 additions (all gated on currentLevel === 2):
//   - Moving platforms (horizontal, driven by JSON fields)
//   - Space gradient background with stars
//   - Colour-blindness / contrast-reduction overlay
//   - Level settings (gravityMultiplier, balanceMultiplier, etc.)
//     read from levelData and applied each frame
//
// Level 1 is 100 % unchanged.
// ============================================================

// ── Input state ──────────────────────────────────────────────
let _keys = { left: false, right: false, down: false };

// ── Input-delay queue (Level 2 only) ─────────────────────────
// Each entry: { type: "press"|"release", kc: keyCode, ts: millis() }
// Drained each frame; only events older than INPUT_DELAY_MS are applied.
let _inputQueue = [];

// ── Instructions visibility ───────────────────────────────────
let _playerHasMoved = false;

// ── Finish / win state ───────────────────────────────────────
let finishPlatform = null;
let winTriggered = false;
let winAnimTimer = 0;

// ── Altitude mapping ─────────────────────────────────────────
let _groundY = 0;
let _climbPx = 1;

// ── Level 2 runtime settings (populated in initGame) ─────────
// These mirror the optional JSON fields in level2.json.
// Defaults are identical to Level 1 so nothing changes if fields are absent.
let _lvGravityMult = 1.0;
let _lvJumpForceMult = 1.0;
let _lvBalanceMult = 1.0;
let _lvColorBlindStrength = 0.0;
let _lvContrastReduction = 0.0;
let _lvEnergyDrainMult = 1.0;

// ── Stars (Level 2 background) ───────────────────────────────
// Generated once in initGame so they don't re-randomise each frame.
let _bgStars = [];
const BG_STAR_COUNT = 120;

// ── Foreground glowing stars (Level 2 only) ───────────────────
// These stars appear gradually as the player climbs toward space.
// Density and brightness scale with altitude (higher = more stars).
// Stars are absent near the ground and fully present at the summit.
//   altThreshold : altitude fraction (0–1) below which this star is invisible
//   altPeak      : fraction at which the star reaches full brightness
let _fgStars = [];
const FG_STAR_COUNT = 180;

// ── Ground scenery layout ─────────────────────────────────────
const SCENERY_GROUND_Y = 3950;
const SCENERY_TREE_SINK = 18;
const SCENERY_HOUSE_SINK = 75;

const SCENERY_TREES = [];

const SCENERY_HOUSE = {
  x: 30,
  scale: 0.3,
};

// ── Astronaut sprite draw offsets ─────────────────────────────
const PLAYER_DRAW_OFFSET_X = -10;
const PLAYER_DRAW_OFFSET_Y = -12;
const PLAYER_DRAW_W = PLAYER_W + 20;
const PLAYER_DRAW_H = PLAYER_H + 18;

// ── Cloud positions in level-space ───────────────────────────
const CLOUD_DEFS = [
  { type: 1, x: -20, y: 3000, scale: 0.9 },
  { type: 1, x: 500, y: 2620, scale: 0.9 },
  { type: 2, x: -15, y: 2380, scale: 0.82 },
  { type: 2, x: 500, y: 2150, scale: 0.85 },
  { type: 1, x: -20, y: 1870, scale: 0.76 },
  { type: 1, x: 500, y: 1600, scale: 0.76 },
  { type: 2, x: -15, y: 1420, scale: 0.7 },
  { type: 2, x: 615, y: 1170, scale: 0.85 },
  { type: 1, x: -20, y: 920, scale: 0.65 },
  { type: 1, x: 605, y: 800, scale: 0.65 },
];

// ══════════════════════════════════════════════════════════════
// Level 3 runtime state — Mars → Deep Space
// ══════════════════════════════════════════════════════════════

// ── Asteroids (background, no collision) ─────────────────────
let _asteroids = [];

// ── Shooting stars ───────────────────────────────────────────
let _shootingStars = [];
let _shootStarTimer = 0;

// ── Spaceship flyover ────────────────────────────────────────
let _ship = null;          // { x, y, dir } while active; null = idle
let _shipTimer = 0;        // countdown to next flyover
let _shakeTimer = 0;       // remaining shake frames
let _shakeOffsetX = 0;
let _shakeOffsetY = 0;

// ── Planet positions (fixed in level-space, set once in initGame) ──
const L3_PLANETS = [
  { key: "earth",   x: 620, y: 3100, scale: 0.12 },
  { key: "saturn",  x: 40,  y: 2100, scale: 0.14 },
  { key: "venus",   x: 610, y: 1400, scale: 0.10 },
  { key: "mercury", x: 80,  y: 750,  scale: 0.08 },
];

function getWorldOffsetX() {
  return (width - PLAY_WIDTH) / 2;
}

// ── initGame ──────────────────────────────────────────────────
function initGame() {
  platforms = [];
  finishPlatform = null;
  winTriggered = false;
  winAnimTimer = 0;
  _playerHasMoved = false;

  // ── Read optional level settings from JSON ───────────────
  _lvGravityMult = levelData.gravityMultiplier || 1.0;
  _lvJumpForceMult = levelData.jumpForceMultiplier || 1.0;
  _lvBalanceMult = levelData.balanceMultiplier || 1.0;
  _lvColorBlindStrength = levelData.colorBlindnessStrength || 0.0;
  _lvContrastReduction = levelData.platformContrastReduction || 0.0;
  _lvEnergyDrainMult = levelData.energyDrainMultiplier || 1.0;

  for (let p of levelData.platforms) {
    const plat = {
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      color: p.color || [80, 80, 90],
      zone: p.zone || "normal",
      section: p.section || "normal",
      laneKey: p.laneKey || "C",
      isFinish: !!p.isFinish,
      baseX: p.x,
      wobblePhase: random(TWO_PI),
      // Moving-platform fields (Level 2)
      moving: !!p.moving,
      moveRange: p.moveRange || 0,
      moveSpeed: p.moveSpeed || 0,
    };
    platforms.push(plat);
    if (plat.isFinish) finishPlatform = plat;
  }

  player = new Player(levelData.startX, levelData.startY);

  // Clear any queued input from a previous run.
  _inputQueue = [];

  // Pass level multipliers to player so it can apply them each frame.
  player.gravityMult = _lvGravityMult;
  player.jumpForceMult = _lvJumpForceMult;
  player.balanceMult = _lvBalanceMult;
  player.energyDrainMult = _lvEnergyDrainMult;

  cam = new Camera2D();
  cam.y = player.y + player.h / 2 - height * CAM_ANCHOR_Y;
  cam.y = constrain(cam.y, 0, max(0, LEVEL_HEIGHT - height));

  const groundPlat = levelData.platforms.find((p) => p.zone === "ground");
  _groundY = groundPlat ? groundPlat.y : LEVEL_HEIGHT;
  _climbPx = finishPlatform
    ? max(1, _groundY - finishPlatform.y)
    : LEVEL_HEIGHT;

  // ── Regenerate star field ────────────────────────────────
  _bgStars = [];
  for (let i = 0; i < BG_STAR_COUNT; i++) {
    _bgStars.push({
      x: random(PLAY_WIDTH),
      y: random(LEVEL_HEIGHT),
      r: random(0.5, 2.2),
      brightness: random(120, 255),
      twinkleOffset: random(TWO_PI),
    });
  }

  // ── Regenerate foreground glowing stars (Level 2 only) ───
  // Stars are distributed with heavy bias toward the upper half of the
  // level. Each star has an altThreshold below which it is fully invisible,
  // and an altPeak at which it reaches full brightness — this makes them
  // "emerge" as the player climbs into the upper atmosphere and space.
  _fgStars = [];
  if (currentLevel >= 2) {
    for (let i = 0; i < FG_STAR_COUNT; i++) {
      // Bias star positions toward the top (lower y values) using pow()
      let rawFrac = pow(random(1), 1.6); // 0 = top, 1 = bottom
      let starY = rawFrac * LEVEL_HEIGHT;

      // Stars only start appearing once the player is at least 30% up.
      // Those near the very top (high altitude fraction) appear earliest
      // and burn brightest.
      let altFrac = 1 - starY / LEVEL_HEIGHT; // 0 = ground, 1 = summit
      let threshold = max(0, 0.35 - altFrac * 0.25);
      let peak = max(threshold, altFrac * 0.85);

      // Star appearance variety
      let tier = random(1);
      let baseR, glowR;
      if (tier < 0.55) {
        // Common small white/blue-white
        baseR = random(0.8, 1.6);
        glowR = baseR * random(2.5, 4.0);
      } else if (tier < 0.82) {
        // Medium bright
        baseR = random(1.5, 2.4);
        glowR = baseR * random(2.8, 5.0);
      } else {
        // Rare large sparkler
        baseR = random(2.2, 3.5);
        glowR = baseR * random(3.5, 6.0);
      }

      // Slight colour tint variety (mostly white/blue, occasional warm)
      let hue = random(1);
      let cr = hue < 0.15 ? 255 : hue < 0.3 ? 200 : 220;
      let cg = hue < 0.15 ? 220 : hue < 0.3 ? 210 : 230;
      let cb = hue < 0.15 ? 150 : hue < 0.3 ? 255 : 255;

      _fgStars.push({
        x: random(PLAY_WIDTH),
        y: starY,
        r: baseR,
        glowR: glowR,
        altThreshold: threshold,
        altPeak: peak,
        twinkleOffset: random(TWO_PI),
        twinkleSpeed: random(0.025, 0.07),
        cr,
        cg,
        cb,
      });
    }
  }

  // ── Level 3 systems init ───────────────────────────────────
  _asteroids = [];
  _shootingStars = [];
  _shootStarTimer = SHOOTSTAR_INTERVAL_MAX;
  _ship = null;
  _shipTimer = SHIP_INTERVAL_MAX;
  _shakeTimer = 0;
  _shakeOffsetX = 0;
  _shakeOffsetY = 0;

  if (currentLevel === 3) {
    // Generate asteroids distributed across the level, biased upper half
    for (let i = 0; i < ASTEROID_COUNT; i++) {
      let ay = pow(random(1), 1.3) * LEVEL_HEIGHT * 0.85;
      _asteroids.push({
        x: random(PLAY_WIDTH),
        y: ay,
        baseX: random(PLAY_WIDTH),
        baseY: ay,
        scale: random(ASTEROID_SCALE_MIN, ASTEROID_SCALE_MAX),
        rot: random(TWO_PI),
        driftAngle: random(TWO_PI),
        driftSpeed: random(0.1, ASTEROID_DRIFT_SPEED),
        driftRange: random(20, 60),
        phase: random(TWO_PI),
      });
    }
  }
}

// ── Main game draw ────────────────────────────────────────────
function drawGame() {
  if (!winTriggered) {
    updatePlatformWobble();

    // ── Drain delayed-input queue (Level 2 & 3) ─────────────
    if (currentLevel >= 2) {
      let now = millis();
      while (
        _inputQueue.length > 0 &&
        now - _inputQueue[0].ts >= INPUT_DELAY_MS
      ) {
        _applyInputEvent(_inputQueue.shift());
      }
    }

    // ── Level 3 systems update ──────────────────────────────
    if (currentLevel === 3) {
      _updateShootingStars();
      _updateSpaceship();
      _updateAsteroids();
      _updateScreenShake();
    }

    player.inputLeft = _keys.left;
    player.inputRight = _keys.right;
    player.inputDown = _keys.down;
    player.update(platforms);
    checkWin();
    checkExhaustion();
  } else {
    winAnimTimer++;
    if (winAnimTimer > 200) currentScreen = "win";
  }

  cam.update(player);

  // ── World rendering → _worldBuffer ──────────────────────
  let g = _worldBuffer;
  let ox = getWorldOffsetX();

  g.clear();
  g.noStroke();
  g.fill(10, 20, 80);
  g.rect(0, 0, g.width, g.height);

  g.push();
  // Apply screen shake offset (Level 3 spaceship flyover)
  g.translate(ox + _shakeOffsetX, _shakeOffsetY);
  g.translate(-cam.x, -cam.y);
  _drawColumnBackground(g);
  if (currentLevel === 1) {
    _drawClouds(g);
    _drawGroundScenery(g);
  } else if (currentLevel === 2) {
    _drawStarField(g);
    _drawCloudsL2(g);
    _drawGroundScenery(g);
  } else if (currentLevel === 3) {
    _drawStarField(g);
    _drawL3Planets(g);
    _drawL3Asteroids(g);
    _drawGroundScenery(g);
  }
  _drawPlatforms(g);
  if (finishPlatform) _drawFinishMarker(g, finishPlatform);
  _drawPlayer(g);
  // Level 3: draw shooting stars and spaceship in world space
  if (currentLevel === 3) {
    _drawShootingStars(g);
    _drawSpaceship(g);
  }
  g.pop();

  // ── Stamp buffer (with blur) ─────────────────────────────
  clear();
  stampWorldBuffer();

  // ── Level 2 & 3: colour-blindness overlay ─────────────────
  if (currentLevel >= 2 && _lvColorBlindStrength > 0) {
    _applyColorBlindOverlay(_lvColorBlindStrength);
  }

  // ── Level 2 & 3: vignette / peripheral focus loss ─────────
  _drawVignette();

  // ── Side panels ─────────────────────────────────────────
  _drawSidePanels(ox);

  // ── UI ──────────────────────────────────────────────────
  drawUI();
}

// ── Colour-blindness simulation overlay ──────────────────────
function _applyColorBlindOverlay(strength) {
  let ox = getWorldOffsetX();
  let camMidY = cam.y + height * 0.5;
  let altT = 1.0 - constrain(camMidY / LEVEL_HEIGHT, 0, 1);
  let alpha = round(strength * altT * 90);
  if (alpha < 2) return;

  noStroke();
  fill(80, 82, 100, alpha);
  rect(ox, 0, PLAY_WIDTH, height);
}

// ── Side panels ───────────────────────────────────────────────
function _drawSidePanels(ox) {
  noStroke();
  let camMidY = cam.y + height * 0.5;
  let t = 1 - constrain(camMidY / LEVEL_HEIGHT, 0, 1);
  let r, gVal, b;
  if (currentLevel === 3) {
    // Mars reddish-brown near ground → pure black in deep space
    r = lerp(60, 2, t);
    gVal = lerp(25, 1, t);
    b = lerp(15, 3, t);
  } else if (currentLevel === 2) {
    r = lerp(30, 5, t);
    gVal = lerp(35, 8, t);
    b = lerp(55, 20, t);
  } else {
    r = lerp(135, 10, t);
    gVal = lerp(195, 20, t);
    b = lerp(255, 80, t);
  }
  fill(r, gVal, b);
  rect(0, 0, ox, height);
  rect(ox + PLAY_WIDTH, 0, width - ox - PLAY_WIDTH, height);
}

// ── Win detection ─────────────────────────────────────────────
function checkWin() {
  if (!finishPlatform || winTriggered) return;
  const fp = finishPlatform;
  const onTop =
    player.onGround &&
    player.x + player.w > fp.x &&
    player.x < fp.x + fp.w &&
    abs(player.y + player.h - fp.y) < 4;
  if (onTop) {
    winTriggered = true;
    if (typeof winSound !== "undefined" && winSound.isLoaded()) winSound.play();
    _stopMusic();
  }
}

// ── Exhaustion / lose detection ───────────────────────────────
function checkExhaustion() {
  if (player.isExhausted) currentScreen = "lose";
}

// ── Platform wobble / movement ───────────────────────────────
function updatePlatformWobble() {
  if (currentLevel === 1) return;
  for (let p of platforms) {
    if (p.zone === "ground" || p.isFinish) continue;

    if (p.moving) {
      // Moving platforms use only their own defined range — no extra wobble
      p.wobblePhase += PLAT_WOBBLE_FREQ;
      p.x = p.baseX + p.moveRange * sin(frameCount * p.moveSpeed);
    } else {
      // Static platforms get altitude-scaled environmental wobble only
      let platAltFrac = constrain((_groundY - p.y) / _climbPx, 0, 1);
      let wobbleAmp = PLAT_WOBBLE_AMP_MAX * pow(platAltFrac, PLAT_WOBBLE_CURVE);
      p.wobblePhase += PLAT_WOBBLE_FREQ;
      p.x = p.baseX + wobbleAmp * sin(p.wobblePhase);
    }
  }
}

// ── Checkpoint refill ─────────────────────────────────────────
function refillCheckpoint() {
  player.refillAtCheckpoint();
}

// ══════════════════════════════════════════════════════════════
// Private draw helpers
// ══════════════════════════════════════════════════════════════

// ── Star field (Level 2 only) ─────────────────────────────────
function _drawStarField(g) {
  g.noStroke();

  // Background star layer — sparse, dim, covers full level height
  for (let s of _bgStars) {
    let twinkle = 0.6 + 0.4 * sin(frameCount * 0.04 + s.twinkleOffset);
    let alpha = round(s.brightness * twinkle);
    g.fill(230, 235, 255, alpha);
    g.ellipse(s.x, s.y, s.r * 2, s.r * 2);
  }

  // Foreground glowing stars — emerge gradually as the player climbs.
  // Each star's visibility is gated by the current camera altitude so
  // stars only "switch on" when the player is high enough to see them.
  let camAltFrac = constrain(1 - (cam.y + height * 0.5) / LEVEL_HEIGHT, 0, 1);

  for (let s of _fgStars) {
    // How far past this star's threshold the camera currently is
    let progress = constrain(
      map(camAltFrac, s.altThreshold, s.altPeak, 0, 1),
      0,
      1,
    );
    if (progress <= 0) continue;

    // Also fade based on the star's own altitude in the level (higher = brighter)
    let starAltFrac = 1 - s.y / LEVEL_HEIGHT;
    let altBoost = constrain(map(starAltFrac, 0.2, 0.9, 0.2, 1.0), 0.2, 1.0);

    let twinkle =
      0.55 + 0.45 * sin(frameCount * s.twinkleSpeed + s.twinkleOffset);
    let masterAlpha = progress * altBoost * twinkle;

    // ── Soft outer glow ─────────────────────────────────────
    let glowAlpha = round(masterAlpha * 28);
    if (glowAlpha > 2) {
      g.fill(s.cr, s.cg, s.cb, glowAlpha);
      g.ellipse(s.x, s.y, s.glowR * 2.8, s.glowR * 2.8);
    }

    // ── Inner glow ring ──────────────────────────────────────
    let midAlpha = round(masterAlpha * 65);
    if (midAlpha > 3) {
      g.fill(s.cr, s.cg, s.cb, midAlpha);
      g.ellipse(s.x, s.y, s.glowR * 1.5, s.glowR * 1.5);
    }

    // ── Bright core ──────────────────────────────────────────
    let coreAlpha = round(masterAlpha * 220);
    if (coreAlpha > 5) {
      g.fill(s.cr, s.cg, s.cb, coreAlpha);
      g.ellipse(s.x, s.y, s.r * 2, s.r * 2);
    }

    // ── Cross sparkle on larger stars ────────────────────────
    if (s.r > 2.0 && masterAlpha > 0.4) {
      let lineAlpha = round(masterAlpha * 80 * twinkle);
      if (lineAlpha > 5) {
        g.stroke(s.cr, s.cg, s.cb, lineAlpha);
        g.strokeWeight(0.6);
        let arm = s.glowR * 1.1;
        g.line(s.x - arm, s.y, s.x + arm, s.y);
        g.line(s.x, s.y - arm, s.x, s.y + arm);
        g.noStroke();
      }
    }
  }
}

// ── Clouds for Level 2 ────────────────────────────────────────
function _drawCloudsL2(g) {
  if (!imgCloud1 || !imgCloud2) return;
  for (let c of CLOUD_DEFS) {
    let cloudT = constrain((_groundY - c.y) / _climbPx, 0, 1);
    if (cloudT > 0.45) continue;
    let fadeAlpha = round(map(cloudT, 0.35, 0.45, 255, 0));
    let img = c.type === 1 ? imgCloud1 : imgCloud2;
    let cw = img.width * c.scale;
    let ch = img.height * c.scale;
    g.tint(255, 255, 255, fadeAlpha);
    g.image(img, c.x, c.y, cw, ch);
    g.noTint();
  }
}

// ── Clouds (Level 1 — unchanged) ─────────────────────────────
function _drawClouds(g) {
  if (!imgCloud1 || !imgCloud2) return;
  g.noTint();
  for (let c of CLOUD_DEFS) {
    let img = c.type === 1 ? imgCloud1 : imgCloud2;
    let cw = img.width * c.scale;
    let ch = img.height * c.scale;
    g.image(img, c.x, c.y, cw, ch);
  }
}

// ── Ground scenery ────────────────────────────────────────────
function _drawGroundScenery(g) {
  if (currentLevel === 1 && (!imgTree || !imgHouse)) return;
  if (currentLevel === 2 && !imgTree) return;

  for (let t of SCENERY_TREES) {
    let tw = imgTree.width * t.scale;
    let th = imgTree.height * t.scale;
    g.image(imgTree, t.x, SCENERY_GROUND_Y - th + SCENERY_TREE_SINK, tw, th);
  }

  if (currentLevel === 1) {
    let hw = imgHouse.width * SCENERY_HOUSE.scale;
    let hh = imgHouse.height * SCENERY_HOUSE.scale;
    g.image(
      imgHouse,
      SCENERY_HOUSE.x,
      SCENERY_GROUND_Y - hh + SCENERY_HOUSE_SINK,
      hw,
      hh,
    );
  } else if (currentLevel === 2 && imgFlag) {
    let fw = imgFlag.width * FLAG_SCALE;
    let fh = imgFlag.height * FLAG_SCALE;
    g.image(imgFlag, FLAG_X, SCENERY_GROUND_Y - fh + FLAG_OFFSET_Y, fw, fh);
  } else if (currentLevel === 3 && imgFlag) {
    let fw = imgFlag.width * FLAG_SCALE;
    let fh = imgFlag.height * FLAG_SCALE;
    g.image(imgFlag, FLAG_X, SCENERY_GROUND_Y - fh + FLAG_OFFSET_Y, fw, fh);
  }
}

// ── Finish marker ─────────────────────────────────────────────
function _drawFinishMarker(g, fp) {
  const cx = fp.x + fp.w / 2;
  const topY = fp.y;

  let pulse = 0.5 + 0.5 * sin(frameCount * 0.06);
  g.noStroke();

  if (currentLevel === 3) {
    g.fill(255, 120, 40, 30 + 40 * pulse);
    g.rect(fp.x - 6, topY - 90, fp.w + 12, 90, 4);

    g.stroke(255, 150, 60);
    g.strokeWeight(2);
    g.line(cx, topY, cx, topY - 80);
    g.noStroke();

    let wave = sin(frameCount * 0.08) * 6;
    g.fill(255, 140, 50);
    g.beginShape();
    g.vertex(cx, topY - 78);
    g.vertex(cx + 36 + wave, topY - 68 + wave * 0.3);
    g.vertex(cx + 34 + wave, topY - 58 + wave * 0.3);
    g.vertex(cx, topY - 56);
    g.endShape(CLOSE);

    g.fill(255, 180, 100, 180 + 60 * pulse);
    g.noStroke();
    g.textAlign(CENTER, BOTTOM);
    g.textSize(13);
    g.textFont("monospace");
    g.text("E S C A P E", cx, topY - 86);
  } else if (currentLevel === 2) {
    g.fill(80, 200, 255, 30 + 40 * pulse);
    g.rect(fp.x - 6, topY - 90, fp.w + 12, 90, 4);

    g.stroke(160, 220, 255);
    g.strokeWeight(2);
    g.line(cx, topY, cx, topY - 80);
    g.noStroke();

    let wave = sin(frameCount * 0.08) * 6;
    g.fill(100, 200, 255);
    g.beginShape();
    g.vertex(cx, topY - 78);
    g.vertex(cx + 36 + wave, topY - 68 + wave * 0.3);
    g.vertex(cx + 34 + wave, topY - 58 + wave * 0.3);
    g.vertex(cx, topY - 56);
    g.endShape(CLOSE);

    g.fill(180, 240, 255, 180 + 60 * pulse);
    g.noStroke();
    g.textAlign(CENTER, BOTTOM);
    g.textSize(13);
    g.textFont("monospace");
    g.text("D E E P  S P A C E", cx, topY - 86);
  } else {
    g.fill(180, 255, 160, 30 + 40 * pulse);
    g.rect(fp.x - 6, topY - 90, fp.w + 12, 90, 4);

    g.stroke(200, 200, 200);
    g.strokeWeight(2);
    g.line(cx, topY, cx, topY - 80);
    g.noStroke();

    let wave = sin(frameCount * 0.08) * 6;
    g.fill(100, 220, 100);
    g.beginShape();
    g.vertex(cx, topY - 78);
    g.vertex(cx + 36 + wave, topY - 68 + wave * 0.3);
    g.vertex(cx + 34 + wave, topY - 58 + wave * 0.3);
    g.vertex(cx, topY - 56);
    g.endShape(CLOSE);

    g.fill(200, 255, 180, 180 + 60 * pulse);
    g.noStroke();
    g.textAlign(CENTER, BOTTOM);
    g.textSize(13);
    g.textFont("monospace");
    g.text("G O A L", cx, topY - 86);
  }

  for (let s = 0; s < 4; s++) {
    let angle = frameCount * 0.04 + s * (PI / 2);
    let r = 28 + 4 * pulse;
    let sx = cx + cos(angle) * r;
    let sy = topY - 40 + sin(angle) * r * 0.5;
    g.fill(255, 240, 100, 200);
    g.noStroke();
    _drawStar(g, sx, sy, 4, 8, 5);
  }
  g.textAlign(LEFT, BASELINE);
}

function _drawStar(g, x, y, r1, r2, pts) {
  g.beginShape();
  for (let i = 0; i < pts * 2; i++) {
    let angle = (PI / pts) * i - PI / 2;
    let r = i % 2 === 0 ? r2 : r1;
    g.vertex(x + cos(angle) * r, y + sin(angle) * r);
  }
  g.endShape(CLOSE);
}

// ── Column background ─────────────────────────────────────────
function _drawColumnBackground(g) {
  g.noStroke();
  let strips = 40;
  let stripH = LEVEL_HEIGHT / strips;

  for (let i = 0; i < strips; i++) {
    let t = 1 - i / strips; // 0 at top, 1 at bottom
    let r, gVal, b;

    if (currentLevel === 3) {
      // Mars reddish-brown at bottom → pure black deep space at top
      let marsT = constrain(t * 2, 0, 1);  // bottom 50% is Mars tones
      r = round(lerp(0, 70, marsT));
      gVal = round(lerp(0, 25, marsT));
      b = round(lerp(2, 12, marsT));
    } else if (currentLevel === 2) {
      r = round(lerp(10, 0, t));
      gVal = round(lerp(20, 0, t));
      b = round(lerp(80, 0, t));
    } else {
      r = round(lerp(135, 10, t));
      gVal = round(lerp(195, 20, t));
      b = round(lerp(255, 80, t));
    }
    g.fill(r, gVal, b);
    g.rect(0, i * stripH, PLAY_WIDTH, stripH + 1);
  }

  g.stroke(255, 255, 255, 6);
  g.strokeWeight(1);
  for (let lx = 4; lx <= 22; lx += 9) g.line(lx, 0, lx, LEVEL_HEIGHT);
  for (let rx = PLAY_WIDTH - 4; rx >= PLAY_WIDTH - 22; rx -= 9)
    g.line(rx, 0, rx, LEVEL_HEIGHT);
  g.noStroke();

  for (let i = 0; i < 30; i++) {
    let a = map(i, 0, 30, 25, 0);
    g.fill(0, 10, 40, a);
    g.rect(i, 0, 1, LEVEL_HEIGHT);
    g.rect(PLAY_WIDTH - i - 1, 0, 1, LEVEL_HEIGHT);
  }

  g.stroke(0, 0, 0, 8);
  g.strokeWeight(1);
  let gridSize = 8;
  for (let x = 0; x < PLAY_WIDTH; x += gridSize) g.line(x, 0, x, LEVEL_HEIGHT);
  for (let y = 0; y < LEVEL_HEIGHT; y += gridSize) g.line(0, y, PLAY_WIDTH, y);
  g.noStroke();
}

// ── Platform rendering ────────────────────────────────────────
function _drawPlatforms(g) {
  g.noStroke();

  const gp = platforms.find((p) => p.zone === "ground");
  if (gp) {
    if (currentLevel === 3 && imgGroundL3) {
      // ── Level 3 Mars ground ──
      const L3_X = gp.x;
      const L3_Y = gp.y - 200;
      const L3_WIDTH = 900;
      const L3_HEIGHT = 400;
      g.image(imgGroundL3, L3_X, L3_Y, L3_WIDTH, L3_HEIGHT);
    } else if (currentLevel === 2 && imgGroundL2) {
      // ── Level 2 cloud ground ──
      const L2_X = gp.x;
      const L2_Y = gp.y - 250;
      const L2_WIDTH = 900;
      const L2_HEIGHT = 500;
      g.image(imgGroundL2, L2_X, L2_Y, L2_WIDTH, L2_HEIGHT);
    } else if (currentLevel === 1 && imgGround) {
      // ── Level 1 ground ──
      const L1_X = gp.x;
      const L1_Y = gp.y - 40;
      const L1_WIDTH = gp.w;
      const L1_HEIGHT = imgGround.height;
      g.image(imgGround, L1_X, L1_Y, L1_WIDTH, L1_HEIGHT);
    }
  }

  for (let p of platforms) {
    if (p.isFinish) continue;
    if (p.zone === "ground") continue;

    const lk = p.laneKey || "C";
    const isWall = lk === "LL" || lk === "RR";
    const isPeak = p.section === "Peak" || p.section === "Summit";
    const isZigzag = p.section === "Zigzag";
    const isNarrow = p.w < 155;

    let platAltFrac = constrain((_groundY - p.y) / _climbPx, 0, 1);

    let baseR, baseG, baseB, platAlpha;

    if (currentLevel === 3) {
      // Mars brownish-red near ground → dark purple-blue in deep space
      baseR = round(lerp(120, 20, platAltFrac));
      baseG = round(lerp(50, 12, platAltFrac));
      baseB = round(lerp(30, 50, platAltFrac));
      platAlpha = round(lerp(200, 90, platAltFrac));
    } else if (currentLevel === 2) {
      baseR = round(lerp(40, 15, platAltFrac));
      baseG = round(lerp(55, 25, platAltFrac));
      baseB = round(lerp(120, 45, platAltFrac));
      platAlpha = 60; // ← single flat opacity for all platforms, 0–255
    } else {
      // Level 1 — original logic unchanged
      platAlpha = round(lerp(255, 115, platAltFrac));
      baseR = round(lerp(60, 85, platAltFrac));
      baseG = round(lerp(85, 110, platAltFrac));
      baseB = round(lerp(120, 150, platAltFrac));
    }
    g.fill(baseR, baseG, baseB, platAlpha);
    g.rect(p.x, p.y, p.w, p.h, 3);

    let hlAlpha = map(p.w, 130, 225, 15, 50) * (platAlpha / 255);
    g.fill(255, 255, 255, constrain(hlAlpha, 12, 42));
    g.rect(p.x, p.y, p.w, 4, 3, 3, 0, 0);

    if (isWall) {
      g.noStroke();
      g.fill(255, 255, 255, 18);
      if (lk === "LL") g.rect(p.x, p.y, 3, p.h, 3, 0, 0, 3);
      else g.rect(p.x + p.w - 3, p.y, 3, p.h, 0, 3, 3, 0);
    }

    if (isPeak || (isZigzag && isNarrow)) {
      g.noFill();
      let edgeCol = currentLevel === 3 ? [200, 100, 50] : currentLevel === 2 ? [80, 150, 215] : [215, 145, 55];
      g.stroke(edgeCol[0], edgeCol[1], edgeCol[2], 50);
      g.strokeWeight(1);
      g.rect(p.x, p.y, p.w, p.h, 3);
      g.noStroke();
    }

    g.noStroke();
    g.fill(0, 0, 0, 10);
    g.rect(p.x + 2, p.y + p.h, p.w - 4, 5, 0, 0, 3, 3);
  }

  if (finishPlatform) {
    const fp = finishPlatform;
    g.fill(fp.color[0], fp.color[1], fp.color[2]);
    g.rect(fp.x, fp.y, fp.w, fp.h, 3);
    g.fill(255, 255, 255, 42);
    g.rect(fp.x, fp.y, fp.w, 4, 3, 3, 0, 0);
    g.fill(100, 210, 100, 22);
    g.rect(fp.x + 2, fp.y + fp.h, fp.w - 4, 6, 0, 0, 4, 4);
  }
}

// ── Player rendering ──────────────────────────────────────────
function _drawPlayer(g) {
  let p = player;

  if (!imgAstronaut) {
    g.fill(220, 200, 160);
    g.noStroke();
    g.rect(p.x, p.y, p.w, p.h, 4);
    return;
  }

  if (p.isExhausted) {
    g.tint(160, 100, 100);
  } else if (p.energy < ENERGY_LOW_THRESHOLD) {
    let t = p.energy / ENERGY_LOW_THRESHOLD;
    let r = 255;
    let gv = round(lerp(100, 230, t));
    let b = round(lerp(80, 200, t));
    g.tint(r, gv, b);
  } else {
    g.noTint();
  }

  let dw = PLAYER_DRAW_W;
  let dh = PLAYER_DRAW_H;
  let dx = p.x + PLAYER_DRAW_OFFSET_X;
  let dy = p.y + PLAYER_DRAW_OFFSET_Y;

  if (!p.facingRight) {
    g.image(imgAstronaut, dx, dy, dw, dh);
  } else {
    g.push();
    g.translate(dx + dw, dy);
    g.scale(-1, 1);
    g.image(imgAstronaut, 0, 0, dw, dh);
    g.pop();
  }

  g.noTint();
}

// ── UI ────────────────────────────────────────────────────────
function drawUI() {
  let ox = getWorldOffsetX();

  fill(10, 20, 80, 245);
  noStroke();
  rect(ox, 0, PLAY_WIDTH, UI_TOP_RESERVE);

  fill(100, 160, 255, 80);
  rect(ox, UI_TOP_RESERVE - 1, PLAY_WIDTH, 1);

  let eFrac = constrain(player.energy / ENERGY_MAX, 0, 1);

  let labelW = 54;
  let pctW = 36;
  let padX = 12;
  let barH = 12;
  let barTopY = 10;
  let trackX = ox + padX + labelW;
  let trackW = PLAY_WIDTH - padX * 2 - labelW - pctW;

  fill(180, 200, 255, 220);
  noStroke();
  textFont("monospace");
  textSize(10);
  textAlign(LEFT, CENTER);
  text("ENERGY", ox + padX, barTopY + barH / 2);

  fill(5, 10, 40);
  noStroke();
  rect(trackX, barTopY, trackW, barH, 4);

  let eR, eG, eB;
  if (eFrac >= 0.5) {
    eR = round(lerp(55, 230, 1 - (eFrac - 0.5) * 2));
    eG = 215;
    eB = 55;
  } else {
    eR = 230;
    eG = round(lerp(55, 215, eFrac * 2));
    eB = 55;
  }

  let pulseAlpha =
    eFrac < ENERGY_LOW_THRESHOLD / ENERGY_MAX
      ? round(180 + 75 * sin(frameCount * 0.22))
      : 255;

  let fillW = trackW * eFrac;
  if (fillW > 4) {
    fill(eR, eG, eB, pulseAlpha);
    noStroke();
    rect(trackX, barTopY, fillW, barH, 4);
  }

  noFill();
  stroke(80, 120, 200, 180);
  strokeWeight(1);
  rect(trackX, barTopY, trackW, barH, 4);
  noStroke();

  fill(eR, eG, eB, 220);
  textAlign(LEFT, CENTER);
  textSize(10);
  text(floor(eFrac * 100) + "%", trackX + trackW + 5, barTopY + barH / 2);

  if (eFrac < ENERGY_LOW_THRESHOLD / ENERGY_MAX && !player.isExhausted) {
    let wa = round(120 + 110 * sin(frameCount * 0.25));
    fill(255, 75, 75, wa);
    noStroke();
    textAlign(CENTER, TOP);
    textSize(10);
    text("! LOW ENERGY !", ox + PLAY_WIDTH / 2, barTopY + barH + 5);
  }

  fill(180, 200, 255, 160);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(9);
  text("LVL " + currentLevel, ox + padX, barTopY + barH + 4);

  let playerFeetY = player.y + PLAYER_H;
  let altKm = constrain(((_groundY - playerFeetY) / _climbPx) * 100, 0, 100);

  let altitude = max(0, LEVEL_HEIGHT - (player.y + player.h));
  let zoneName = getZoneLabel(altitude);

  fill(200, 220, 255, 220);
  noStroke();
  textAlign(RIGHT, CENTER);
  textSize(9);
  text(zoneName.toUpperCase(), ox + PLAY_WIDTH - padX, UI_TOP_RESERVE / 2 + 6);

  let barX = ox + PLAY_WIDTH - 22;
  let barTopYA = UI_TOP_RESERVE + height * 0.04;
  let barHA = height * 0.55;

  fill(0, 0, 0, 140);
  noStroke();
  rect(barX - 7, barTopYA - 6, 22, barHA + 12, 8);

  stroke(200, 230, 255, 200);
  strokeWeight(1.5);
  noFill();
  rect(barX - 2, barTopYA - 2, 12, barHA + 4, 5);
  noStroke();

  fill(8, 14, 40, 230);
  noStroke();
  rect(barX, barTopYA, 8, barHA, 4);

  let altFrac = altKm / 100;
  let aR = round(lerp(255, 180, altFrac));
  let aG = round(lerp(140, 240, altFrac));
  let aB = round(lerp(40, 255, altFrac));

  fill(aR, aG, aB, 40);
  rect(barX - 1, barTopYA, 10, barHA, 4);

  fill(aR, aG, aB, 240);
  let fillH = barHA * altFrac;
  if (fillH > 2) rect(barX, barTopYA + barHA - fillH, 8, fillH, 4);

  stroke(255, 255, 255, 180);
  strokeWeight(1);
  line(barX - 3, barTopYA, barX + 11, barTopYA);
  noStroke();

  if (fillH > 2) {
    let dotPulse = 0.65 + 0.35 * sin(frameCount * 0.08);
    fill(255, 255, 255, round(200 * dotPulse));
    noStroke();
    ellipse(barX + 4, barTopYA + barHA - fillH, 7, 7);
    fill(aR, aG, aB, 255);
    ellipse(barX + 4, barTopYA + barHA - fillH, 4, 4);
  }

  let kmLabel = altKm >= 99.5 ? "100 km" : floor(altKm) + " km";
  textAlign(RIGHT, BOTTOM);
  textSize(11);
  textFont("monospace");

  fill(0, 0, 0, 200);
  noStroke();
  rect(barX - 32, barTopYA - 19, 46, 16, 3);

  fill(aR, aG, aB, 255);
  text(kmLabel, barX + 8, barTopYA - 3);

  if (winTriggered) {
    let a = map(winAnimTimer, 0, 90, 0, 200);
    fill(160, 210, 255, constrain(a, 0, 200));
    noStroke();
    rect(ox, 0, PLAY_WIDTH, height);
    fill(10, 40, 100, constrain(a * 1.5, 0, 255));
    textAlign(CENTER, CENTER);
    textSize(36);
    textFont("monospace");
    text("YOU MADE IT!", ox + PLAY_WIDTH / 2, height / 2);
    textAlign(LEFT, BASELINE);
  }

  if (!_playerHasMoved && !winTriggered) {
    fill(20, 20, 60, 200);
    textAlign(CENTER, BOTTOM);
    textStyle(BOLD);
    textSize(13);
    text(
      "A/D or ← → move   ↑/W/Space jump   ↓/S fast-fall",
      ox + PLAY_WIDTH / 2,
      height - 20,
    );
  }

  textAlign(LEFT, BASELINE);
}

function getZoneLabel(altitude) {
  if (currentLevel === 3) {
    const t = altitude / LEVEL_HEIGHT;
    if (t < 0.08) return "Mars Surface";
    if (t < 0.22) return "Mars Atmo";
    if (t < 0.38) return "Upper Mars";
    if (t < 0.52) return "Low Deep";
    if (t < 0.68) return "Mid Deep";
    if (t < 0.82) return "Far Deep";
    if (t < 0.94) return "Summit";
    return "ESCAPE";
  }
  if (currentLevel === 2) {
    const t = altitude / LEVEL_HEIGHT;
    if (t < 0.08) return "Ground";
    if (t < 0.25) return "Atmosphere";
    if (t < 0.45) return "Upper Atmo";
    if (t < 0.6) return "Low Space";
    if (t < 0.75) return "Mid Space";
    if (t < 0.88) return "Deep Space";
    return "SUMMIT";
  }
  const t = altitude / LEVEL_HEIGHT;
  if (t < 0.08) return "Ground";
  if (t < 0.2) return "Left Wall";
  if (t < 0.3) return "Bridge";
  if (t < 0.42) return "Right Wall";
  if (t < 0.52) return "Bridge";
  if (t < 0.62) return "L↔C Zigzag";
  if (t < 0.72) return "R↔C Zigzag";
  if (t < 0.8) return "Left Ledge";
  if (t < 0.86) return "Crossing";
  if (t < 0.92) return "Right Ledge";
  if (t < 0.96) return "Crossing";
  if (t < 0.99) return "Peak";
  return "SUMMIT";
}

// ── Input routing ─────────────────────────────────────────────
// _applyInputEvent: shared logic for immediately applying a key event.
function _applyInputEvent(evt) {
  let kc = evt.kc;
  if (evt.type === "press") {
    if (kc === LEFT_ARROW || kc === 65) {
      _keys.left = true;
      _playerHasMoved = true;
    }
    if (kc === RIGHT_ARROW || kc === 68) {
      _keys.right = true;
      _playerHasMoved = true;
    }
    if (kc === DOWN_ARROW || kc === 83) {
      _keys.down = true;
      _playerHasMoved = true;
    }
    if (kc === UP_ARROW || kc === 87 || kc === 32) {
      player.inputJump = true;
      _playerHasMoved = true;
    }
  } else {
    if (kc === LEFT_ARROW || kc === 65) _keys.left = false;
    if (kc === RIGHT_ARROW || kc === 68) _keys.right = false;
    if (kc === DOWN_ARROW || kc === 83) _keys.down = false;
  }
}

function gameKeyPressed(kc) {
  if (currentLevel >= 2) {
    // Queue the event; it will be applied after INPUT_DELAY_MS.
    _inputQueue.push({ type: "press", kc: kc, ts: millis() });
    // Still mark _playerHasMoved immediately so instructions disappear on first keypress.
    if (
      kc === LEFT_ARROW ||
      kc === 65 ||
      kc === RIGHT_ARROW ||
      kc === 68 ||
      kc === DOWN_ARROW ||
      kc === 83 ||
      kc === UP_ARROW ||
      kc === 87 ||
      kc === 32
    ) {
      _playerHasMoved = true;
    }
  } else {
    _applyInputEvent({ type: "press", kc: kc });
  }
}

function gameKeyReleased(kc) {
  if (currentLevel >= 2) {
    _inputQueue.push({ type: "release", kc: kc, ts: millis() });
  } else {
    _applyInputEvent({ type: "release", kc: kc });
  }
}

// ══════════════════════════════════════════════════════════════
// Level 3 — Mars → Deep Space: draw & update helpers
// ══════════════════════════════════════════════════════════════

// ── Planet decorations ───────────────────────────────────────
// Static images placed at fixed positions in level-space.
function _drawL3Planets(g) {
  for (let pd of L3_PLANETS) {
    let img = null;
    if (pd.key === "earth") img = imgEarth;
    else if (pd.key === "saturn") img = imgSaturn;
    else if (pd.key === "venus") img = imgVenus;
    else if (pd.key === "mercury") img = imgMercury;
    if (!img) continue;

    let pw = img.width * pd.scale;
    let ph = img.height * pd.scale;

    // Gentle slow float animation
    let floatY = sin(frameCount * 0.012 + pd.y * 0.01) * 6;
    g.image(img, pd.x, pd.y + floatY, pw, ph);
  }
}

// ── Asteroids ────────────────────────────────────────────────
function _updateAsteroids() {
  for (let a of _asteroids) {
    a.rot += ASTEROID_ROTATE_SPEED;
    // Slow orbit around base position
    a.x = a.baseX + sin(frameCount * 0.008 + a.phase) * a.driftRange;
    a.y = a.baseY + cos(frameCount * 0.006 + a.phase) * a.driftRange * 0.5;
  }
}

function _drawL3Asteroids(g) {
  if (!imgAsteroid) return;
  for (let a of _asteroids) {
    let aw = imgAsteroid.width * a.scale;
    let ah = imgAsteroid.height * a.scale;
    g.push();
    g.translate(a.x + aw / 2, a.y + ah / 2);
    g.rotate(a.rot);
    g.image(imgAsteroid, -aw / 2, -ah / 2, aw, ah);
    g.pop();
  }
}

// ── Shooting stars ───────────────────────────────────────────
function _updateShootingStars() {
  // Spawn new shooting stars on a timer
  _shootStarTimer--;
  if (_shootStarTimer <= 0 && _shootingStars.length < SHOOTSTAR_MAX_ACTIVE) {
    // Spawn in screen-space relative to camera, converted to world coords
    let sx = random(-50, PLAY_WIDTH);
    let sy = cam.y + random(-50, height * 0.3);
    _shootingStars.push({
      x: sx,
      y: sy,
      vx: SHOOTSTAR_SPEED * random(0.7, 1.3),
      vy: SHOOTSTAR_SPEED * random(0.5, 1.0),
      life: 0,
      maxLife: floor(random(60, 120)),
    });
    _shootStarTimer = floor(
      random(SHOOTSTAR_INTERVAL_MIN, SHOOTSTAR_INTERVAL_MAX)
    );
  }

  // Update existing
  for (let i = _shootingStars.length - 1; i >= 0; i--) {
    let s = _shootingStars[i];
    s.x += s.vx;
    s.y += s.vy;
    s.life++;
    if (s.life > s.maxLife || s.x > PLAY_WIDTH + 100) {
      _shootingStars.splice(i, 1);
    }
  }
}

function _drawShootingStars(g) {
  if (!imgShootingStar) return;
  for (let s of _shootingStars) {
    let fadeIn = constrain(s.life / 10, 0, 1);
    let fadeOut = constrain((s.maxLife - s.life) / 15, 0, 1);
    let alpha = round(255 * fadeIn * fadeOut);
    if (alpha < 5) continue;

    let sw = imgShootingStar.width * SHOOTSTAR_SCALE;
    let sh = imgShootingStar.height * SHOOTSTAR_SCALE;
    g.push();
    g.translate(s.x, s.y);
    // Rotate sprite to match movement direction
    g.rotate(atan2(s.vy, s.vx) + PI * 0.15);
    g.tint(255, 255, 255, alpha);
    g.image(imgShootingStar, -sw / 2, -sh / 2, sw, sh);
    g.noTint();
    g.pop();
  }
}

// ── Spaceship flyover ────────────────────────────────────────
function _updateSpaceship() {
  if (_ship) {
    // Move ship across screen
    _ship.x += SHIP_SPEED * _ship.dir;
    // Check if ship has exited screen bounds (in world space)
    let screenLeft = cam.x - 100;
    let screenRight = cam.x + PLAY_WIDTH + 100;
    if (
      (_ship.dir > 0 && _ship.x > screenRight) ||
      (_ship.dir < 0 && _ship.x < screenLeft)
    ) {
      _ship = null;
      _shakeTimer = SHIP_SHAKE_DECAY; // residual shake after exit
    }
  } else {
    // Countdown to next flyover
    _shipTimer--;
    if (_shipTimer <= 0) {
      let dir = random(1) < 0.5 ? 1 : -1;
      let startX = dir > 0 ? -120 : PLAY_WIDTH + 120;
      let yInScreen = cam.y + random(height * 0.15, height * 0.65);
      _ship = { x: startX, y: yInScreen, dir: dir };
      _shakeTimer = 999; // active shake while ship is on screen
      _shipTimer = floor(random(SHIP_INTERVAL_MIN, SHIP_INTERVAL_MAX));
    }
  }
}

function _drawSpaceship(g) {
  if (!_ship || !imgSpaceship) return;
  let sw = imgSpaceship.width * SHIP_SCALE;
  let sh = imgSpaceship.height * SHIP_SCALE;
  g.push();
  g.translate(_ship.x + sw / 2, _ship.y + sh / 2);
  if (_ship.dir < 0) g.scale(-1, 1);
  g.image(imgSpaceship, -sw / 2, -sh / 2, sw, sh);
  g.pop();
}

// ── Screen shake ─────────────────────────────────────────────
function _updateScreenShake() {
  if (_shakeTimer > 0 || _ship) {
    let intensity = SHIP_SHAKE_INTENSITY;
    // Decay intensity when ship has left
    if (!_ship && _shakeTimer > 0) {
      intensity *= _shakeTimer / SHIP_SHAKE_DECAY;
      _shakeTimer--;
    }
    _shakeOffsetX = random(-intensity, intensity);
    _shakeOffsetY = random(-intensity, intensity);
  } else {
    _shakeOffsetX = 0;
    _shakeOffsetY = 0;
  }
}
