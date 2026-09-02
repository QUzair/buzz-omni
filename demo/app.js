const $ = (selector) => document.querySelector(selector)
const params = new URLSearchParams(location.search)
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character])

const agentEmoji = {
  'triage-coordinator': '◎', 'fraud-review': '🛡', 'payments-ops': '↗',
  'network-operations': '⌁', 'threat-intelligence': '◈',
  'tokenization-launch': '◇', 'growth-insights': '△',
}
const agentEmojiByName = {
  'Triage Coordinator': '◎', 'Fraud Review': '🛡', 'Payments Operations': '↗',
  'Network Operations': '⌁', 'Threat Intelligence': '◈',
  'Tokenization Launch': '◇', 'Growth Insights': '△',
}

let activeChannel

function showRequestedView() {
  const agentsSelected = params.get('view') === 'agents'
  $('#channel-view').hidden = agentsSelected
  $('#agents-view').hidden = !agentsSelected
  $('#agents-nav-link').classList.toggle('active', agentsSelected)
  document.title = agentsSelected ? 'Buzz · Mastercard agents' : 'Buzz · Mastercard Commerce Operations'
}

function renderSetup(setup) {
  $('#agent-count').textContent = `${setup.agents.length} agents`
  $('#agent-cards').innerHTML = setup.agents.map((agent) => `
    <article class="agent-card">
      <div class="agent-card-head">
        <span class="agent-card-avatar">${agentEmoji[agent.id] || '○'}</span>
        <div><strong>${escapeHtml(agent.name)}</strong><small>${escapeHtml(agent.handle)}</small></div>
      </div>
      <p>${escapeHtml(agent.role)}</p>
      <footer class="agent-card-footer"><i></i><span>Running · local Omnigent</span><span>${agent.tools.length} mock tools</span></footer>
    </article>
  `).join('')
}

function formatEmployeeBody(body) {
  return escapeHtml(body).replace(/(@[A-Za-z]+)/g, '<mark>$1</mark>')
}

function renderNavigation(channels) {
  const groups = new Map()
  channels.forEach((channel) => {
    if (!groups.has(channel.group)) groups.set(channel.group, [])
    groups.get(channel.group).push(channel)
  })
  const sections = [...groups].map(([group, groupChannels]) => `
    <section>
      <h2>${escapeHtml(group)}</h2>
      ${groupChannels.map((channel) => `
        <a class="${channel.id === activeChannel.id ? 'selected' : ''}" href="/?demo=1&channel=${encodeURIComponent(channel.id)}" ${channel.id === activeChannel.id ? 'aria-current="page"' : ''}>
          <span>#</span>${escapeHtml(channel.name)}${channel.unread ? `<b>${channel.unread}</b>` : ''}
        </a>`).join('')}
    </section>`).join('')

  $('#channel-nav').innerHTML = `${sections}
    <section class="dm-section">
      <h2>Direct messages</h2>
      <a href="#"><span class="tiny-avatar blue">MP</span>Maya Patel</a>
      <a href="#"><span class="tiny-avatar green">AK</span>Aisha Khan<b>1</b></a>
      <a href="#"><span class="tiny-avatar peach">NO</span>Nora Okafor</a>
    </section>`
}

function renderConversation(channel) {
  $('#channel-name').textContent = channel.name
  $('#channel-purpose').textContent = channel.purpose
  $('#message-input').value = channel.suggestedPrompt
  $('#message-input').placeholder = `Message #${channel.name}`
  $('#composer-label').textContent = `Message ${channel.name}`
  $('#active-agent').textContent = `${channel.agentHandle}:`
  $('#agent-status').textContent = 'Ready'
  if (params.get('view') !== 'agents') document.title = `Buzz · #${channel.name}`

  $('#messages').innerHTML = `${channel.messages.map((message, index) => `
    ${index === 2 ? '<div class="new-rule"><span>NEW</span></div>' : ''}
    <article class="buzz-message employee-message">
      <div class="message-avatar tone-${escapeHtml(message.tone)}">${escapeHtml(message.initials)}</div>
      <div class="message-copy">
        <header><strong>${escapeHtml(message.employee)}</strong><span class="employee-role">${escapeHtml(message.role)}</span><time>${escapeHtml(message.time)}</time></header>
        <p>${formatEmployeeBody(message.body)}</p>
      </div>
    </article>`).join('')}
    <article id="agent-response" class="buzz-message agent-message loading">
      <div class="message-avatar agent-avatar">${agentEmoji[channel.agentId] || '○'}</div>
      <div class="message-copy"><header><strong>${escapeHtml(channel.agentHandle.slice(1))}</strong><span class="agent-badge">AGENT</span><time>Now</time></header><div class="typing"><i></i><i></i><i></i><span>Waiting to be invoked…</span></div></div>
    </article>`
}

function renderWorkspace(workspace) {
  const requested = params.get('channel') || (params.get('scenario') === 'payments' ? 'customer-triage' : 'network-operations')
  activeChannel = workspace.channels.find((channel) => channel.id === requested) || workspace.channels[0]
  $('#demo-disclaimer').textContent = workspace.disclaimer
  renderNavigation(workspace.channels)
  renderConversation(activeChannel)

  if (params.get('scenario') === 'payments') {
    $('#message-input').value = '@Triage Our supplier transfer is pending after 24 hours. Check the payment rail and prepare an escalation.'
  }
  if (params.has('demo') && params.get('view') !== 'agents') setTimeout(() => run($('#message-input').value), 250)
}

function renderResult(result) {
  const response = $('#agent-response')
  response.classList.remove('loading')
  response.innerHTML = `
    <div class="message-avatar agent-avatar">${agentEmojiByName[result.agent] || '○'}</div>
    <div class="message-copy">
      <header><strong>${escapeHtml(result.agent)}</strong><span class="agent-badge">AGENT</span><time>Now</time></header>
      <div class="route-summary"><span class="priority">${escapeHtml(result.priority)}</span><span>${escapeHtml(result.summary)}</span></div>
      <p>${escapeHtml(result.answer)}</p>
      <p class="next-step"><strong>Human next step:</strong> ${escapeHtml(result.nextStep)} <button type="button">${escapeHtml(result.actionLabel)}</button></p>
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
      <div class="buzz-reactions"><button type="button">👍 <span>2</span></button><button type="button">💬 <span>Reply</span></button></div>
    </div>`
  $('#agent-status').textContent = 'Ready'
}

async function run(message) {
  if (!activeChannel) return
  const response = $('#agent-response')
  response.classList.add('loading')
  response.innerHTML = `
    <div class="message-avatar agent-avatar">${agentEmoji[activeChannel.agentId] || '○'}</div>
    <div class="message-copy"><header><strong>${escapeHtml(activeChannel.agentHandle.slice(1))}</strong><span class="agent-badge">AGENT</span><time>Now</time></header><div class="typing"><i></i><i></i><i></i><span>Running governed workflow…</span></div></div>`
  $('#agent-status').textContent = 'Working'
  try {
    const request = await fetch(`/api/workflows/${encodeURIComponent(activeChannel.id)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }),
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
fetch('/api/workspace').then((response) => {
  if (!response.ok) throw new Error('Workspace unavailable')
  return response.json()
}).then(renderWorkspace).catch(() => {
  $('#messages').innerHTML = '<div class="channel-loading" role="alert">The local workspace runtime is unavailable.</div>'
})
