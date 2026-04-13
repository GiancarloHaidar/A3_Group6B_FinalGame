// ============================================================
// sketch.js — Conductor / Router
// ============================================================

let currentScreen = "intro"; // "intro" | "game" | "win" | "lose"

let player;
let platforms;
let cam;
let levelData;

// ── Level management ──────────────────────────────────────────
let currentLevel = 1;
let level1Data = null;
let level2Data = null;
let level3Data = null;

// ── Star progression ──────────────────────────────────────────
let _totalStars = 0;
let _starAwardedThisWin = false;
let _starAnimTimer = 0;
const STAR_ANIM_DURATION = 40;

// ── One-shot music-stop flags ──────────────────────────────────
let _winMusicStopped = false;
let _loseMusicStopped = false;

// ── Intro video ───────────────────────────────────────────────
let _introVideo = null;
let _continueBtnHandler = null;

// ── World graphics buffer ─────────────────────────────────────
// FIX: Buffer is PLAY_WIDTH (800px) wide, NOT windowWidth.
// The blur filter and all world drawing only ever touch 800×screenHeight
// pixels regardless of monitor size. On a 4K HDMI display this cuts
// GPU compositing cost by ~5× compared to a full-resolution buffer.
let _worldBuffer = null;

// ── Blur state machine ────────────────────────────────────────
let _blurState = "idle";
let _blurTimer = 0;
let _blurRadius = 0;
let _nextBlurInterval = 0;

let imgHouse;
let imgTree;
let imgAstronaut;
let imgGround;
let imgGroundL2;
let imgGroundL3;
let imgCloud1;
let imgCloud2;
let imgFlag;
let imgEarth;
let imgSaturn;
let imgVenus;
let imgMercury;
let imgShootingStar;
let imgAsteroid;
let imgSpaceship;

let bgMusic;
let jumpSound;
let landingSound;
let lowEnergySound;
let fallingSound;
let failSound;
let winSound;
let speakingSound;
let spaceshipSound;
let bgMusic2;
let bgMusic3;

function preload() {
  level1Data = loadJSON("level1.json");
  level2Data = loadJSON("level2.json");
  level3Data = loadJSON("level3.json");
  bgMusic = loadSound("Assets/Background1.mp3");
  jumpSound = loadSound("Assets/Jump.mp3");
  landingSound = loadSound("Assets/Landing.mp3");
  lowEnergySound = loadSound("Assets/LowEnergy.mp3");
  fallingSound = loadSound("Assets/Falling.mp3");
  failSound = loadSound("Assets/Fail.mp3");
  winSound = loadSound("Assets/Win.mp3");
  speakingSound = loadSound("Assets/Speaking.mp3");
  bgMusic2 = loadSound("Assets/Background2.mp3");
  bgMusic3 = loadSound("Assets/Background3.mp3");
  spaceshipSound = loadSound("Assets/Spaceship.mp3");

  imgHouse = loadImage("Assets/house.png");
  imgTree = loadImage("Assets/tree.png");
  imgAstronaut = loadImage("Assets/astronaut.png");
  imgGround = loadImage("Assets/ground.png");
  imgGroundL2 = loadImage("Assets/cloud_platform1.png");
  imgGroundL3 = loadImage("Assets/mars_platform.png");
  imgFlag = loadImage("Assets/flag.png");
  imgCloud1 = loadImage("Assets/Cloud1.png");
  imgCloud2 = loadImage("Assets/Cloud2.png");
  imgEarth = loadImage("Assets/earth.png");
  imgSaturn = loadImage("Assets/saturn.png");
  imgVenus = loadImage("Assets/venus.png");
  imgMercury = loadImage("Assets/mercury.png");
  imgShootingStar = loadImage("Assets/shooting_star.png");
  imgAsteroid = loadImage("Assets/astroid.png");
  imgSpaceship = loadImage("Assets/spaceship.png");
}

// ── Level helpers ─────────────────────────────────────────────
function _loadLevel(n) {
  currentLevel = n;
  if (n === 3) levelData = level3Data;
  else if (n === 2) levelData = level2Data;
  else levelData = level1Data;
}

// ── Intro video helpers ───────────────────────────────────────

function _startIntro() {
  if (window._introStarted) return;
  window._introStarted = true;

  const overlay = document.getElementById("startOverlay");

  if (overlay && overlay.style.display !== "none") {
    overlay.addEventListener("click", _playIntroVideo, { once: true });
  } else {
    _playIntroVideo();
  }
}

function _playIntroVideo() {
  _introVideo = document.getElementById("introVideo");

  _introVideo.src = "Assets/intro.mp4";
  _introVideo.style.display = "block";
  _introVideo.style.position = "fixed";
  _introVideo.style.top = "50%";
  _introVideo.style.left = "50%";
  _introVideo.style.transform = "translate(-50%, -50%)";
  _introVideo.style.width = "90%";
  _introVideo.style.height = "90%";
  _introVideo.style.objectFit = "contain";
  _introVideo.style.zIndex = "10";

  _introVideo.muted = true;

  const EARLY_BY_INTRO = 2.0;
  let _btnShown = false;

  _introVideo.addEventListener("timeupdate", function _checkEarlyIntro() {
    if (_btnShown) return;
    const remaining = _introVideo.duration - _introVideo.currentTime;
    if (remaining <= EARLY_BY_INTRO) {
      _btnShown = true;
      _introVideo.removeEventListener("timeupdate", _checkEarlyIntro);
      _onIntroEnded();
    }
  });

  _introVideo.addEventListener("ended", _onIntroEnded, { once: true });

  _introVideo.play().catch(() => {
    console.warn("Intro video play() failed — skipping to game.");
    _onIntroEnded();
  });

  if (bgMusic && !bgMusic.isPlaying()) bgMusic.loop();
}

function _setContinueBtnHandler(fn) {
  const btn = document.getElementById("continueBtn");
  if (_continueBtnHandler) {
    btn.removeEventListener("click", _continueBtnHandler);
  }
  _continueBtnHandler = fn;
  btn.addEventListener("click", fn, { once: true });
}

function _onIntroEnded() {
  if (_introVideo) _introVideo.pause();

  document.getElementById("continueBtnImg").src = "Assets/StartButton.png";
  const btn = document.getElementById("continueBtn");
  btn.style.display = "flex";
  _setContinueBtnHandler(_onContinueClicked);
}

function _onContinueClicked() {
  document.getElementById("continueBtn").style.display = "none";
  _continueBtnHandler = null;

  if (_introVideo) {
    _introVideo.style.display = "none";
    _introVideo = null;
  }

  _playScene2();
}

// ── Scene 2 video ─────────────────────────────────────────────

function _playScene2() {
  _introVideo = document.getElementById("introVideo");

  _introVideo.src = "Assets/Scene2.mp4";
  _introVideo.muted = true;

  _introVideo.style.display = "block";
  _introVideo.style.position = "fixed";
  _introVideo.style.width = "90%";
  _introVideo.style.height = "90%";
  _introVideo.style.top = "50%";
  _introVideo.style.left = "50%";
  _introVideo.style.transform = "translate(-50%, -50%)";
  _introVideo.style.objectFit = "contain";

  const EARLY_BY = 6.0;
  let _btnShown = false;

  _introVideo.addEventListener("timeupdate", function _checkEarly() {
    if (_btnShown) return;
    const remaining = _introVideo.duration - _introVideo.currentTime;
    if (remaining <= EARLY_BY) {
      _btnShown = true;
      _introVideo.removeEventListener("timeupdate", _checkEarly);
      _onScene2Ended();
    }
  });

  _introVideo.addEventListener("ended", _onScene2Ended, { once: true });

  _introVideo.play().catch(() => {
    console.warn("Scene2 play() failed — skipping to game.");
    _onScene2Ended();
  });

  if (speakingSound && speakingSound.isLoaded()) speakingSound.play();
}

function _onScene2Ended() {
  if (_introVideo) _introVideo.pause();

  document.getElementById("continueBtnImg").src = "Assets/Continue.png";
  const btn = document.getElementById("continueBtn");
  btn.style.display = "flex";
  _setContinueBtnHandler(_onScene2Continued);
}

function _onScene2Continued() {
  document.getElementById("continueBtn").style.display = "none";
  _continueBtnHandler = null;
  if (_introVideo) {
    _introVideo.style.display = "none";
    _introVideo = null;
  }
  _loadLevel(1);
  currentScreen = "game";
  _syncMusic();
}

// ── Level 2 transition video ──────────────────────────────────

function _playLevel2Video() {
  let backdrop = document.getElementById("videoBackdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "videoBackdrop";
    backdrop.style.cssText =
      "position:fixed;inset:0;background:#000;z-index:9;";
    document.body.appendChild(backdrop);
  }
  backdrop.style.display = "block";

  _introVideo = document.getElementById("introVideo");

  _introVideo.src = "Assets/Level2Video.mp4";
  _introVideo.muted = true;

  _introVideo.style.display = "block";
  _introVideo.style.position = "fixed";
  _introVideo.style.width = "90%";
  _introVideo.style.height = "90%";
  _introVideo.style.top = "50%";
  _introVideo.style.left = "50%";
  _introVideo.style.transform = "translate(-50%, -50%)";
  _introVideo.style.objectFit = "contain";
  _introVideo.style.zIndex = "10";

  _introVideo.addEventListener("ended", _onLevel2VideoEnded, { once: true });

  _introVideo.play().catch(() => {
    console.warn("Level2Video play() failed — skipping to game.");
    _onLevel2VideoEnded();
  });

  if (speakingSound && speakingSound.isLoaded()) speakingSound.play();
  if (bgMusic && bgMusic.isPlaying()) bgMusic.stop();
  if (bgMusic2 && bgMusic2.isLoaded() && !bgMusic2.isPlaying()) bgMusic2.loop();
}

function _onLevel2VideoEnded() {
  if (_introVideo) _introVideo.pause();

  document.getElementById("continueBtnImg").src = "Assets/Continue.png";
  const btn = document.getElementById("continueBtn");
  btn.style.display = "flex";
  _setContinueBtnHandler(_onLevel2VideoContinued);
}

function _onLevel2VideoContinued() {
  document.getElementById("continueBtn").style.display = "none";
  _continueBtnHandler = null;
  if (_introVideo) {
    _introVideo.style.display = "none";
    _introVideo = null;
  }
  let backdrop = document.getElementById("videoBackdrop");
  if (backdrop) backdrop.style.display = "none";
  _starAwardedThisWin = false;
  _loadLevel(2);
  currentScreen = "game";
  initGame();
  _initBlur();
  if (speakingSound && speakingSound.isPlaying()) speakingSound.stop();
  _syncMusic();
}

// ── Level 3 transition video ──────────────────────────────────

function _playLevel3Video() {
  let backdrop = document.getElementById("videoBackdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "videoBackdrop";
    backdrop.style.cssText =
      "position:fixed;inset:0;background:#000;z-index:9;";
    document.body.appendChild(backdrop);
  }
  backdrop.style.display = "block";

  _introVideo = document.getElementById("introVideo");

  _introVideo.src = "Assets/Before_Level_3_Dialogue_Vid.mp4";
  _introVideo.muted = true;

  _introVideo.style.display = "block";
  _introVideo.style.position = "fixed";
  _introVideo.style.width = "90%";
  _introVideo.style.height = "90%";
  _introVideo.style.top = "50%";
  _introVideo.style.left = "50%";
  _introVideo.style.transform = "translate(-50%, -50%)";
  _introVideo.style.objectFit = "contain";
  _introVideo.style.zIndex = "10";

  _introVideo.addEventListener("ended", _onLevel3VideoEnded, { once: true });

  _introVideo.play().catch(() => {
    console.warn("Level3 transition video play() failed — skipping to game.");
    _onLevel3VideoEnded();
  });

  if (speakingSound && speakingSound.isLoaded()) speakingSound.play();
  if (bgMusic && bgMusic.isPlaying()) bgMusic.stop();
  if (bgMusic2 && bgMusic2.isPlaying()) bgMusic2.stop();
  if (bgMusic3 && bgMusic3.isLoaded() && !bgMusic3.isPlaying()) bgMusic3.loop();
}

function _onLevel3VideoEnded() {
  if (_introVideo) _introVideo.pause();

  document.getElementById("continueBtnImg").src = "Assets/Continue.png";
  const btn = document.getElementById("continueBtn");
  btn.style.display = "flex";
  _setContinueBtnHandler(_onLevel3VideoContinued);
}

function _onLevel3VideoContinued() {
  document.getElementById("continueBtn").style.display = "none";
  _continueBtnHandler = null;
  if (_introVideo) {
    _introVideo.style.display = "none";
    _introVideo = null;
  }
  let backdrop = document.getElementById("videoBackdrop");
  if (backdrop) backdrop.style.display = "none";
  _starAwardedThisWin = false;
  _loadLevel(3);
  currentScreen = "game";
  initGame();
  _initBlur();
  if (speakingSound && speakingSound.isPlaying()) speakingSound.stop();
  _syncMusic();
}

// ── Final closing clip ────────────────────────────────────────

function _playFinalClip() {
  _stopMusic();

  let backdrop = document.getElementById("videoBackdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "videoBackdrop";
    backdrop.style.cssText =
      "position:fixed;inset:0;background:#000;z-index:9;";
    document.body.appendChild(backdrop);
  }
  backdrop.style.display = "block";

  _introVideo = document.getElementById("introVideo");
  _introVideo.src = "Assets/final_closing_clip__after_level_3_.mp4";
  _introVideo.muted = true;

  _introVideo.style.display = "block";
  _introVideo.style.position = "fixed";
  _introVideo.style.width = "90%";
  _introVideo.style.height = "90%";
  _introVideo.style.top = "50%";
  _introVideo.style.left = "50%";
  _introVideo.style.transform = "translate(-50%, -50%)";
  _introVideo.style.objectFit = "contain";
  _introVideo.style.zIndex = "10";

  _introVideo.addEventListener("ended", _onFinalClipEnded, { once: true });

  _introVideo.play().catch(() => {
    console.warn("Final clip play() failed — restarting game.");
    _onFinalClipEnded();
  });

  if (speakingSound && speakingSound.isLoaded()) {
    speakingSound.play();
    setTimeout(function () {
      if (speakingSound.isPlaying()) speakingSound.stop();
    }, 3000);
  }

  if (bgMusic && bgMusic.isLoaded() && !bgMusic.isPlaying()) {
    bgMusic.loop();
  }
}

function _onFinalClipEnded() {
  if (_introVideo) {
    _introVideo.pause();
    _introVideo.style.display = "none";
    _introVideo = null;
  }
  let backdrop = document.getElementById("videoBackdrop");
  if (backdrop) backdrop.style.display = "none";

  _stopMusic();
  _totalStars = 0;
  _starAwardedThisWin = false;
  _winMusicStopped = false;
  _loseMusicStopped = false;
  window._introStarted = false;
  _loadLevel(1);
  currentScreen = "intro";
  initGame();
  _initBlur();

  const overlay = document.getElementById("startOverlay");
  if (overlay) {
    overlay.style.display = "flex";
    overlay.addEventListener(
      "click",
      function () {
        overlay.style.display = "none";
        if (typeof _startIntro === "function") {
          window._introStarted = false;
          _startIntro();
        }
      },
      { once: true },
    );
  }
}

// ── Blur helpers ──────────────────────────────────────────────

function _initBlur() {
  _blurState = "idle";
  _blurTimer = BLUR_INTERVAL_MAX;
  _blurRadius = 0;
  _nextBlurInterval = 0;
}

function _nextIdleInterval() {
  if (!player) return BLUR_INTERVAL_MAX;
  let fatigueT = 1 - constrain(player.energy / ENERGY_MAX, 0, 1);
  let interval = lerp(BLUR_INTERVAL_MAX, BLUR_INTERVAL_MIN, fatigueT);
  return floor(interval + random(-20, 20));
}

function _peakBlur() {
  if (!player) return BLUR_INTENSITY_MAX;
  let fatigueT = 1 - constrain(player.energy / ENERGY_MAX, 0, 1);
  return BLUR_INTENSITY_MAX * (1 + BLUR_ENERGY_SCALE * fatigueT);
}

function _updateBlur() {
  let gameActive = currentScreen === "game";
  let energyDepleting = player && player.energy <= 70;

  switch (_blurState) {
    case "idle":
      _blurRadius = 0;
      if (gameActive && energyDepleting) {
        let targetInterval = _nextIdleInterval();
        if (_blurTimer > targetInterval) _blurTimer = targetInterval;
        _blurTimer--;
        if (_blurTimer <= 0) {
          _blurState = "fadein";
          _blurTimer = BLUR_FADE_IN_FRAMES;
          _nextBlurInterval = _nextIdleInterval();
        }
      }
      break;
    case "fadein":
      _blurTimer--;
      let tIn = 1 - _blurTimer / BLUR_FADE_IN_FRAMES;
      _blurRadius = _peakBlur() * tIn;
      if (_blurTimer <= 0) {
        _blurState = "hold";
        _blurTimer = BLUR_HOLD_FRAMES;
      }
      break;
    case "hold":
      _blurRadius = _peakBlur();
      _blurTimer--;
      if (_blurTimer <= 0) {
        _blurState = "fadeout";
        _blurTimer = BLUR_FADE_OUT_FRAMES;
      }
      break;
    case "fadeout":
      _blurTimer--;
      let tOut = _blurTimer / BLUR_FADE_OUT_FRAMES;
      _blurRadius = _peakBlur() * tOut;
      if (_blurTimer <= 0) {
        _blurRadius = 0;
        _blurState = "idle";
        _blurTimer =
          _nextBlurInterval > 0 ? _nextBlurInterval : _nextIdleInterval();
      }
      break;
  }
}

// ── Integer-scale helper ──────────────────────────────────────
// Keeps pixel art crisp by:
//   1. Snapping the game column's horizontal offset to a whole pixel,
//      so the 800px worldBuffer never lands on a sub-pixel boundary.
//      Without this, (windowWidth - 800) being odd places every sprite
//      at a 0.5px offset, which softly blurs all pixel art edges.
//   2. Setting image-rendering: pixelated on the canvas element so
//      the browser uses nearest-neighbour compositing (no AA blur).
//
// Returns the integer-snapped ox value so stampWorldBuffer uses it
// consistently without recomputing.
function applyIntegerScale() {
  // floor() guarantees the column offset is always a whole CSS pixel.
  let ox = floor((windowWidth - PLAY_WIDTH) / 2);

  // Nearest-neighbour rendering: prevents any browser-level
  // anti-aliasing on top of what p5 already drew to the canvas.
  let cnv = document.querySelector("canvas");
  if (cnv) {
    cnv.style.imageRendering = "pixelated";
  }

  return ox;
}

// FIX: Stamp the narrow buffer (PLAY_WIDTH wide) at the horizontal
// offset so it lands centred on the main canvas.
// The buffer is no longer windowWidth wide, so the blur filter only
// processes the 800px game column, not the full monitor resolution.
// floor() on ox ensures the buffer always lands on a whole pixel —
// prevents sub-pixel placement from softly blurring all sprite edges.
function stampWorldBuffer() {
  let ox = floor((width - PLAY_WIDTH) / 2);
  let ctx = drawingContext;
  if (_blurRadius > 0.05) {
    ctx.filter = "blur(" + _blurRadius.toFixed(2) + "px)";
  }
  image(_worldBuffer, ox, 0);
  ctx.filter = "none";
}

// ── Vignette overlay (Level 2 & 3) ───────────────────────────
function _drawVignette() {
  if (currentLevel !== 2 && currentLevel !== 3) return;

  let fatigueT = player ? 1 - constrain(player.energy / ENERGY_MAX, 0, 1) : 0;

  let edgeAlpha = VIGNETTE_ALPHA_BASE + VIGNETTE_ALPHA_FATIGUE * fatigueT;

  let halfDiag = sqrt(width * width + height * height) * 0.5;
  let cx = width / 2;
  let cy = height / 2;

  let innerFrac = VIGNETTE_INNER_RADIUS - VIGNETTE_FATIGUE_SHRINK * fatigueT;
  let innerR = halfDiag * innerFrac;

  let ctx = drawingContext;
  let grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, halfDiag);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0," + (edgeAlpha / 255).toFixed(3) + ")");

  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// ── p5 lifecycle ──────────────────────────────────────────────

function setup() {
  // ── HiDPI performance lock ────────────────────────────────────
  // Without this, plugging into a 4K monitor makes the canvas 2–3×
  // larger in actual pixels. The blur filter in stampWorldBuffer()
  // then runs on a ~2400px buffer instead of 800px — that is where
  // the lag spike on monitor plug-in comes from.
  // pixelDensity(1) locks canvas pixels to CSS pixels, keeping the
  // buffer cost constant regardless of devicePixelRatio.
  // Must be called BEFORE createCanvas so the backing store is
  // allocated at the correct size from the very first frame.
  pixelDensity(1);

  createCanvas(windowWidth, windowHeight);

  // FIX: Buffer is PLAY_WIDTH wide (800px), not windowWidth.
  // Blur filter and world drawing cost is now constant regardless of
  // monitor resolution — connecting a 4K HDMI display no longer lags.
  _worldBuffer = createGraphics(PLAY_WIDTH, windowHeight);

  // Lock to 60 fps so all frame-counted timers, physics, and wobble
  // run at the intended speed on any monitor refresh rate.
  frameRate(60);

  _loadLevel(1);
  initGame();
  _initBlur();

  bgMusic.setVolume(0.4);
  bgMusic2.setVolume(0.4);
  bgMusic3.setVolume(0.4);
  spaceshipSound.setVolume(0.6);
  jumpSound.setVolume(0.6);
  landingSound.setVolume(0.5);
  lowEnergySound.setVolume(0.6);
  fallingSound.setVolume(0.5);
  failSound.setVolume(0.6);
  winSound.setVolume(0.6);

  // Snap column offset to integer pixels and apply nearest-neighbour
  // CSS rendering on first load.
  applyIntegerScale();

  _startIntro();
}

// ── Music helpers ─────────────────────────────────────────────
function _syncMusic() {
  if (currentLevel === 2) {
    if (bgMusic.isPlaying()) bgMusic.stop();
    if (bgMusic3.isPlaying()) bgMusic3.stop();
    if (!bgMusic2.isPlaying()) bgMusic2.loop();
  } else if (currentLevel === 3) {
    if (bgMusic.isPlaying()) bgMusic.stop();
    if (bgMusic2.isPlaying()) bgMusic2.stop();
    if (!bgMusic3.isPlaying()) bgMusic3.loop();
  } else {
    if (bgMusic2.isPlaying()) bgMusic2.stop();
    if (bgMusic3.isPlaying()) bgMusic3.stop();
    if (!bgMusic.isPlaying()) bgMusic.loop();
  }
}

function _stopMusic() {
  if (bgMusic.isPlaying()) bgMusic.stop();
  if (bgMusic2.isPlaying()) bgMusic2.stop();
  if (bgMusic3.isPlaying()) bgMusic3.stop();
}

function draw() {
  if (currentScreen === "intro") {
    background(135, 195, 255);
    return;
  }

  _updateBlur();

  switch (currentScreen) {
    case "game":
      drawGame();
      break;
    case "win":
      if (!_starAwardedThisWin) {
        if (!_winMusicStopped) {
          _stopMusic();
          _winMusicStopped = true;
        }
        _totalStars++;
        _starAwardedThisWin = true;
        _starAnimTimer = 0;

        if (currentLevel === 3) {
          currentScreen = "congrats";
          return;
        }
      }
      _starAnimTimer++;
      drawWinScreen();
      break;
    case "lose":
      if (!_loseMusicStopped) {
        _stopMusic();
        _loseMusicStopped = true;
      }
      drawLoseScreen();
      break;
    case "congrats":
      drawCongratsScreen();
      break;
    case "finalclip":
      background(0);
      break;
  }
}

// ── Win screen ────────────────────────────────────────────────
function drawWinScreen() {
  let ox = (width - PLAY_WIDTH) / 2;
  background(10, 11, 16);
  fill(10, 11, 16);
  noStroke();
  rect(0, 0, width, height);

  for (let i = 0; i < 8; i++) {
    let t = i / 8;
    fill(lerp(10, 5, t), lerp(30, 15, t), lerp(60, 35, t));
    rect(ox, (i * height) / 8, PLAY_WIDTH, height / 8);
  }

  randomSeed(99);
  for (let i = 0; i < 40; i++) {
    let sx = ox + random(PLAY_WIDTH);
    let sy = random(height);
    let pulse = 0.5 + 0.5 * sin(frameCount * 0.05 + i);
    fill(120, 220, 255, 80 + 120 * pulse);
    noStroke();
    drawWinStar(sx, sy, 3, 7, 5);
  }

  let bounce = sin(frameCount * 0.05) * 8;
  fill(100, 200, 255);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(48);
  textFont("monospace");
  text("Congrats!", ox + PLAY_WIDTH / 2, height / 2 - 80 + bounce);

  textSize(18);
  fill(180, 230, 255);
  let winMsg =
    currentLevel === 1
      ? "You reached the top of Level 1."
      : currentLevel === 2
        ? "You escaped into deep space."
        : "You conquered Mars and beyond.";
  text(winMsg, ox + PLAY_WIDTH / 2, height / 2 - 20);

  _drawStarReward(ox);

  _drawWinButtons(ox);
  textAlign(LEFT, BASELINE);
}

// ── Win screen buttons (Levels 1 & 2) ────────────────────────
function _drawWinButtons(ox) {
  let cx = ox + PLAY_WIDTH / 2;
  let by = height / 2 + 105;
  let bw = 160,
    bh = 40,
    gap = 20;
  let replayX = cx - bw - gap / 2;
  let nextX = cx + gap / 2;

  let nextLabel = currentLevel === 1 ? "▶ Level 2" : "▶ Level 3";

  let overReplay =
    mouseX >= replayX &&
    mouseX <= replayX + bw &&
    mouseY >= by &&
    mouseY <= by + bh;
  fill(overReplay ? color(140, 220, 255) : color(60, 130, 200));
  stroke(180, 230, 255);
  strokeWeight(1.5);
  rect(replayX, by, bw, bh, 6);
  noStroke();
  fill(overReplay ? color(10, 20, 40) : color(220, 240, 255));
  textAlign(CENTER, CENTER);
  textSize(14);
  textFont("monospace");
  text("↺ Replay", replayX + bw / 2, by + bh / 2);

  let overNext =
    mouseX >= nextX &&
    mouseX <= nextX + bw &&
    mouseY >= by &&
    mouseY <= by + bh;
  fill(overNext ? color(140, 220, 255) : color(60, 130, 200));
  stroke(180, 230, 255);
  strokeWeight(1.5);
  rect(nextX, by, bw, bh, 6);
  noStroke();
  fill(overNext ? color(10, 20, 40) : color(220, 240, 255));
  text(nextLabel, nextX + bw / 2, by + bh / 2);
}

// ── Level 3 Congrats screen ───────────────────────────────────
function drawCongratsScreen() {
  let ox = (width - PLAY_WIDTH) / 2;
  background(10, 11, 16);
  fill(10, 11, 16);
  noStroke();
  rect(0, 0, width, height);

  for (let i = 0; i < 8; i++) {
    let t = i / 8;
    fill(lerp(10, 5, t), lerp(30, 15, t), lerp(60, 35, t));
    rect(ox, (i * height) / 8, PLAY_WIDTH, height / 8);
  }

  randomSeed(99);
  for (let i = 0; i < 40; i++) {
    let sx = ox + random(PLAY_WIDTH);
    let sy = random(height);
    let pulse = 0.5 + 0.5 * sin(frameCount * 0.05 + i);
    fill(120, 220, 255, 80 + 120 * pulse);
    noStroke();
    drawWinStar(sx, sy, 3, 7, 5);
  }

  let bounce = sin(frameCount * 0.05) * 8;
  fill(100, 200, 255);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(48);
  textFont("monospace");
  text("Congrats!", ox + PLAY_WIDTH / 2, height / 2 - 110 + bounce);

  textSize(18);
  fill(180, 230, 255);
  text("You conquered Mars and beyond.", ox + PLAY_WIDTH / 2, height / 2 - 50);

  textFont("monospace");
  textSize(13);
  fill(180, 230, 255, 200);
  text("ALL STARS COLLECTED", ox + PLAY_WIDTH / 2, height / 2 + 10);

  let starSize = 28;
  let starGap = 38;
  let totalW = (3 - 1) * starGap;
  let startX = ox + PLAY_WIDTH / 2 - totalW / 2;
  for (let i = 0; i < 3; i++) {
    let sx = startX + i * starGap;
    let sy = height / 2 + 45;
    noStroke();
    fill(255, 218, 50);
    _drawStarShape(sx, sy, starSize * 0.42, starSize * 0.9, 5);
    fill(255, 255, 200, 160);
    _drawStarShape(sx - 2, sy - 3, starSize * 0.18, starSize * 0.38, 5);
  }

  _drawCongratsButtons(ox);
  textAlign(LEFT, BASELINE);
}

function _drawCongratsButtons(ox) {
  let cx = ox + PLAY_WIDTH / 2;
  let by = height / 2 + 105;
  let bw = 160,
    bh = 40,
    gap = 20;
  let replayX = cx - bw - gap / 2;
  let creditsX = cx + gap / 2;

  let overReplay =
    mouseX >= replayX &&
    mouseX <= replayX + bw &&
    mouseY >= by &&
    mouseY <= by + bh;
  fill(overReplay ? color(140, 220, 255) : color(60, 130, 200));
  stroke(180, 230, 255);
  strokeWeight(1.5);
  rect(replayX, by, bw, bh, 6);
  noStroke();
  fill(overReplay ? color(10, 20, 40) : color(220, 240, 255));
  textAlign(CENTER, CENTER);
  textSize(14);
  textFont("monospace");
  text("▶ Replay Level 3", replayX + bw / 2, by + bh / 2);

  let overCredits =
    mouseX >= creditsX &&
    mouseX <= creditsX + bw &&
    mouseY >= by &&
    mouseY <= by + bh;
  fill(overCredits ? color(140, 220, 255) : color(60, 130, 200));
  stroke(180, 230, 255);
  strokeWeight(1.5);
  rect(creditsX, by, bw, bh, 6);
  noStroke();
  fill(overCredits ? color(10, 20, 40) : color(220, 240, 255));
  text("★ End Credits", creditsX + bw / 2, by + bh / 2);
}

function mousePressed() {
  let ox = (width - PLAY_WIDTH) / 2;
  let cx = ox + PLAY_WIDTH / 2;
  let by = height / 2 + 105;
  let bw = 160,
    bh = 40,
    gap = 20;
  let replayX = cx - bw - gap / 2;
  let nextX = cx + gap / 2;

  // ── Win screen buttons (Levels 1 & 2) ──────────────────────
  if (currentScreen === "win") {
    if (
      mouseX >= replayX &&
      mouseX <= replayX + bw &&
      mouseY >= by &&
      mouseY <= by + bh
    ) {
      _winMusicStopped = false;
      _starAwardedThisWin = false;
      currentScreen = "game";
      initGame();
      _initBlur();
      _syncMusic();
    }
    if (
      mouseX >= nextX &&
      mouseX <= nextX + bw &&
      mouseY >= by &&
      mouseY <= by + bh
    ) {
      _winMusicStopped = false;
      _starAwardedThisWin = false;
      _stopMusic();
      if (currentLevel === 1) _playLevel2Video();
      else if (currentLevel === 2) _playLevel3Video();
    }
  }

  // ── Congrats screen buttons (Level 3) ──────────────────────
  if (currentScreen === "congrats") {
    if (
      mouseX >= replayX &&
      mouseX <= replayX + bw &&
      mouseY >= by &&
      mouseY <= by + bh
    ) {
      _winMusicStopped = false;
      _starAwardedThisWin = false;
      _loadLevel(3);
      currentScreen = "game";
      initGame();
      _initBlur();
      _syncMusic();
    }
    if (
      mouseX >= nextX &&
      mouseX <= nextX + bw &&
      mouseY >= by &&
      mouseY <= by + bh
    ) {
      _playFinalClip();
      currentScreen = "finalclip";
    }
  }
}

// ── Star reward rendering ─────────────────────────────────────
function _drawStarReward(ox) {
  let centerX = ox + PLAY_WIDTH / 2;
  let centerY = height / 2 + 45;

  textFont("monospace");
  textSize(13);
  textAlign(CENTER, CENTER);
  fill(180, 230, 255, 200);
  noStroke();
  let starLabel = "LEVEL " + currentLevel + " STAR COLLECTED";
  text(starLabel, centerX, centerY - 28);

  let animT = constrain(_starAnimTimer / STAR_ANIM_DURATION, 0, 1);
  let starsToShow = min(_totalStars, currentLevel);
  let starSize = 28;
  let starGap = 38;
  let totalW = (starsToShow - 1) * starGap;
  let startX = centerX - totalW / 2;

  for (let i = 0; i < starsToShow; i++) {
    let sx = startX + i * starGap;
    let sy = centerY + 8;
    let isNewest = i === starsToShow - 1;

    let s = isNewest ? max(0.01, _easeOutBack(animT)) : 1.0;

    push();
    translate(sx, sy);
    scale(s);

    if (isNewest && animT < 1.0) {
      let glowA = round(map(animT, 0, 1, 200, 0));
      noStroke();
      fill(255, 230, 80, glowA);
      ellipse(0, 0, starSize * 2.2, starSize * 2.2);
    }

    noStroke();
    fill(255, 218, 50);
    _drawStarShape(0, 0, starSize * 0.42, starSize * 0.9, 5);

    fill(255, 255, 200, 160);
    _drawStarShape(-2, -3, starSize * 0.18, starSize * 0.38, 5);

    pop();
  }
}

function _drawStarShape(cx, cy, r1, r2, pts) {
  beginShape();
  for (let i = 0; i < pts * 2; i++) {
    let angle = (PI / pts) * i - PI / 2;
    let r = i % 2 === 0 ? r2 : r1;
    vertex(cx + cos(angle) * r, cy + sin(angle) * r);
  }
  endShape(CLOSE);
}

function _easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  let v = 1 + c3 * pow(t - 1, 3) + c1 * pow(t - 1, 2);
  return max(0.001, v);
}

// ── Lose screen ───────────────────────────────────────────────
function drawLoseScreen() {
  let ox = (width - PLAY_WIDTH) / 2;
  background(8, 6, 6);

  for (let i = 0; i < 8; i++) {
    let t = i / 8;
    fill(lerp(35, 15, t), lerp(15, 6, t), lerp(4, 2, t));
    rect(ox, (i * height) / 8, PLAY_WIDTH, height / 8);
  }

  randomSeed(77);
  for (let i = 0; i < 28; i++) {
    let ex = ox + random(PLAY_WIDTH);
    let ey = random(height);
    let pulse = 0.4 + 0.6 * sin(frameCount * 0.09 + i * 1.4);
    fill(255, round(150 + 60 * pulse), 20, round(80 + 120 * pulse));
    noStroke();
    ellipse(ex, ey, 5 * pulse, 5 * pulse);
  }

  let bounce = sin(frameCount * 0.04) * 6;
  fill(255, 160, 20);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(44);
  textFont("monospace");
  text("EXHAUSTED", ox + PLAY_WIDTH / 2, height / 2 - 55 + bounce);
  textSize(16);
  fill(230, 180, 100);
  text("You ran out of energy.", ox + PLAY_WIDTH / 2, height / 2 + 8);
  let blink = frameCount % 50 < 30;
  if (blink) {
    textSize(13);
    fill(200, 160, 80);
    text("Press R to try again", ox + PLAY_WIDTH / 2, height / 2 + 65);
  }
  textAlign(LEFT, BASELINE);
}

function drawWinStar(x, y, r1, r2, pts) {
  beginShape();
  for (let i = 0; i < pts * 2; i++) {
    let angle = (PI / pts) * i - PI / 2;
    let r = i % 2 === 0 ? r2 : r1;
    vertex(x + cos(angle) * r, y + sin(angle) * r);
  }
  endShape(CLOSE);
}

function keyPressed() {
  if (currentScreen === "intro" || currentScreen === "finalclip") return;

  if (currentScreen === "game") {
    gameKeyPressed(keyCode);

    if (key === "t" || key === "T") {
      _stopMusic();
      if (currentLevel === 1) _playLevel2Video();
      else if (currentLevel === 2) _playLevel3Video();
      else if (currentLevel === 3) {
        _totalStars++;
        _starAwardedThisWin = true;
        _playFinalClip();
        currentScreen = "finalclip";
      }
    }
  }

  if (
    currentScreen === "win" ||
    currentScreen === "lose" ||
    currentScreen === "congrats"
  ) {
    if (key === "r" || key === "R") {
      _winMusicStopped = false;
      _loseMusicStopped = false;
      _starAwardedThisWin = false;
      currentScreen = "game";
      initGame();
      _initBlur();
      _syncMusic();
    }
    if (key === "1") {
      _winMusicStopped = false;
      _loseMusicStopped = false;
      _starAwardedThisWin = false;
      _loadLevel(1);
      currentScreen = "game";
      initGame();
      _initBlur();
      _syncMusic();
    }
    if (key === "2") {
      _winMusicStopped = false;
      _loseMusicStopped = false;
      _stopMusic();
      _playLevel2Video();
    }
    if (key === "3") {
      _winMusicStopped = false;
      _loseMusicStopped = false;
      _stopMusic();
      _playLevel3Video();
    }
  }
}

function keyReleased() {
  if (currentScreen === "intro") return;

  if (currentScreen === "game") {
    gameKeyReleased(keyCode);
  }
}

function windowResized() {
  // Re-lock pixel density BEFORE resizing. Dragging the window from a
  // standard monitor to a HiDPI one changes devicePixelRatio at runtime.
  // p5 reads devicePixelRatio inside resizeCanvas(), so if pixelDensity(1)
  // is not re-affirmed here first, the buffer silently inflates to 2–3×
  // and the blur in stampWorldBuffer() lags again immediately.
  pixelDensity(1);

  resizeCanvas(windowWidth, windowHeight);

  // FIX: Only height changes on resize — width stays PLAY_WIDTH (800px).
  if (_worldBuffer) {
    _worldBuffer.resizeCanvas(PLAY_WIDTH, windowHeight);
  }

  // Re-clamp camera so there's no one-frame pop when screen height changes.
  if (cam && player) {
    cam.y = constrain(cam.y, 0, max(0, LEVEL_HEIGHT - height));
  }

  // Re-snap the column offset to a whole pixel after every resize and
  // re-apply image-rendering: pixelated in case the browser recreated
  // the canvas element during the resize event.
  applyIntegerScale();
}
