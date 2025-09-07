if (typeof chrome !== 'undefined' && chrome.storage) {
  console.log('Chrome storage is available');
} else {
  console.error('Chrome storage is not available');
}

const STORAGE_KEY = 'attemptCounters';
const HISTORY_KEY = 'sessionHistory';

async function loadCounters() {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_KEY], (res) => {
      console.log('Loaded counters:', res[STORAGE_KEY]);
      resolve(res[STORAGE_KEY] || {});
    });
  });
}

async function loadHistory() {
  return new Promise(resolve => {
    chrome.storage.local.get([HISTORY_KEY], (res) => {
      console.log('Loaded history:', res[HISTORY_KEY]);
      resolve(res[HISTORY_KEY] || []);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function drawChart(entries) {
  console.log('Drawing chart with entries:', entries);
  const canvas = document.getElementById('barChart');
  const ctx = canvas.getContext('2d');
  const width = canvas.width = Math.max(400, canvas.offsetWidth || 400);
  const height = canvas.height = Math.max(280, canvas.offsetHeight || 280);

  console.log('Canvas dimensions:', width, height);

  ctx.clearRect(0, 0, width, height);

  if (!entries.length) {
    console.log('No entries to display');
    ctx.fillStyle = '#888888';
    ctx.font = '16px Poppins';
    ctx.textAlign = 'center';
    ctx.fillText('Nenhuma tentativa registrada', width / 2, height / 2);
    return;
  }

  const maxCount = Math.max(...entries.map(([, count]) => count));
  const barWidth = Math.max(20, (width - 60) / entries.length - 10);
  const startX = 40;

  entries.forEach(([site, count], index) => {
    const barHeight = (count / maxCount) * (height - 80);
    const x = startX + index * (barWidth + 10);
    const y = height - 40 - barHeight;

    // Draw bar
    const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);

    // Draw count on top
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Poppins';
    ctx.textAlign = 'center';
    ctx.fillText(count.toString(), x + barWidth / 2, y - 5);

    // Draw site name
    ctx.fillStyle = '#c4c4c4';
    ctx.font = '11px Poppins';
    const truncatedSite = site.length > 10 ? site.substring(0, 10) + '...' : site;
    ctx.fillText(truncatedSite, x + barWidth / 2, height - 20);
  });
}

function renderTable(entries) {
  const wrap = document.getElementById('tableWrap');
  if (!entries.length) {
    wrap.innerHTML = '<div class="empty">Nenhuma tentativa registrada durante a última sessão de foco.</div>';
    return;
  }
  let html = '<table><thead><tr><th>Site</th><th style="text-align:right">Tentativas</th></tr></thead><tbody>';
  for (const [site, count] of entries) {
    html += `<tr><td>${escapeHtml(site)}</td><td class="count">${count}</td></tr>`;
  }
  html += '</tbody></table>';
  wrap.innerHTML = html;
}

function renderHistory(history) {
  const wrap = document.getElementById('historyWrap');
  if (!history.length) {
    wrap.innerHTML = '<div class="empty">Nenhum histórico de sessão disponível.</div>';
    return;
  }
  wrap.innerHTML = history.slice(-10).reverse().map(session => {
    const date = new Date(session.date).toLocaleString('pt-BR');
    const attempts = Object.entries(session.counters || {});
    return `
      <div class="session">
        <h3>${date}</h3>
        <p>Duração: ${session.duration || 0} minutos</p>
        <p>Total de tentativas: ${attempts.reduce((sum, [, count]) => sum + count, 0)}</p>
        ${attempts.length > 0 ? `
          <div class="session-attempts">
            ${attempts.map(([site, count]) => `<span class="attempt-tag">${site}: ${count}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function refreshUI() {
  console.log('Refreshing UI...');
  const counters = await loadCounters();
  const history = await loadHistory();

  const entries = Object.entries(counters).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  console.log('Counters entries:', entries);
  console.log('Total attempts:', total);

  document.getElementById('metaText').textContent = `Total de tentativas nesta sessão: ${total}`;
  document.getElementById('totalText').textContent = `Total: ${total}`;
  document.getElementById('lastUpdated').textContent = `Atualizado: ${new Date().toLocaleString('pt-BR')}`;

  renderTable(entries);
  renderHistory(history);
  drawChart(entries);
}

// Initial load with small delay to ensure DOM is ready
setTimeout(() => {
  refreshUI();
}, 100);
