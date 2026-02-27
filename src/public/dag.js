// DAG panel: Cytoscape.js + dagre layout

let cy = null;

function initDAG(data) {
  const fp = data.forwardPass || [];
  const edges = data.edges || [];
  const fc = data.finalChoices || [];

  const finalMap = {};
  fc.forEach(c => { finalMap[c.opIndex] = c.chosenLayout; });

  // Compute out-degree to identify fork nodes
  const outDegree = {};
  edges.forEach(e => { outDegree[e.producerOpIndex] = (outDegree[e.producerOpIndex] || 0) + 1; });

  // Build Cytoscape elements
  const elements = [];

  fp.forEach((op, i) => {
    const layout = classifyOpLayout(op);
    const shortName = op.opName.replace('ttnn.', '');
    const chosenLayout = op.isInplace ? 'in-place (no output)' :
      (finalMap[op.opIndex] || (op.beam && op.beam[0] ? op.beam[0].outputLayout : '?'));
    const isFork = (outDegree[op.opIndex] || 0) > 1;

    elements.push({
      group: 'nodes',
      data: {
        id: 'op-' + op.opIndex,
        opIndex: op.opIndex,
        arrayIndex: i,
        label: `#${op.opIndex} ${shortName}`,
        sublabel: shortenLayout(chosenLayout),
        fullLayout: chosenLayout,
        layoutClass: layout.cls,
        color: layout.color,
        isFork: isFork,
        usedDramFallback: op.usedDramFallback,
        hasReshard: op.beam && op.beam.some(b => b.score && b.score.requiresReshard),
      },
      classes: [layout.cls, isFork ? 'fork' : ''].filter(Boolean).join(' '),
    });
  });

  // Insert reshard nodes on reshard edges
  edges.forEach((e, idx) => {
    const srcId = 'op-' + e.producerOpIndex;
    const tgtId = 'op-' + e.consumerOpIndex;

    if (e.hasReshard) {
      const reshardId = 'reshard-' + idx;
      elements.push({
        group: 'nodes',
        data: {
          id: reshardId,
          label: 'R',
          sublabel: shortenLayout(e.reshardLayout || ''),
          isReshard: true,
          reshardLayout: e.reshardLayout || '',
          producerOpIndex: e.producerOpIndex,
          consumerOpIndex: e.consumerOpIndex,
        },
        classes: 'reshard-node',
      });
      elements.push({
        group: 'edges',
        data: { id: 'e-' + idx + 'a', source: srcId, target: reshardId },
        classes: 'dataflow',
      });
      elements.push({
        group: 'edges',
        data: { id: 'e-' + idx + 'b', source: reshardId, target: tgtId },
        classes: 'reshard',
      });
    } else {
      elements.push({
        group: 'edges',
        data: {
          id: 'e-' + idx,
          source: srcId,
          target: tgtId,
          operandIndex: e.operandIndex,
        },
        classes: 'dataflow',
      });
    }
  });

  // Destroy old instance
  if (cy) cy.destroy();

  cy = cytoscape({
    container: document.getElementById('cy'),
    elements: elements,
    style: [
      // Default node
      {
        selector: 'node',
        style: {
          'label': 'data(label)',
          'text-valign': 'center',
          'text-halign': 'center',
          'font-size': '10px',
          'font-family': '"SF Mono", "Cascadia Code", "Consolas", monospace',
          'color': '#e0e0e0',
          'text-outline-color': '#1e1e2e',
          'text-outline-width': 1,
          'background-color': 'data(color)',
          'background-opacity': 0.25,
          'border-width': 1.5,
          'border-color': 'data(color)',
          'shape': 'roundrectangle',
          'width': 150,
          'height': 40,
          'text-wrap': 'ellipsis',
          'text-max-width': '140px',
        },
      },
      // L1 Sharded
      {
        selector: 'node.l1-sharded',
        style: {
          'background-color': '#50c878',
          'border-color': '#50c878',
        },
      },
      // L1 Interleaved
      {
        selector: 'node.l1-interleaved',
        style: {
          'background-color': '#f0c040',
          'border-color': '#f0c040',
        },
      },
      // DRAM
      {
        selector: 'node.dram',
        style: {
          'background-color': '#e05050',
          'border-color': '#e05050',
        },
      },
      // In-place (zero-result) ops
      {
        selector: 'node.inplace',
        style: {
          'background-color': '#40b0b0',
          'border-color': '#40b0b0',
          'border-style': 'dashed',
        },
      },
      // Fork nodes
      {
        selector: 'node.fork',
        style: {
          'border-style': 'dashed',
          'border-color': '#a070d0',
          'border-width': 2.5,
        },
      },
      // Reshard diamond nodes
      {
        selector: 'node.reshard-node',
        style: {
          'shape': 'diamond',
          'width': 20,
          'height': 20,
          'background-color': '#e08040',
          'background-opacity': 0.8,
          'border-width': 0,
          'label': '',
          'font-size': '8px',
        },
      },
      // Selected node
      {
        selector: 'node:selected',
        style: {
          'border-color': '#ffffff',
          'border-width': 3,
          'z-index': 10,
        },
      },
      // Highlighted (from detail panel click)
      {
        selector: 'node.highlighted',
        style: {
          'border-color': '#ffffff',
          'border-width': 3,
        },
      },
      // Hidden by filter
      {
        selector: 'node.filtered-out',
        style: {
          'opacity': 0.15,
        },
      },
      // Dataflow edges
      {
        selector: 'edge.dataflow',
        style: {
          'curve-style': 'bezier',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#5080b0',
          'line-color': '#5080b0',
          'width': 1.5,
          'arrow-scale': 0.8,
        },
      },
      // Reshard edges
      {
        selector: 'edge.reshard',
        style: {
          'curve-style': 'bezier',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#e08040',
          'line-color': '#e08040',
          'line-style': 'dashed',
          'line-dash-pattern': [6, 3],
          'width': 1.5,
          'arrow-scale': 0.8,
        },
      },
      // Edge hover
      {
        selector: 'edge:selected',
        style: {
          'line-color': '#ffffff',
          'target-arrow-color': '#ffffff',
          'width': 2.5,
          'z-index': 10,
        },
      },
      // Filtered-out edges
      {
        selector: 'edge.filtered-out',
        style: {
          'opacity': 0.1,
        },
      },
    ],

    layout: {
      name: 'dagre',
      rankDir: 'LR',
      nodeSep: 20,
      rankSep: 80,
      edgeSep: 10,
      animate: false,
    },

    // Performance settings
    minZoom: 0.05,
    maxZoom: 5,
    wheelSensitivity: 0.3,
    boxSelectionEnabled: false,
    selectionType: 'single',
  });

  // Lazy label rendering: hide labels at low zoom
  cy.on('zoom', () => {
    const zoom = cy.zoom();
    cy.style()
      .selector('node')
      .style('font-size', zoom < 0.3 ? '0px' : '10px')
      .update();
  });

  // Click handler for op nodes
  cy.on('tap', 'node', evt => {
    const node = evt.target;
    if (node.data('isReshard')) return; // skip reshard diamonds
    const opIdx = node.data('arrayIndex');
    if (opIdx !== undefined) {
      selectOp(opIdx);
    }
  });

  // Click on edge: show tooltip with reshard info
  cy.on('tap', 'edge', evt => {
    const edge = evt.target;
    // Deselect nodes, select this edge
    cy.nodes().unselect();
    edge.select();
  });

  // Click on background: deselect
  cy.on('tap', evt => {
    if (evt.target === cy) {
      cy.elements().unselect().removeClass('highlighted');
      selectedOpIndex = -1;
      scrollDetailToOp(-1);
    }
  });
}

function highlightDAGNode(opIndex) {
  if (!cy) return;
  cy.nodes().removeClass('highlighted');
  if (opIndex >= 0) {
    const node = cy.getElementById('op-' + opIndex);
    if (node.length) {
      node.addClass('highlighted');
    }
  }
}

function centerDAGOnNode(opIndex) {
  if (!cy) return;
  const fp = traceData.forwardPass || [];
  if (opIndex < 0 || opIndex >= fp.length) return;
  const realOpIndex = fp[opIndex].opIndex;
  const node = cy.getElementById('op-' + realOpIndex);
  if (node.length) {
    cy.animate({
      center: { eles: node },
      zoom: 1.5,
      duration: 300,
    });
    cy.nodes().removeClass('highlighted');
    node.addClass('highlighted');
  }
}

function filterDAGNodes() {
  if (!cy) return;
  const search = document.getElementById('search').value.toLowerCase();
  const filterDram = document.getElementById('filter-dram').checked;
  const filterReshard = document.getElementById('filter-reshard').checked;

  cy.batch(() => {
    cy.nodes().forEach(node => {
      if (node.data('isReshard')) return;
      const label = (node.data('label') || '').toLowerCase();
      const layout = (node.data('fullLayout') || '').toLowerCase();
      const isDram = node.data('usedDramFallback');
      const hasReshard = node.data('hasReshard');

      let visible = true;
      if (search && !label.includes(search) && !layout.includes(search)) visible = false;
      if (filterDram && !isDram) visible = false;
      if (filterReshard && !hasReshard) visible = false;

      if (visible) {
        node.removeClass('filtered-out');
      } else {
        node.addClass('filtered-out');
      }
    });

    // Filter edges connected to filtered-out nodes
    cy.edges().forEach(edge => {
      const src = edge.source();
      const tgt = edge.target();
      if (src.hasClass('filtered-out') || tgt.hasClass('filtered-out')) {
        edge.addClass('filtered-out');
      } else {
        edge.removeClass('filtered-out');
      }
    });
  });
}

function shortenLayout(layout) {
  if (!layout) return '';
  // "l1/#ttnn.tensor_memory_layout<interleaved>/8x8" -> "l1/intrlvd/8x8"
  return layout
    .replace('#ttnn.tensor_memory_layout<', '')
    .replace('>', '')
    .replace('interleaved', 'intrlvd')
    .replace('height_sharded', 'h-shard')
    .replace('width_sharded', 'w-shard')
    .replace('block_sharded', 'blk-shard');
}
