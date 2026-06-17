import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getHeatColor } from '../utils/heatColor.js';

export class SceneManager {
  constructor(container) {
    this.container = container;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.pickableObjects = [];
    this.pipeMeshes = new Map();
    this.boilerMeshes = new Map();
    this.valveMeshes = new Map();
    this.nodeUserDataMap = new Map();
    this.autoRotate = false;
    this.hoveredObject = null;
    this.onHoverCallback = null;
    this.onClickCallback = null;
    this.clock = new THREE.Clock();
    this._sharedPipeColor = new THREE.Color();
    this._sharedHeatColor = new THREE.Color();
    this._pendingVisualUpdates = [];
    this._rafScheduled = false;

    this._init();
    this._createLighting();
    this._createGroundAndGrid();
    this._setupControls();
    this._setupEventListeners();
    this._animate();
  }

  _init() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020617);
    this.scene.fog = new THREE.Fog(0x020617, 25, 60);

    this.camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 200);
    this.camera.position.set(10, 12, 18);
    this.camera.lookAt(3, 2, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;

    this.container.appendChild(this.renderer.domElement);

    window.addEventListener('resize', () => this._onResize());
  }

  _createLighting() {
    const ambientLight = new THREE.AmbientLight(0x64748b, 0.6);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x60a5fa, 0x1e293b, 0.4);
    this.scene.add(hemiLight);

    const mainLight = new THREE.DirectionalLight(0xfff1e0, 1.1);
    mainLight.position.set(8, 20, 10);
    mainLight.castShadow = true;
    mainLight.shadow.mapSize.width = 2048;
    mainLight.shadow.mapSize.height = 2048;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 60;
    mainLight.shadow.camera.left = -20;
    mainLight.shadow.camera.right = 20;
    mainLight.shadow.camera.top = 20;
    mainLight.shadow.camera.bottom = -20;
    mainLight.shadow.bias = -0.0005;
    this.scene.add(mainLight);

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.4);
    fillLight.position.set(-10, 8, -6);
    this.scene.add(fillLight);

    const pointLight1 = new THREE.PointLight(0xf97316, 0.8, 15, 2);
    pointLight1.position.set(0, 3, 0);
    this.scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xf97316, 0.8, 15, 2);
    pointLight2.position.set(8, 3, 0);
    this.scene.add(pointLight2);

    this.boilerLights = [pointLight1, pointLight2];
  }

  _createGroundAndGrid() {
    const groundGeo = new THREE.PlaneGeometry(40, 30);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);

    const gridHelper = new THREE.GridHelper(40, 40, 0x334155, 0x1e293b);
    gridHelper.position.y = 0;
    this.scene.add(gridHelper);

    const floorLinesGeo = new THREE.PlaneGeometry(30, 22);
    const floorLinesMat = new THREE.MeshBasicMaterial({
      color: 0x0f172a,
      transparent: true,
      opacity: 0.6,
    });
    const floorLines = new THREE.Mesh(floorLinesGeo, floorLinesMat);
    floorLines.rotation.x = -Math.PI / 2;
    floorLines.position.set(3, 0.001, 0);
    this.scene.add(floorLines);
  }

  _setupControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 45;
    this.controls.maxPolarAngle = Math.PI / 2.05;
    this.controls.target.set(3, 2, 0);
    this.controls.autoRotateSpeed = 0.8;
  }

  _setupEventListeners() {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    canvas.addEventListener('click', (e) => this._onClick(e));
    canvas.addEventListener('mouseleave', () => {
      this._clearHover();
    });
  }

  _onMouseMove(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this._updateRaycast(event);
  }

  _onClick(event) {
    if (this.hoveredObject && this.onClickCallback) {
      this.onClickCallback(this.hoveredObject.userData.sensorNode);
    }
  }

  _updateRaycast(event) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(this.pickableObjects, true);

    if (intersects.length > 0) {
      const obj = intersects[0].object;
      const sensorNode = this._findSensorNodeData(obj);
      if (sensorNode) {
        if (this.hoveredObject !== obj) {
          this._clearHover();
          this.hoveredObject = obj;
          this._setEmissive(obj, 0x60a5fa, 0.5);
          this.renderer.domElement.style.cursor = 'pointer';
        }
        if (this.onHoverCallback) {
          this.onHoverCallback(sensorNode, event);
        }
        return;
      }
    }
    this._clearHover();
  }

  _findSensorNodeData(obj) {
    let current = obj;
    while (current) {
      if (current.userData && current.userData.sensorNode) {
        return current.userData.sensorNode;
      }
      current = current.parent;
    }
    return null;
  }

  _setEmissive(obj, color, intensity) {
    let current = obj;
    while (current) {
      if (current.isMesh && current.material) {
        const mats = Array.isArray(current.material) ? current.material : [current.material];
        mats.forEach(m => {
          if (m.emissive) {
            m.userData._origEmissive = m.userData._origEmissive || m.emissive.clone();
            m.userData._origEmissiveIntensity = m.userData._origEmissiveIntensity ?? m.emissiveIntensity;
            m.emissive.setHex(color);
            m.emissiveIntensity = intensity;
          }
        });
      }
      current = current.parent;
    }
  }

  _restoreEmissive(obj) {
    let current = obj;
    while (current) {
      if (current.isMesh && current.material) {
        const mats = Array.isArray(current.material) ? current.material : [current.material];
        mats.forEach(m => {
          if (m.emissive && m.userData._origEmissive) {
            m.emissive.copy(m.userData._origEmissive);
            m.emissiveIntensity = m.userData._origEmissiveIntensity;
          }
        });
      }
      current = current.parent;
    }
  }

  _clearHover() {
    if (this.hoveredObject) {
      this._restoreEmissive(this.hoveredObject);
      this.hoveredObject = null;
      this.renderer.domElement.style.cursor = 'default';
    }
    if (this.onHoverCallback) {
      this.onHoverCallback(null, null);
    }
  }

  _onResize() {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  _animate() {
    const animateFn = () => {
      requestAnimationFrame(animateFn);
      const delta = this.clock.getDelta();

      this.controls.autoRotate = this.autoRotate;
      this.controls.update();

      this._animateBoilerLights(delta);
      this._animatePipes(delta);

      this.renderer.render(this.scene, this.camera);
    };
    animateFn();
  }

  _animateBoilerLights(delta) {
    const time = this.clock.elapsedTime;
    this.boilerLights.forEach((light, i) => {
      light.intensity = 0.6 + Math.sin(time * 2 + i) * 0.3;
    });
  }

  _animatePipes(delta) {
    const time = this.clock.elapsedTime;
    this.pipeMeshes.forEach((group) => {
      if (group.userData.glowRing) {
        group.userData.glowRing.rotation.x = time * 2;
      }
    });
  }

  createBoiler(position, id, sensorData) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.userData.sensorNode = sensorData;

    const bodyR = 1.5;
    const bodyH = 3.2;
    const bodyGeo = new THREE.CylinderGeometry(bodyR, bodyR * 1.1, bodyH, 32, 1, false);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.75,
      roughness: 0.35,
      emissive: 0xf97316,
      emissiveIntensity: 0.1,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = bodyH / 2 + 0.3;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const skirtGeo = new THREE.CylinderGeometry(bodyR * 1.15, bodyR * 1.25, 0.4, 32);
    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.8,
      roughness: 0.3,
    });
    const skirt = new THREE.Mesh(skirtGeo, skirtMat);
    skirt.position.y = 0.2;
    skirt.castShadow = true;
    skirt.receiveShadow = true;
    group.add(skirt);

    const baseGeo = new THREE.CylinderGeometry(bodyR * 1.3, bodyR * 1.35, 0.15, 32);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.6,
      roughness: 0.6,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.075;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const topDomeGeo = new THREE.SphereGeometry(bodyR * 0.95, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const topDome = new THREE.Mesh(topDomeGeo, bodyMat);
    topDome.position.y = bodyH + 0.3;
    topDome.castShadow = true;
    topDome.receiveShadow = true;
    group.add(topDome);

    const chimneyGeo = new THREE.CylinderGeometry(0.25, 0.3, 2, 16);
    const chimneyMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.8,
      roughness: 0.3,
    });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(0, bodyH + 1.5, 0);
    chimney.castShadow = true;
    group.add(chimney);

    const chimneyCapGeo = new THREE.CylinderGeometry(0.35, 0.25, 0.1, 16);
    const chimneyCap = new THREE.Mesh(chimneyCapGeo, chimneyMat);
    chimneyCap.position.y = bodyH + 2.55;
    group.add(chimneyCap);

    const ringColors = [0xef4444, 0xf97316, 0xeab308, 0x22c55e, 0x3b82f6];
    for (let i = 0; i < 4; i++) {
      const ringGeo = new THREE.TorusGeometry(bodyR + 0.03, 0.04, 12, 48);
      const ringMat = new THREE.MeshStandardMaterial({
        color: ringColors[i % ringColors.length],
        metalness: 0.5,
        roughness: 0.4,
        emissive: ringColors[i % ringColors.length],
        emissiveIntensity: 0.15,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 1 + i * 0.75;
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
    }

    const windowCount = 4;
    for (let i = 0; i < windowCount; i++) {
      const angle = (i / windowCount) * Math.PI * 2;
      const windowGeo = new THREE.PlaneGeometry(0.35, 0.5);
      const windowMat = new THREE.MeshBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      });
      const windowMesh = new THREE.Mesh(windowGeo, windowMat);
      const wx = Math.sin(angle) * (bodyR + 0.01);
      const wz = Math.cos(angle) * (bodyR + 0.01);
      windowMesh.position.set(wx, 1.9, wz);
      windowMesh.rotation.y = angle;
      group.add(windowMesh);
    }

    this.boilerMeshes.set(id, group);
    this.scene.add(group);
    this.pickableObjects.push(group);
    return group;
  }

  createPipe(start, end, id, pipeIndex, radius = 0.22, sensorData = null) {
    const group = new THREE.Group();
    group.userData.sensorNode = sensorData || { nodeId: id, nodeName: id, pipeIndex };
    group.userData._heatTargets = [];
    group.userData._lastAppliedTemp = -1;

    const startVec = new THREE.Vector3(...(Array.isArray(start) ? start : [start.x, start.y, start.z]));
    const endVec = new THREE.Vector3(...(Array.isArray(end) ? end : [end.x, end.y, end.z]));
    const direction = new THREE.Vector3().subVectors(endVec, startVec);
    const length = direction.length();
    const midPoint = new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5);

    const pipeGeo = new THREE.CylinderGeometry(radius, radius, length, 24, 4, false);
    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.8,
      roughness: 0.28,
      emissive: 0xef4444,
      emissiveIntensity: 0.08,
    });
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    pipe.castShadow = true;
    pipe.receiveShadow = true;
    group.add(pipe);
    group.userData._heatTargets.push(pipeMat);

    group.position.copy(midPoint);
    const axis = new THREE.Vector3(0, 1, 0);
    const dirNorm = direction.clone().normalize();
    const quaternion = new THREE.Quaternion().setFromUnitVectors(axis, dirNorm);
    group.quaternion.copy(quaternion);

    const flangeGeo = new THREE.CylinderGeometry(radius * 1.5, radius * 1.5, 0.08, 24);
    const flangeMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.85,
      roughness: 0.25,
    });
    const flange1 = new THREE.Mesh(flangeGeo, flangeMat);
    flange1.castShadow = true;
    const flange2 = new THREE.Mesh(flangeGeo, flangeMat.clone());
    const f1Pos = startVec.clone().add(dirNorm.clone().multiplyScalar(radius * 0.3));
    const f2Pos = endVec.clone().sub(dirNorm.clone().multiplyScalar(radius * 0.3));
    const localF1 = group.worldToLocal(f1Pos.clone());
    const localF2 = group.worldToLocal(f2Pos.clone());
    flange1.position.copy(localF1);
    flange2.position.copy(localF2);
    group.add(flange1);
    group.add(flange2);
    group.userData._heatTargets.push(flangeMat, flange2.material);

    const glowGeo = new THREE.TorusGeometry(radius * 1.1, 0.02, 8, 24);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0,
    });
    const glowRing = new THREE.Mesh(glowGeo, glowMat);
    glowRing.position.y = length * 0.25;
    group.userData.glowRing = glowRing;
    group.userData._glowMat = glowMat;
    group.add(glowRing);

    this.pipeMeshes.set(id, group);
    this.scene.add(group);
    this.pickableObjects.push(group);
    return group;
  }

  createValve(position, id, sensorData = null) {
    const group = new THREE.Group();
    group.position.copy(new THREE.Vector3(position.x, position.y, position.z));
    group.userData.sensorNode = sensorData;

    const bodyGeo = new THREE.SphereGeometry(0.28, 24, 16);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.85,
      roughness: 0.25,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const handleGeo = new THREE.TorusGeometry(0.22, 0.03, 10, 24);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      metalness: 0.7,
      roughness: 0.3,
    });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = 0.35;
    handle.castShadow = true;
    group.add(handle);

    const stemGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 12);
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.9,
      roughness: 0.2,
    });
    const stem = new THREE.Mesh(stemGeo, stemMat);
    stem.position.y = 0.18;
    group.add(stem);

    this.valveMeshes.set(id, group);
    this.scene.add(group);
    this.pickableObjects.push(group);
    return group;
  }

  createSensorMarker(position, id, sensorData = null) {
    const group = new THREE.Group();
    group.position.copy(new THREE.Vector3(position.x, position.y, position.z));
    group.userData.sensorNode = sensorData;

    const markerGeo = new THREE.OctahedronGeometry(0.12, 0);
    const markerMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 0.4,
      metalness: 0.5,
      roughness: 0.3,
    });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.castShadow = true;
    marker.name = 'sensorMarker';
    group.add(marker);

    const haloGeo = new THREE.RingGeometry(0.15, 0.18, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = -0.1;
    group.add(halo);

    this.nodeUserDataMap.set(id, group);
    this.scene.add(group);
    this.pickableObjects.push(group);
    return group;
  }

  updatePipeColors(sensorNodes) {
    const nodesByPipeIndex = new Map();
    for (let i = 0; i < sensorNodes.length; i++) {
      const node = sensorNodes[i];
      if (node.pipeIndex != null && node.temperature != null) {
        if (!nodesByPipeIndex.has(node.pipeIndex)) nodesByPipeIndex.set(node.pipeIndex, []);
        nodesByPipeIndex.get(node.pipeIndex).push(node);
      }
    }

    const TEMP_THRESHOLD = 0.8;

    this.pipeMeshes.forEach((group, pipeId) => {
      let temp = null;
      if (group.userData.sensorNode && group.userData.sensorNode.temperature != null) {
        temp = group.userData.sensorNode.temperature;
      }
      const matchingNode = sensorNodes.find(n => n.nodeId === pipeId);
      if (matchingNode && matchingNode.temperature != null) {
        temp = matchingNode.temperature;
        group.userData.sensorNode = matchingNode;
      }

      if (temp != null) {
        const last = group.userData._lastAppliedTemp;
        if (last === -1 || Math.abs(temp - last) >= TEMP_THRESHOLD) {
          group.userData._lastAppliedTemp = temp;
          this._scheduleVisualUpdate(() => this._applyPipeHeatColorFast(group, temp));
        }
      }
    });
  }

  _applyPipeHeatColorFast(group, temperature) {
    const t = Math.max(0, Math.min(1, (temperature - 40) / (180 - 40)));
    const colorHex = getHeatColor(temperature);
    const targetColor = this._sharedPipeColor.set(colorHex);
    const emissiveIntensity = 0.08 + t * 0.35;

    const targets = group.userData._heatTargets || [];
    for (let i = 0; i < targets.length; i++) {
      const mat = targets[i];
      if (!mat) continue;
      if (mat.color) mat.color.lerp(targetColor, 0.85);
      if (mat.emissive && !mat.userData._origEmissive) {
        mat.emissive.lerp(targetColor, 0.7);
        mat.emissiveIntensity = emissiveIntensity;
      }
      mat.needsUpdate = false;
    }
    const glowMat = group.userData._glowMat;
    if (glowMat) {
      glowMat.color.copy(targetColor);
      glowMat.opacity = 0.1 + t * 0.5;
    }
  }

  _scheduleVisualUpdate(fn) {
    this._pendingVisualUpdates.push(fn);
    if (!this._rafScheduled) {
      this._rafScheduled = true;
      requestAnimationFrame(() => this._flushVisualUpdates());
    }
  }

  _flushVisualUpdates() {
    this._rafScheduled = false;
    const tasks = this._pendingVisualUpdates;
    if (tasks.length === 0) return;
    this._pendingVisualUpdates = [];
    for (let i = 0; i < tasks.length; i++) {
      try { tasks[i](); } catch (e) { console.error(e); }
    }
  }

  updateBoilerTemperatures(sensorNodes) {
    for (let i = 0; i < sensorNodes.length; i++) {
      const node = sensorNodes[i];
      if (node.nodeType !== 'BOILER' || node.temperature == null) continue;
      const group = this.boilerMeshes.get(node.nodeId);
      if (!group) continue;
      group.userData.sensorNode = node;
      const last = group.userData._lastAppliedTemp ?? -1;
      if (Math.abs(node.temperature - last) < 0.8) continue;
      group.userData._lastAppliedTemp = node.temperature;
      const temp = node.temperature;
      this._scheduleVisualUpdate(() => this._applyBoilerHeat(group, temp));
    }
  }

  _applyBoilerHeat(group, temperature) {
    const t = Math.max(0, Math.min(1, (temperature - 40) / (180 - 40)));
    const colorHex = getHeatColor(temperature);
    const c = this._sharedHeatColor.set(colorHex);
    const intensity = 0.05 + t * 0.3;
    if (!group.userData._bodyMats) {
      const mats = [];
      group.traverse((child) => {
        if (child.isMesh && child.material && child.material.emissive && !child.material.userData._origEmissive) {
          mats.push(Array.isArray(child.material) ? child.material : [child.material]);
        }
      });
      group.userData._bodyMats = mats.flat();
    }
    const mats = group.userData._bodyMats || [];
    for (let i = 0; i < mats.length; i++) {
      mats[i].emissive.lerp(c, 0.7);
      mats[i].emissiveIntensity = intensity;
    }
  }

  updateSensorMarkers(sensorNodes) {
    for (let i = 0; i < sensorNodes.length; i++) {
      const node = sensorNodes[i];
      const group = this.nodeUserDataMap.get(node.nodeId);
      if (!group || node.temperature == null) continue;
      group.userData.sensorNode = node;
      const last = group.userData._lastAppliedTemp ?? -1;
      if (Math.abs(node.temperature - last) < 1.0) continue;
      group.userData._lastAppliedTemp = node.temperature;
      const temp = node.temperature;
      this._scheduleVisualUpdate(() => this._applyMarkerHeat(group, temp));
    }
  }

  _applyMarkerHeat(group, temperature) {
    if (!group.userData._refs) {
      const refs = {};
      group.traverse((child) => {
        if (child.name === 'sensorMarker') refs.marker = child;
        if (child.geometry && child.geometry.type === 'RingGeometry') refs.halo = child;
      });
      group.userData._refs = refs;
    }
    const { marker, halo } = group.userData._refs;
    const colorHex = getHeatColor(temperature);
    const c = this._sharedHeatColor.set(colorHex);
    const t = Math.max(0, Math.min(1, (temperature - 40) / (180 - 40)));
    if (marker && marker.material) {
      marker.material.color.copy(c);
      marker.material.emissive.copy(c);
      marker.material.emissiveIntensity = 0.4 + t * 0.4;
    }
    if (halo && halo.material) {
      halo.material.color.copy(c);
      halo.material.opacity = 0.3 + t * 0.5;
    }
  }

  updateValveStatus(sensorNodes) {
    for (let i = 0; i < sensorNodes.length; i++) {
      const node = sensorNodes[i];
      if (node.nodeType !== 'VALVE' || node.temperature == null) continue;
      const group = this.valveMeshes.get(node.nodeId);
      if (!group) continue;
      group.userData.sensorNode = node;
      const last = group.userData._lastAppliedTemp ?? -1;
      if (Math.abs(node.temperature - last) < 1.0) continue;
      group.userData._lastAppliedTemp = node.temperature;
      const temp = node.temperature;
      this._scheduleVisualUpdate(() => this._applyValveHeat(group, temp));
    }
  }

  _applyValveHeat(group, temperature) {
    if (!group.userData._valveMats) {
      const mats = [];
      group.traverse((child) => {
        if (child.isMesh && child.material && child.material.emissive !== undefined && !child.material.userData._origEmissive) {
          mats.push(child.material);
        }
      });
      group.userData._valveMats = mats;
    }
    const colorHex = getHeatColor(temperature);
    const c = this._sharedHeatColor.set(colorHex);
    const mats = group.userData._valveMats || [];
    for (let i = 0; i < mats.length; i++) {
      mats[i].emissive.lerp(c, 0.7);
      mats[i].emissiveIntensity = 0.1;
    }
  }

  setAutoRotate(enabled) {
    this.autoRotate = enabled;
  }

  setOnHoverCallback(cb) {
    this.onHoverCallback = cb;
  }

  setOnClickCallback(cb) {
    this.onClickCallback = cb;
  }

  resetCamera() {
    this.camera.position.set(10, 12, 18);
    this.controls.target.set(3, 2, 0);
    this.controls.update();
  }
}
