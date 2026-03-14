import { SheepState } from "./types";

interface Star {
  x: number;
  y: number;
  twinkleSpeed: number;
}

interface Firefly {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: number;
}

export class NightAmbience {
  private stars: Star[] = [];
  private fireflies: Firefly[] = [];
  private screenWidth: number;
  private screenHeight: number;
  private time = 0;

  constructor(screenWidth: number, screenHeight: number) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
    this.seedStars();
  }

  private seedStars() {
    this.stars = [];
    for (let i = 0; i < 35; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random() * 0.6, // upper 60% of screen
        twinkleSpeed: 0.5 + Math.random() * 2,
      });
    }
  }

  /** Returns 0..1 night intensity based on current hour */
  getNightAlpha(): number {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;

    if (h >= 6 && h < 20) return 0; // daytime
    if (h >= 20 && h < 22) return (h - 20) / 2; // ramp up
    if (h >= 22 || h < 4) return 1; // full night
    // 4am–6am: ramp down
    return 1 - (h - 4) / 2;
  }

  update(dt: number, sheepPositions: Array<{ x: number; y: number; state: SheepState }>) {
    this.time += dt;
    const nightAlpha = this.getNightAlpha();

    if (nightAlpha <= 0) {
      this.fireflies = [];
      return;
    }

    // Spawn fireflies near calm sheep
    const calmStates: SheepState[] = ["idle", "sit", "sleep", "idle_sleep", "idle_campfire", "idle_counting"];
    const calmSheep = sheepPositions.filter((s) => calmStates.includes(s.state));

    if (calmSheep.length > 0 && this.fireflies.length < 6 && Math.random() < 0.02) {
      const target = calmSheep[Math.floor(Math.random() * calmSheep.length)];
      this.fireflies.push({
        x: target.x + (Math.random() - 0.5) * 80,
        y: target.y + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5) * 20,
        vy: (Math.random() - 0.5) * 15,
        phase: Math.random() * Math.PI * 2,
      });
    }

    // Update fireflies — random walk bounded near sheep
    const dtSec = dt / 1000;
    this.fireflies = this.fireflies.filter((f) => {
      f.vx += (Math.random() - 0.5) * 40 * dtSec;
      f.vy += (Math.random() - 0.5) * 30 * dtSec;
      f.vx *= 0.95;
      f.vy *= 0.95;
      f.x += f.vx * dtSec;
      f.y += f.vy * dtSec;
      f.phase += dt / 400;

      // Keep bounded on screen
      return f.x > -20 && f.x < this.screenWidth + 20 &&
             f.y > -20 && f.y < this.screenHeight + 20;
    });
  }

  /** Draw stars and moonlight — call BEFORE sheep */
  drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const nightAlpha = this.getNightAlpha();
    if (nightAlpha <= 0) return;

    // Stars
    ctx.save();
    ctx.fillStyle = "#ffffff";
    const t = this.time / 1000;
    for (const star of this.stars) {
      const alpha = nightAlpha * (0.3 + 0.7 * Math.abs(Math.sin(t * star.twinkleSpeed)));
      ctx.globalAlpha = alpha;
      const size = 1 + (star.twinkleSpeed > 1.5 ? 1 : 0);
      ctx.fillRect(star.x * w, star.y * h, size, size);
    }
    ctx.restore();

    // Moonlight glow — subtle radial gradient top-right
    ctx.save();
    const grad = ctx.createRadialGradient(w * 0.85, h * 0.08, 10, w * 0.85, h * 0.08, w * 0.4);
    grad.addColorStop(0, `rgba(180, 200, 255, ${0.04 * nightAlpha})`);
    grad.addColorStop(1, "rgba(180, 200, 255, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  /** Draw fireflies and enhanced campfire glow — call AFTER sheep */
  drawForeground(
    ctx: CanvasRenderingContext2D,
    _w: number,
    _h: number,
    sheepPositions?: Array<{ x: number; y: number; state: SheepState }>,
  ) {
    const nightAlpha = this.getNightAlpha();
    if (nightAlpha <= 0) return;

    const t = this.time / 1000;

    // Fireflies
    for (const f of this.fireflies) {
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(f.phase));
      const alpha = nightAlpha * pulse;

      ctx.save();
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 6);
      grad.addColorStop(0, `rgba(200, 255, 100, ${alpha})`);
      grad.addColorStop(1, "rgba(200, 255, 100, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Bright center
      ctx.fillStyle = `rgba(220, 255, 150, ${alpha})`;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Enhanced campfire glow at night
    if (sheepPositions) {
      for (const s of sheepPositions) {
        if (s.state === "idle_campfire") {
          ctx.save();
          const glowX = s.x + 96 + 10; // approximate campfire position
          const glowY = s.y + 76;
          const flicker = 0.8 + 0.2 * Math.sin(t * 3);
          const grad = ctx.createRadialGradient(glowX, glowY, 5, glowX, glowY, 80);
          grad.addColorStop(0, `rgba(255, 150, 50, ${0.08 * nightAlpha * flicker})`);
          grad.addColorStop(1, "rgba(255, 150, 50, 0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(glowX, glowY, 80, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }
    }
  }

  updateScreenSize(w: number, h: number) {
    this.screenWidth = w;
    this.screenHeight = h;
    this.seedStars();
  }
}
