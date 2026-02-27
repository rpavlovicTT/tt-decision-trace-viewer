// Detail panel: virtual-scrolled op cards with producer/user links

const CARD_HEIGHT = 44;       // collapsed card height in px
const CARD_MARGIN = 8;        // margin-bottom
const CARD_SLOT = CARD_HEIGHT + CARD_MARGIN;
const OVERSCAN = 5;           // extra cards above/below viewport

let allOps = [];              // full forwardPass array
let filteredIndices = [];     // indices into allOps that pass current filters
let expandedSet = new Set();  // set of array indices that are expanded

function initDetail(data) {
  allOps = data.forwardPass || [];
  expandedSet.clear();
  filteredIndices = allOps.map((_, i) => i);
  renderDetailCards();
  renderForkSection(data);
}

function renderDetailCards() {
  const container = document.getElementById('detail-container');
  container.innerHTML = '';

  // For large lists, we render all collapsed cards (they're small DOM).
  // Virtual scrolling only kicks in for body content.
  filteredIndices.forEach(i => {
    const op = allOps[i];
    const card = createOpCard(op, i);
    container.appendChild(card);
  });
}

function createOpCard(op, arrayIndex) {
  const layout = classifyOpLayout(op);
  const isSelected = arrayIndex === selectedOpIndex;

  const card = document.createElement('div');
  card.className = 'op-card' + (isSelected ? ' expanded selected' : '') +
    (expandedSet.has(arrayIndex) ? ' expanded' : '');
  card.id = 'op-card-' + arrayIndex;
  card.dataset.arrayIndex = arrayIndex;

  // Header
  const header = document.createElement('div');
  header.className = 'op-card-header';
  const badgeCls = layout.cls === 'l1-sharded' ? 'green' :
    layout.cls === 'l1-interleaved' ? 'yellow' :
    layout.cls === 'inplace' ? 'teal' : 'red';
  header.innerHTML = `
    <span class="arrow">&#9654;</span>
    <span class="op-idx">#${op.opIndex}</span>
    <span class="op-name">${escHtml(op.opName)}</span>
    <span class="badge badge-${badgeCls}">${layout.label}</span>
    <span class="op-loc" title="${escHtml(op.opLocation)}">${escHtml(op.opLocation)}</span>
  `;
  header.addEventListener('click', () => toggleCardExpand(arrayIndex));
  card.appendChild(header);

  // Body (lazy rendered on expand)
  const body = document.createElement('div');
  body.className = 'op-card-body';
  if (isSelected || expandedSet.has(arrayIndex)) {
    body.innerHTML = buildOpCardBody(op, arrayIndex);
  }
  card.appendChild(body);

  return card;
}

function toggleCardExpand(arrayIndex) {
  const card = document.getElementById('op-card-' + arrayIndex);
  if (!card) return;

  if (expandedSet.has(arrayIndex)) {
    expandedSet.delete(arrayIndex);
    card.classList.remove('expanded');
    if (selectedOpIndex === arrayIndex) {
      selectedOpIndex = -1;
      highlightDAGNode(-1);
    }
  } else {
    expandedSet.add(arrayIndex);
    card.classList.add('expanded');
    selectedOpIndex = arrayIndex;
    highlightDAGNode(allOps[arrayIndex].opIndex);

    // Lazy render body content
    const body = card.querySelector('.op-card-body');
    if (body && !body.dataset.rendered) {
      body.innerHTML = buildOpCardBody(allOps[arrayIndex], arrayIndex);
      body.dataset.rendered = '1';
    }
  }
}

function buildOpCardBody(op, arrayIndex) {
  let html = '';
  const isInplace = !!op.isInplace;

  // In-place indicator
  if (isInplace) {
    html += '<div style="color:#40b0b0;margin:4px 0;">In-place operation — modifies input tensor, no layout decision</div>';
  }

  // DRAM fallback indicator
  if (op.usedDramFallback) {
    html += '<div class="dram-fallback-indicator">DRAM FALLBACK: No valid L1 candidate found</div>';
  }

  // Producer/consumer links
  html += buildLinksSection(op, arrayIndex);

  // Input candidate sets
  if (op.inputCandidateSets && op.inputCandidateSets.length > 0) {
    html += '<div class="section-title">Input Candidates</div>';
    html += '<div class="table-scroll"><table class="trace-table"><thead><tr>';
    html += '<th>Operand</th><th>Producer Beam</th><th>Reshard</th><th>Candidates</th>';
    html += '</tr></thead><tbody>';
    op.inputCandidateSets.forEach(ics => {
      html += `<tr><td>${ics.operandIndex}</td><td>${ics.fromProducerBeam}</td>`;
      html += `<td>${ics.fromReshard}</td>`;
      html += `<td>${(ics.candidates || []).slice(0, 5).map(escHtml).join(', ')}`;
      if (ics.candidates && ics.candidates.length > 5)
        html += ` (+${ics.candidates.length - 5} more)`;
      html += '</td></tr>';
    });
    html += '</tbody></table></div>';
  }

  // Skip outputHints, evaluations, and beam sections for in-place ops.
  if (!isInplace) {
  // Output hints
  if (op.outputHints) {
    html += '<div class="section-title">Output Hints</div>';
    html += `<div style="color:var(--text-dim);margin:4px 0;">`;
    html += `Primary: ${op.outputHints.primaryCount}, Fallback: ${op.outputHints.fallbackCount}, `;
    html += `L1 Sharding: ${op.outputHints.attemptL1Sharding ? 'yes' : 'no'}`;
    html += '</div>';
  }

  // Cross-product size
  if (op.crossProductSize) {
    html += `<div style="color:var(--text-dim);margin:2px 0;">Cross-product: ${op.crossProductSize} combinations</div>`;
  }

  // Evaluations
  if (op.evaluations && op.evaluations.length > 0) {
    html += `<div class="section-title">Evaluations (${op.evaluations.length})</div>`;
    html += '<div class="table-scroll"><table class="trace-table"><thead><tr>';
    html += '<th>Hint</th><th>Inputs</th><th>Valid</th><th>L1</th><th>Shrd</th>';
    html += '<th>DramIn</th><th>Reshd</th><th>Cores</th><th>L1Use</th><th>Output/Failure</th>';
    html += '</tr></thead><tbody>';

    const beamOutputs = new Set();
    if (op.beam) op.beam.forEach(b => beamOutputs.add(b.outputLayout));

    op.evaluations.forEach(ev => {
      let rowClass = 'invalid';
      if (ev.valid) rowClass = beamOutputs.has(ev.output) ? 'valid-in-beam' : 'valid-not-chosen';
      html += `<tr class="${rowClass}">`;
      html += `<td>${escHtml(ev.hint)}</td>`;
      html += `<td>${(ev.inputs || []).map(escHtml).join(', ')}</td>`;
      html += `<td>${ev.valid ? 'Y' : 'N'}</td>`;
      if (ev.valid) {
        const s = ev.score || ev;
        html += `<td>${s.isL1 ? 'Y' : 'N'}</td><td>${s.isSharded ? 'Y' : 'N'}</td>`;
        html += `<td>${s.inputDramBytes || 0}</td><td>${s.requiresReshard ? 'Y' : 'N'}</td>`;
        html += `<td>${s.coreCount || 0}</td><td>${s.outputL1Usage || 0}</td>`;
        html += `<td>${escHtml(ev.output || '')}</td>`;
      } else {
        html += `<td colspan="6" style="color:var(--red)">${escHtml(ev.failureReason || 'validation failed')}</td>`;
      }
      html += '</tr>';
    });
    html += '</tbody></table></div>';
  }

  // Beam survivors
  if (op.beam && op.beam.length > 0) {
    html += `<div class="section-title">Beam Survivors (${op.beam.length})</div>`;
    html += '<div class="table-scroll"><table class="trace-table"><thead><tr>';
    html += '<th>Rank</th><th>Output</th><th>L1</th><th>Shrd</th>';
    html += '<th>DramIn</th><th>Reshd</th><th>Cores</th><th>L1Use</th>';
    html += '</tr></thead><tbody>';
    op.beam.forEach(b => {
      const s = b.score || b;
      html += `<tr><td>${b.rank}</td><td>${escHtml(b.outputLayout)}</td>`;
      html += `<td>${s.isL1 ? 'Y' : 'N'}</td><td>${s.isSharded ? 'Y' : 'N'}</td>`;
      html += `<td>${s.inputDramBytes || 0}</td><td>${s.requiresReshard ? 'Y' : 'N'}</td>`;
      html += `<td>${s.coreCount || 0}</td><td>${s.outputL1Usage || 0}</td></tr>`;
    });
    html += '</tbody></table></div>';
  }
  } // end if (!isInplace)

  return html;
}

function buildLinksSection(op, arrayIndex) {
  const producers = edgeMaps.producersOf[op.opIndex] || [];
  const consumers = edgeMaps.consumersOf[op.opIndex] || [];

  if (producers.length === 0 && consumers.length === 0) return '';

  let html = '<div class="op-links">';

  if (producers.length > 0) {
    html += '<span style="color:var(--text-dim);font-size:11px">From: </span>';
    producers.forEach(e => {
      const pOp = findOpByIndex(e.producerOpIndex);
      const name = pOp ? pOp.opName.replace('ttnn.', '') : `op#${e.producerOpIndex}`;
      const pArrayIdx = findArrayIndexByOpIndex(e.producerOpIndex);
      html += `<span class="op-link" onclick="focusOp(${pArrayIdx})">#${e.producerOpIndex} ${escHtml(name)}`;
      if (e.hasReshard) html += '<span class="reshard-badge">R</span>';
      html += '</span> ';
    });
  }

  if (consumers.length > 0) {
    html += '<span style="color:var(--text-dim);font-size:11px;margin-left:8px">To: </span>';
    consumers.forEach(e => {
      const cOp = findOpByIndex(e.consumerOpIndex);
      const name = cOp ? cOp.opName.replace('ttnn.', '') : `op#${e.consumerOpIndex}`;
      const cArrayIdx = findArrayIndexByOpIndex(e.consumerOpIndex);
      html += `<span class="op-link" onclick="focusOp(${cArrayIdx})">#${e.consumerOpIndex} ${escHtml(name)}`;
      if (e.hasReshard) html += '<span class="reshard-badge">R</span>';
      html += '</span> ';
    });
  }

  html += '</div>';
  return html;
}

function findOpByIndex(opIndex) {
  return allOps.find(op => op.opIndex === opIndex);
}

function findArrayIndexByOpIndex(opIndex) {
  return allOps.findIndex(op => op.opIndex === opIndex);
}

function renderForkSection(data) {
  const container = document.getElementById('detail-container');
  const forks = data.backwardPass && data.backwardPass.forkResolutions;
  if (!forks || forks.length === 0) return;

  const section = document.createElement('div');
  section.innerHTML = buildForkSectionHtml(forks);
  container.appendChild(section);
}

function buildForkSectionHtml(forks) {
  let html = `<div class="section-title" style="margin-top:16px">Fork Resolutions (${forks.length})</div>`;
  forks.forEach(f => {
    const opIdx = f.opIndex !== undefined ? f.opIndex : -1;
    const arrayIdx = findArrayIndexByOpIndex(opIdx);
    html += `<div class="fork-card" onclick="focusOp(${arrayIdx})">`;
    html += `<strong>${escHtml(f.opName)}</strong> @ ${escHtml(f.opLocation)}<br>`;
    html += `Chosen candidate: #${f.chosenCandidateIndex}, Consumers: ${f.numConsumers}`;
    if (f.consumerOpIndices && f.consumerOpIndices.length > 0) {
      html += `<br>Consumer indices: [${f.consumerOpIndices.join(', ')}]`;
    }
    html += `<br><span style="color:var(--blue);font-size:11px;">Click to focus in DAG</span>`;
    html += '</div>';
  });
  return html;
}

function filterDetailPanel() {
  const search = document.getElementById('search').value.toLowerCase();
  const filterDram = document.getElementById('filter-dram').checked;
  const filterFailed = document.getElementById('filter-failed').checked;
  const filterReshard = document.getElementById('filter-reshard').checked;

  filteredIndices = [];
  allOps.forEach((op, i) => {
    if (search && !op.opName.toLowerCase().includes(search) &&
        !(op.opLocation || '').toLowerCase().includes(search)) return;
    if (filterDram && !op.usedDramFallback) return;
    if (filterFailed && (!op.evaluations || !op.evaluations.some(e => !e.valid))) return;
    if (filterReshard && (!op.beam || !op.beam.some(b => b.score && b.score.requiresReshard))) return;
    filteredIndices.push(i);
  });

  renderDetailCards();
  if (traceData) renderForkSection(traceData);
}

function scrollDetailToOp(opIndex) {
  if (opIndex < 0) return;
  const card = document.getElementById('op-card-' + opIndex);
  if (!card) return;

  // Expand and highlight
  document.querySelectorAll('.op-card.selected').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected', 'expanded');
  expandedSet.add(opIndex);

  // Lazy render body if not done
  const body = card.querySelector('.op-card-body');
  if (body && !body.dataset.rendered) {
    body.innerHTML = buildOpCardBody(allOps[opIndex], opIndex);
    body.dataset.rendered = '1';
  }

  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
