// ============================================================
// rendering/SceneBuilder.ts
//
// Coordinate remap — physics internal vs Three.js world space:
//   Physics [x, y, z]  →  Three.js (x, z, -y)
//   (physics Z=up maps to Three.js Y=up)
// ============================================================

import * as THREE from 'three';
import type { Vec3 } from '@/types';
import { COLORS, TRAIL_MAX_POINTS, BALL_RADIUS, SPIKE_DISPLAY_FRAMES } from '@/constants/defaults';

export interface SceneObjects {
  trueBall:       THREE.Mesh;
  kalmanBall:     THREE.Mesh;
  sensorMarker:   THREE.Mesh;
  spikeMarker:    THREE.Group;   // persistent orange outlier indicator
  trueTrail:      THREE.Line;
  kalmanTrail:    THREE.Line;
  forecastLine:   THREE.Line;
  boxWireframe:   THREE.LineSegments;
  gridHelper:     THREE.GridHelper;
  floorMesh:      THREE.Mesh;
}

/** Physics [x,y,z] → Three.js Vector3 */
function toThree(p: Vec3): THREE.Vector3 {
  return new THREE.Vector3(p[0], p[2], -p[1]);
}
function t3(p: Vec3): [number, number, number] {
  return [p[0], p[2], -p[1]];
}

export class SceneBuilder {
  public readonly scene:    THREE.Scene;
  public readonly camera:   THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;

  private objects!: SceneObjects;
  private truePoints:    THREE.Vector3[] = [];
  private kalmanPoints:  THREE.Vector3[] = [];
  // Pre-allocated position buffers for dynamic trail update
  private _trueBuf!:    THREE.BufferAttribute;
  private _kalmanBuf!:  THREE.BufferAttribute;
  
  // Spike persistent display state
  private _spikeFramesLeft = 0;

  // Camera orbit
  private _theta = 0.65;
  private _phi   = 1.05;
  private _radius = 50;
  private _isDragging = false;
  private _lastMouse  = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.ambient);
    this.scene.fog = new THREE.FogExp2(COLORS.ambient, 0.007);

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    this._syncCamera();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled   = true;
    this.renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this._buildScene();
    this._attachOrbitListeners(canvas);
  }

  // ── Coordinate helper ──────────────────────────────────────
  private _setPos(obj: THREE.Object3D, p: Vec3): void {
    obj.position.set(...t3(p));
  }

  // ── Scene construction ─────────────────────────────────────
  private _buildScene(): void {
    const BS = 20;

    // Lights
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(22, 35, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 120;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -20;
    sun.shadow.camera.right = sun.shadow.camera.top   =  20;
    sun.shadow.bias = -0.001;
    this.scene.add(sun);
    const fill = new THREE.PointLight(0x38bdf8, 0.8, 90);
    fill.position.set(-18, 8, -15);
    this.scene.add(fill);
    this.scene.add(new THREE.HemisphereLight(0x1e3a5f, 0x0b1426, 0.5));

    // Box wireframe
    const boxGeo = new THREE.BoxGeometry(BS, BS, BS);
    const boxWireframe = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeo),
      new THREE.LineBasicMaterial({ color: COLORS.boxEdge, transparent: true, opacity: 0.65 }),
    );
    this.scene.add(boxWireframe);
    this.scene.add(new THREE.Mesh(boxGeo,
      new THREE.MeshBasicMaterial({ color: 0x0d2035, transparent: true, opacity: 0.10, side: THREE.BackSide }),
    ));

    // Floor
    const gridHelper = new THREE.GridHelper(BS, 12, 0x1a3a5c, 0x152c47);
    gridHelper.position.y = -BS / 2;
    this.scene.add(gridHelper);
    const floorMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(BS, BS),
      new THREE.MeshStandardMaterial({ color: 0x0d2035, roughness: 0.85, metalness: 0.1, transparent: true, opacity: 0.55 }),
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -BS / 2 + 0.01;
    floorMesh.receiveShadow = true;
    this.scene.add(floorMesh);

    // ── True ball (green) ─────────────────────────────────────
    const trueBall = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 32, 32),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(COLORS.trueBall),
        roughness: 0.25, metalness: 0.15,
        emissive: new THREE.Color(COLORS.trueBall), emissiveIntensity: 0.3,
      }),
    );
    trueBall.castShadow = true;
    this.scene.add(trueBall);

    // ── Kalman ball (cyan) ────────────────────────────────────
    const kalmanBall = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 32, 32),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(COLORS.kalmanBall),
        roughness: 0.08, metalness: 0.35,
        transparent: true, opacity: 0.78,
        emissive: new THREE.Color(COLORS.kalmanBall), emissiveIntensity: 0.35,
      }),
    );
    kalmanBall.castShadow = true;
    this.scene.add(kalmanBall);

    // ── Sensor marker (red) ───────────────────────────────────
    // Rendered with depthTest:false so it's always visible through/over balls.
    // Slightly larger than BALL_RADIUS so it isn't fully hidden when co-located.
    const sensorMarkerMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(COLORS.sensorMarker),
      depthTest: false,           // always on top
      transparent: true,
      opacity: 0.92,
      wireframe: false,
    });
    const sensorMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(BALL_RADIUS * 0.55, 0),
      sensorMarkerMat,
    );
    sensorMarker.renderOrder = 999; // render last — over all opaque objects
    sensorMarker.visible = false;
    this.scene.add(sensorMarker);

    // ── Spike marker (orange, persistent, larger) ─────────────
    // A Group: solid octahedron + ring line to make it unmissable.
    const spikeGroup = new THREE.Group();
    spikeGroup.renderOrder = 1000;

    const spikeMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(BALL_RADIUS * 0.9, 0),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(COLORS.spikeMarker),
        depthTest: false,
        transparent: true,
        opacity: 0.95,
      }),
    );
    spikeMesh.renderOrder = 1000;
    spikeGroup.add(spikeMesh);

    // Crosshair ring (circle in XZ plane) to draw attention
    const ringPts: THREE.Vector3[] = [];
    const ringR = BALL_RADIUS * 2.2;
    for (let i = 0; i <= 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      ringPts.push(new THREE.Vector3(Math.cos(a) * ringR, 0, Math.sin(a) * ringR));
    }
    const ringGeo = new THREE.BufferGeometry().setFromPoints(ringPts);
    const ringLine = new THREE.Line(
      ringGeo,
      new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.spikeMarker), depthTest: false, transparent: true, opacity: 0.7 }),
    );
    ringLine.renderOrder = 1000;
    spikeGroup.add(ringLine);

    spikeGroup.visible = false;
    this.scene.add(spikeGroup);

    // ── Trails ────────────────────────────────────────────────
    const truePositions  = new Float32Array(TRAIL_MAX_POINTS * 3);
    const kalmanPositions = new Float32Array(TRAIL_MAX_POINTS * 3);

    const trueTrailGeo = new THREE.BufferGeometry();
    trueTrailGeo.setAttribute('position', new THREE.BufferAttribute(truePositions, 3).setUsage(THREE.DynamicDrawUsage));
    trueTrailGeo.setDrawRange(0, 0);
    const trueTrail = new THREE.Line(
      trueTrailGeo,
      new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.trueBall), transparent: true, opacity: 0.45 }),
    );
    trueTrail.frustumCulled = false;   // bounding sphere not updated every frame — disable culling
    this.scene.add(trueTrail);

    const kalmanTrailGeo = new THREE.BufferGeometry();
    kalmanTrailGeo.setAttribute('position', new THREE.BufferAttribute(kalmanPositions, 3).setUsage(THREE.DynamicDrawUsage));
    kalmanTrailGeo.setDrawRange(0, 0);
    const kalmanTrail = new THREE.Line(
      kalmanTrailGeo,
      new THREE.LineBasicMaterial({ color: new THREE.Color(COLORS.kalmanBall), transparent: true, opacity: 0.9 }),
    );
    kalmanTrail.frustumCulled = false;
    this.scene.add(kalmanTrail);

    // Forecast (dashed amber)
    const forecastLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({ color: 0xfbbf24, dashSize: 0.45, gapSize: 0.3, transparent: true, opacity: 0.55 }),
    );
    forecastLine.frustumCulled = false;
    this.scene.add(forecastLine);

    this.objects = {
      trueBall, kalmanBall, sensorMarker, spikeMarker: spikeGroup,
      trueTrail, kalmanTrail, forecastLine,
      boxWireframe, gridHelper, floorMesh,
    };

    // Cache buffer attribute references for fast per-frame updates
    this._trueBuf   = trueTrailGeo.getAttribute('position')   as THREE.BufferAttribute;
    this._kalmanBuf = kalmanTrailGeo.getAttribute('position') as THREE.BufferAttribute;
  }

  // ── Per-frame update API ────────────────────────────────────

  public updateTrueBall(pos: Vec3, showTrail: boolean): void {
    this._setPos(this.objects.trueBall, pos);
    this.objects.trueTrail.visible = showTrail;
    if (!showTrail) return;

    this.truePoints.push(toThree(pos));
    if (this.truePoints.length > TRAIL_MAX_POINTS) this.truePoints.shift();

    const count = this.truePoints.length;
    for (let i = 0; i < count; i++) {
      this._trueBuf.setXYZ(i, this.truePoints[i].x, this.truePoints[i].y, this.truePoints[i].z);
    }
    this._trueBuf.needsUpdate = true;
    (this.objects.trueTrail.geometry as THREE.BufferGeometry).setDrawRange(0, count);
  }

  public updateKalmanBall(pos: Vec3, showTrail: boolean): void {
    this._setPos(this.objects.kalmanBall, pos);
    this.objects.kalmanTrail.visible = showTrail;
    if (!showTrail) return;

    this.kalmanPoints.push(toThree(pos));
    if (this.kalmanPoints.length > TRAIL_MAX_POINTS) this.kalmanPoints.shift();

    const count = this.kalmanPoints.length;
    for (let i = 0; i < count; i++) {
      this._kalmanBuf.setXYZ(i, this.kalmanPoints[i].x, this.kalmanPoints[i].y, this.kalmanPoints[i].z);
    }
    this._kalmanBuf.needsUpdate = true;
    (this.objects.kalmanTrail.geometry as THREE.BufferGeometry).setDrawRange(0, count);
  }

  public showSensorMarker(pos: Vec3): void {
    if (this.objects.sensorMarker.visible) {
      this._setPos(this.objects.sensorMarker, pos);
    } else {
      this.objects.sensorMarker.visible = true;
      this._setPos(this.objects.sensorMarker, pos);
    }
  }

  public hideSensorMarker(): void {
    this.objects.sensorMarker.visible = false;
  }

  /**
   * Show the persistent orange spike marker for SPIKE_DISPLAY_FRAMES frames.
   * Clamps the position inside the box so it's always visible.
   */
  public showSpikeMarker(pos: Vec3): void {
    const half = 9.2; // slightly inside box walls
    const clamped: Vec3 = [
      Math.max(-half, Math.min(half, pos[0])),
      Math.max(-half, Math.min(half, pos[1])),
      Math.max(-half, Math.min(half, pos[2])),
    ];
    this._setPos(this.objects.spikeMarker, clamped);
    this.objects.spikeMarker.visible = true;
    this._spikeFramesLeft = SPIKE_DISPLAY_FRAMES;
  }

  /** Call every frame — decrements spike timer and hides when expired */
  public tickSpikeMarker(): void {
    if (this._spikeFramesLeft > 0) {
      this._spikeFramesLeft--;
      // Fade out over last 15 frames
      const fade = Math.min(1, this._spikeFramesLeft / 15);
      this.objects.spikeMarker.children.forEach((child) => {
        const mat = (child as THREE.Mesh | THREE.Line).material as THREE.Material & { opacity?: number };
        if (mat && 'opacity' in mat) mat.opacity = fade * (child instanceof THREE.Line ? 0.7 : 0.95);
      });
      if (this._spikeFramesLeft === 0) {
        this.objects.spikeMarker.visible = false;
      }
    }
  }

  public updateForecast(path: Vec3[]): void {
    const pts = path.map(p => toThree(p));
    (this.objects.forecastLine.geometry as THREE.BufferGeometry).setFromPoints(pts);
    this.objects.forecastLine.computeLineDistances();
    this.objects.forecastLine.visible = true;
  }

  public hideForecast(): void {
    this.objects.forecastLine.visible = false;
  }

  public clearTrails(): void {
    this.truePoints   = [];
    this.kalmanPoints = [];
    (this.objects.trueTrail.geometry   as THREE.BufferGeometry).setDrawRange(0, 0);
    (this.objects.kalmanTrail.geometry as THREE.BufferGeometry).setDrawRange(0, 0);
    (this.objects.forecastLine.geometry as THREE.BufferGeometry).setFromPoints([]);
    this.objects.spikeMarker.visible = false;
    this._spikeFramesLeft = 0;
  }

  /** Generic visibility setter (for boxWireframe, gridHelper, floorMesh) */
  public setVisibility(key: keyof SceneObjects, visible: boolean): void {
    (this.objects[key] as THREE.Object3D).visible = visible;
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public resize(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public dispose(): void {
    this.renderer.dispose();
    this.scene.clear();
  }

  // ── Camera orbit ────────────────────────────────────────────
  private _syncCamera(): void {
    this.camera.position.set(
      this._radius * Math.sin(this._phi) * Math.sin(this._theta),
      this._radius * Math.cos(this._phi),
      this._radius * Math.sin(this._phi) * Math.cos(this._theta),
    );
    this.camera.lookAt(0, 0, 0);
    this.camera.up.set(0, 1, 0);
  }

  private _attachOrbitListeners(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('mousedown', (e) => {
      this._isDragging = true;
      this._lastMouse = { x: e.clientX, y: e.clientY };
      canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('mouseup', () => {
      this._isDragging = false;
      canvas.style.cursor = 'grab';
    });
    canvas.addEventListener('mousemove', (e) => {
      if (!this._isDragging) return;
      const dx = e.clientX - this._lastMouse.x;
      const dy = e.clientY - this._lastMouse.y;
      this._lastMouse = { x: e.clientX, y: e.clientY };
      this._theta -= dx * 0.006;
      this._phi = Math.max(0.08, Math.min(Math.PI - 0.08, this._phi + dy * 0.006));
      this._syncCamera();
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._radius = Math.max(18, Math.min(100, this._radius + e.deltaY * 0.05));
      this._syncCamera();
    }, { passive: false });

    let lastTouchDist = 0;
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this._isDragging = true;
        this._lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      }
    });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && this._isDragging) {
        const dx = e.touches[0].clientX - this._lastMouse.x;
        const dy = e.touches[0].clientY - this._lastMouse.y;
        this._lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this._theta -= dx * 0.006;
        this._phi = Math.max(0.08, Math.min(Math.PI - 0.08, this._phi + dy * 0.006));
        this._syncCamera();
      } else if (e.touches.length === 2) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        this._radius = Math.max(18, Math.min(100, this._radius - (d - lastTouchDist) * 0.08));
        lastTouchDist = d;
        this._syncCamera();
      }
    }, { passive: false });
    canvas.addEventListener('touchend', () => { this._isDragging = false; });
  }
}
