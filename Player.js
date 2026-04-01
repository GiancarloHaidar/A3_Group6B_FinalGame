// ============================================================
// Player.js
//
// Level-agnostic. Level-specific tuning is injected by initGame()
// via three instance properties set immediately after construction:
//
//   player.gravityMult   — multiplies GRAVITY each frame   (default 1.0)
//   player.jumpForceMult — multiplies JUMP_FORCE           (default 1.0)
//   player.balanceMult   — multiplies all sway/overshoot   (default 1.0)
//   player.energyDrainMult — multiplies energy drain rate  (default 1.0)
//
// Level 1 receives 1.0 for all four → behaviour is 100% identical
// to the original. Level 2 receives values from its JSON.
// ============================================================

class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = PLAYER_W;
    this.h = PLAYER_H;

    this.vx = 0;
    this.vy = 0;

    this.onGround = false;
    this.facingRight = true;

    this.inputLeft = false;
    this.inputRight = false;
    this.inputJump = false;
    this.inputDown = false;

    this.energy = ENERGY_MAX;
    this.isExhausted = false;

    this.onCheckpoint = false;
    this._wobblePhase = 0;
    this._prevHorizInput = false;
    this._wasOnGround = false;
    this._lowEnergyPlayed = false;
    this._fallTimer = 0;
    this._fallSoundPlayed = false;

    // ── Level multipliers (set by initGame after construction) ──
    // Defaults of 1.0 keep Level 1 identical to the original.
    this.gravityMult = 1.0;
    this.jumpForceMult = 1.0;
    this.balanceMult = 1.0;
    this.energyDrainMult = 1.0;
  }

  energySpeedMultiplier() {
    let t = constrain(this.energy / ENERGY_MAX, 0, 1);
    return ENERGY_SPEED_MIN + (1 - ENERGY_SPEED_MIN) * sqrt(t);
  }

  _releaseFriction() {
    let t = constrain(this.energy / ENERGY_MAX, 0, 1);
    if (t >= BALANCE_FATIGUE_TIRED) {
      let band = (t - BALANCE_FATIGUE_TIRED) / (1.0 - BALANCE_FATIGUE_TIRED);
      return lerp(BALANCE_FRICTION_TIRED, BALANCE_FRICTION_BASE, band);
    }
    return BALANCE_FRICTION_TIRED;
  }

  _overshootK() {
    let t = constrain(this.energy / ENERGY_MAX, 0, 1);
    return lerp(BALANCE_OVERSHOOT_TIRED, BALANCE_OVERSHOOT_BASE, t);
  }

  refillAtCheckpoint() {
    let add = ENERGY_MAX * ENERGY_CHECKPOINT_ADD;
    let cap = ENERGY_MAX * ENERGY_CHECKPOINT_CAP;
    this.energy = min(this.energy + add, cap);
    if (this.energy > 0) this.isExhausted = false;
    if (this.energy > ENERGY_LOW_THRESHOLD) this._lowEnergyPlayed = false;
  }

  update(platforms) {
    // ── Energy drain ───────────────────────────────────────────
    if (!this.isExhausted) {
      let absVx = abs(this.vx);
      if (absVx > ENERGY_MOVE_DEADZONE) {
        this.energy -= ENERGY_DRAIN_HORIZ * absVx * this.energyDrainMult;
      }
      if (this.vy > ENERGY_FALL_THRESHOLD) {
        this.energy -=
          ENERGY_DRAIN_FALL_OVER *
          (this.vy - ENERGY_FALL_THRESHOLD) *
          this.energyDrainMult;
      }
      if (this.energy <= 0) {
        this.energy = 0;
        this.isExhausted = true;
        if (typeof failSound !== "undefined" && failSound.isLoaded()) {
          failSound.play();
        }
      }
      if (this.energy <= ENERGY_LOW_THRESHOLD && !this._lowEnergyPlayed) {
        if (
          typeof lowEnergySound !== "undefined" &&
          lowEnergySound.isLoaded()
        ) {
          lowEnergySound.play();
        }
        this._lowEnergyPlayed = true;
      }
    }

    // ── Horizontal movement ────────────────────────────────────
    let effectiveSpeed = this.isExhausted
      ? 0
      : MOVE_SPEED * this.energySpeedMultiplier();

    let hasHorizInput = this.inputLeft || this.inputRight;
    let targetVx = 0;
    if (this.inputLeft) targetVx -= effectiveSpeed;
    if (this.inputRight) targetVx += effectiveSpeed;

    if (this.inputRight) this.facingRight = true;
    if (this.inputLeft) this.facingRight = false;

    let friction =
      hasHorizInput || !this.onGround
        ? GROUND_FRICTION
        : this._releaseFriction();
    this.vx = lerp(this.vx, targetVx, friction);

    // ── Overshoot micro-lurch on release ──────────────────────
    let justReleased = this._prevHorizInput && !hasHorizInput;
    if (justReleased && this.onGround && abs(this.vx) > 0.05) {
      // balanceMult amplifies the lurch in Level 2
      this.vx -= this.vx * this._overshootK() * this.balanceMult;
    }
    this._prevHorizInput = hasHorizInput;

    // ── Jump ──────────────────────────────────────────────────
    if (this.inputJump && this.onGround && !this.isExhausted) {
      // jumpForceMult < 1 = floatier, less forceful (Level 2 "space" feel)
      this.vy = JUMP_FORCE * this.jumpForceMult;
      this.onGround = false;
      this.energy = max(0, this.energy - ENERGY_DRAIN_JUMP);
      if (this.energy === 0) {
        this.isExhausted = true;
        if (typeof failSound !== "undefined" && failSound.isLoaded())
          failSound.play();
      }
      if (typeof jumpSound !== "undefined" && jumpSound.isLoaded())
        jumpSound.play();
    }
    this.inputJump = false;

    // ── Gravity (gravityMult gives floaty space feel at <1) ───
    let gravThisFrame = GRAVITY * this.gravityMult;
    if (this.inputDown && !this.onGround)
      gravThisFrame = GRAVITY * this.gravityMult * FAST_FALL_MULTIPLIER;
    this.vy += gravThisFrame;
    this.vy = constrain(this.vy, -MAX_FALL_SPEED, MAX_FALL_SPEED);

    // ── Grounded sway (balanceMult amplifies all layers) ──────
    if (this.onGround) {
      this._applyGroundedSway();
    }

    this.x += this.vx;
    this.y += this.vy;

    // ── Collision ─────────────────────────────────────────────
    this.onGround = false;
    for (let p of platforms) {
      this._resolveAABB(p);
    }

    if (this.y + this.h > LEVEL_HEIGHT) {
      this.y = LEVEL_HEIGHT - this.h;
      this.vy = 0;
      this.onGround = true;
    }
    this.x = constrain(this.x, 0, PLAY_WIDTH - this.w);

    // ── Landing sound ─────────────────────────────────────────
    if (this.onGround && !this._wasOnGround) {
      if (typeof landingSound !== "undefined" && landingSound.isLoaded()) {
        landingSound.play();
      }
    }
    this._wasOnGround = this.onGround;

    // ── Falling sound ─────────────────────────────────────────
    if (!this.onGround && this.vy > 0) {
      this._fallTimer++;
      if (this._fallTimer > 25 && !this._fallSoundPlayed) {
        if (typeof fallingSound !== "undefined" && fallingSound.isLoaded()) {
          fallingSound.play();
        }
        this._fallSoundPlayed = true;
      }
    } else {
      this._fallTimer = 0;
      this._fallSoundPlayed = false;
    }
  }

  _applyGroundedSway() {
    this._wobblePhase += PLAYER_SWAY_FREQ;

    let checkpointMul = this.onCheckpoint ? PLAYER_SWAY_CHECKPOINT_DAMPEN : 1.0;
    let fatigueT = 1.0 - constrain(this.energy / ENERGY_MAX, 0, 1);

    let totalAmp =
      (PLAYER_SWAY_AMP_BASE + PLAYER_SWAY_AMP_FATIGUE * fatigueT) *
      this.balanceMult;

    this.vx += totalAmp * checkpointMul * sin(this._wobblePhase);
  }

  _resolveAABB(p) {
    if (
      this.x + this.w <= p.x ||
      this.x >= p.x + p.w ||
      this.y + this.h <= p.y ||
      this.y >= p.y + p.h
    )
      return;

    let overlapLeft = this.x + this.w - p.x;
    let overlapRight = p.x + p.w - this.x;
    let overlapTop = this.y + this.h - p.y;
    let overlapBot = p.y + p.h - this.y;

    let minX = min(overlapLeft, overlapRight);
    let minY = min(overlapTop, overlapBot);

    if (minY < minX) {
      if (overlapTop < overlapBot) {
        this.y = p.y - this.h;
        if (this.vy > 0) {
          if (typeof currentLevel !== "undefined" && currentLevel === 2) {
            // Level 2: small bounce on landing, mimicking low gravity
            this.vy = this.vy > 1.5 ? -this.vy * 0.5 : 0;
          } else if (typeof currentLevel !== "undefined" && currentLevel === 3) {
            // Level 3: heavier thud with micro-bounce (heavy gravity)
            this.vy = this.vy > 3 ? -this.vy * 0.25 : 0;
          } else {
            // Level 1: clean stop
            this.vy = 0;
          }
        }
        this.onGround = true;
      } else {
        this.y = p.y + p.h;
        if (this.vy < 0) this.vy = 0;
      }
    } else {
      if (overlapLeft < overlapRight) this.x = p.x - this.w;
      else this.x = p.x + p.w;
      this.vx = 0;
    }
  }

  draw() {
    let cx = this.x + this.w / 2;
    let cy = this.y + this.h / 2;

    let bodyR, bodyG, bodyB;
    if (this.isExhausted) {
      bodyR = 190;
      bodyG = 90;
      bodyB = 80;
    } else if (this.energy < ENERGY_LOW_THRESHOLD) {
      let t = this.energy / ENERGY_LOW_THRESHOLD;
      bodyR = 220;
      bodyG = round(lerp(90, 200, t));
      bodyB = round(lerp(80, 160, t));
    } else {
      bodyR = 220;
      bodyG = 200;
      bodyB = 160;
    }
    fill(bodyR, bodyG, bodyB);
    noStroke();
    rect(this.x, this.y, this.w, this.h, 4);

    let eyeOffsetX = this.facingRight ? this.w * 0.25 : -this.w * 0.25;
    fill(50);
    ellipse(cx + eyeOffsetX, cy - this.h * 0.15, 5, 5);

    stroke(180, 160, 120);
    strokeWeight(2);
    if (this.onGround) {
      line(
        this.x + this.w * 0.3,
        this.y + this.h,
        this.x + this.w * 0.2,
        this.y + this.h + 8,
      );
      line(
        this.x + this.w * 0.7,
        this.y + this.h,
        this.x + this.w * 0.8,
        this.y + this.h + 8,
      );
    }
    noStroke();
  }
}
