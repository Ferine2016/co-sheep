import { SpriteSheet } from "./sprite";
import { SheepAnimation, SheepState } from "./types";

const SPRITE_SIZE = 32;
const SCALE = 3;
const DISPLAY_SIZE = SPRITE_SIZE * SCALE;
const WALK_SPEED = 60; // px/sec
const DOCK_MARGIN = 80; // stay above macOS Dock
const ZOOM_SPEED = 600; // px/sec

export class Sheep {
  x: number;
  y: number;
  vx: number = 0;
  vy: number = 0;
  state: SheepState = "parachute";
  facingRight: boolean = true;

  private screenWidth: number;
  private screenHeight: number;
  private stateTimer: number = 0;
  private stateDuration: number = 0;

  private sprites: Record<string, SpriteSheet>;

  constructor(screenWidth: number, screenHeight: number) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    // Start from top center for parachute entrance
    this.x = screenWidth / 2 - DISPLAY_SIZE / 2;
    this.y = -DISPLAY_SIZE;

    this.sprites = {
      idle: new SpriteSheet("/assets/sprites/sheep-idle.png", 32, 32, 2, 2),
      walk: new SpriteSheet("/assets/sprites/sheep-walk.png", 32, 32, 4, 6),
      parachute: new SpriteSheet(
        "/assets/sprites/sheep-parachute.png",
        32,
        32,
        2,
        3,
      ),
      sit: new SpriteSheet("/assets/sprites/sheep-sit.png", 32, 32, 1, 1),
      sleep: new SpriteSheet("/assets/sprites/sheep-sleep.png", 32, 32, 2, 2),
      fall: new SpriteSheet("/assets/sprites/sheep-fall.png", 32, 32, 1, 1),
    };
  }

  get groundY(): number {
    return this.screenHeight - DISPLAY_SIZE - DOCK_MARGIN;
  }

  get displaySize(): number {
    return DISPLAY_SIZE;
  }

  /** Trigger a named animation. Interrupts idle/walk/sit but not grabbed. */
  playAnimation(anim: SheepAnimation) {
    if (this.state === "grabbed" || this.state === "parachute") return;
    console.log("[co-sheep] Playing animation:", anim);

    switch (anim) {
      case "bounce":
        this.setState("bounce", 1200);
        this.vy = -300;
        break;
      case "spin":
        this.setState("spin", 800);
        break;
      case "backflip":
        this.setState("backflip", 600);
        this.vy = -200;
        break;
      case "headshake":
        this.setState("headshake", 800);
        break;
      case "zoom":
        this.setState("zoom", 1500);
        this.facingRight = Math.random() > 0.5;
        break;
      case "vibrate":
        this.setState("vibrate", 1000);
        break;
    }
  }

  /** Called when the user clicks on the sheep to start dragging. */
  grab() {
    this.state = "grabbed";
    this.stateTimer = 0;
    this.vx = 0;
    this.vy = 0;
  }

  /** Called when the user releases the sheep. Parachutes if airborne. */
  release() {
    if (this.y < this.groundY - 10) {
      // Airborne — deploy parachute
      this.state = "parachute";
      this.stateTimer = 0;
      this.vy = 0;
      this.vx = 0;
      const sprite = this.sprites["parachute"];
      if (sprite) sprite.reset();
    } else {
      // On or near ground
      this.y = this.groundY;
      this.state = "idle";
      this.stateTimer = 0;
      this.stateDuration = 1000 + Math.random() * 2000;
    }
  }

  /** Start petting — called when cursor hovers over sheep for a while. */
  startPetting() {
    if (this.state === "grabbed" || this.state === "parachute") return;
    if (this.state === "petting") return;
    console.log("[co-sheep] Being petted!");
    this.setState("petting", 0);
  }

  /** Stop petting — called when cursor leaves. */
  stopPetting() {
    if (this.state !== "petting") return;
    console.log("[co-sheep] Petting stopped");
    this.setState("idle", 2000 + Math.random() * 3000);
  }

  /** Returns a random quip for double-click interaction. */
  getRandomQuip(): string {
    const quips = [
      "Hey! Hooves are sensitive!",
      "Do I come to YOUR desktop and poke you?",
      "Baaaa! That tickles!",
      "*startled sheep noises*",
      "I was THINKING. Very deep thoughts.",
      "You know I can see your tabs, right?",
      "Stop poking me and get back to work.",
      "Is this what passes for entertainment?",
      "I'm not a button. I'm a sheep.",
      "If you pet me one more time I'm filing an HR complaint.",
      "Wow, procrastinating by clicking on a sheep. New low.",
      "I'm judging you. Always judging.",
      "That's my personal space!",
      "Ow! Just kidding, I'm made of pixels.",
    ];
    return quips[Math.floor(Math.random() * quips.length)];
  }

  /** Hit-test: is point (px, py) over the sheep? Uses a generous hitbox. */
  hitTest(px: number, py: number): boolean {
    const pad = 12;
    return (
      px >= this.x - pad &&
      px <= this.x + DISPLAY_SIZE + pad &&
      py >= this.y - pad &&
      py <= this.y + DISPLAY_SIZE + pad
    );
  }

  update(dt: number) {
    this.stateTimer += dt;

    // Animate sprite — pick the right sheet for the current state
    const spriteKey = this.getSpriteKey();
    const currentSprite = this.sprites[spriteKey];
    if (currentSprite) currentSprite.update(dt);

    switch (this.state) {
      case "parachute":
        this.updateParachute(dt);
        break;
      case "idle":
        this.updateIdle();
        break;
      case "walk":
        this.updateWalk(dt);
        break;
      case "sit":
        this.updateSit();
        break;
      case "sleep":
        this.updateSleep();
        break;
      case "fall":
        this.updateFall(dt);
        break;
      case "grabbed":
        this.x = Math.max(0, Math.min(this.x, this.screenWidth - DISPLAY_SIZE));
        this.y = Math.max(0, Math.min(this.y, this.screenHeight - DISPLAY_SIZE));
        break;
      case "petting":
        // Just chill — sprite animation handles the rest
        break;
      case "bounce":
        this.updateBounce(dt);
        break;
      case "spin":
      case "backflip":
      case "headshake":
      case "vibrate":
        this.updateTimedAnimation();
        break;
      case "zoom":
        this.updateZoom(dt);
        break;
    }
  }

  private setState(newState: SheepState, duration: number = 0) {
    this.state = newState;
    this.stateTimer = 0;
    this.stateDuration = duration;
    const sprite = this.sprites[newState];
    if (sprite) sprite.reset();
  }

  private updateParachute(dt: number) {
    this.vy = 80; // slow fall px/sec
    this.y += this.vy * (dt / 1000);

    // Gentle side-to-side sway
    this.x += Math.sin(this.stateTimer / 500) * 0.5;

    if (this.y >= this.groundY) {
      this.y = this.groundY;
      this.vy = 0;
      this.setState("idle", 2000 + Math.random() * 3000);
    }
  }

  private updateIdle() {
    if (this.stateTimer >= this.stateDuration) {
      this.transitionFromIdle();
    }
  }

  private updateWalk(dt: number) {
    const dir = this.facingRight ? 1 : -1;
    this.x += dir * WALK_SPEED * (dt / 1000);

    if (this.x <= 0) {
      this.x = 0;
      this.facingRight = true;
    } else if (this.x >= this.screenWidth - DISPLAY_SIZE) {
      this.x = this.screenWidth - DISPLAY_SIZE;
      this.facingRight = false;
    }

    if (this.stateTimer >= this.stateDuration) {
      this.setState("idle", 2000 + Math.random() * 6000);
    }
  }

  private updateSit() {
    if (this.stateTimer >= this.stateDuration) {
      this.setState("idle", 1000 + Math.random() * 2000);
    }
  }

  private updateSleep() {
    if (this.stateTimer >= this.stateDuration) {
      this.setState("idle", 1000 + Math.random() * 2000);
    }
  }

  private updateFall(dt: number) {
    this.vy += 0.5 * 60 * (dt / 1000);
    this.y += this.vy * (dt / 1000);

    if (this.y >= this.groundY) {
      this.y = this.groundY;
      this.vy = 0;
      this.setState("idle", 1000 + Math.random() * 2000);
    }
  }

  private transitionFromIdle() {
    const roll = Math.random();
    if (roll < 0.7) {
      this.facingRight = Math.random() > 0.5;
      this.setState("walk", 3000 + Math.random() * 7000);
    } else if (roll < 0.9) {
      this.setState("sit", 5000 + Math.random() * 10000);
    } else {
      this.setState("idle", 2000 + Math.random() * 6000);
    }
  }

  /** Map states to sprite sheet keys */
  private getSpriteKey(): string {
    switch (this.state) {
      case "grabbed": return "fall";
      case "petting": return "sleep";
      case "bounce": return "idle";
      case "spin": return "walk";
      case "backflip": return "fall";
      case "headshake": return "idle";
      case "zoom": return "walk";
      case "vibrate": return "idle";
      default: return this.state;
    }
  }

  private updateBounce(dt: number) {
    this.vy += 800 * (dt / 1000); // gravity
    this.y += this.vy * (dt / 1000);

    if (this.y >= this.groundY) {
      this.y = this.groundY;
      if (this.stateTimer >= this.stateDuration) {
        this.setState("idle", 1000 + Math.random() * 2000);
      } else {
        this.vy = -200; // smaller re-bounce
      }
    }
  }

  private updateTimedAnimation() {
    if (this.stateTimer >= this.stateDuration) {
      this.y = this.groundY;
      this.setState("idle", 1000 + Math.random() * 2000);
    }
  }

  private updateZoom(dt: number) {
    const dir = this.facingRight ? 1 : -1;
    this.x += dir * ZOOM_SPEED * (dt / 1000);

    // Bounce off edges
    if (this.x <= 0) {
      this.x = 0;
      this.facingRight = true;
    } else if (this.x >= this.screenWidth - DISPLAY_SIZE) {
      this.x = this.screenWidth - DISPLAY_SIZE;
      this.facingRight = false;
    }

    if (this.stateTimer >= this.stateDuration) {
      this.setState("idle", 1000 + Math.random() * 2000);
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const spriteKey = this.getSpriteKey();
    const sprite = this.sprites[spriteKey];
    if (!sprite) return;

    const cx = this.x + DISPLAY_SIZE / 2;
    const cy = this.y + DISPLAY_SIZE / 2;

    switch (this.state) {
      case "grabbed": {
        const wiggle = Math.sin(this.stateTimer / 60) * 0.18;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(wiggle);
        ctx.translate(-cx, -cy);
        sprite.draw(ctx, this.x, this.y, SCALE, !this.facingRight);
        ctx.restore();
        break;
      }

      case "petting": {
        // Gentle happy sway
        const sway = Math.sin(this.stateTimer / 300) * 0.05;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(sway);
        ctx.translate(-cx, -cy);
        sprite.draw(ctx, this.x, this.y, SCALE, !this.facingRight);
        ctx.restore();
        break;
      }

      case "bounce": {
        // Squash and stretch based on vertical velocity
        const squash = 1 + Math.abs(this.vy) * 0.001;
        const scaleX = 1 / squash;
        const scaleY = squash;
        ctx.save();
        ctx.translate(cx, this.y + DISPLAY_SIZE);
        ctx.scale(scaleX, scaleY);
        ctx.translate(-cx, -(this.y + DISPLAY_SIZE));
        sprite.draw(ctx, this.x, this.y, SCALE, !this.facingRight);
        ctx.restore();
        break;
      }

      case "spin": {
        const angle = (this.stateTimer / this.stateDuration) * Math.PI * 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.translate(-cx, -cy);
        sprite.draw(ctx, this.x, this.y, SCALE, !this.facingRight);
        ctx.restore();
        break;
      }

      case "backflip": {
        const progress = this.stateTimer / this.stateDuration;
        const angle = progress * Math.PI * 2;
        // Arc up then down
        const arcY = this.y - Math.sin(progress * Math.PI) * 80;
        const arcCy = arcY + DISPLAY_SIZE / 2;
        ctx.save();
        ctx.translate(cx, arcCy);
        ctx.rotate(-angle);
        ctx.translate(-cx, -arcCy);
        sprite.draw(ctx, this.x, arcY, SCALE, !this.facingRight);
        ctx.restore();
        break;
      }

      case "headshake": {
        const shake = Math.sin(this.stateTimer / 30) * 8;
        ctx.save();
        ctx.translate(shake, 0);
        sprite.draw(ctx, this.x, this.y, SCALE, !this.facingRight);
        ctx.restore();
        break;
      }

      case "zoom": {
        // Lean forward + motion blur via slight horizontal stretch
        const lean = this.facingRight ? -0.2 : 0.2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(lean);
        ctx.scale(1.15, 0.9);
        ctx.translate(-cx, -cy);
        sprite.draw(ctx, this.x, this.y, SCALE, !this.facingRight);

        // Speed lines (afterimages)
        ctx.globalAlpha = 0.15;
        const trailDir = this.facingRight ? -1 : 1;
        sprite.draw(ctx, this.x + trailDir * 30, this.y, SCALE, !this.facingRight);
        ctx.globalAlpha = 0.07;
        sprite.draw(ctx, this.x + trailDir * 60, this.y, SCALE, !this.facingRight);
        ctx.restore();
        break;
      }

      case "vibrate": {
        const ox = (Math.random() - 0.5) * 6;
        const oy = (Math.random() - 0.5) * 6;
        sprite.draw(ctx, this.x + ox, this.y + oy, SCALE, !this.facingRight);
        break;
      }

      default:
        sprite.draw(ctx, this.x, this.y, SCALE, !this.facingRight);
        break;
    }

    // Draw emote particles for certain animations
    this.drawEmoteParticles(ctx);
  }

  private drawEmoteParticles(ctx: CanvasRenderingContext2D) {
    const cx = this.x + DISPLAY_SIZE / 2;
    const top = this.y - 10;

    if (this.state === "petting") {
      // Floating hearts
      ctx.save();
      ctx.font = "14px serif";
      const t = this.stateTimer / 600;
      const heartCount = 3;
      for (let i = 0; i < heartCount; i++) {
        const phase = t + i * 2.1;
        const hx = cx + Math.sin(phase * 1.5) * 25 - 8;
        const hy = top - (phase % 3) * 20;
        ctx.globalAlpha = 1 - (phase % 3) / 3;
        ctx.fillText("\u{2764}\u{FE0F}", hx, hy);
      }
      ctx.restore();
    }

    if (this.state === "bounce" && this.vy < -50) {
      // Sparkles on upward bounce
      ctx.save();
      ctx.fillStyle = "#FFD700";
      ctx.font = "16px serif";
      const sparkleY = top - Math.sin(this.stateTimer / 100) * 15;
      ctx.fillText("\u2728", cx - 20, sparkleY);
      ctx.fillText("\u2728", cx + 10, sparkleY - 8);
      ctx.restore();
    }

    if (this.state === "vibrate") {
      // Angry marks
      ctx.save();
      ctx.fillStyle = "#e94560";
      ctx.font = "18px serif";
      const pulse = 0.8 + Math.sin(this.stateTimer / 50) * 0.2;
      ctx.globalAlpha = pulse;
      ctx.fillText("\u{1F4A2}", cx - 8, top - 5);
      ctx.restore();
    }
  }
}
