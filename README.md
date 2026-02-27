# tt-decision-trace-viewer

Interactive viewer for tt-mlir greedy optimizer decision traces.

Visualizes layout propagation decisions, dataflow DAGs, reshard edges, fork
resolutions, and L1 memory spill management timelines.

## Quick Start

```bash
# Install dependencies
npm install

# Run with a trace file
node bin/dtv.js /path/to/decision_trace/main_decision_trace.json

# Or a directory of trace files
node bin/dtv.js /path/to/decision_trace/
```

The viewer opens in your default browser at `http://127.0.0.1:<port>`.

## Global Install

```bash
npm install -g .
dtv /path/to/trace.json
```

## Features

### Layout DAG
- Cytoscape.js graph with dagre (Sugiyama) layout
- Nodes color-coded: green (L1 sharded), yellow (L1 interleaved), red (DRAM)
- Fork nodes highlighted with dashed purple border
- Reshard edges shown as dashed orange with diamond markers
- Pan, zoom, click-to-select with instant performance on 2000+ nodes

### Detail Panel
- Op cards with lazy-rendered evaluation tables
- Producer/consumer links (click to navigate in DAG)
- Reshard badges on edges
- Search and filter by DRAM fallback, failed evals, reshards

### L1 Spill Timeline
- Canvas-based memory pressure chart
- Event markers: live_added, eviction, demotion, self_spill
- Budget line with clickable events

## Generating Traces

In tt-mlir, compile with the greedy optimizer and decision trace enabled:

```bash
ttmlir-opt \
  --ttir-to-ttnn-backend-pipeline="system-desc-path=... \
    optimization-level=2 \
    enable-greedy-optimizer=true" \
  input.mlir
```

The trace JSON is written to `decision_trace/main_decision_trace.json`.

## Schema

See `schema/decision-trace-v2.schema.json` for the full JSON schema
documenting the trace format.

## Dependencies

| Package | Purpose |
|---------|---------|
| cytoscape | Graph rendering, pan/zoom, interaction |
| cytoscape-dagre | Sugiyama layered layout |
| dagre | Layout engine (peer dep) |
| express | Local static file server |
| open | Cross-platform browser open |
