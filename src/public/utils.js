// Shared utilities for the Decision Trace Viewer

function formatBytes(b) {
  if (b === undefined || b === null) return '?';
  if (b < 1024) return b + 'B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + 'KB';
  return (b / (1024 * 1024)).toFixed(2) + 'MB';
}

function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Classify an op's memory layout from its beam/fallback state
function classifyOpLayout(op) {
  if (op.isInplace) {
    return { cls: 'inplace', label: 'In-place', color: '#40b0b0' };
  }
  if (op.usedDramFallback) {
    return { cls: 'dram', label: 'DRAM Fallback', color: '#e05050' };
  }
  const beam0 = (op.beam && op.beam.length > 0) ? op.beam[0] : null;
  if (beam0 && beam0.score) {
    if (beam0.score.isSharded && beam0.score.isL1) {
      return { cls: 'l1-sharded', label: 'L1 Sharded', color: '#50c878' };
    }
    if (beam0.score.isL1) {
      return { cls: 'l1-interleaved', label: 'L1 Interleaved', color: '#f0c040' };
    }
    return { cls: 'dram', label: 'DRAM', color: '#e05050' };
  }
  return { cls: 'unknown', label: 'Unknown', color: '#606080' };
}

// Build lookup maps from trace data for quick edge/producer/consumer queries
function buildEdgeMaps(edges) {
  const producersOf = {};  // consumerOpIndex -> [edge]
  const consumersOf = {};  // producerOpIndex -> [edge]
  (edges || []).forEach(e => {
    if (!producersOf[e.consumerOpIndex]) producersOf[e.consumerOpIndex] = [];
    producersOf[e.consumerOpIndex].push(e);
    if (!consumersOf[e.producerOpIndex]) consumersOf[e.producerOpIndex] = [];
    consumersOf[e.producerOpIndex].push(e);
  });
  return { producersOf, consumersOf };
}
