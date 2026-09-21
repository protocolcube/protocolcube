<script setup lang="ts">
import { computed } from "vue";
import type {
  VariableDependencyGraphInspection,
  VariableDependencyGraphNode,
} from "@/domain/protocol";

const props = defineProps<{
  inspection: VariableDependencyGraphInspection;
  selectedId?: string;
}>();

const emit = defineEmits<{
  select: [id: string];
}>();

interface PositionedNode {
  node: VariableDependencyGraphNode;
  x: number;
  y: number;
}

const nodeWidth = 190;
const nodeHeight = 68;
const columnGap = 80;
const rowGap = 26;

const layout = computed(() => {
  const levels = new Map<string, number>();
  for (const node of props.inspection.nodes) {
    levels.set(node.id, node.kind === "unknown" || node.variable.kind === "input" ? 0 : 1);
  }
  for (let pass = 0; pass < props.inspection.nodes.length; pass += 1) {
    let changed = false;
    for (const edge of props.inspection.edges) {
      if (edge.cycleMember) continue;
      const sourceLevel = levels.get(edge.sourceId) ?? 0;
      const targetLevel = levels.get(edge.targetId) ?? 1;
      const next = Math.min(4, Math.max(targetLevel, sourceLevel + 1));
      if (next !== targetLevel) {
        levels.set(edge.targetId, next);
        changed = true;
      }
    }
    if (!changed) break;
  }

  const columns = new Map<number, VariableDependencyGraphNode[]>();
  for (const node of props.inspection.nodes) {
    const level = levels.get(node.id) ?? 0;
    columns.set(level, [...(columns.get(level) ?? []), node]);
  }
  const positioned: PositionedNode[] = [];
  for (const [level, nodes] of columns) {
    nodes.forEach((node, index) => {
      positioned.push({
        node,
        x: 24 + level * (nodeWidth + columnGap),
        y: 24 + index * (nodeHeight + rowGap),
      });
    });
  }
  const positions = new Map(positioned.map((item) => [item.node.id, item]));
  const width =
    Math.max(1, ...columns.keys()) * (nodeWidth + columnGap) + nodeWidth + 48;
  const height =
    Math.max(1, ...[...columns.values()].map((nodes) => nodes.length)) *
      (nodeHeight + rowGap) +
    24;
  return { positioned, positions, width, height };
});

function nodeLabel(node: VariableDependencyGraphNode): string {
  return node.kind === "unknown"
    ? `Missing: ${node.referencedVariableId}`
    : node.variable.label;
}
</script>

<template>
  <div
    class="mt-4 rounded-[var(--radius)] border border-border [background:radial-gradient(circle,color-mix(in_oklab,var(--border)_70%,transparent)_1px,transparent_1px)_0_0/16px_16px,var(--card)]"
  >
    <div class="overflow-auto">
      <svg
        :viewBox="`0 0 ${layout.width} ${layout.height}`"
        :style="{ minWidth: `${layout.width}px`, height: `${layout.height}px` }"
        role="img"
        aria-labelledby="dependency-graph-title dependency-graph-description"
      >
        <title id="dependency-graph-title">Variable dependency graph</title>
        <desc id="dependency-graph-description">
          Directed edges run from referenced Variables to Derived Variables.
        </desc>
        <defs>
          <marker
            id="dependency-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path class="fill-primary" d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>
        <path
          v-for="edge in inspection.edges"
          :key="edge.id"
          :d="(() => {
            const source = layout.positions.get(edge.sourceId);
            const target = layout.positions.get(edge.targetId);
            if (!source || !target) return '';
            const startX = source.x + nodeWidth;
            const startY = source.y + nodeHeight / 2;
            const endX = target.x;
            const endY = target.y + nodeHeight / 2;
            const bend = Math.max(36, (endX - startX) / 2);
            return `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`;
          })()"
          class="fill-none stroke-primary stroke-2 [&.cycle]:stroke-warning [&.cycle]:stroke-[3] [&.diagnostic]:stroke-destructive [&.diagnostic]:[stroke-dasharray:7_5]"
          :class="{
            diagnostic: edge.diagnosticCodes.length > 0,
            cycle: edge.cycleMember,
          }"
          marker-end="url(#dependency-arrow)"
        />
        <foreignObject
          v-for="item in layout.positioned"
          :key="item.node.id"
          :x="item.x"
          :y="item.y"
          :width="nodeWidth"
          :height="nodeHeight"
        >
          <button
            type="button"
            class="grid size-full content-center gap-1 overflow-hidden rounded-[.35rem] border border-border border-l-4 border-l-primary bg-card px-3 py-[.65rem] text-left text-foreground shadow-[0_6px_18px_color-mix(in_oklab,var(--foreground)_8%,transparent)] enabled:cursor-pointer enabled:hover:bg-accent focus-visible:outline-3 focus-visible:outline-ring focus-visible:outline-offset-[-3px] disabled:border-l-destructive [&.cycle]:border-l-warning [&.diagnostic]:border-l-destructive [&.selected]:bg-accent"
            :class="{
              unknown: item.node.kind === 'unknown',
              diagnostic: item.node.diagnosticCodes.length > 0,
              cycle: item.node.cycleMember,
              selected: selectedId === item.node.id,
            }"
            :disabled="item.node.kind === 'unknown'"
            @click="item.node.kind === 'variable' && emit('select', item.node.id)"
          >
            <span class="overflow-hidden text-ellipsis whitespace-nowrap font-bold">
              {{ nodeLabel(item.node) }}
            </span>
            <code class="overflow-hidden text-ellipsis whitespace-nowrap text-[.72rem] text-muted-foreground">
              {{ item.node.kind === "unknown" ? item.node.referencedVariableId : item.node.id }}
            </code>
          </button>
        </foreignObject>
      </svg>
    </div>
    <ul
      v-if="inspection.diagnostics.length"
      class="m-0 border-t border-border bg-[color-mix(in_oklab,var(--destructive)_7%,var(--card))] py-3 pr-4 pl-8 text-[.8rem] text-destructive"
      role="alert"
    >
      <li
        v-for="diagnostic in inspection.diagnostics"
        :key="`${diagnostic.code}:${diagnostic.path}:${diagnostic.message}`"
      >
        <strong>{{ diagnostic.code }}</strong>
        {{ diagnostic.message }}
      </li>
    </ul>
  </div>
</template>
