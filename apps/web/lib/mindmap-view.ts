import dagre from 'dagre';
import type { MindMapGraph, MindMapNode } from './mindmap';

export type MindMapDocument = {
    document_id: string;
    title: string;
};

export type DisplayMindMapNode = MindMapNode & {
    parentIds: string[];
    childIds: string[];
};

export type DisplayMindMapGraph = {
    nodes: DisplayMindMapNode[];
    edges: MindMapGraph['edges'];
    rootId: string;
};

const ROOT_ID = 'document-root';
const NODE_WIDTH = 190;
const NODE_HEIGHT = 74;

function uniqueEdges(edges: MindMapGraph['edges']) {
    const seen = new Set<string>();

    return edges.filter((edge) => {
        const key = `${edge.source}->${edge.target}`;
        if (edge.source === edge.target || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

function findRootNode(graph: MindMapGraph) {
    const levelRoot = graph.nodes.find((node) => node.level === 0);
    if (levelRoot) return levelRoot;

    if (graph.edges.length === 0) return undefined;

    const targets = new Set(graph.edges.map((edge) => edge.target));
    return graph.nodes.find((node) => !targets.has(node.id));
}

export function buildDisplayMindMap(
    graph: MindMapGraph,
    documentTitle: string,
): DisplayMindMapGraph {
    const existingRoot = findRootNode(graph);
    const rootId = existingRoot?.id ?? ROOT_ID;
    const nodeMap = new Map<string, MindMapNode>();

    if (existingRoot) {
        for (const node of graph.nodes) {
            nodeMap.set(node.id, {
                ...node,
                label: node.id === rootId ? documentTitle : node.label,
                level: node.id === rootId ? 0 : node.level,
            });
        }
    } else {
        nodeMap.set(ROOT_ID, {
            id: ROOT_ID,
            label: documentTitle,
            description: 'Root topic for this uploaded document.',
            level: 0,
        });
    }

    for (const node of graph.nodes) {
        if (!nodeMap.has(node.id)) nodeMap.set(node.id, node);
    }

    const existingEdges = uniqueEdges(
        graph.edges.filter((edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target)),
    );

    const connectedChildren = new Set(existingEdges.map((edge) => edge.target));
    const syntheticRootEdges = Array.from(nodeMap.values())
        .filter((node) => node.id !== rootId && !connectedChildren.has(node.id))
        .map((node) => ({ source: rootId, target: node.id }));

    const edges = uniqueEdges([...existingEdges, ...syntheticRootEdges]);
    const parentIds = new Map<string, string[]>();
    const childIds = new Map<string, string[]>();

    for (const nodeId of nodeMap.keys()) {
        parentIds.set(nodeId, []);
        childIds.set(nodeId, []);
    }

    for (const edge of edges) {
        parentIds.get(edge.target)?.push(edge.source);
        childIds.get(edge.source)?.push(edge.target);
    }

    return {
        rootId,
        edges,
        nodes: Array.from(nodeMap.values()).map((node) => ({
            ...node,
            parentIds: parentIds.get(node.id) ?? [],
            childIds: childIds.get(node.id) ?? [],
        })),
    };
}

export function getVisibleMindMap(
    graph: DisplayMindMapGraph,
    collapsedNodeIds: Set<string>,
) {
    const visibleNodeIds = new Set<string>([graph.rootId]);
    const queue = [graph.rootId];
    const childMap = new Map(graph.nodes.map((node) => [node.id, node.childIds]));

    while (queue.length > 0) {
        const current = queue.shift()!;
        if (collapsedNodeIds.has(current)) continue;

        for (const childId of childMap.get(current) ?? []) {
            if (visibleNodeIds.has(childId)) continue;
            visibleNodeIds.add(childId);
            queue.push(childId);
        }
    }

    return {
        nodes: graph.nodes.filter((node) => visibleNodeIds.has(node.id)),
        edges: graph.edges.filter(
            (edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target),
        ),
    };
}

export function layoutMindMap(
    graph: ReturnType<typeof getVisibleMindMap>,
) {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: 'LR', nodesep: 42, ranksep: 88, marginx: 24, marginy: 24 });

    for (const node of graph.nodes) {
        dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }

    for (const edge of graph.edges) {
        dagreGraph.setEdge(edge.source, edge.target);
    }

    dagre.layout(dagreGraph);

    return graph.nodes.map((node) => {
        const position = dagreGraph.node(node.id) ?? { x: 0, y: 0 };

        return {
            id: node.id,
            position: {
                x: position.x - NODE_WIDTH / 2,
                y: position.y - NODE_HEIGHT / 2,
            },
            data: node,
        };
    });
}
