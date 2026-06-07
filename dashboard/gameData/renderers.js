export function renderSidebar({ width, title, toolbarHtml = '', bodyHtml }) {
  return `
    <div class="gamedata-sidebar" style="width: ${width}px;">
      <div class="gamedata-sidebar-header">
        <span class="gamedata-sidebar-title">${title}</span>
        ${toolbarHtml}
      </div>
      <div class="gamedata-sidebar-list">
        ${bodyHtml}
      </div>
    </div>
  `;
}

export function renderListItem({ dataAttr, dataValue, onclick, selected = false, title, meta = '', subtitle = '', tail = '' }) {
  const secondaryRow = subtitle || tail
    ? `
      <div class="gamedata-list-item-row gamedata-list-item-row-secondary">
        <span class="gamedata-list-item-subtitle">${subtitle}</span>
        <span class="gamedata-list-item-tail">${tail}</span>
      </div>
    `
    : '';

  return `
    <div ${dataAttr}="${dataValue}" onclick="${onclick}" class="gamedata-list-item ${selected ? 'is-selected' : ''}">
      <div class="gamedata-list-item-row">
        <span class="gamedata-list-item-title">${title}</span>
        <span class="gamedata-list-item-meta">${meta}</span>
      </div>
      ${secondaryRow}
    </div>
  `;
}

export function renderDetailPanel(dataAttr, bodyHtml) {
  return `<div ${dataAttr} class="gamedata-detail">${bodyHtml}</div>`;
}

export function renderDetailHeader({ title, titleStyle = '', badgeHtml = '', metaHtml = '' }) {
  return `
    <div class="gamedata-detail-header">
      <div class="gamedata-detail-header-main">
        <h2 class="gamedata-detail-title" style="${titleStyle}">${title}</h2>
        ${badgeHtml}
      </div>
      ${metaHtml ? `<div class="gamedata-detail-meta">${metaHtml}</div>` : ''}
    </div>
  `;
}

export function renderSectionTitle(title) {
  return `<div class="gamedata-section-title">${title}</div>`;
}

export function renderStatGrid(cards, columns) {
  return `<div class="gamedata-stat-grid" style="grid-template-columns: ${columns};">${cards.join('')}</div>`;
}

export function renderStatCard({ label, value, valueColor = '#fff', valueFontSize = '10px' }) {
  return `
    <div class="gamedata-stat-card">
      <div class="gamedata-stat-label">${label}</div>
      <div class="gamedata-stat-value" style="color: ${valueColor}; font-size: ${valueFontSize};">${value}</div>
    </div>
  `;
}

export function renderBlockGrid(cards, columns) {
  return `<div class="gamedata-block-grid" style="grid-template-columns: ${columns};">${cards.join('')}</div>`;
}

export function renderBlockCard({ label, value }) {
  return `
    <div class="gamedata-block-card">
      <div class="gamedata-block-label">${label}</div>
      <div class="gamedata-block-value">${value}</div>
    </div>
  `;
}

export function renderBindingItem({ label, valueHtml }) {
  return `
    <div class="gamedata-binding-item">
      <span class="gamedata-binding-label">${label}</span>
      <span class="gamedata-binding-value">${valueHtml}</span>
    </div>
  `;
}
