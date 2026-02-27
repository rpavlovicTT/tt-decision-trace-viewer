// Main application: file loading, tab switching, state management

let traceData = null;
let currentTab = 'dag';
let selectedOpIndex = -1;
let edgeMaps = { producersOf: {}, consumersOf: {} };

// Boot: load static demo trace (GitHub Pages mode)
(async function boot() {
  try {
    await loadTrace('demo/trace.json');
  } catch (err) {
    document.getElementById('loading').innerHTML =
      `<div class="loading-text" style="color:var(--red)">Failed to load: ${escHtml(err.message)}</div>`;
  }
})();

async function loadTrace(url) {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('app').classList.remove('active');

  const res = await fetch(url);
  traceData = await res.json();

  edgeMaps = buildEdgeMaps(traceData.edges);
  selectedOpIndex = -1;

  document.getElementById('loading').classList.add('hidden');
  document.getElementById('app').classList.add('active');

  initViewer();
}

function initViewer() {
  renderSummary();
  initDAG(traceData);
  initDetail(traceData);

  // Wire up toolbar
  document.getElementById('search').value = '';
  document.getElementById('filter-dram').checked = false;
  document.getElementById('filter-failed').checked = false;
  document.getElementById('filter-reshard').checked = false;

  document.getElementById('search').addEventListener('input', applyFilters);
  document.getElementById('filter-dram').addEventListener('change', applyFilters);
  document.getElementById('filter-failed').addEventListener('change', applyFilters);
  document.getElementById('filter-reshard').addEventListener('change', applyFilters);

  // Wire up tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  switchTab('dag');
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('dag-panel').style.display = tab === 'dag' ? '' : 'none';
  document.getElementById('detail-panel').style.display = tab === 'dag' ? '' : 'none';
  document.getElementById('toolbar').style.display = tab === 'dag' ? '' : 'none';
  const l1Panel = document.getElementById('l1-panel');
  l1Panel.classList.toggle('active', tab === 'l1');
  if (tab === 'l1') renderL1Timeline(traceData);
}

function renderSummary() {
  const d = traceData;
  const fp = d.forwardPass || [];
  const regularOps = fp.filter(op => !op.isInplace);
  const inplaceCount = fp.filter(op => op.isInplace).length;
  const shardedCount = regularOps.filter(op => {
    const b0 = op.beam && op.beam[0];
    return b0 && b0.score && b0.score.isSharded && b0.score.isL1;
  }).length;
  const fallbackCount = regularOps.filter(op => op.usedDramFallback).length;
  const shardedPct = regularOps.length > 0 ? Math.round(100 * shardedCount / regularOps.length) : 0;
  const spill = d.spillManagement;
  let spillHtml = '';
  if (spill) {
    const cls = spill.totalSpills > 0 ? 'badge-red' : 'badge-green';
    spillHtml = `<span><span class="label">Spills:</span> <span class="badge ${cls}">${spill.totalSpills}</span></span>`;
  }
  const inplaceHtml = inplaceCount > 0
    ? `<span><span class="label">In-place:</span> <span class="badge badge-teal">${inplaceCount}</span></span>`
    : '';

  document.getElementById('summary').innerHTML = `
    <span><span class="label">Function:</span> <span class="value">${escHtml(d.functionName || 'N/A')}</span></span>
    <span><span class="label">Beam:</span> <span class="value">${d.beamWidth || 0}</span></span>
    <span><span class="label">Ops:</span> <span class="value">${d.totalOps || 0}</span></span>
    <span><span class="label">Sharded:</span> <span class="badge badge-green">${shardedPct}% (${shardedCount}/${regularOps.length})</span></span>
    <span><span class="label">DRAM Fallback:</span> <span class="badge ${fallbackCount > 0 ? 'badge-red' : 'badge-green'}">${fallbackCount}</span></span>
    ${inplaceHtml}
    ${spillHtml}
    <span><span class="label">v${d.version || 1}</span></span>
  `;
}

function applyFilters() {
  filterDetailPanel();
  filterDAGNodes();
}

// Called from dag.js / detail.js when an op is selected
function selectOp(opIndex) {
  selectedOpIndex = opIndex;
  highlightDAGNode(opIndex);
  scrollDetailToOp(opIndex);
}

// Called from detail.js when user clicks a producer/consumer link
function focusOp(opIndex) {
  selectedOpIndex = opIndex;
  switchTab('dag');
  centerDAGOnNode(opIndex);
  scrollDetailToOp(opIndex);
}
