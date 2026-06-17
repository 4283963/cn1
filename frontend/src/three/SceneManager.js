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
    const flange2 = flange1.clone();
    const f1Pos = startVec.clone().add(dirNorm.clone().multiplyScalar(radius * 0.3));
    const f2Pos = endVec.clone().sub(dirNorm.clone().multiplyScalar(radius * 0.3));
    const localF1 = group.worldToLocal(f1Pos.clone());
    const localF2 = group.worldToLocal(f2Pos.clone());
    flange1.position.copy(localF1);
    flange2.position.copy(localF2);
    group.add(flange1);
    group.add(flange2);

    for (let i = 0; i < 6; i++) {
      const boltAngle = (i / 6) * Math.PI * 2;
      const boltGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8);
      const boltMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
      const boltPos = new THREE.Vector3(
        Math.cos(boltAngle) * radius * 1.2,
        0,
        Math.sin(boltAngle) * radius * 1.2
      );
      [flange1, flange2].forEach((f, fi) => {
        const bolt = new THREE.Mesh(boltGeo, boltMat);
        bolt.position.copy(boltPos);
        bolt.rotation.x = Math.PI / 2;
        f.add(bolt);
      });
    }

    const glowGeo = new THREE.TorusGeometry(radius * 1.1, 0.02, 8, 24);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x60a5fa,
      transparent: true,
      opacity: 0,
    });
    const glowRing = new THREE.Mesh(glowGeo, glowMat);
    glowRing.position.y = length * 0.25;
    group.userData.glowRing = glowRing;
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
    sensorNodes.forEach(node => {
      if (node.pipeIndex != null) {
        if (!nodesByPipeIndex.has(node.pipeIndex)) {
          nodesByPipeIndex.set(node.pipeIndex, []);
        }
        nodesByPipeIndex.get(node.pipeIndex).push(node);
      }
    });

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
        const color = getHeatColor(temp);
        this._applyHeatColorToGroup(group, color, temp);
      }
    });
  }

  _applyHeatColorToGroup(group, colorHex, temperature) {
    const t = (temperature - 40) / (180 - 40);
    const emissiveIntensity = 0.08 + t * 0.35;

    group.traverse((child) => {
      if (child.isMesh && child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(mat => {
          if (child.name === 'sensorMarker') return;
          if (mat.color) {
            const targetColor = new THREE.Color(colorHex);
            mat.color.lerp(targetColor, 0.85);
          }
          if (mat.emissive && !mat.userData._origEmissive) {
            const emissiveColor = new THREE.Color(colorHex);
            mat.emissive.lerp(emissiveColor, 0.7);
            mat.emissiveIntensity = emissiveIntensity;
          }
          if (mat.opacity !== undefined) {
            if (group.userData.glowRing === child) {
              mat.opacity = 0.1 + t * 0.5;
              mat.color = new THREE.Color(colorHex);
            }
          }
        });
      }
    });
  }

  updateBoilerTemperatures(sensorNodes) {
    const boilers = sensorNodes.filter(n => n.nodeType === 'BOILER');
    boilers.forEach(node => {
      const group = this.boilerMeshes.get(node.nodeId);
      if (group && node.temperature != null) {
        const color = getHeatColor(node.temperature);
        const t = (node.temperature - 40) / (180 - 40);
        group.traverse((child) => {
          if (child.isMesh && child.material && child.material.emissive) {
            if (!child.material.userData._origEmissive) {
              child.material.emissive = new THREE.Color(color);
              child.material.emissiveIntensity = 0.05 + t * 0.3;
            }
          }
        });
        group.userData.sensorNode = node;
      }
    });
  }

  updateSensorMarkers(sensorNodes) {
    sensorNodes.forEach(node => {
      const group = this.nodeUserDataMap.get(node.nodeId);
      if (!group) return;
      group.userData.sensorNode = node;

      const temp = node.temperature;
      if (temp != null) {
        const color = getHeatColor(temp);
        group.traverse((child) => {
          if (child.name === 'sensorMarker' && child.material) {
            child.material.color = new THREE.Color(color);
            child.material.emissive = new THREE.Color(color);
            child.material.emissiveIntensity = 0.4 + ((temp - 40) / 140) * 0.4;
          }
          if (child.material && child.material.color && child.geometry && child.geometry.type === 'RingGeometry') {
            child.material.color = new THREE.Color(color);
            child.material.opacity = 0.3 + ((temp - 40) / 140) * 0.5;
          }
        });
      }
    });
  }

  updateValveStatus(sensorNodes) {
    const valves = sensorNodes.filter(n => n.nodeType === 'VALVE');
    valves.forEach(node => {
      const group = this.valveMeshes.get(node.nodeId);
      if (group) {
        group.userData.sensorNode = node;
        if (node.temperature != null) {
          const color = getHeatColor(node.temperature);
          group.traverse((child) => {
            if (child.isMesh && child.material && child.material.color && child.material.emissive !== undefined) {
              if (!child.material.userData._origEmissive) {
                child.material.emissive = new THREE.Color(color);
                child.material.emissiveIntensity = 0.1;
              }
            }
          });
        }
      }
    });
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
