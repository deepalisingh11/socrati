import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildDisplayMindMap,
    getVisibleMindMap,
    layoutMindMap,
} from '../apps/web/lib/mindmap-view';
import type { MindMapGraph } from '../apps/web/lib/mindmap';

describe('mind map view helpers', () => {
    it('uses the document title for an existing root node', () => {
        const graph: MindMapGraph = {
            nodes: [
                {
                    id: 'ai-theme',
                    label: 'AI Theme',
                    description: 'The generated root description.',
                    level: 0,
                },
                {
                    id: 'models',
                    label: 'Models',
                    description: 'Models are a major topic.',
                    level: 1,
                },
            ],
            edges: [{ source: 'ai-theme', target: 'models' }],
        };

        const displayGraph = buildDisplayMindMap(graph, 'Lecture 4 Notes');
        const root = displayGraph.nodes.find((node) => node.id === displayGraph.rootId);

        assert.equal(root?.label, 'Lecture 4 Notes');
        assert.equal(root?.description, 'The generated root description.');
        assert.deepEqual(root?.childIds, ['models']);
    });

    it('adds a document root for flat fallback graphs', () => {
        const graph: MindMapGraph = {
            nodes: [
                {
                    id: 'mitosis',
                    label: 'Mitosis',
                    description: 'A key term from the document.',
                    level: 1,
                },
                {
                    id: 'meiosis',
                    label: 'Meiosis',
                    description: 'Another key term from the document.',
                    level: 1,
                },
            ],
            edges: [],
        };

        const displayGraph = buildDisplayMindMap(graph, 'Biology Review');

        assert.equal(displayGraph.rootId, 'document-root');
        assert.equal(displayGraph.nodes.find((node) => node.id === 'document-root')?.label, 'Biology Review');
        assert.deepEqual(
            displayGraph.edges,
            [
                { source: 'document-root', target: 'mitosis' },
                { source: 'document-root', target: 'meiosis' },
            ],
        );
    });

    it('hides descendants of collapsed branches', () => {
        const displayGraph = buildDisplayMindMap(
            {
                nodes: [
                    { id: 'root', label: 'Root', description: 'Root.', level: 0 },
                    { id: 'topic', label: 'Topic', description: 'Topic.', level: 1 },
                    { id: 'subtopic', label: 'Subtopic', description: 'Subtopic.', level: 2 },
                ],
                edges: [
                    { source: 'root', target: 'topic' },
                    { source: 'topic', target: 'subtopic' },
                ],
            },
            'Course Notes',
        );

        const visible = getVisibleMindMap(displayGraph, new Set(['topic']));

        assert.deepEqual(
            visible.nodes.map((node) => node.id),
            ['root', 'topic'],
        );
        assert.deepEqual(visible.edges, [{ source: 'root', target: 'topic' }]);
    });

    it('lays nodes out left to right', () => {
        const displayGraph = buildDisplayMindMap(
            {
                nodes: [
                    { id: 'root', label: 'Root', description: 'Root.', level: 0 },
                    { id: 'topic', label: 'Topic', description: 'Topic.', level: 1 },
                ],
                edges: [{ source: 'root', target: 'topic' }],
            },
            'Course Notes',
        );

        const visible = getVisibleMindMap(displayGraph, new Set());
        const nodes = layoutMindMap(visible);
        const root = nodes.find((node) => node.id === 'root');
        const topic = nodes.find((node) => node.id === 'topic');

        assert.ok(root);
        assert.ok(topic);
        assert.ok(topic.position.x > root.position.x);
    });
});
