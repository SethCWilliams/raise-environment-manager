// Polling configuration
const POLL_INTERVAL = 5000; // 5 seconds
let pollTimer = null;
let isPolling = false;
let previousData = null;

// Fetch and display environment data
async function fetchEnvironments() {
  try {
    const response = await fetch('/api/environments');
    if (!response.ok) {
      throw new Error('Failed to fetch environments');
    }

    const data = await response.json();
    updateDashboard(data);
    updateLastUpdate();
    updateConnectionStatus(true);
  } catch (error) {
    console.error('Error fetching environments:', error);
    updateConnectionStatus(false);
  }
}

// Update the dashboard with environment data (incrementally)
function updateDashboard(data) {
  const container = document.getElementById('environmentsContainer');

  // Check if any service status changed (requires re-sort)
  let statusChanged = false;
  if (previousData && previousData.environments) {
    for (const [envName, env] of Object.entries(data.environments)) {
      const prevEnv = previousData.environments[envName];
      if (!prevEnv) {
        statusChanged = true;
        break;
      }

      for (const [serviceName, service] of Object.entries(env.services)) {
        const prevService = prevEnv.services?.[serviceName];
        if (!prevService || service.status !== prevService.status) {
          statusChanged = true;
          break;
        }
      }
      if (statusChanged) break;
    }
  }

  // On first load, structure change, or status change, do full rebuild
  if (!previousData ||
      Object.keys(data.environments).length !== Object.keys(previousData.environments || {}).length ||
      statusChanged) {
    container.innerHTML = '';
    for (const [envName, env] of Object.entries(data.environments)) {
      const envSection = createEnvironmentSection(envName, env);
      container.appendChild(envSection);
    }
    previousData = data;
    return;
  }

  // Incremental update: only update changed services (no status change)
  for (const [envName, env] of Object.entries(data.environments)) {
    const prevEnv = previousData.environments[envName];

    for (const [serviceName, service] of Object.entries(env.services)) {
      const prevService = prevEnv?.services[serviceName];

      // Check if service data changed (but status didn't, that's handled above)
      if (!prevService || hasServiceChanged(service, prevService)) {
        updateServiceCard(envName, serviceName, service);
      }
    }
  }

  previousData = data;
}

// Check if a service's data has changed
function hasServiceChanged(service, prevService) {
  return service.status !== prevService.status ||
         service.owner !== prevService.owner ||
         service.task !== prevService.task ||
         service.duration !== prevService.duration ||
         service.queue.length !== prevService.queue.length ||
         JSON.stringify(service.queue) !== JSON.stringify(prevService.queue);
}

// Update a specific service card in the DOM
function updateServiceCard(envName, serviceName, service) {
  const card = document.querySelector(
    `[data-env="${envName}"][data-service="${serviceName}"]`
  );

  if (!card) {
    // Card doesn't exist, need full rebuild
    const container = document.getElementById('environmentsContainer');
    container.innerHTML = '';
    previousData = null;
    return;
  }

  // Update the card's content
  const statusClass = service.status === 'available' ? 'available' : 'in-use';
  const statusText = service.status === 'available' ? 'Available' : 'In Use';

  let detailsHTML = '';
  if (service.status === 'in_use') {
    detailsHTML = `
      <div class="service-details">
        <div class="detail-row">
          <span class="detail-label">Owner</span>
          <span class="detail-value">${escapeHtml(service.owner)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Duration</span>
          <span class="detail-value">${service.duration}</span>
        </div>
      </div>
      ${service.task ? `<div class="task-description">${escapeHtml(service.task)}</div>` : ''}
    `;
  }

  const queueHTML = createQueueHTML(service.queue);

  card.innerHTML = `
    <div class="service-header">
      <h3 class="service-name">${serviceName}</h3>
      <div class="service-status ${statusClass}">
        <span class="status-dot"></span>
        ${statusText}
      </div>
    </div>
    ${detailsHTML}
    ${queueHTML}
  `;
}

// Create an environment section
function createEnvironmentSection(envName, env) {
  const section = document.createElement('div');
  section.className = 'env-section';

  const header = document.createElement('h2');
  header.className = 'env-section-header';
  header.textContent = envName.toUpperCase();
  section.appendChild(header);

  const servicesGrid = document.createElement('div');
  servicesGrid.className = 'services-grid';

  // Sort services: In Use first, then Available
  const sortedServices = Object.entries(env.services).sort((a, b) => {
    const statusA = a[1].status; // 'in_use' or 'available'
    const statusB = b[1].status;

    // In Use (in_use) comes before Available (available)
    if (statusA === 'in_use' && statusB === 'available') return -1;
    if (statusA === 'available' && statusB === 'in_use') return 1;

    // If same status, maintain alphabetical order by service name
    return a[0].localeCompare(b[0]);
  });

  for (const [serviceName, service] of sortedServices) {
    const serviceCard = createServiceCard(envName, serviceName, service);
    servicesGrid.appendChild(serviceCard);
  }

  section.appendChild(servicesGrid);
  return section;
}

// Create a service card
function createServiceCard(envName, serviceName, service) {
  const card = document.createElement('div');
  card.className = 'service-card';
  card.setAttribute('data-env', envName);
  card.setAttribute('data-service', serviceName);

  const statusClass = service.status === 'available' ? 'available' : 'in-use';
  const statusText = service.status === 'available' ? 'Available' : 'In Use';

  let detailsHTML = '';

  if (service.status === 'in_use') {
    detailsHTML = `
      <div class="service-details">
        <div class="detail-row">
          <span class="detail-label">Owner</span>
          <span class="detail-value">${escapeHtml(service.owner)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Duration</span>
          <span class="detail-value">${service.duration}</span>
        </div>
      </div>
      ${service.task ? `<div class="task-description">${escapeHtml(service.task)}</div>` : ''}
    `;
  }

  const queueHTML = createQueueHTML(service.queue);

  card.innerHTML = `
    <div class="service-header">
      <h3 class="service-name">${serviceName}</h3>
      <div class="service-status ${statusClass}">
        <span class="status-dot"></span>
        ${statusText}
      </div>
    </div>
    ${detailsHTML}
    ${queueHTML}
  `;

  return card;
}

// Create queue HTML
function createQueueHTML(queue) {
  if (!queue || queue.length === 0) {
    return `
      <div class="queue-section">
        <div class="queue-header">Queue</div>
        <div class="empty-queue">Empty</div>
      </div>
    `;
  }

  const queueItems = queue.map((item, index) => `
    <div class="queue-item">
      <div class="queue-position">${index + 1}</div>
      <div class="queue-info">
        <div class="queue-user">${escapeHtml(item.userName)}</div>
        <div class="queue-task">${escapeHtml(item.task)}</div>
      </div>
    </div>
  `).join('');

  return `
    <div class="queue-section">
      <div class="queue-header">Queue (${queue.length})</div>
      ${queueItems}
    </div>
  `;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Update last update timestamp
function updateLastUpdate() {
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  document.getElementById('lastUpdate').textContent = timeString;
}

// Update connection status indicator
function updateConnectionStatus(connected) {
  const statusEl = document.getElementById('connectionStatus');
  if (connected) {
    statusEl.innerHTML = '<span class="dot"></span> Connected';
  } else {
    statusEl.innerHTML = '<span class="dot" style="background: #ef4444;"></span> Disconnected';
  }
}

// Start polling
function startPolling() {
  if (isPolling) return;

  isPolling = true;
  console.log('Started polling');

  // Fetch immediately
  fetchEnvironments();

  // Then poll every interval
  pollTimer = setInterval(fetchEnvironments, POLL_INTERVAL);
}

// Stop polling
function stopPolling() {
  if (!isPolling) return;

  isPolling = false;
  console.log('Stopped polling');

  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// Handle tab visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Tab is hidden, stop polling
    stopPolling();
  } else {
    // Tab is visible, start polling
    startPolling();
  }
});

// Start polling when page loads
startPolling();
