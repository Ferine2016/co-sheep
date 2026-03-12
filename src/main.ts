import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Sheep } from "./sheep";
import { SpeechBubble } from "./speech-bubble";
import "./styles.css";

let sheep: Sheep;
let speechBubble: SpeechBubble;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let lastTime = 0;

// Drag state
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Petting state
let hoverTimer = 0;
let isHovering = false;
const PET_THRESHOLD = 2000; // ms of hovering before petting starts

// Throttle bounds updates to Rust (~20fps)
let lastBoundsUpdate = 0;
const BOUNDS_UPDATE_INTERVAL = 50;

async function init() {
  canvas = document.getElementById("sheep-canvas") as HTMLCanvasElement;
  ctx = canvas.getContext("2d")!;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  ctx.imageSmoothingEnabled = false;

  console.log("[co-sheep] Canvas initialized:", canvas.width, "x", canvas.height);

  sheep = new Sheep(canvas.width, canvas.height);
  speechBubble = new SpeechBubble();
  speechBubble.onAnimation = (anim) => {
    console.log("[co-sheep] Triggering animation from AI:", anim);
    sheep.playAnimation(anim);
  };
  console.log("[co-sheep] Sheep and speech bubble created");

  // --- Drag, toss, double-click, and petting handlers ---

  document.addEventListener("mousedown", (e) => {
    if (sheep.hitTest(e.clientX, e.clientY)) {
      console.log("[co-sheep] Grab! at", e.clientX, e.clientY);
      isDragging = true;
      dragOffsetX = e.clientX - sheep.x;
      dragOffsetY = e.clientY - sheep.y;
      sheep.grab();
      document.body.classList.add("dragging");
      invoke("set_dragging", { dragging: true });
    }
  });

  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      sheep.x = e.clientX - dragOffsetX;
      sheep.y = e.clientY - dragOffsetY;
    }
  });

  document.addEventListener("mouseup", () => {
    if (isDragging) {
      console.log("[co-sheep] Release!");
      isDragging = false;
      sheep.release();
      document.body.classList.remove("dragging");
      invoke("set_dragging", { dragging: false });
    }
  });

  // Double-click: random quip + animation
  document.addEventListener("dblclick", (e) => {
    if (sheep.hitTest(e.clientX, e.clientY) && !isDragging) {
      console.log("[co-sheep] Double-click!");
      const quip = sheep.getRandomQuip();
      speechBubble.show(quip, 4000);
      const anims: Array<"bounce" | "spin" | "headshake" | "vibrate"> = [
        "bounce", "spin", "headshake", "vibrate",
      ];
      sheep.playAnimation(anims[Math.floor(Math.random() * anims.length)]);
      invoke("record_interaction", { interaction: "poked" });
    }
  });

  // Petting: track hover time over sheep
  document.addEventListener("mousemove", (e) => {
    if (isDragging) return;
    if (sheep.hitTest(e.clientX, e.clientY)) {
      if (!isHovering) {
        isHovering = true;
        hoverTimer = performance.now();
      } else if (
        performance.now() - hoverTimer > PET_THRESHOLD &&
        sheep.state !== "petting"
      ) {
        sheep.startPetting();
        speechBubble.show("Zzzz... don't stop...", 3000);
        invoke("record_interaction", { interaction: "petted" });
      }
    } else {
      if (isHovering) {
        isHovering = false;
        sheep.stopPetting();
      }
    }
  });

  // File drop: sheep "eats" the file and comments
  document.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  document.addEventListener("drop", (e) => {
    e.preventDefault();
    if (!e.dataTransfer?.files.length) return;
    const file = e.dataTransfer.files[0];
    console.log("[co-sheep] File dropped:", file.name, file.type);
    const comment = getFileComment(file);
    speechBubble.show(comment, 5000);
    sheep.playAnimation("bounce");
    invoke("record_interaction", { interaction: "fed a file" });
  });

  // --- Events ---
  listen<string>("naming-complete", async (event) => {
    const name = event.payload;
    console.log("[co-sheep] Naming complete:", name);
    const hasKey = await invoke<boolean>("check_api_key");
    if (hasKey) {
      speechBubble.show(
        `Nice! I'm ${name} now. I can see everything. This is going to be fun. For me.`,
        6000,
      );
    } else {
      speechBubble.show(
        `I'm ${name}! But I can't see your screen yet. Set ANTHROPIC_API_KEY in your environment and restart me!`,
        8000,
      );
    }
  });

  // --- Onboarding ---
  try {
    const needsOnboarding = await invoke<boolean>("check_onboarding");
    console.log("[co-sheep] Needs onboarding:", needsOnboarding);
    if (needsOnboarding) {
      console.log("[co-sheep] Will open naming window in 4s...");
      setTimeout(() => {
        console.log("[co-sheep] Opening naming window");
        invoke("open_naming_window");
      }, 4000);
    }
  } catch (e) {
    console.error("[co-sheep] Onboarding check failed:", e);
  }

  console.log("[co-sheep] Starting animation loop");
  requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp: number) {
  const dt = lastTime ? timestamp - lastTime : 16;
  lastTime = timestamp;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;

  sheep.update(dt);
  sheep.draw(ctx);

  speechBubble.updatePosition(sheep.x, sheep.y, sheep.displaySize);

  // Report sheep bounds to Rust for cursor hit detection (throttled)
  if (timestamp - lastBoundsUpdate > BOUNDS_UPDATE_INTERVAL) {
    lastBoundsUpdate = timestamp;
    const pad = 12;
    invoke("update_sheep_bounds", {
      x: sheep.x - pad,
      y: sheep.y - pad,
      w: sheep.displaySize + pad * 2,
      h: sheep.displaySize + pad * 2,
    });
  }

  requestAnimationFrame(gameLoop);
}

function getFileComment(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const name = file.name;

  const comments: Record<string, string[]> = {
    pdf: [
      `A PDF? *chews* Dry.`,
      `"${name}"... riveting literature, I'm sure.`,
      `*nibbles corner* Tastes like bureaucracy.`,
    ],
    png: [
      `Ooh, a picture! *munches* Not bad.`,
      `Is this your idea of art? Bold choice.`,
      `*examines pixels* I've seen better.`,
    ],
    jpg: [
      `A JPEG? The compression! My taste buds!`,
      `*squints at artifacts* Needs more pixels.`,
    ],
    gif: [
      `A GIF! Finally, some entertainment.`,
      `*watches loop 47 times* Still funny.`,
    ],
    mp3: [
      `Music? My ears are made of wool, but I'll try.`,
      `*bobs head* Not baaad.`,
    ],
    mp4: [
      `A video? I don't have that kind of attention span.`,
      `*stares* Is this what you watch instead of working?`,
    ],
    js: [
      `JavaScript? *gags* At least it's not PHP.`,
      `*reads code* I have opinions. None of them good.`,
    ],
    ts: [
      `TypeScript! A sheep of culture, your human.`,
      `*types checked* ...mostly.`,
    ],
    rs: [
      `Rust! Now we're talking. *happy sheep noises*`,
      `*borrows and returns* The borrow checker approves.`,
    ],
    py: [
      `Python? *hisses* Snakes are NOT my friends.`,
      `Significant whitespace? In THIS economy?`,
    ],
    zip: [
      `*swallows whole* That was a lot to digest.`,
      `A zip file? I'm not opening that. I'm a sheep, not a bomb squad.`,
    ],
    exe: [
      `An exe? I'm not clicking that and neither should you.`,
      `*backs away slowly*`,
    ],
    md: [
      `Markdown! My diary format of choice.`,
      `*reads* Wait, is this about me?`,
    ],
    txt: [
      `Plain text. How refreshingly boring.`,
      `*reads entire thing in 0.3 seconds* Meh.`,
    ],
  };

  const pool = comments[ext] || [
    `A .${ext} file? Never heard of it. *chews anyway*`,
    `*sniffs ${name}* Smells like work.`,
    `You're feeding me "${name}"? I have standards. Low ones, but still.`,
  ];

  return pool[Math.floor(Math.random() * pool.length)];
}

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
});

init();
