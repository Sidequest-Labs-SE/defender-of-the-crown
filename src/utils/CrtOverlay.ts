import Phaser from 'phaser';

/**
 * CrtOverlay (Disabled / Removed per 16:9 HD Hybrid Visual Upgrade)
 * Kept as a clean no-op compatibility stub so scenes render pure, razor-sharp HD imagery
 * without scanlines or dark vignette artifacts slicing through text.
 */
export class CrtOverlay {
  constructor(_scene: Phaser.Scene) {
    // Intentionally empty: clean modern HD presentation
  }

  public toggle(): void {
    // No-op
  }

  public destroy(): void {
    // No-op
  }
}
