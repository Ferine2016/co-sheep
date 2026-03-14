import { Sheep } from "./sheep";
import { SpeechBubble } from "./speech-bubble";

export type GroupActivityType = "campfire_circle" | "follow_leader" | "sync_bounce" | "huddle";

export interface GroupActivity {
  type: GroupActivityType;
  participants: string[];
  phase: "gathering" | "performing" | "dispersing";
  timer: number;
  duration: number;
  centerX: number;
  leaderId?: string;
  bounceCount?: number;
}

const DISPLAY_SIZE = 96;

/** Check if enough sheep are calm and near each other to start a group activity */
export function canStartGroupActivity(
  sheepList: Array<{ id: string; x: number; calm: boolean }>,
): string[] | null {
  // Need at least 3 calm sheep within 5 display widths of each other
  const calm = sheepList.filter((s) => s.calm);
  if (calm.length < 3) return null;

  // Find a cluster — check if any 3+ are within range
  for (let i = 0; i < calm.length; i++) {
    const cluster = [calm[i]];
    for (let j = 0; j < calm.length; j++) {
      if (i === j) continue;
      if (Math.abs(calm[i].x - calm[j].x) < DISPLAY_SIZE * 5) {
        cluster.push(calm[j]);
      }
    }
    if (cluster.length >= 3) {
      return cluster.map((s) => s.id);
    }
  }
  return null;
}

export function createGroupActivity(
  type: GroupActivityType,
  participants: string[],
  centerX: number,
): GroupActivity {
  const durations: Record<GroupActivityType, number> = {
    campfire_circle: 15000 + Math.random() * 10000,
    follow_leader: 10000 + Math.random() * 5000,
    sync_bounce: 6000,
    huddle: 10000 + Math.random() * 5000,
  };

  return {
    type,
    participants,
    phase: "gathering",
    timer: 0,
    duration: durations[type],
    centerX,
    leaderId: type === "follow_leader" ? participants[Math.floor(Math.random() * participants.length)] : undefined,
    bounceCount: type === "sync_bounce" ? 0 : undefined,
  };
}

export function pickActivityType(): GroupActivityType {
  const types: GroupActivityType[] = ["campfire_circle", "follow_leader", "sync_bounce", "huddle"];
  return types[Math.floor(Math.random() * types.length)];
}

/** Returns true while activity is still running, false when done */
export function updateGroupActivity(
  activity: GroupActivity,
  dt: number,
  getSheep: (id: string) => { sheep: Sheep; bubble: SpeechBubble } | null,
): boolean {
  activity.timer += dt;

  switch (activity.phase) {
    case "gathering":
      return updateGathering(activity, dt, getSheep);
    case "performing":
      return updatePerforming(activity, dt, getSheep);
    case "dispersing":
      return updateDispersing(activity);
  }
}

function updateGathering(
  activity: GroupActivity,
  _dt: number,
  getSheep: (id: string) => { sheep: Sheep; bubble: SpeechBubble } | null,
): boolean {
  let allGathered = true;

  for (const id of activity.participants) {
    const entry = getSheep(id);
    if (!entry) continue;
    const sheep = entry.sheep;

    // Set walk target toward center
    if (sheep.walkTarget === null && Math.abs(sheep.x - activity.centerX) > DISPLAY_SIZE * 1.5) {
      sheep.walkTarget = activity.centerX + (activity.participants.indexOf(id) - 1) * DISPLAY_SIZE * 0.8;
    }

    if (Math.abs(sheep.x - activity.centerX) > DISPLAY_SIZE * 2) {
      allGathered = false;
    }
  }

  // Timeout gathering after 8s — just start performing
  if (allGathered || activity.timer > 8000) {
    activity.phase = "performing";
    activity.timer = 0;

    // Announce the activity
    if (activity.type === "huddle") {
      const first = getSheep(activity.participants[0]);
      if (first) first.bubble.show("Group meeting!", 3000);
    } else if (activity.type === "campfire_circle") {
      const first = getSheep(activity.participants[0]);
      if (first) first.bubble.show("Campfire time!", 3000);
    }
  }

  return true;
}

function updatePerforming(
  activity: GroupActivity,
  dt: number,
  getSheep: (id: string) => { sheep: Sheep; bubble: SpeechBubble } | null,
): boolean {
  switch (activity.type) {
    case "campfire_circle": {
      // First participant does campfire, others sit nearby
      for (let i = 0; i < activity.participants.length; i++) {
        const entry = getSheep(activity.participants[i]);
        if (!entry) continue;
        const sheep = entry.sheep;
        if (i === 0 && sheep.state !== "idle_campfire") {
          sheep.playAnimation("bounce"); // will transition to campfire via bored state
          // Directly set state for leader
          (sheep as any).state = "idle_campfire";
          (sheep as any).stateTimer = 0;
          (sheep as any).stateDuration = activity.duration;
          (sheep as any).campfireSparks = [];
        } else if (i > 0 && sheep.state !== "sit") {
          (sheep as any).state = "sit";
          (sheep as any).stateTimer = 0;
          (sheep as any).stateDuration = activity.duration;
        }
      }
      break;
    }

    case "follow_leader": {
      // Leader walks, others follow
      const leader = getSheep(activity.leaderId!);
      if (leader) {
        if (leader.sheep.state !== "walk") {
          leader.sheep.facingRight = Math.random() > 0.5;
          (leader.sheep as any).state = "walk";
          (leader.sheep as any).stateTimer = 0;
          (leader.sheep as any).stateDuration = activity.duration;
        }
        // Others follow leader
        for (const id of activity.participants) {
          if (id === activity.leaderId) continue;
          const follower = getSheep(id);
          if (follower) {
            follower.sheep.walkTarget = leader.sheep.x;
          }
        }
      }
      break;
    }

    case "sync_bounce": {
      // Synchronized bouncing every 1.5s
      const interval = 1500;
      const expectedBounces = Math.floor(activity.timer / interval);
      if (activity.bounceCount !== undefined && expectedBounces > activity.bounceCount && activity.bounceCount < 4) {
        activity.bounceCount = expectedBounces;
        for (let i = 0; i < activity.participants.length; i++) {
          const entry = getSheep(activity.participants[i]);
          if (entry) {
            // Stagger slightly for cascade effect
            setTimeout(() => entry.sheep.playAnimation("bounce"), i * 150);
          }
        }
      }
      break;
    }

    case "huddle": {
      // Everyone sits close together
      for (const id of activity.participants) {
        const entry = getSheep(id);
        if (!entry) continue;
        if (entry.sheep.state !== "sit" && entry.sheep.state !== "idle") {
          (entry.sheep as any).state = "sit";
          (entry.sheep as any).stateTimer = 0;
          (entry.sheep as any).stateDuration = activity.duration;
        }
      }
      break;
    }
  }

  if (activity.timer >= activity.duration) {
    activity.phase = "dispersing";
    activity.timer = 0;
    // Release participants from forced states
    for (const id of activity.participants) {
      const entry = getSheep(id);
      if (entry) {
        // Set random walk targets outward
        const dir = Math.random() > 0.5 ? 1 : -1;
        entry.sheep.walkTarget = entry.sheep.x + dir * (DISPLAY_SIZE * 2 + Math.random() * DISPLAY_SIZE * 3);
      }
    }
  }

  // Call campfire update for the leader during campfire_circle
  if (activity.type === "campfire_circle") {
    const leader = getSheep(activity.participants[0]);
    if (leader) {
      leader.sheep.update(dt);
    }
  }

  return true;
}

function updateDispersing(activity: GroupActivity): boolean {
  // Dispersal lasts 3s then activity ends
  return activity.timer < 3000;
}
