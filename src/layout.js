'use strict';
// Pure geometry, shared by the native window and the tests. Coordinates may be negative.
function visibleBounds(b, area, collapsed = false) {
  const width = Math.min(area.width, Math.max(340, Math.min(700, b.width || 388)));
  const height = Math.min(area.height, collapsed ? 132 : Math.max(420, Math.min(1100, b.height || 660)));
  return { width, height,
    x: Math.max(area.x, Math.min(area.x + area.width - width, Number.isFinite(b.x) ? b.x : area.x + area.width - width - 20)),
    y: Math.max(area.y, Math.min(area.y + area.height - height, Number.isFinite(b.y) ? b.y : area.y + 40)) };
}
function edgeBounds(b, area, side) {
  const width = Math.min(46, area.width), height = Math.min(164, area.height);
  return { width, height, x: side === 'left' ? area.x : area.x + area.width - width,
    y: Math.max(area.y, Math.min(area.y + area.height - height, b.y)) };
}
function nearestEdge(b, area) { return b.x + b.width / 2 < area.x + area.width / 2 ? 'left' : 'right'; }
module.exports = { visibleBounds, edgeBounds, nearestEdge };
