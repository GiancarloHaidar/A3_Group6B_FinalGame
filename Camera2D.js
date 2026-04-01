// ============================================================
// Camera2D.js
// Pure vertical-follow camera.
// Horizontal centering is handled by worldOffsetX in gameScreen.js,
// so this class only needs to track and apply a Y offset.
// UI is drawn OUTSIDE camera.apply() / camera.reset().
// ============================================================

class Camera2D {
  constructor() {
    this.x = 0; // always 0 — kept for potential future use
    this.y = 0;
  }

  update(target) {
    // Keep player near CAM_ANCHOR_Y fraction of the screen vertically
    let desiredY = target.y + target.h / 2 - height * CAM_ANCHOR_Y;
    this.y = lerp(this.y, desiredY, CAM_LERP);

    // Clamp: don't scroll above the top or below the bottom of the level
    this.y = constrain(this.y, 0, max(0, LEVEL_HEIGHT - height));
  }

  // Call before drawing world-space objects
  apply() {
    translate(-this.x, -this.y);
  }

  // Not used in push/pop pattern but kept for symmetry
  reset() {
    translate(this.x, this.y);
  }
}
