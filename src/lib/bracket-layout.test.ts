import { describe, expect, it } from "vitest";

import { buildBracketTree, type BracketNode } from "@/lib/bracket-layout";
import { createMockRunResponse } from "@/test/helpers/mock-data";

function findNode(nodes: BracketNode[], key: string): BracketNode | undefined {
  return nodes.find((n) => n.key === key);
}

function collectLeavesFromNodes(nodes: BracketNode[]): BracketNode[] {
  return nodes.filter((n) => n.key.startsWith("r"));
}

function collectInternalFromNodes(nodes: BracketNode[]): BracketNode[] {
  return nodes.filter((n) => n.key.startsWith("w"));
}

describe("buildBracketTree", () => {
  const run = createMockRunResponse();

  it("builds correct node count", () => {
    const { nodes } = buildBracketTree(run.roundPairs, [], 1, );
    expect(nodes).toHaveLength(31); // 16 leaves + 15 internal
    expect(collectLeavesFromNodes(nodes)).toHaveLength(16);
    expect(collectInternalFromNodes(nodes)).toHaveLength(15);
  });

  it("assigns correct x positions by half and depth", () => {
    const { nodes } = buildBracketTree(run.roundPairs, [], 1, );

    // Left leaves
    const leftLeaf = findNode(nodes, "r1-left");
    expect(leftLeaf).toBeDefined();
    expect(leftLeaf!.x).toBe(105);

    // Right leaves
    const rightLeaf = findNode(nodes, "r5-left");
    expect(rightLeaf).toBeDefined();
    expect(rightLeaf!.x).toBe(1435);

    // Left first winner
    const w1 = findNode(nodes, "w1");
    expect(w1).toBeDefined();
    expect(w1!.x).toBe(270);

    // Right first winner
    const w5 = findNode(nodes, "w5");
    expect(w5).toBeDefined();
    expect(w5!.x).toBe(1270);

    // Left quarter
    const w9 = findNode(nodes, "w9");
    expect(w9).toBeDefined();
    expect(w9!.x).toBe(450);

    // Right quarter
    const w11 = findNode(nodes, "w11");
    expect(w11).toBeDefined();
    expect(w11!.x).toBe(1090);

    // Left semi
    const w13 = findNode(nodes, "w13");
    expect(w13).toBeDefined();
    expect(w13!.x).toBe(620);

    // Right semi
    const w14 = findNode(nodes, "w14");
    expect(w14).toBeDefined();
    expect(w14!.x).toBe(920);

    // Champion
    const w15 = findNode(nodes, "w15");
    expect(w15).toBeDefined();
    expect(w15!.x).toBe(770);
  });

  it("assigns y midpoints for internal nodes", () => {
    const { nodes } = buildBracketTree(run.roundPairs, [], 1, );

    const w1 = findNode(nodes, "w1")!;
    const w1Left = findNode(nodes, "r1-left")!;
    const w1Right = findNode(nodes, "r1-right")!;
    expect(w1.y).toBeCloseTo((w1Left.y + w1Right.y) / 2, 1);

    const w9 = findNode(nodes, "w9")!;
    const w1x = findNode(nodes, "w1")!;
    const w2x = findNode(nodes, "w2")!;
    expect(w9.y).toBeCloseTo((w1x.y + w2x.y) / 2, 1);

    const w13 = findNode(nodes, "w13")!;
    const w9x = findNode(nodes, "w9")!;
    const w10x = findNode(nodes, "w10")!;
    expect(w13.y).toBeCloseTo((w9x.y + w10x.y) / 2, 1);

    const w14 = findNode(nodes, "w14")!;
    const w15 = findNode(nodes, "w15")!;
    expect(w15.y).toBeCloseTo((w13.y + w14.y) / 2, 1);
  });

  it("positions leaves at correct y values matching original layout", () => {
    const { nodes } = buildBracketTree(run.roundPairs, [], 1, );
    const leftLeaves = collectLeavesFromNodes(nodes)
      .filter((n) => n.x === 105)
      .sort((a, b) => a.y - b.y);

    expect(leftLeaves).toHaveLength(8);
    expect(leftLeaves.map((n) => n.y)).toEqual([100, 175, 250, 325, 495, 570, 645, 720]);

    const rightLeaves = collectLeavesFromNodes(nodes)
      .filter((n) => n.x === 1435)
      .sort((a, b) => a.y - b.y);

    expect(rightLeaves).toHaveLength(8);
    expect(rightLeaves.map((n) => n.y)).toEqual([100, 175, 250, 325, 495, 570, 645, 720]);
  });

  it("positions first-round winner nodes at correct y values", () => {
    const { nodes } = buildBracketTree(run.roundPairs, [], 1, );

    expect(findNode(nodes, "w1")!.y).toBeCloseTo(137.5, 1);
    expect(findNode(nodes, "w2")!.y).toBeCloseTo(287.5, 1);
    expect(findNode(nodes, "w3")!.y).toBeCloseTo(532.5, 1);
    expect(findNode(nodes, "w4")!.y).toBeCloseTo(682.5, 1);
  });

  it("positions quarter-final nodes at correct y values", () => {
    const { nodes } = buildBracketTree(run.roundPairs, [], 1, );

    expect(findNode(nodes, "w9")!.y).toBeCloseTo(212.5, 1);
    expect(findNode(nodes, "w10")!.y).toBeCloseTo(607.5, 1);
  });

  it("positions semi-final and champion nodes at correct y values", () => {
    const { nodes } = buildBracketTree(run.roundPairs, [], 1, );

    expect(findNode(nodes, "w13")!.y).toBeCloseTo(410, 1);
    expect(findNode(nodes, "w14")!.y).toBeCloseTo(410, 1);
    expect(findNode(nodes, "w15")!.y).toBeCloseTo(410, 1);
  });

  it("generates connectors for all internal nodes", () => {
    const { connectors } = buildBracketTree(run.roundPairs, [], 1, );
    expect(connectors.length).toBeGreaterThan(0);
    // Each of the 15 internal nodes generates connectors
    // w1-w8: 4 elbow segments each → 32
    // w9-w12: 4 elbow segments each → 16
    // w13,w14: 4 elbow segments each → 8
    // w15: children at same y (center case) → 2
    // Total = 58
    expect(connectors.length).toBe(58);
  });

  it("marks eliminated leaves correctly", () => {
    // Round 1: pick left game
    const selections = [
      { round: 1, pickedGameId: "g1", completedAt: "2024-01-01T00:00:00.000Z" }
    ];
    const { nodes } = buildBracketTree(run.roundPairs, selections, 2, );

    const r1Left = findNode(nodes, "r1-left")!;
    const r1Right = findNode(nodes, "r1-right")!;
    expect(r1Left.eliminated).toBe(false); // picked game not eliminated
    expect(r1Right.eliminated).toBe(true); // unpicked game eliminated
  });

  it("marks active leaves for current round", () => {
    const { nodes } = buildBracketTree(run.roundPairs, [], 3, );

    // Round 3 leaves should be active
    const r3Left = findNode(nodes, "r3-left")!;
    const r3Right = findNode(nodes, "r3-right")!;
    expect(r3Left.active).toBe(true);
    expect(r3Right.active).toBe(true);

    // Other rounds should not be active
    const r1Left = findNode(nodes, "r1-left")!;
    expect(r1Left.active).toBe(false);
  });

  it("marks active internal nodes for later advancement rounds", () => {
    // Round 13 inputs are w9 and w10
    const { nodes } = buildBracketTree(run.roundPairs, [], 13, );
    expect(findNode(nodes, "w9")!.active).toBe(true);
    expect(findNode(nodes, "w10")!.active).toBe(true);

    // Round 14 inputs are w11 and w12
    const r14 = buildBracketTree(run.roundPairs, [], 14, );
    expect(findNode(r14.nodes, "w11")!.active).toBe(true);
    expect(findNode(r14.nodes, "w12")!.active).toBe(true);

    // Round 15 inputs are w13 and w14
    const r15 = buildBracketTree(run.roundPairs, [], 15, );
    expect(findNode(r15.nodes, "w13")!.active).toBe(true);
    expect(findNode(r15.nodes, "w14")!.active).toBe(true);
  });

  it("no internal nodes active for opener rounds", () => {
    const { nodes } = buildBracketTree(run.roundPairs, [], 5, );
    const internal = collectInternalFromNodes(nodes);
    internal.forEach((node) => {
      expect(node.active).toBe(false);
    });
  });

  it("marks winner on completed internal rounds", () => {
    const selections = [
      { round: 1, pickedGameId: "g1", completedAt: "2024-01-01T00:00:00.000Z" }
    ];
    const { nodes } = buildBracketTree(run.roundPairs, selections, 2, );

    const w1 = findNode(nodes, "w1")!;
    expect(w1.winner).toBe(true);
    expect(w1.gameId).toBe("g1");
  });

  it("always builds a complete 31-node tree regardless of game presence", () => {
    const { nodes } = buildBracketTree(run.roundPairs, [], 1);

    expect(nodes).toHaveLength(31);
    expect(collectLeavesFromNodes(nodes)).toHaveLength(16);
    expect(collectInternalFromNodes(nodes)).toHaveLength(15);
  });

  it("focus point centers on active nodes with gameId", () => {
    const { nodes, focusPoint } = buildBracketTree(run.roundPairs, [], 1, );

    // Active leaves are r1-left and r1-right
    const r1Left = findNode(nodes, "r1-left")!;
    const r1Right = findNode(nodes, "r1-right")!;

    const expectedX = (r1Left.x + r1Right.x) / 2;
    const expectedY = (r1Left.y + r1Right.y) / 2;

    expect(focusPoint.x).toBeCloseTo(expectedX, 0);
    expect(focusPoint.y).toBeCloseTo(expectedY, 0);
  });
});
