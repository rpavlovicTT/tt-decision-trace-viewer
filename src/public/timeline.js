// L1 Spill Timeline: canvas-based pressure chart with event markers

let selectedSpillEvent = -1;

function renderL1Timeline(data) {
  const spill = data.spillManagement;
  if (!spill || !spill.events || spill.events.length === 0) {
    document.getElementById('l1-detail').innerHTML =
      '<div style="color:var(--text-dim);padding:20px;">No spill management data in this trace.</div>';
    return;
  }

  const canvas = document.getElementById('l1-canvas');
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = (rect.height - 200) * devicePixelRatio;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = (rect.height - 200) + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  const w = rect.width;
  const h = rect.height - 200;
  ctx.clearRect(0, 0, w, h);

  const budget = spill.budget;
  const events = spill.events;
  const maxPos = spill.scheduleSize || Math.max(...events.map(e => e.position)) + 1;

  // Build pressure timeline
  const pressurePoints = [];
  events.forEach(e => {
    if (e.occupiedL1After !== undefined) {
      pressurePoints.push({ pos: e.position, value: e.occupiedL1After });
    }
  });

  const margin = { top: 30, right: 20, bottom: 40, left: 80 };
  const plotW = w - margin.left - margin.right;
  const plotH = h - margin.top - margin.bottom;
  const maxL1 = Math.max(budget, ...pressurePoints.map(p => p.value)) * 1.1;

  const xScale = pos => margin.left + (pos / maxPos) * plotW;
  const yScale = val => margin.top + plotH - (val / maxL1) * plotH;

  // Background
  ctx.fillStyle = '#1e1e2e';
  ctx.fillRect(0, 0, w, h);

  // Grid lines
  ctx.strokeStyle = '#303050';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const val = (maxL1 / 4) * i;
    const y = yScale(val);
    ctx.beginPath();
    ctx.moveTo(margin.left, y);
    ctx.lineTo(w - margin.right, y);
    ctx.stroke();
  }

  // Budget line
  ctx.beginPath();
  ctx.moveTo(margin.left, yScale(budget));
  ctx.lineTo(w - margin.right, yScale(budget));
  ctx.strokeStyle = '#e05050';
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#e05050';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('Budget: ' + formatBytes(budget), w - margin.right, yScale(budget) - 4);

  // Pressure area fill
  if (pressurePoints.length > 1) {
    ctx.beginPath();
    ctx.moveTo(xScale(pressurePoints[0].pos), yScale(pressurePoints[0].value));
    for (let i = 1; i < pressurePoints.length; i++) {
      ctx.lineTo(xScale(pressurePoints[i].pos), yScale(pressurePoints[i].value));
    }
    ctx.lineTo(xScale(pressurePoints[pressurePoints.length - 1].pos), yScale(0));
    ctx.lineTo(xScale(pressurePoints[0].pos), yScale(0));
    ctx.closePath();
    ctx.fillStyle = 'rgba(80, 160, 224, 0.15)';
    ctx.fill();

    // Pressure line
    ctx.beginPath();
    ctx.moveTo(xScale(pressurePoints[0].pos), yScale(pressurePoints[0].value));
    for (let i = 1; i < pressurePoints.length; i++) {
      ctx.lineTo(xScale(pressurePoints[i].pos), yScale(pressurePoints[i].value));
    }
    ctx.strokeStyle = '#50a0e0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Event markers
  const actionColors = {
    'live_added': '#50c878',
    'dead_removal': '#9090a0',
    'eviction': '#e05050',
    'demotion_success': '#e08040',
    'demotion_failed': '#e08040',
    'self_spill': '#a020a0',
    'oom': '#e05050',
    'revalidation': '#a070d0',
  };
  const markerSize = 4;

  events.forEach((e, idx) => {
    const x = xScale(e.position);
    const y = yScale(e.occupiedL1After || 0);
    const color = actionColors[e.action] || '#606080';
    const isSelected = idx === selectedSpillEvent;

    ctx.beginPath();
    if (e.action === 'eviction') {
      ctx.moveTo(x - markerSize, y - markerSize);
      ctx.lineTo(x + markerSize, y + markerSize);
      ctx.moveTo(x + markerSize, y - markerSize);
      ctx.lineTo(x - markerSize, y + markerSize);
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();
    } else if (e.action === 'self_spill') {
      ctx.arc(x, y, markerSize + 1, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    } else if (e.action === 'demotion_success' || e.action === 'demotion_failed') {
      ctx.moveTo(x, y - markerSize - 1);
      ctx.lineTo(x - markerSize, y + markerSize);
      ctx.lineTo(x + markerSize, y + markerSize);
      ctx.closePath();
      ctx.fillStyle = e.action === 'demotion_success' ? color : 'transparent';
      ctx.strokeStyle = color;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.fill();
      ctx.stroke();
    } else if (e.action === 'live_added') {
      ctx.arc(x, y, markerSize, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(x, y, markerSize + 4, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });

  // Axes
  ctx.strokeStyle = '#404060';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, h - margin.bottom);
  ctx.lineTo(w - margin.right, h - margin.bottom);
  ctx.stroke();

  // Y axis labels
  ctx.fillStyle = '#9090a0';
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const val = (maxL1 / 4) * i;
    const y = yScale(val);
    ctx.fillText(formatBytes(val), margin.left - 8, y + 3);
  }

  // X axis labels
  ctx.textAlign = 'center';
  const xTicks = Math.min(10, maxPos);
  for (let i = 0; i <= xTicks; i++) {
    const pos = Math.round((maxPos / xTicks) * i);
    ctx.fillText(pos, xScale(pos), h - margin.bottom + 16);
  }
  ctx.fillText('Schedule Position', w / 2, h - 4);

  // Title
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e0e0e0';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('L1 Memory Pressure Timeline', margin.left, 16);

  // Wire click handler
  canvas.onclick = onL1Click;

  // Render event list
  renderL1EventList(spill);
}

function onL1Click(e) {
  const spill = traceData.spillManagement;
  if (!spill || !spill.events) return;

  const canvas = e.target;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const events = spill.events;
  const maxPos = spill.scheduleSize || Math.max(...events.map(ev => ev.position)) + 1;
  const margin = { left: 80, right: 20 };
  const plotW = rect.width - margin.left - margin.right;

  let closestIdx = -1;
  let closestDist = Infinity;
  events.forEach((ev, idx) => {
    const x = margin.left + (ev.position / maxPos) * plotW;
    const dist = Math.abs(x - mx);
    if (dist < closestDist && dist < 20) {
      closestDist = dist;
      closestIdx = idx;
    }
  });

  selectedSpillEvent = closestIdx;
  renderL1Timeline(traceData);
}

function renderL1EventList(spill) {
  const detail = document.getElementById('l1-detail');
  let html = '<div class="section-title">Spill Events</div>';
  html += '<div class="table-scroll"><table class="trace-table"><thead><tr>';
  html += '<th>Pos</th><th>Action</th><th>Op</th><th>L1 Before</th><th>L1 After</th><th>Usage</th><th>Details</th>';
  html += '</tr></thead><tbody>';

  const actionBadge = action => {
    const colors = {
      'live_added': 'badge-green', 'dead_removal': '', 'eviction': 'badge-red',
      'demotion_success': 'badge-yellow', 'demotion_failed': 'badge-red',
      'self_spill': 'badge-red', 'oom': 'badge-red', 'revalidation': '',
    };
    return `<span class="badge ${colors[action] || ''}">${action}</span>`;
  };

  (spill.events || []).forEach((ev, idx) => {
    const isSelected = idx === selectedSpillEvent;
    const shortName = (ev.opName || '').split(' ')[0].replace(/^%\d+ = /, '');
    html += `<tr style="${isSelected ? 'background:var(--surface2)' : ''}">`;
    html += `<td>${ev.position}</td>`;
    html += `<td>${actionBadge(ev.action)}</td>`;
    html += `<td title="${escHtml(ev.opName)}">${escHtml(shortName.substring(0, 30))}</td>`;
    html += `<td>${formatBytes(ev.occupiedL1Before)}</td>`;
    html += `<td>${formatBytes(ev.occupiedL1After)}</td>`;
    html += `<td>${ev.opL1Usage ? formatBytes(ev.opL1Usage) : ''}</td>`;
    html += `<td>${escHtml(ev.details || '')} ${ev.victimName ? 'victim: ' + escHtml(ev.victimName.substring(0, 30)) : ''}</td>`;
    html += '</tr>';
  });
  html += '</tbody></table></div>';

  // Summary
  html += '<div style="margin-top:8px;color:var(--text-dim)">';
  html += `Budget: ${formatBytes(spill.budget)} | Schedule: ${spill.scheduleSize} ops | `;
  html += `Total Spills: ${spill.totalSpills} | Final L1: ${formatBytes(spill.finalOccupied)} (${spill.finalLiveTensors} tensors)`;
  html += '</div>';

  detail.innerHTML = html;
}

// Resize handler for L1 timeline
window.addEventListener('resize', () => {
  if (currentTab === 'l1' && traceData) renderL1Timeline(traceData);
});
