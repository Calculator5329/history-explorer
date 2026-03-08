import type { EventType } from "../../types/index.ts";

// SVG path data for event type icons, normalized to -6..6 coordinate space
// These render inside node circles, so they must be small and recognizable
export const EVENT_ICON_PATHS: Record<EventType, string> = {
  // Crossed swords
  battle: "M-4,-4 L4,4 M-3,-4 L-4,-4 L-4,-3 M3,4 L4,4 L4,3 M4,-4 L-4,4 M3,-4 L4,-4 L4,-3 M-3,4 L-4,4 L-4,3",

  // Explosion star burst
  bombing: "M0,-5 L1,-2 L4,-3 L2,-1 L5,0 L2,1 L4,3 L1,2 L0,5 L-1,2 L-4,3 L-2,1 L-5,0 L-2,-1 L-4,-3 L-1,-2 Z",

  // Arrow pointing right into territory
  invasion: "M-4,0 L3,0 M0,-3 L3,0 L0,3 M-4,-2 L-4,2",

  // Ship/anchor
  naval: "M0,-4 L0,-2 M-3,0 Q0,4 3,0 M-4,2 L4,2 M0,-2 Q-2,0 -3,2 M0,-2 Q2,0 3,2",

  // Scroll/document
  treaty: "M-3,-4 L3,-4 L3,4 L-3,4 Z M-1,-2 L1,-2 M-1,0 L1,0 M-1,2 L1,2",

  // Gavel
  declaration: "M-3,-3 L1,1 M1,-3 L-3,1 M-1,-1 L3,-1 M-2,2 L2,2 M0,2 L0,4",

  // Lowered flag
  surrender: "M-3,-4 L-3,4 M-3,-4 L3,-2 L-3,0",

  // Factory
  homefront: "M-4,3 L-4,-1 L-2,-3 L-2,-1 L0,-3 L0,-1 L2,-3 L2,-1 L4,-1 L4,3 Z",

  // Capitol/podium
  political: "M-3,3 L-3,0 L0,-3 L3,0 L3,3 M-4,3 L4,3 M-2,0 L-2,3 M2,0 L2,3",

  // Broken chain
  liberation: "M-4,0 Q-4,-3 -1,-3 M-1,-3 L-1,-1 M1,3 L1,1 M1,3 Q4,3 4,0",

  // Running figures
  evacuation: "M-2,-3 A1,1 0 1,1 -2,-1 M-2,-1 L-2,2 M-2,0 L-4,1 M-2,0 L0,1 M-2,2 L-4,4 M-2,2 L0,4",
};
