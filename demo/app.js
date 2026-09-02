const $ = (selector) => document.querySelector(selector)
const params = new URLSearchParams(location.search)
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character])
const agentEmoji = { 'triage-coordinator': '🐝', 'fraud-review': '🛡️', 'payments-ops': '⚡' }

function showRequestedView() {
  const agentsSelected = params.get('view') === 'agents'
  $('#channel-view').hidden = agentsSelected
  $('#agents-view').hidden = !agentsSelected
  $('#agents-nav-link').classList.toggle('active', agentsSelected)
  $('#channel-nav-link').classList.toggle('selected', !agentsSelected)
  document.title = agentsSelected ? 'Buzz · Agents' : 'Buzz · Customer triage'
}

function renderSetup(setup) {
  $('#agent-count').textContent = `${setup.agents.length} agents`
  $('#agent-cards').innerHTML = setup.agents.map((agent) => `
    <article class="agent-card">
      <div class="agent-card-head">
        <span class="agent-card-avatar">${agentEmoji[agent.id] || '🤖'}</span>
        <div><strong>${escapeHtml(agent.name)}</strong><small>${escapeHtml(agent.handle)}</small></div>
      </div>
      <p>${escapeHtml(agent.role)}</p>
      <footer class="agent-card-footer"><i></i><span>Running · Omnigent</span><span>${agent.tools.length} mock tools</span></footer>
    </article>
  `).join('')
}

function renderResult(result) {
  const response = $('#agent-response')
  response.classList.remove('loading')
  response.innerHTML = `
    <div class="message-avatar triage-avatar">🐝</div>
    <div class="message-copy">
      <header><strong>Triage Coordinator</strong><time>10:24 AM</time></header>
      <div class="route-summary"><span class="priority">${escapeHtml(result.priority)}</span><span>Routed to</span><strong>${escapeHtml(result.agent)}</strong></div>
      <p>${escapeHtml(result.answer)}</p>
      <p class="next-step"><strong>Next:</strong> ${escapeHtml(result.nextStep)} <button type="button">${escapeHtml(result.actionLabel)}</button></p>
      <details class="run-details" open>
        <summary>Agent activity <span>${result.tools.length} mock tool calls · ${result.durationMs} ms</span></summary>
        <div class="tool-list">${result.tools.map((tool, index) => `
          <div class="tool-row ${tool.status === 'approval_required' ? 'approval' : ''}">
            <span class="tool-index">${index + 1}</span>
            <div><strong>${escapeHtml(tool.label)}</strong><code>${escapeHtml(tool.name)}</code><p>${escapeHtml(tool.output)}</p></div>
            <span>${tool.status === 'approval_required' ? 'Approval' : 'Done'}</span>
          </div>`).join('')}
        </div>
      </details>
      <div class="buzz-reactions"><button>👍 <span>1</span></button><button>💬 <span>Reply</span></button></div>
    </div>`
  $('#agent-status').textContent = 'Ready'
}

async function run(message) {
  const response = $('#agent-response')
  response.classList.add('loading')
  $('#agent-status').textContent = 'Working'
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
    const typing = response.querySelector('.typing')
    if (typing) typing.textContent = error instanceof Error ? error.message : 'Runtime unavailable'
    $('#agent-status').textContent = 'Offline'
  }
}

$('#composer').addEventListener('submit', (event) => {
  event.preventDefault()
  run($('#message-input').value)
})

showRequestedView()
fetch('/api/setup').then((response) => response.json()).then(renderSetup).catch(() => {
  $('#agent-count').textContent = 'Runtime offline'
})

if (params.get('scenario') === 'payments') {
  $('#message-input').value = '@Triage Our supplier transfer is still pending after 24 hours. Check the payment rail and prepare an escalation.'
}
if (params.has('demo') && params.get('view') !== 'agents') {
  setTimeout(() => run($('#message-input').value), 250)
}
