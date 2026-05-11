'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
    Background,
    Controls,
    Handle,
    MarkerType,
    Position,
    ReactFlowProvider,
    type Edge,
    type Node,
    type NodeProps,
    useReactFlow,
} from 'reactflow';
import html2canvas from 'html2canvas';
import type { MindMapResult } from '@/lib/mindmap';
import {
    buildDisplayMindMap,
    getVisibleMindMap,
    layoutMindMap,
    type DisplayMindMapNode,
    type MindMapDocument,
} from '@/lib/mindmap-view';

type MindMapPanelProps = {
    documents: MindMapDocument[];
    onClose: () => void;
};

type FlowNodeData = DisplayMindMapNode & {
    isCollapsed: boolean;
    isSelected: boolean;
    onSelect: (node: DisplayMindMapNode) => void;
    onToggle: (nodeId: string) => void;
};

const nodeTypes = {
    mindMap: MindMapNode,
};

function logMindMapView(message: string, fields?: Record<string, unknown>) {
    if (fields) {
        console.log(`[mindmap:view] ${message}`, fields);
        return;
    }

    console.log(`[mindmap:view] ${message}`);
}

function MindMapNode({ data }: NodeProps<FlowNodeData>) {
    const hasChildren = data.childIds.length > 0;

    return (
        <button
            type="button"
            onClick={() => data.onSelect(data)}
            style={{
                width: 190,
                minHeight: 74,
                border: `1.5px solid ${data.isSelected ? 'var(--acc)' : 'var(--b1)'}`,
                borderRadius: 8,
                background: data.level === 0 ? 'var(--acl)' : 'var(--card)',
                boxShadow: data.isSelected ? '0 10px 24px rgba(74, 114, 89, 0.16)' : 'none',
                color: 'var(--td)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: '11px 12px',
                textAlign: 'left',
            }}
        >
            <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div
                    style={{
                        flex: 1,
                        fontSize: data.level === 0 ? 14 : 13,
                        fontWeight: data.level === 0 ? 700 : 600,
                        lineHeight: 1.25,
                        overflowWrap: 'anywhere',
                    }}
                >
                    {data.label}
                </div>
                {hasChildren && (
                    <span
                        role="button"
                        aria-label={data.isCollapsed ? 'Expand branch' : 'Collapse branch'}
                        tabIndex={0}
                        onClick={(event) => {
                            event.stopPropagation();
                            data.onToggle(data.id);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault();
                                event.stopPropagation();
                                data.onToggle(data.id);
                            }
                        }}
                        style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            border: '1px solid var(--b1)',
                            background: data.isCollapsed ? 'var(--acl)' : 'var(--main)',
                            color: 'var(--acc1)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 700,
                            lineHeight: 1,
                            flexShrink: 0,
                        }}
                    >
                        {data.isCollapsed ? '+' : '-'}
                    </span>
                )}
            </div>
            <div
                style={{
                    marginTop: 7,
                    fontSize: 10,
                    fontWeight: 500,
                    color: 'var(--t3)',
                    textTransform: 'uppercase',
                    letterSpacing: '.06em',
                }}
            >
                {data.level === 0 ? 'Document' : data.level === 1 ? 'Topic' : 'Subtopic'}
            </div>
            <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
        </button>
    );
}

function OutlineFallback({
    graph,
    selectedNode,
    onSelect,
}: {
    graph: ReturnType<typeof buildDisplayMindMap>;
    selectedNode: DisplayMindMapNode | null;
    onSelect: (node: DisplayMindMapNode) => void;
}) {
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));

    function renderBranch(nodeId: string) {
        const node = nodeById.get(nodeId);
        if (!node) return null;

        return (
            <li key={node.id} style={{ margin: '8px 0 0 18px' }}>
                <button
                    type="button"
                    onClick={() => onSelect(node)}
                    style={{
                        border: 'none',
                        background: selectedNode?.id === node.id ? 'var(--acl)' : 'transparent',
                        color: selectedNode?.id === node.id ? 'var(--acc1)' : 'var(--td)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 13,
                        fontWeight: selectedNode?.id === node.id ? 600 : 500,
                        padding: '3px 5px',
                        borderRadius: 6,
                        textAlign: 'left',
                    }}
                >
                    {node.label}
                </button>
                {node.childIds.length > 0 && (
                    <ul style={{ listStyle: 'disc' }}>{node.childIds.map(renderBranch)}</ul>
                )}
            </li>
        );
    }

    return (
        <div style={{ padding: 18, overflowY: 'auto', flex: 1 }}>
            <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 12, lineHeight: 1.5 }}>
                Interactive diagram rendering is not supported by this browser. Showing a text outline instead.
            </p>
            <ul style={{ listStyle: 'disc' }}>{renderBranch(graph.rootId)}</ul>
        </div>
    );
}

function MindMapCanvas({
    graph,
    selectedNode,
    collapsedNodeIds,
    onSelectNode,
    onToggleNode,
}: {
    graph: ReturnType<typeof buildDisplayMindMap>;
    selectedNode: DisplayMindMapNode | null;
    collapsedNodeIds: Set<string>;
    onSelectNode: (node: DisplayMindMapNode) => void;
    onToggleNode: (nodeId: string) => void;
}) {
    const reactFlow = useReactFlow<FlowNodeData>();
    const visibleGraph = useMemo(
        () => getVisibleMindMap(graph, collapsedNodeIds),
        [collapsedNodeIds, graph],
    );

    const nodes = useMemo<Node<FlowNodeData>[]>(() => {
        const laidOutNodes = layoutMindMap(visibleGraph);

        return laidOutNodes.map((node) => ({
            id: node.id,
            type: 'mindMap',
            position: node.position,
            draggable: false,
            data: {
                ...node.data,
                isCollapsed: collapsedNodeIds.has(node.id),
                isSelected: selectedNode?.id === node.id,
                onSelect: onSelectNode,
                onToggle: onToggleNode,
            },
        }));
    }, [collapsedNodeIds, onSelectNode, onToggleNode, selectedNode?.id, visibleGraph]);

    const edges = useMemo<Edge[]>(
        () =>
            visibleGraph.edges.map((edge) => ({
                id: `${edge.source}-${edge.target}`,
                source: edge.source,
                target: edge.target,
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--acc)' },
                style: { stroke: 'var(--acc)', strokeWidth: 1.6 },
            })),
        [visibleGraph.edges],
    );

    useEffect(() => {
        logMindMapView('rendering flow', { nodeCount: nodes.length, edgeCount: edges.length });
        window.requestAnimationFrame(() => reactFlow.fitView({ padding: 0.18, duration: 250 }));
    }, [edges.length, nodes.length, reactFlow]);

    return (
        <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            fitView
            minZoom={0.35}
            maxZoom={1.5}
            proOptions={{ hideAttribution: true }}
        >
            <Background color="var(--b1)" gap={18} size={1} />
            <Controls showInteractive={false} />
        </ReactFlow>
    );
}

function MindMapContent({ documents, onClose }: MindMapPanelProps) {
    const [selectedDocumentId, setSelectedDocumentId] = useState(documents[0]?.document_id ?? '');
    const [graphs, setGraphs] = useState<Record<string, MindMapResult>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedNode, setSelectedNode] = useState<DisplayMindMapNode | null>(null);
    const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
    const [supportsFlow, setSupportsFlow] = useState(true);
    const exportRef = useRef<HTMLDivElement>(null);
    const reactFlow = useReactFlow<FlowNodeData>();

    const selectedDocument =
        documents.find((document) => document.document_id === selectedDocumentId) ?? documents[0];
    const currentGraph = selectedDocumentId ? graphs[selectedDocumentId] : undefined;

    const displayGraph = useMemo(() => {
        if (!currentGraph || !selectedDocument) return null;
        return buildDisplayMindMap(currentGraph, selectedDocument.title);
    }, [currentGraph, selectedDocument]);

    useEffect(() => {
        setSupportsFlow(
            typeof window !== 'undefined' &&
                'ResizeObserver' in window &&
                'DOMMatrix' in window &&
                'SVGElement' in window,
        );
    }, []);

    useEffect(() => {
        if (!selectedDocumentId || graphs[selectedDocumentId]) return;

        const controller = new AbortController();
        setLoading(true);
        setError(null);
        logMindMapView('fetching graph', { documentId: selectedDocumentId });

        fetch('/api/mindmap/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentId: selectedDocumentId }),
            signal: controller.signal,
        })
            .then(async (response) => {
                const body = await response.json().catch(() => ({}));
                if (!response.ok) {
                    throw new Error((body as { error?: string }).error ?? 'Failed to generate mind map.');
                }

                return body as MindMapResult;
            })
            .then((graph) => {
                logMindMapView('graph loaded', {
                    documentId: selectedDocumentId,
                    nodeCount: graph.nodes.length,
                    edgeCount: graph.edges.length,
                    warning: graph.warning,
                });
                setGraphs((previous) => ({ ...previous, [selectedDocumentId]: graph }));
            })
            .catch((err: unknown) => {
                if ((err as Error).name === 'AbortError') return;
                console.error('[mindmap:view] graph fetch failed', err);
                setError(err instanceof Error ? err.message : 'Failed to generate mind map.');
            })
            .finally(() => setLoading(false));

        return () => controller.abort();
    }, [graphs, selectedDocumentId]);

    useEffect(() => {
        setSelectedNode(displayGraph?.nodes.find((node) => node.id === displayGraph.rootId) ?? null);
        setCollapsedNodeIds(new Set());
    }, [displayGraph]);

    function toggleNode(nodeId: string) {
        setCollapsedNodeIds((previous) => {
            const next = new Set(previous);
            if (next.has(nodeId)) {
                next.delete(nodeId);
                logMindMapView('expanded branch', { nodeId });
            } else {
                next.add(nodeId);
                logMindMapView('collapsed branch', { nodeId });
            }
            return next;
        });
    }

    async function exportPng() {
        if (!exportRef.current) return;

        const nodes = reactFlow.getNodes();
        logMindMapView('exporting png', { nodeCount: nodes.length });
        const canvas = await html2canvas(exportRef.current, {
            backgroundColor: '#faf7f0',
            scale: Math.min(window.devicePixelRatio || 1, 2),
        });
        const link = document.createElement('a');
        const fileStem = (selectedDocument?.title ?? 'mind-map')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        link.download = `${fileStem || 'mind-map'}-mind-map.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    return (
        <div
            style={{
                borderTop: '1px solid var(--b1)',
                background: 'var(--main)',
                height: '52vh',
                minHeight: 420,
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0,
            }}
        >
            <div
                style={{
                    padding: '12px 18px',
                    borderBottom: '1px solid var(--b1)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                }}
            >
                <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--td)' }}>Mind Map</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                        Click nodes for descriptions. Use +/- to expand branches.
                    </div>
                </div>
                <div style={{ flex: 1 }} />
                {documents.length > 1 && (
                    <select
                        value={selectedDocumentId}
                        onChange={(event) => setSelectedDocumentId(event.target.value)}
                        style={{
                            maxWidth: 220,
                            border: '1px solid var(--b1)',
                            background: 'var(--card)',
                            color: 'var(--td)',
                            borderRadius: 8,
                            padding: '7px 10px',
                            fontFamily: 'inherit',
                            fontSize: 12,
                        }}
                    >
                        {documents.map((document) => (
                            <option key={document.document_id} value={document.document_id}>
                                {document.title}
                            </option>
                        ))}
                    </select>
                )}
                <button
                    type="button"
                    onClick={exportPng}
                    disabled={!displayGraph || loading || !supportsFlow}
                    style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: displayGraph && supportsFlow ? 'var(--acc1)' : 'var(--t3)',
                        background: displayGraph && supportsFlow ? 'var(--acl)' : 'var(--foot)',
                        border: '1px solid var(--acl2)',
                        borderRadius: 8,
                        padding: '7px 12px',
                        cursor: displayGraph && supportsFlow ? 'pointer' : 'default',
                        fontFamily: 'inherit',
                    }}
                >
                    Export PNG
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close mind map"
                    style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: '1px solid var(--b1)',
                        background: 'var(--card)',
                        color: 'var(--t2)',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontSize: 18,
                        lineHeight: 1,
                    }}
                >
                    x
                </button>
            </div>

            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                <div ref={exportRef} style={{ flex: 1, minWidth: 0, position: 'relative', background: 'var(--main)' }}>
                    {loading && (
                        <div style={{ padding: 24, fontSize: 13, color: 'var(--t3)' }}>Generating mind map...</div>
                    )}
                    {error && (
                        <div style={{ padding: 24, fontSize: 13, color: '#8a4a40' }}>{error}</div>
                    )}
                    {!loading && !error && displayGraph && supportsFlow && (
                        <MindMapCanvas
                            graph={displayGraph}
                            selectedNode={selectedNode}
                            collapsedNodeIds={collapsedNodeIds}
                            onSelectNode={setSelectedNode}
                            onToggleNode={toggleNode}
                        />
                    )}
                    {!loading && !error && displayGraph && !supportsFlow && (
                        <OutlineFallback
                            graph={displayGraph}
                            selectedNode={selectedNode}
                            onSelect={setSelectedNode}
                        />
                    )}
                </div>

                <aside
                    style={{
                        width: 280,
                        borderLeft: '1px solid var(--b1)',
                        background: 'var(--card)',
                        padding: 18,
                        overflowY: 'auto',
                    }}
                >
                    <div
                        style={{
                            fontSize: 10,
                            fontWeight: 600,
                            color: 'var(--t3)',
                            textTransform: 'uppercase',
                            letterSpacing: '.07em',
                            marginBottom: 10,
                        }}
                    >
                        Description
                    </div>
                    {selectedNode ? (
                        <>
                            <h2 style={{ fontSize: 17, fontWeight: 650, color: 'var(--td)', marginBottom: 10, lineHeight: 1.3 }}>
                                {selectedNode.label}
                            </h2>
                            <p style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.6 }}>
                                {selectedNode.description}
                            </p>
                        </>
                    ) : (
                        <p style={{ fontSize: 13, color: 'var(--t3)', lineHeight: 1.5 }}>
                            Select a node to see its AI-generated description.
                        </p>
                    )}
                    {currentGraph?.warning && (
                        <div
                            style={{
                                marginTop: 18,
                                padding: '10px 12px',
                                border: '1px solid #f0d58b',
                                borderRadius: 8,
                                background: '#fffbeb',
                                color: '#835f14',
                                fontSize: 12,
                                lineHeight: 1.45,
                            }}
                        >
                            {currentGraph.warning}
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
}

export function MindMapPanel(props: MindMapPanelProps) {
    return (
        <ReactFlowProvider>
            <MindMapContent {...props} />
        </ReactFlowProvider>
    );
}
