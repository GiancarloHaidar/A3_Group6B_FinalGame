// ============================================================
// sketch.js — Conductor / Router
// ============================================================

let currentScreen = "intro"; // "intro" | "game" | "win" | "lose"

let player;
let platforms;
let cam;
let levelData;

// ── Level management ──────────────────────────────────────────
// Change this to 2 (or pass via query param) to start on level 2.
// After completing Level 1 the game auto-advances to Level 2.
let currentLevel = 1;
let level1Data = null;
let level2Data = null;
let level3Data = null;

// ── Star progression ──────────────────────────────────────────
let _totalStars = 0;
let _starAwardedThisWin = false;
let _starAnimTimer = 0;
const STAR_ANIM_DURATION = 40;

// ── One-shot music-stop flags (prevent _stopMusic re-firing every frame) ──
let _winMusicStopped = false;
let _loseMusicStopped = false;

// ── Intro video ───────────────────────────────────────────────
let _introVideo = null;
let _continueBtnHandler = null;

// ── World graphics buffer ─────────────────────────────────────
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
let bgMusic2;

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
  imgFlag = loadImage("Assets/flag.png");
  bgMusic2 = loadSound("Assets/Background2.mp3");
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

// Removes any previously registered #continueBtn handler before adding the new
// one. Prevents stale listeners from prior video flows firing unexpectedly.
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

  document.getElementById("continueBtnImg").src = "Assets/Continue.png";
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
// Plays Assets/Level2Video.mp4 when the player selects Level 2.
// Both speakingSound and bgMusic2 start together when the video begins.

function _playLevel2Video() {
  // Black backdrop so the canvas doesn't bleed through behind the video
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

  // Start speaking and background music 2 together when the video begins
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
  // Remove the black backdrop now that we're entering the game
  let backdrop = document.getElementById("videoBackdrop");
  if (backdrop) backdrop.style.display = "none";
  _starAwardedThisWin = false;
  _loadLevel(2);
  currentScreen = "game";
  initGame();
  _initBlur();
  // Stop speaking audio now that we're entering gameplay
  if (speakingSound && speakingSound.isPlaying()) speakingSound.stop();
  // bgMusic2 is already looping — started when the video began
  if (bgMusic && bgMusic.isPlaying()) bgMusic.stop();
}

// ── Level 3 transition video ──────────────────────────────────
// Reuses the same pattern as Level 2 video transitions.
// bgMusic2 continues into Level 3 (same space soundtrack).

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

  // Re-use the Level 2 video for the Level 3 transition.
  // Replace with a dedicated Level3Video.mp4 if one is created later.
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

  const EARLY_BY_L3 = 2.0;
  let _btnShown = false;

  _introVideo.addEventListener("timeupdate", function _checkEarlyL3() {
    if (_btnShown) return;
    const remaining = _introVideo.duration - _introVideo.currentTime;
    if (remaining <= EARLY_BY_L3) {
      _btnShown = true;
      _introVideo.removeEventListener("timeupdate", _checkEarlyL3);
      _onLevel3VideoEnded();
    }
  });

  _introVideo.addEventListener("ended", _onLevel3VideoEnded, { once: true });

  _introVideo.play().catch(() => {
    console.warn("Level3 transition video play() failed — skipping to game.");
    _onLevel3VideoEnded();
  });

  if (speakingSound && speakingSound.isLoaded()) speakingSound.play();
  if (bgMusic && bgMusic.isPlaying()) bgMusic.stop();
  if (bgMusic2 && bgMusic2.isLoaded() && !bgMusic2.isPlaying()) bgMusic2.loop();
}

function _onLevel3VideoEnded() {
  if (_introVideo) _introVideo.pause();

  document.getElementById("continueBtnImg").src = "Assets/StartButton.png";
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
  if (bgMusic && bgMusic.isPlaying()) bgMusic.stop();
}

// ── Final closing clip (after Level 3 win) ────────────────────
// Plays the final video, then auto-restarts the game from Level 1.

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
  _introVideo.src = "Assets/FinalClip.mp4";
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
}

function _onFinalClipEnded() {
  if (_introVideo) {
    _introVideo.pause();
    _introVideo.style.display = "none";
    _introVideo = null;
  }
  let backdrop = document.getElementById("videoBackdrop");
  if (backdrop) backdrop.style.display = "none";

  // Auto-restart from Level 1
  _totalStars = 0;
  _starAwardedThisWin = false;
  _winMusicStopped = false;
  _loseMusicStopped = false;
  _loadLevel(1);
  currentScreen = "game";
  initGame();
  _initBlur();
  _syncMusic();
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

function stampWorldBuffer() {
  let ctx = drawingContext;
  if (_blurRadius > 0.05) {
    ctx.filter = "blur(" + _blurRadius.toFixed(2) + "px)";
  }
  image(_worldBuffer, 0, 0);
  ctx.filter = "none";
}

// ── Vignette overlay (Level 2 only) ──────────────────────────
// Drawn after the world buffer stamp, before the UI, so the energy
// bar and altitude indicators are never darkened.
// Uses Canvas 2D radial gradient — same approach as the blur system.
function _drawVignette() {
  if (currentLevel !== 2 && currentLevel !== 3) return;

  let fatigueT = player ? 1 - constrain(player.energy / ENERGY_MAX, 0, 1) : 0;

  let edgeAlpha = VIGNETTE_ALPHA_BASE + VIGNETTE_ALPHA_FATIGUE * fatigueT;

  // Half-diagonal of the canvas — the gradient outer radius.
  let halfDiag = sqrt(width * width + height * height) * 0.5;
  let cx = width / 2;
  let cy = height / 2;

  // Inner clear radius shrinks slightly as fatigue grows.
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
  createCanvas(windowWidth, windowHeight);
  _worldBuffer = createGraphics(windowWidth, windowHeight);

  // Default to level 1 data so initGame() has something to work with.
  _loadLevel(1);
  initGame();
  _initBlur();

  bgMusic.setVolume(0.4);
  bgMusic2.setVolume(0.4);
  jumpSound.setVolume(0.6);
  landingSound.setVolume(0.5);
  lowEnergySound.setVolume(0.6);
  fallingSound.setVolume(0.5);
  failSound.setVolume(0.6);
  winSound.setVolume(0.6);

  imgHouse = loadImage("Assets/house.png");
  imgTree = loadImage("Assets/tree.png");
  imgAstronaut = loadImage("Assets/astronaut.png");
  imgGround = loadImage("Assets/ground.png");
  imgGroundL2 = loadImage("Assets/cloud_platform1.png");
  imgGroundL3 = loadImage("Assets/mars_platform.png");
  imgCloud1 = loadImage("Assets/Cloud1.png");
  imgCloud2 = loadImage("Assets/Cloud2.png");
  imgEarth = loadImage("Assets/earth.png");
  imgSaturn = loadImage("Assets/saturn.png");
  imgVenus = loadImage("Assets/venus.png");
  imgMercury = loadImage("Assets/mercury.png");
  imgShootingStar = loadImage("Assets/shooting_star.png");
  imgAsteroid = loadImage("Assets/astroid.png");
  imgSpaceship = loadImage("Assets/spaceship.png");

  _startIntro();
}

// ── Music helpers ─────────────────────────────────────────────
// Call after any level change or screen transition.
// Starts the correct track for the current level and stops the other.
// Level 3 shares bgMusic2 with Level 2.
function _syncMusic() {
  let useSpaceTrack = currentLevel === 2 || currentLevel === 3;
  let activeTrack = useSpaceTrack ? bgMusic2 : bgMusic;
  let inactiveTrack = useSpaceTrack ? bgMusic : bgMusic2;
  if (inactiveTrack.isPlaying()) inactiveTrack.stop();
  if (!activeTrack.isPlaying()) activeTrack.loop();
}

// Stop whichever track is currently playing (used on win / lose).
function _stopMusic() {
  if (bgMusic.isPlaying()) bgMusic.stop();
  if (bgMusic2.isPlaying()) bgMusic2.stop();
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
        // Stop music exactly once when the win screen first appears
        if (!_winMusicStopped) {
          _stopMusic();
          _winMusicStopped = true;
        }
        _totalStars++;
        _starAwardedThisWin = true;
        _starAnimTimer = 0;

        // Level 3 win → play the final closing clip, then auto-restart
        if (currentLevel === 3) {
          _playFinalClip();
          currentScreen = "finalclip";
          return;
        }
      }
      _starAnimTimer++;
      drawWinScreen();
      break;
    case "lose":
      // Stop music exactly once when the lose screen first appears
      if (!_loseMusicStopped) {
        _stopMusic();
        _loseMusicStopped = true;
      }
      drawLoseScreen();
      break;
    case "finalclip":
      // Final video is playing via DOM — just draw black behind it
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

  let blink = frameCount % 50 < 30;
  if (blink) {
    textSize(14);
    fill(140, 190, 240);
    if (currentLevel === 1) {
      text(
        "Press R to replay  |  Press 2 for Level 2",
        ox + PLAY_WIDTH / 2,
        height / 2 + 120,
      );
    } else if (currentLevel === 2) {
      text(
        "Press R to replay  |  Press 3 for Level 3",
        ox + PLAY_WIDTH / 2,
        height / 2 + 120,
      );
    } else {
      text(
        "Press R to climb again  |  Press 1 for Level 1",
        ox + PLAY_WIDTH / 2,
        height / 2 + 120,
      );
    }
  }
  textAlign(LEFT, BASELINE);
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

  let starSize = 28;
  let starGap = 38;
  let totalW = (_totalStars - 1) * starGap;
  let startX = centerX - totalW / 2;

  for (let i = 0; i < _totalStars; i++) {
    let sx = startX + i * starGap;
    let sy = centerY + 8;
    let isNewest = i === _totalStars - 1;

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

    // TEMP: press T to cycle to next level for testing
    if (key === "t" || key === "T") {
      _stopMusic();
      if (currentLevel === 1) _playLevel2Video();
      else if (currentLevel === 2) _playLevel3Video();
    }
  }

  if (currentScreen === "win" || currentScreen === "lose") {
    if (key === "r" || key === "R") {
      // Replay the same level — reset one-shot flags before re-entering game
      _winMusicStopped = false;
      _loseMusicStopped = false;
      _starAwardedThisWin = false;
      currentScreen = "game";
      initGame();
      _initBlur();
      _syncMusic();
    }
    // Level select from win/lose screen
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
  resizeCanvas(windowWidth, windowHeight);
  if (_worldBuffer) {
    _worldBuffer.resizeCanvas(windowWidth, windowHeight);
  }
}
