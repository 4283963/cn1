import { SceneManager } from './three/SceneManager.js';
import { fetchAllSensors } from './api/client.js';
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
    this.pollInterval = 2000;
    this.pollTimer = null;
    this.paused = false;
    this.alarms = [];

    this._init();
  }

  _init() {
    const container = document.getElementById('canvas-container');
    this.sceneManager = new SceneManager(container);

    this._buildScene();
    this._bindUIEvents();
    this._setupTooltip();
    this._startPolling();

    setTimeout(() => this._fetchAndUpdate(), 300);
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
        if (!this.paused) {
          this._stopPolling();
          this._startPolling();
        }
      }
    });

    const pauseBtn = document.getElementById('btn-pause');
    pauseBtn.addEventListener('click', () => {
      this.paused = !this.paused;
      if (this.paused) {
        this._stopPolling();
        pauseBtn.textContent = '▶ 继续更新';
        pauseBtn.classList.add('active');
      } else {
        pauseBtn.textContent = '⏸ 暂停更新';
        pauseBtn.classList.remove('active');
        this._startPolling();
        this._fetchAndUpdate();
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

  _startPolling() {
    if (this.pollTimer) return;
    this._fetchAndUpdate();
    this.pollTimer = setInterval(() => {
      if (!this.paused) this._fetchAndUpdate();
    }, this.pollInterval);
  }

  _stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async _fetchAndUpdate() {
    try {
      const response = await fetchAllSensors();
      if (response && response.code === 200 && response.data) {
        this.sensorData = response.data;
        this._updateScene(this.sensorData);
        this._updateSensorList(this.sensorData);
        this._updateAlarms(this.sensorData);
        this._updateConnectionStatus(true, response.timestamp);
      }
    } catch (err) {
      console.warn('Poll failed:', err);
      this._updateConnectionStatus(false, Date.now());
    }
  }

  _updateScene(sensorData) {
    this._assignTemperaturesToPipes(sensorData);
    this.sceneManager.updatePipeColors(sensorData);
    this.sceneManager.updateBoilerTemperatures(sensorData);
    this.sceneManager.updateValveStatus(sensorData);

    sensorData.forEach(node => {
      const pos = {
        x: node.positionX ?? 0,
        y: node.positionY ?? 0,
        z: node.positionZ ?? 0,
      };
      if (!this.sceneManager.nodeUserDataMap.has(node.nodeId)) {
        if (node.positionX != null) {
          this.sceneManager.createSensorMarker(pos, node.nodeId, node);
        }
      }
    });
    this.sceneManager.updateSensorMarkers(sensorData);
  }

  _assignTemperaturesToPipes(sensorData) {
    const pipeGroups = new Map();
    sensorData.forEach(node => {
      if (node.pipeIndex != null && node.temperature != null) {
        const idx = node.pipeIndex;
        if (!pipeGroups.has(idx)) pipeGroups.set(idx, []);
        pipeGroups.get(idx).push(node);
      }
    });

    this.sceneManager.pipeMeshes.forEach((group, pipeId) => {
      const pipeIdx = group.userData.sensorNode?.pipeIndex;
      if (pipeIdx != null && pipeGroups.has(pipeIdx)) {
        const nodes = pipeGroups.get(pipeIdx);
        if (nodes.length > 0) {
          const avgTemp = nodes.reduce((s, n) => s + n.temperature, 0) / nodes.length;
          const avgPressure = nodes.reduce((s, n) => s + (n.pressure || 0), 0) / nodes.length;
          const worstStatus = nodes.reduce((worst, n) => {
            const rank = { NORMAL: 0, WARNING: 1, ALARM: 2 };
            return rank[n.status] > rank[worst] ? n.status : worst;
          }, 'NORMAL');
          if (!group.userData.sensorNode) group.userData.sensorNode = {};
          group.userData.sensorNode.temperature = avgTemp;
          group.userData.sensorNode.pressure = avgPressure;
          group.userData.sensorNode.status = worstStatus;
          group.userData.sensorNode.nodeName = `管道#${pipeIdx}`;
        }
      }
    });
  }

  _updateSensorList(sensorData) {
    const list = document.getElementById('sensor-list');
    if (!list) return;
    const items = sensorData.slice().sort((a, b) => {
      const rank = { NORMAL: 0, WARNING: 1, ALARM: 2 };
      return (rank[b.status] || 0) - (rank[a.status] || 0);
    });
    list.innerHTML = items.map(n => {
      const tempColor = getHeatColor(n.temperature ?? 80);
      return `
        <div class="sensor-item status-${n.status || 'NORMAL'}" data-node-id="${n.nodeId}">
          <div class="sensor-name">
            ${n.nodeName || n.nodeId}
            <span class="sensor-badge badge-${n.status || 'NORMAL'}">${this._getStatusLabel(n.status)}</span>
          </div>
          <div class="sensor-metrics">
            <span class="metric-temp">🌡 ${n.temperature?.toFixed(1) ?? '--'}°C</span>
            <span class="metric-pressure">🔵 ${n.pressure?.toFixed(2) ?? '--'} MPa</span>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.sensor-item').forEach(el => {
      el.addEventListener('click', () => {
        const nodeId = el.dataset.nodeId;
        const node = sensorData.find(n => n.nodeId === nodeId);
        if (node && node.positionX != null) {
          this._focusOnPosition(node.positionX, node.positionY, node.positionZ);
        }
      });
    });
  }

  _updateAlarms(sensorData) {
    const issues = sensorData.filter(n => n.status === 'WARNING' || n.status === 'ALARM');
    const list = document.getElementById('alarm-list');
    if (!list) return;
    if (issues.length === 0) {
      this.alarms = [];
      list.innerHTML = '<p class="no-alarm">暂无报警</p>';
      return;
    }
    issues.sort((a, b) => {
      const rank = { ALARM: 0, WARNING: 1 };
      return (rank[a.status] ?? 2) - (rank[b.status] ?? 2);
    });
    list.innerHTML = issues.map(n => {
      const ts = n.lastUpdated ? new Date(n.lastUpdated).toLocaleTimeString('zh-CN') : new Date().toLocaleTimeString('zh-CN');
      const msg = n.status === 'ALARM'
        ? `【报警】${n.nodeName || n.nodeId} 参数异常 (${n.temperature?.toFixed(1)}°C / ${n.pressure?.toFixed(2)}MPa)`
        : `【预警】${n.nodeName || n.nodeId} 参数接近阈值 (${n.temperature?.toFixed(1)}°C / ${n.pressure?.toFixed(2)}MPa)`;
      return `
        <div class="alarm-item level-${n.status}">
          <div class="alarm-text">${msg}</div>
          <div class="alarm-time">⏱ ${ts}</div>
        </div>
      `;
    }).join('');
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
