import { SceneManager } from './three/SceneManager.js';
import { fetchAllSensors, cancelPendingRequest } from './api/client.js';
import { getHeatColor, TEMP_MIN, TEMP_MAX } from './utils/heatColor.js';

const PIPE_DEFS = [
  { id: 'PIPE_01', pipeIndex: 1, from: [-6, 2, 0], to: [-0.5, 2, 0], radius: 0.25 },
  { id: 'PIPE_02', pipeIndex: 2, from: [0.5, 4.5, 0], to: [4.5, 4.5, 0], radius: 0.22 },
  { id: 'PIPE_03', pipeIndex: 3, from: [7.5, 4.5, 0], to: [11.5, 4.5, 0], radius: 0.22 },
  { id: 'PIPE_04', pipeIndex: 4, from: [-6, 1, 0], to: [12, 1, 0], radius: 0.28 },
  { id: 'PIPE_05', pipeIndex: 5, from: [0, 3.6, 0], to: [0, 4.5, 0], radius: 0.2 },
  { id: 'PIPE_06', pipeIndex: 2, from: [4.5, 4.5, 0], to: [7.5, 4.5, 0], radius: 0.25 },
  { id: 'PIPE_07', pipeIndex: 6, from: [8, 3.6, 0], to: [8, 4.5, 0], radius: 0.2 },
  { id: 'PIPE_08', pipeIndex: 1, from: [0, 2, 0], to: [0, 0.3, 0], radius: 0.2 },
  { id: 'PIPE_09', pipeIndex: 4, from: [0, 0.3, 0], to: [8, 0.3, 0], radius: 0.2 },
  { id: 'PIPE_10', pipeIndex: 6, from: [8, 0.3, 0], to: [8, 2, 0], radius: 0.2 },
];

const BOILER_DEFS = [
  { id: 'BOILER_01', position: [0, 0, 0] },
  { id: 'BOILER_02', position: [8, 0, 0] },
];

const VALVE_DEFS = [
  { id: 'VALVE_01', position: [-4.5, 2, 0] },
  { id: 'VALVE_02', position: [3.5, 4.5, 0] },
  { id: 'VALVE_03', position: [10.5, 4.5, 0] },
  { id: 'VALVE_04', position: [10, 1, 0] },
];

class App {
  constructor() {
    this.sceneManager = null;
    this.sensorData = [];
    this.sensorDataById = new Map();
    this.pollInterval = 2000;
    this._pollTimer = null;
    this._fetching = false;
    this._failCount = 0;
    this.paused = false;
    this.alarms = [];
    this._uiRafScheduled = false;
    this._pendingSensorListData = null;
    this._pendingAlarmData = null;
    this._lastSensorListKey = '';
    this._lastAlarmKey = '';

    this._init();
  }

  _init() {
    const container = document.getElementById('canvas-container');
    this.sceneManager = new SceneManager(container);

    this._buildScene();
    this._bindUIEvents();
    this._setupTooltip();
    this._scheduleNextPoll(300);
  }

  _buildScene() {
    BOILER_DEFS.forEach(def => {
      this.sceneManager.createBoiler(
        { x: def.position[0], y: def.position[1], z: def.position[2] },
        def.id,
        { nodeId: def.id, nodeName: def.id, nodeType: 'BOILER' }
      );
    });

    PIPE_DEFS.forEach(def => {
      this.sceneManager.createPipe(
        def.from, def.to, def.id, def.pipeIndex, def.radius,
        { nodeId: def.id, nodeName: def.id, nodeType: 'PIPE', pipeIndex: def.pipeIndex }
      );
    });

    VALVE_DEFS.forEach(def => {
      this.sceneManager.createValve(
        { x: def.position[0], y: def.position[1], z: def.position[2] },
        def.id,
        { nodeId: def.id, nodeName: def.id, nodeType: 'VALVE' }
      );
    });
  }

  _bindUIEvents() {
    const pollInput = document.getElementById('poll-interval');
    pollInput.addEventListener('change', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val >= 500 && val <= 10000) {
        this.pollInterval = val;
      }
    });

    const pauseBtn = document.getElementById('btn-pause');
    pauseBtn.addEventListener('click', () => {
      this.paused = !this.paused;
      if (this.paused) {
        this._clearPollTimer();
        cancelPendingRequest();
        pauseBtn.textContent = '▶ 继续更新';
        pauseBtn.classList.add('active');
      } else {
        pauseBtn.textContent = '⏸ 暂停更新';
        pauseBtn.classList.remove('active');
        this._failCount = 0;
        this._scheduleNextPoll(100);
      }
    });

    const rotateBtn = document.getElementById('btn-rotate');
    rotateBtn.addEventListener('click', () => {
      const enabled = !this.sceneManager.autoRotate;
      this.sceneManager.setAutoRotate(enabled);
      rotateBtn.classList.toggle('active', enabled);
    });
  }

  _setupTooltip() {
    const tooltip = document.getElementById('tooltip');
    const container = document.getElementById('canvas-container');

    this.sceneManager.setOnHoverCallback((sensorNode, event) => {
      if (!sensorNode || !event) {
        tooltip.classList.add('hidden');
        return;
      }
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left + 16;
      const y = event.clientY - rect.top + 16;

      const tempColor = getHeatColor(sensorNode.temperature ?? 80);
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${y}px`;
      tooltip.innerHTML = `
        <div class="tooltip-title">${sensorNode.nodeName || sensorNode.nodeId}</div>
        <div class="tooltip-row">
          <span class="tooltip-label">节点ID</span>
          <span class="tooltip-value">${sensorNode.nodeId || '-'}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">类型</span>
          <span class="tooltip-value">${this._getTypeLabel(sensorNode.nodeType)}</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">温度</span>
          <span class="tooltip-value" style="color:${tempColor}">${sensorNode.temperature?.toFixed(1) ?? '--'} °C</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">压力</span>
          <span class="tooltip-value" style="color:#60a5fa">${sensorNode.pressure?.toFixed(2) ?? '--'} MPa</span>
        </div>
        <div class="tooltip-row">
          <span class="tooltip-label">状态</span>
          <span class="tooltip-value badge-${sensorNode.status || 'NORMAL'}" style="padding:1px 6px;border-radius:3px;font-size:11px;">${this._getStatusLabel(sensorNode.status)}</span>
        </div>
      `;
      tooltip.classList.remove('hidden');
    });
  }

  _getTypeLabel(type) {
    const map = { BOILER: '锅炉', PIPE: '管道', VALVE: '阀门', SENSOR: '传感器' };
    return map[type] || type || '--';
  }

  _getStatusLabel(status) {
    const map = { NORMAL: '正常', WARNING: '预警', ALARM: '报警' };
    return map[status] || status || '--';
  }

  _clearPollTimer() {
    if (this._pollTimer) {
      clearTimeout(this._pollTimer);
      this._pollTimer = null;
    }
  }

  _scheduleNextPoll(delayOverride) {
    this._clearPollTimer();
    if (this.paused) return;
    let delay = delayOverride != null ? delayOverride : this.pollInterval;
    if (this._failCount > 0) {
      const backoff = Math.min(10000, 500 * Math.pow(2, this._failCount));
      delay = Math.max(delay, backoff);
    }
    this._pollTimer = setTimeout(() => this._fetchAndUpdate(), delay);
  }

  async _fetchAndUpdate() {
    if (this._fetching || this.paused) {
      this._scheduleNextPoll();
      return;
    }
    this._fetching = true;
    try {
      const response = await fetchAllSensors({ timeoutMs: 3000 });
      if (response && response.code === 200 && response.data) {
        this._failCount = 0;
        this.sensorData = response.data;
        this.sensorDataById = new Map(response.data.map(n => [n.nodeId, n]));
        this._updateScene(this.sensorData);
        this._scheduleUIUpdate(this.sensorData);
        this._updateConnectionStatus(true, response.timestamp);
      } else {
        throw new Error('Bad response');
      }
    } catch (err) {
      if (!err._aborted) {
        this._failCount = Math.min(this._failCount + 1, 8);
        console.warn(`Poll failed (fail=${this._failCount}):`, err.message || err.name);
        this._updateConnectionStatus(false, Date.now());
      }
    } finally {
      this._fetching = false;
      this._scheduleNextPoll();
    }
  }

  _updateScene(sensorData) {
    this._assignTemperaturesToPipes(sensorData);
    try {
      this.sceneManager.updatePipeColors(sensorData);
      this.sceneManager.updateBoilerTemperatures(sensorData);
      this.sceneManager.updateValveStatus(sensorData);
      this.sceneManager.updateAlarmStates(sensorData);
    } catch (e) {
      console.error('Scene update error:', e);
    }

    for (let i = 0; i < sensorData.length; i++) {
      const node = sensorData[i];
      if (node.positionX == null) continue;
      if (!this.sceneManager.nodeUserDataMap.has(node.nodeId)) {
        try {
          this.sceneManager.createSensorMarker(
            { x: node.positionX, y: node.positionY, z: node.positionZ },
            node.nodeId,
            node
          );
        } catch (e) { /* noop */ }
      }
    }
    try {
      this.sceneManager.updateSensorMarkers(sensorData);
    } catch (e) {
      console.error('Marker update error:', e);
    }
  }

  _assignTemperaturesToPipes(sensorData) {
    const pipeGroups = new Map();
    for (let i = 0; i < sensorData.length; i++) {
      const node = sensorData[i];
      if (node.pipeIndex != null && node.temperature != null) {
        const idx = node.pipeIndex;
        if (!pipeGroups.has(idx)) pipeGroups.set(idx, []);
        pipeGroups.get(idx).push(node);
      }
    }

    this.sceneManager.pipeMeshes.forEach((group) => {
      const pipeIdx = group.userData.sensorNode?.pipeIndex;
      if (pipeIdx == null || !pipeGroups.has(pipeIdx)) return;
      const nodes = pipeGroups.get(pipeIdx);
      if (!nodes.length) return;
      let sumT = 0, sumP = 0;
      let worst = 0;
      const rank = { NORMAL: 0, WARNING: 1, ALARM: 2 };
      for (let i = 0; i < nodes.length; i++) {
        sumT += nodes[i].temperature;
        sumP += (nodes[i].pressure || 0);
        const r = rank[nodes[i].status] || 0;
        if (r > worst) worst = r;
      }
      const avgT = sumT / nodes.length;
      const avgP = sumP / nodes.length;
      const worstStatus = ['NORMAL', 'WARNING', 'ALARM'][worst];
      if (!group.userData.sensorNode) group.userData.sensorNode = {};
      group.userData.sensorNode.temperature = avgT;
      group.userData.sensorNode.pressure = avgP;
      group.userData.sensorNode.status = worstStatus;
      group.userData.sensorNode.nodeName = `管道#${pipeIdx}`;
    });
  }

  _scheduleUIUpdate(sensorData) {
    this._pendingSensorListData = sensorData;
    const issues = sensorData.filter(n => n.status === 'WARNING' || n.status === 'ALARM');
    this._pendingAlarmData = issues;
    if (!this._uiRafScheduled) {
      this._uiRafScheduled = true;
      requestAnimationFrame(() => this._flushUIUpdates());
    }
  }

  _flushUIUpdates() {
    this._uiRafScheduled = false;
    if (this._pendingSensorListData) {
      const key = this._pendingSensorListData
        .map(n => `${n.nodeId}|${n.status}|${n.temperature?.toFixed(0)}|${n.pressure?.toFixed(1)}`)
        .sort()
        .join(';');
      if (key !== this._lastSensorListKey) {
        this._lastSensorListKey = key;
        try { this._renderSensorList(this._pendingSensorListData); } catch (e) { console.error(e); }
      }
      this._pendingSensorListData = null;
    }
    if (this._pendingAlarmData !== null) {
      const key = this._pendingAlarmData
        .map(n => `${n.nodeId}|${n.status}|${n.temperature?.toFixed(0)}`)
        .join(';');
      if (key !== this._lastAlarmKey) {
        this._lastAlarmKey = key;
        try { this._renderAlarms(this._pendingAlarmData); } catch (e) { console.error(e); }
      }
      this._pendingAlarmData = null;
    }
  }

  _renderSensorList(sensorData) {
    const list = document.getElementById('sensor-list');
    if (!list) return;
    const items = sensorData.slice().sort((a, b) => {
      const rank = { NORMAL: 0, WARNING: 1, ALARM: 2 };
      return (rank[b.status] || 0) - (rank[a.status] || 0);
    });

    const frag = document.createDocumentFragment();
    for (let i = 0; i < items.length; i++) {
      const n = items[i];
      const tempColor = getHeatColor(n.temperature ?? 80);
      const div = document.createElement('div');
      div.className = `sensor-item status-${n.status || 'NORMAL'}`;
      div.dataset.nodeId = n.nodeId;
      div.innerHTML = `
        <div class="sensor-name">
          ${n.nodeName || n.nodeId}
          <span class="sensor-badge badge-${n.status || 'NORMAL'}">${this._getStatusLabel(n.status)}</span>
        </div>
        <div class="sensor-metrics">
          <span class="metric-temp">🌡 ${n.temperature?.toFixed(1) ?? '--'}°C</span>
          <span class="metric-pressure">🔵 ${n.pressure?.toFixed(2) ?? '--'} MPa</span>
        </div>
      `;
      frag.appendChild(div);
    }

    const sensorDataRef = sensorData;
    frag.querySelectorAll('.sensor-item').forEach(el => {
      el.addEventListener('click', () => {
        const nodeId = el.dataset.nodeId;
        const node = sensorDataRef.find(n => n.nodeId === nodeId);
        if (node && node.positionX != null) {
          this._focusOnPosition(node.positionX, node.positionY, node.positionZ);
        }
      });
    });

    list.replaceChildren(frag);
  }

  _renderAlarms(issues) {
    const list = document.getElementById('alarm-list');
    if (!list) return;
    this.alarms = issues || [];
    if (!issues || issues.length === 0) {
      list.innerHTML = '<p class="no-alarm">✅ 系统运行正常，无报警</p>';
      return;
    }
    issues.sort((a, b) => {
      const rank = { ALARM: 0, WARNING: 1 };
      return (rank[a.status] ?? 2) - (rank[b.status] ?? 2);
    });

    const TEMP_WARN = 162;
    const TEMP_ALARM = 171;
    const PRESSURE_WARN = 2.7;
    const PRESSURE_ALARM = 2.85;

    const frag = document.createDocumentFragment();
    for (let i = 0; i < issues.length; i++) {
      const n = issues[i];
      const ts = n.lastUpdated ? new Date(n.lastUpdated).toLocaleTimeString('zh-CN') : new Date().toLocaleTimeString('zh-CN');
      const tempVal = n.temperature;
      const pressVal = n.pressure;

      let tempThreshold = n.status === 'ALARM' ? TEMP_ALARM : TEMP_WARN;
      let pressThreshold = n.status === 'ALARM' ? PRESSURE_ALARM : PRESSURE_WARN;
      const tempOver = tempVal != null && tempVal > tempThreshold;
      const pressOver = pressVal != null && pressVal > pressThreshold;

      const tempOverPct = tempOver ? (((tempVal - tempThreshold) / tempThreshold) * 100).toFixed(1) : null;
      const pressOverPct = pressOver ? (((pressVal - pressThreshold) / pressThreshold) * 100).toFixed(1) : null;

      const icon = n.status === 'ALARM' ? '🚨' : '⚠️';
      const label = n.status === 'ALARM' ? '报警' : '预警';

      const div = document.createElement('div');
      div.className = `alarm-item level-${n.status}`;
      div.dataset.nodeId = n.nodeId;
      if (n.pipeIndex != null) div.dataset.pipeIndex = String(n.pipeIndex);

      div.innerHTML = `
        <div class="alarm-head">
          <span class="alarm-icon">${icon}</span>
          <span class="alarm-title">${n.nodeName || n.nodeId}</span>
          <button class="alarm-focus-btn" title="在 3D 场景中定位">🎯 定位</button>
        </div>
        <div class="alarm-metrics">
          <span class="alarm-metric-temp ${tempOver ? 'over-limit' : ''}">
            🌡 ${tempVal?.toFixed(1) ?? '--'}°C
            ${tempOverPct != null ? `<span class="metric-overline">(阈值 ${tempThreshold}°C / +${tempOverPct}%)</span>` : ''}
          </span>
        </div>
        <div class="alarm-metrics">
          <span class="alarm-metric-pressure ${pressOver ? 'over-limit' : ''}">
            🔵 ${pressVal?.toFixed(2) ?? '--'} MPa
            ${pressOverPct != null ? `<span class="metric-overline">(阈值 ${pressThreshold}MPa / +${pressOverPct}%)</span>` : ''}
          </span>
        </div>
        <div class="alarm-time">⏱ ${ts} · ${label}级别</div>
      `;
      frag.appendChild(div);
    }

    const app = this;
    frag.querySelectorAll('.alarm-item').forEach(el => {
      const nodeId = el.dataset.nodeId;
      const pipeIndex = el.dataset.pipeIndex != null ? parseInt(el.dataset.pipeIndex, 10) : null;
      const focus = (e) => {
        if (e) e.stopPropagation();
        const node = issues.find(x => x.nodeId === nodeId);
        const pipeId = app._findPipeIdByNodeIdOrIndex(nodeId, pipeIndex);
        if (pipeId) {
          app.sceneManager.focusOnPipe(pipeId, node);
        } else if (node && node.positionX != null) {
          app._focusOnPosition(node.positionX, node.positionY, node.positionZ);
        }
      };
      el.addEventListener('click', focus);
      const btn = el.querySelector('.alarm-focus-btn');
      if (btn) btn.addEventListener('click', focus);
    });

    list.replaceChildren(frag);
  }

  _findPipeIdByNodeIdOrIndex(nodeId, pipeIndex) {
    const mgr = this.sceneManager;
    if (mgr.pipeMeshes.has(nodeId)) return nodeId;
    if (pipeIndex != null) {
      for (const [pipeId, group] of mgr.pipeMeshes.entries()) {
        if (group.userData.sensorNode?.pipeIndex === pipeIndex) {
          return pipeId;
        }
      }
    }
    return null;
  }

  _updateConnectionStatus(ok, timestamp) {
    const statusEl = document.getElementById('conn-status');
    const lastUpdateEl = document.getElementById('last-update');
    if (statusEl) {
      statusEl.textContent = ok ? '已连接' : '连接失败';
      statusEl.classList.toggle('status-ok', ok);
      statusEl.classList.toggle('status-error', !ok);
    }
    if (lastUpdateEl && timestamp) {
      lastUpdateEl.textContent = new Date(timestamp).toLocaleString('zh-CN');
    }
  }

  _focusOnPosition(x, y, z) {
    if (!this.sceneManager) return;
    const cam = this.sceneManager.camera;
    const target = this.sceneManager.controls.target;

    const startCam = cam.position.clone();
    const startTarget = target.clone();
    const endTarget = new (Object.getPrototypeOf(target).constructor)(x, y, z);
    const offset = new (Object.getPrototypeOf(cam.position).constructor)(5, 5, 7);
    const endCam = endTarget.clone().add(offset);

    const duration = 800;
    const startTime = performance.now();
    const animate = () => {
      const t = Math.min(1, (performance.now() - startTime) / duration);
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      cam.position.lerpVectors(startCam, endCam, ease);
      target.lerpVectors(startTarget, endTarget, ease);
      this.sceneManager.controls.update();
      if (t < 1) requestAnimationFrame(animate);
    };
    animate();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__app = new App();
});

window.addEventListener('beforeunload', () => {
  cancelPendingRequest();
  if (window.__app) {
    window.__app._clearPollTimer();
    window.__app.paused = true;
  }
});
