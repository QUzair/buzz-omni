const $ = (selector) => document.querySelector(selector)
const params = new URLSearchParams(location.search)
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character])

const agentTone = { 'triage-coordinator': 'amber', 'fraud-review': 'rose', 'payments-ops': 'cyan' }

function renderSetup(setup) {
  $('#runtime-state').textContent = 'Online'
  $('#runtime-state').classList.add('online')
  $('#agent-count').textContent = `${setup.agents.length} active`
  $('#agent-nav').innerHTML = setup.agents.map((agent) => `
    <div><span class="agent-presence ${agentTone[agent.id] || 'amber'}">${escapeHtml(agent.name.charAt(0))}</span><p><strong>${escapeHtml(agent.name)}</strong><small>${escapeHtml(agent.handle)}</small></p><i></i></div>
  `).join('')
  $('#agent-cards').innerHTML = setup.agents.map((agent, index) => `
    <article class="agent-card ${index === 0 ? 'active' : ''}">
      <span class="agent-presence ${agentTone[agent.id] || 'amber'}">${escapeHtml(agent.name.charAt(0))}</span>
      <div><strong>${escapeHtml(agent.name)}</strong><p>${escapeHtml(agent.role)}</p><small>${agent.tools.length} mock tools</small></div>
    </article>
  `).join('')
}

function renderResult(result) {
  const response = $('#agent-response')
  response.classList.remove('loading')
  response.innerHTML = `
    <div class="avatar bot">T</div>
    <div class="message-body">
      <header><strong>Triage Coordinator</strong><span class="bot-label">AGENT</span><time>10:24</time></header>
      <div class="route-line"><span class="priority">${escapeHtml(result.priority)}</span><span>Routed to</span><strong>${escapeHtml(result.agent)}</strong><span class="route-arrow">→</span></div>
      <p>${escapeHtml(result.answer)}</p>
      <div class="decision-card">
        <span>RECOMMENDED NEXT STEP</span>
        <strong>${escapeHtml(result.nextStep)}</strong>
        <button type="button">${escapeHtml(result.actionLabel)} <b>→</b></button>
      </div>
      <div class="message-meta"><span>✓ ${result.tools.length} mock tools completed</span><span>${result.durationMs} ms</span></div>
    </div>`

  $('#trace-duration').textContent = `${result.durationMs} ms`
  $('#tool-trace').innerHTML = result.tools.map((tool, index) => `
    <li class="${tool.status === 'approval_required' ? 'approval' : ''}">
      <div class="trace-index">${index + 1}</div>
      <div><header><strong>${escapeHtml(tool.label)}</strong><span>${tool.status === 'approval_required' ? 'APPROVAL' : 'DONE'}</span></header><code>${escapeHtml(tool.name)}</code><p>${escapeHtml(tool.output)}</p><small>MOCK TOOL</small></div>
    </li>`).join('')
}

async function run(message) {
  const response = $('#agent-response')
  response.classList.add('loading')
  try {
    const request = await fetch('/api/triage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    if (!request.ok) throw new Error('Runtime rejected the turn')
    renderResult(await request.json())
  } catch (error) {
    response.classList.remove('loading')
    response.querySelector('.typing').textContent = error.message
  }
}

$('#composer').addEventListener('submit', (event) => {
  event.preventDefault()
  run($('#message-input').value)
})

fetch('/api/setup').then((response) => response.json()).then(renderSetup).catch(() => {
  $('#runtime-state').textContent = 'Offline'
})

if (params.get('scenario') === 'payments') {
  $('#message-input').value = '@Triage Our supplier transfer is still pending after 24 hours. Check the payment rail and prepare an escalation.'
}

if (params.has('demo')) {
  setTimeout(() => run($('#message-input').value), 350)
}
