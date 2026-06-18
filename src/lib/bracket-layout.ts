import { ADVANCEMENT_ROUNDS } from "@/lib/bracket";
import type { RunGame, RunPair, RunSelection } from "@/lib/types";

export const WORLD_WIDTH = 1540;
export const WORLD_HEIGHT = 820;
export const CARD_WIDTH = 74;
export const CARD_HEIGHT = 100;
export const MAX_ZOOM = 3.1;

const LEFT_COLUMNS = [105, 270, 450, 620] as const;
const RIGHT_COLUMNS = [1435, 1270, 1090, 920] as const;
const CHAMPION_X = 770;

/** Original seed y-positions: 4 pairs per side, 75px within-pair gap, 170px between halves. */
const SEED_Y = [100, 175, 250, 325, 495, 570, 645, 720] as const;

type Half = "left" | "right" | "center";

export type BracketNode = {
  key: string;
  round: number;
  gameId: string | null;
  eliminated: boolean;
  active: boolean;
  winner: boolean;
  x: number;
  y: number;
  half: Half;
  children?: [BracketNode, BracketNode];
};

export type BracketConnector = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type FocusPoint = { x: number; y: number };

export type FlatNode = Pick<BracketNode, "key" | "round" | "gameId" | "eliminated" | "active" | "winner" | "x" | "y">;

function nodeToFlat(node: BracketNode): FlatNode {
  return {
    key: node.key,
    round: node.round,
    gameId: node.gameId,
    eliminated: node.eliminated,
    active: node.active,
    winner: node.winner,
    x: node.x,
    y: node.y
  };
}

function getSelection(selections: RunSelection[], round: number) {
  return selections.find((selection) => selection.round === round) ?? null;
}

function leafY(index: number) {
  return SEED_Y[index];
}

function getDepth(round: number): number {
  if (round <= 8) return 1;
  if (round <= 12) return 2;
  if (round <= 14) return 3;
  return 4;
}

function buildBracketTree(
  openingPairs: RunPair[],
  selections: RunSelection[],
  currentRound: number
): { nodes: FlatNode[]; connectors: BracketConnector[]; focusPoint: FocusPoint } {
  const allNodes = new Map<string, BracketNode>();

  // -- Build leaves --
  const leftLeaves: BracketNode[] = [];
  const rightLeaves: BracketNode[] = [];

  for (let i = 0; i < openingPairs.length; i++) {
    const pair = openingPairs[i];
    const half: Half = i < 4 ? "left" : "right";
    const selection = getSelection(selections, pair.round);
    const active = currentRound === pair.round;

    const leftLeaf: BracketNode = {
      key: `r${pair.round}-left`,
      round: pair.round,
      gameId: pair.leftGameId,
      eliminated: !!selection && selection.pickedGameId !== pair.leftGameId,
      active,
      winner: false,
      x: 0,
      y: 0,
      half
    };

    const rightLeaf: BracketNode = {
      key: `r${pair.round}-right`,
      round: pair.round,
      gameId: pair.rightGameId,
      eliminated: !!selection && selection.pickedGameId !== pair.rightGameId,
      active,
      winner: false,
      x: 0,
      y: 0,
      half
    };

    if (half === "left") {
      leftLeaves.push(leftLeaf, rightLeaf);
    } else {
      rightLeaves.push(leftLeaf, rightLeaf);
    }

    allNodes.set(leftLeaf.key, leftLeaf);
    allNodes.set(rightLeaf.key, rightLeaf);
  }

  leftLeaves.forEach((leaf, index) => {
    leaf.y = leafY(index);
    leaf.x = LEFT_COLUMNS[0];
  });

  rightLeaves.forEach((leaf, index) => {
    leaf.y = leafY(index);
    leaf.x = RIGHT_COLUMNS[0];
  });

  // Build a quick map from round to leaf pair for creating w1-w8
  const leavesByRound = new Map<number, [BracketNode, BracketNode]>();
  for (const pair of openingPairs) {
    const left = allNodes.get(`r${pair.round}-left`);
    const right = allNodes.get(`r${pair.round}-right`);
    if (left && right) {
      leavesByRound.set(pair.round, [left, right]);
    }
  }

  // -- Build internal nodes (w1..w15) --
  function createWinnerNode(round: number): BracketNode {
    const half: Half = round <= 14
      ? (round <= 4 || (round >= 9 && round <= 10) || round === 13 ? "left" : "right")
      : "center";

    const selection = getSelection(selections, round);

    const node: BracketNode = {
      key: `w${round}`,
      round,
      gameId: selection?.pickedGameId ?? null,
      eliminated: false,
      active: false,
      winner: !!selection,
      x: 0,
      y: 0,
      half,
      children: undefined
    };

    return node;
  }

  // w1..w8
  for (let r = 1; r <= 8; r++) {
    const node = createWinnerNode(r);
    const children = leavesByRound.get(r);
    if (children) {
      node.children = children;
    }
    allNodes.set(node.key, node);
  }

  // w9..w15 from ADVANCEMENT_ROUNDS
  const advancementKeys = Object.keys(ADVANCEMENT_ROUNDS).map(Number).sort((a, b) => a - b);
  for (const advRound of advancementKeys) {
    const [sourceA, sourceB] = ADVANCEMENT_ROUNDS[advRound];
    const node = createWinnerNode(advRound);
    const childA = allNodes.get(`w${sourceA}`);
    const childB = allNodes.get(`w${sourceB}`);
    if (childA && childB) {
      node.children = [childA, childB];
    }
    allNodes.set(node.key, node);
  }

  // -- Set active on internal nodes --
  const isAdvancement = currentRound in ADVANCEMENT_ROUNDS;
  if (isAdvancement) {
    const [sourceA, sourceB] = ADVANCEMENT_ROUNDS[currentRound];
    const nodeA = allNodes.get(`w${sourceA}`);
    const nodeB = allNodes.get(`w${sourceB}`);
    if (nodeA) nodeA.active = true;
    if (nodeB) nodeB.active = true;
  }

  // -- Layout internal nodes (y = midpoint of children, x by half + depth) --
  function layoutNode(node: BracketNode) {
    if (!node.children) return;

    const [childA, childB] = node.children;

    // Ensure children are laid out first
    layoutNode(childA);
    layoutNode(childB);

    node.y = (childA.y + childB.y) / 2;

    if (node.half === "left") {
      node.x = LEFT_COLUMNS[getDepth(node.round)];
    } else if (node.half === "right") {
      node.x = RIGHT_COLUMNS[getDepth(node.round)];
    } else {
      node.x = CHAMPION_X;
    }
  }

  const root = allNodes.get("w15");
  if (root) layoutNode(root);

  // -- Generate connectors --
  const connectors: BracketConnector[] = [];
  const edge = CARD_WIDTH / 2;

  function addConnectors(node: BracketNode) {
    if (!node.children) return;

    const [childA, childB] = node.children;

    addConnectors(childA);
    addConnectors(childB);

    const midX = (childA.x + node.x) / 2;

    if (node.half === "left") {
      if (childA.y === childB.y) {
        connectors.push(
          { x1: childA.x + edge, y1: childA.y, x2: node.x - edge, y2: node.y },
          { x1: childB.x + edge, y1: childB.y, x2: node.x - edge, y2: node.y }
        );
      } else {
        connectors.push(
          { x1: childA.x + edge, y1: childA.y, x2: midX, y2: childA.y },
          { x1: childB.x + edge, y1: childB.y, x2: midX, y2: childB.y },
          { x1: midX, y1: childA.y, x2: midX, y2: childB.y },
          { x1: midX, y1: node.y, x2: node.x - edge, y2: node.y }
        );
      }
    } else if (node.half === "right") {
      if (childA.y === childB.y) {
        connectors.push(
          { x1: childA.x - edge, y1: childA.y, x2: node.x + edge, y2: node.y },
          { x1: childB.x - edge, y1: childB.y, x2: node.x + edge, y2: node.y }
        );
      } else {
        connectors.push(
          { x1: childA.x - edge, y1: childA.y, x2: midX, y2: childA.y },
          { x1: childB.x - edge, y1: childB.y, x2: midX, y2: childB.y },
          { x1: midX, y1: childA.y, x2: midX, y2: childB.y },
          { x1: midX, y1: node.y, x2: node.x + edge, y2: node.y }
        );
      }
    } else {
      connectors.push(
        { x1: childA.x + edge, y1: childA.y, x2: node.x - edge, y2: node.y },
        { x1: childB.x - edge, y1: childB.y, x2: node.x + edge, y2: node.y }
      );
    }
  }

  if (root) addConnectors(root);

  // -- Focus point --
  const activeSlots = Array.from(allNodes.values()).filter(
    (node) => node.active && node.gameId
  );
  const targetSlots = activeSlots.length > 0
    ? activeSlots
    : Array.from(allNodes.values()).filter((node) => node.gameId);

  let focusPoint: FocusPoint;
  if (targetSlots.length === 0) {
    focusPoint = { x: CHAMPION_X, y: (SEED_Y[0] + SEED_Y[SEED_Y.length - 1]) / 2 };
  } else {
    focusPoint = {
      x: targetSlots.reduce((sum, node) => sum + node.x, 0) / targetSlots.length,
      y: targetSlots.reduce((sum, node) => sum + node.y, 0) / targetSlots.length
    };
  }

  return {
    nodes: Array.from(allNodes.values()).map(nodeToFlat),
    connectors,
    focusPoint
  };
}

export { buildBracketTree };

export function getCoverUrl(game: RunGame | null | undefined) {
  return game?.imageUrl ?? game?.thumbUrl ?? null;
}
