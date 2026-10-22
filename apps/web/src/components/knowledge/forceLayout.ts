import { CodeKnowledgeNode, CodeKnowledgeEdge } from '../../types';

export interface ForceNodePosition {
  x: number;
  y: number;
}

export interface ClusteredLayoutResult {
  positions: Map<string, ForceNodePosition>;
  width: number;
  height: number;
}

/**
 * Deterministic community color palette using golden ratio hue progression.
 * Returns vibrant, distinct HSL colors for any community ID.
 */
export function getCommunityColor(communityId: number | null | undefined): {
  accent: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  border: string;
  lightBg: string;
  rawHue: number;
} {
  if (communityId === null || communityId === undefined || communityId < 0) {
    return {
      accent: '#64748b',
      badgeBg: '#f1f5f9',
      badgeBorder: '#cbd5e1',
      badgeText: '#475569',
      border: '#cbd5e1',
      lightBg: '#f8fafc',
      rawHue: 215,
    };
  }

  // Golden ratio angle (137.508 degrees) distributes colors evenly across spectrum
  const hue = Math.round((communityId * 137.5077) % 360);
  return {
    accent: `hsl(${hue}, 70%, 42%)`,
    badgeBg: `hsl(${hue}, 85%, 96%)`,
    badgeBorder: `hsl(${hue}, 60%, 82%)`,
    badgeText: `hsl(${hue}, 85%, 28%)`,
    border: `hsl(${hue}, 55%, 75%)`,
    lightBg: `hsl(${hue}, 90%, 98%)`,
    rawHue: hue,
  };
}

/**
 * Spring-electrical clustered force-directed layout.
 * Groups nodes around their community centroids while respecting edge connectivity
 * and pushing overlapping nodes apart. Deterministic and fast (<20ms).
 */
export function computeClusteredForceLayout(
  nodes: CodeKnowledgeNode[],
  edges: CodeKnowledgeEdge[],
  options: {
    iterations?: number;
    width?: number;
    height?: number;
    nodeRadius?: number;
  } = {}
): ClusteredLayoutResult {
  const {
    iterations = 80,
    width = 1600,
    height = 1100,
    nodeRadius = 130,
  } = options;

  if (nodes.length === 0) {
    return { positions: new Map(), width, height };
  }

  // 1. Identify distinct communities and compute community anchor centers
  const communities = new Map<number, CodeKnowledgeNode[]>();
  nodes.forEach((node) => {
    const cid = node.community ?? 0;
    if (!communities.has(cid)) {
      communities.set(cid, []);
    }
    communities.get(cid)!.push(node);
  });

  const sortedCommunities = Array.from(communities.entries()).sort(
    (a, b) => b[1].length - a[1].length
  );

  const communityCenters = new Map<number, { x: number; y: number }>();
  const totalCommunities = sortedCommunities.length;

  if (totalCommunities === 1) {
    communityCenters.set(sortedCommunities[0][0], { x: width / 2, y: height / 2 });
  } else {
    // Arrange communities in a multi-ring phyllotaxis/spiral layout
    const centerX = width / 2;
    const centerY = height / 2;
    const baseRadius = Math.min(width, height) * 0.35;

    sortedCommunities.forEach(([cid, members], idx) => {
      // Larger communities positioned slightly more centrally
      const angle = (idx * 2.39996) + 0.1; // Golden angle
      const distance = totalCommunities <= 6
        ? baseRadius * 0.7
        : baseRadius * (0.35 + 0.65 * Math.sqrt(idx / totalCommunities));

      const cx = centerX + Math.cos(angle) * distance;
      const cy = centerY + Math.sin(angle) * distance;
      communityCenters.set(cid, { x: cx, y: cy });
    });
  }

  // 2. Initialize node positions near their community centers with pseudo-random jitter
  interface SimulationNode {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    community: number;
    degree: number;
  }

  const simNodes: SimulationNode[] = [];
  const nodeMap = new Map<string, SimulationNode>();

  nodes.forEach((node, i) => {
    const cid = node.community ?? 0;
    const center = communityCenters.get(cid) || { x: width / 2, y: height / 2 };
    // Deterministic jitter using index
    const angle = ((i * 137.5) * Math.PI) / 180;
    const r = 35 + ((i % 7) * 20);

    const sNode: SimulationNode = {
      id: node.id,
      x: center.x + Math.cos(angle) * r,
      y: center.y + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
      community: cid,
      degree: node.degree || 1,
    };
    simNodes.push(sNode);
    nodeMap.set(node.id, sNode);
  });

  // Build edge list for fast neighbor lookup
  interface SimEdge {
    source: SimulationNode;
    target: SimulationNode;
    weight: number;
  }
  const simEdges: SimEdge[] = [];
  edges.forEach((e) => {
    const s = nodeMap.get(e.source);
    const t = nodeMap.get(e.target);
    if (s && t && s !== t) {
      simEdges.push({ source: s, target: t, weight: e.weight || 1 });
    }
  });

  // 3. Simulation iterations (Verlet-like integration with cooling temperature)
  let temperature = 1.0;
  const cooling = 0.96;

  for (let iter = 0; iter < iterations; iter++) {
    // A. Gravity towards community centroid
    for (let i = 0; i < simNodes.length; i++) {
      const node = simNodes[i];
      const center = communityCenters.get(node.community);
      if (center) {
        const dx = center.x - node.x;
        const dy = center.y - node.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const gravityForce = 0.08 * dist * temperature;
        node.vx += (dx / dist) * gravityForce;
        node.vy += (dy / dist) * gravityForce;
      }
    }

    // B. Edge spring attraction
    for (let e = 0; e < simEdges.length; e++) {
      const { source, target, weight } = simEdges[e];
      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const preferredDist = 120;
      const spring = (dist - preferredDist) * 0.04 * weight * temperature;

      const fx = (dx / dist) * spring;
      const fy = (dy / dist) * spring;

      source.vx += fx;
      source.vy += fy;
      target.vx -= fx;
      target.vy -= fy;
    }

    // C. Coulomb node-node repulsion (O(N^2) bounded by max nodes, e.g. <300)
    const repulsionStrength = 1600;
    for (let i = 0; i < simNodes.length; i++) {
      const na = simNodes[i];
      for (let j = i + 1; j < simNodes.length; j++) {
        const nb = simNodes[j];
        const dx = nb.x - na.x;
        const dy = nb.y - na.y;
        const distSq = dx * dx + dy * dy + 100;
        const dist = Math.sqrt(distSq);

        if (dist < nodeRadius * 2.5) {
          // Extra strong repulsion between different communities
          const commFactor = na.community === nb.community ? 1.0 : 1.8;
          const force = (repulsionStrength * commFactor) / distSq * temperature;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          na.vx -= fx;
          na.vy -= fy;
          nb.vx += fx;
          nb.vy += fy;
        }
      }
    }

    // D. Update positions with friction damping
    const maxVelocity = 40 * temperature;
    for (let i = 0; i < simNodes.length; i++) {
      const n = simNodes[i];
      const vMag = Math.sqrt(n.vx * n.vx + n.vy * n.vy) || 1;
      if (vMag > maxVelocity) {
        n.vx = (n.vx / vMag) * maxVelocity;
        n.vy = (n.vy / vMag) * maxVelocity;
      }

      n.x += n.vx;
      n.y += n.vy;

      // Dampen velocity
      n.vx *= 0.55;
      n.vy *= 0.55;
    }

    temperature *= cooling;
  }

  // 4. Populate output map
  const positions = new Map<string, ForceNodePosition>();
  simNodes.forEach((node) => {
    positions.set(node.id, {
      x: Math.round(node.x),
      y: Math.round(node.y),
    });
  });

  return { positions, width, height };
}
