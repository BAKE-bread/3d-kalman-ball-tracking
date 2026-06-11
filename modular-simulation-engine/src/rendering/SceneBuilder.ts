// ============================================================
// rendering/SceneBuilder.ts
// Constructs and owns all Three.js objects.
// Exposes clean update methods — zero knowledge of Kalman/physics.
// ============================================================

import * as THREE from 'three';
import type { Vec3 } from '@/types';
import { COLORS, TRAIL_MAX_POINTS } from '@/constants/defaults';

export interface SceneObjects {
  trueBall: THREE.Mesh;
  kalmanBall: THREE.Mesh;
  sensorMarker: THREE.Mesh;
  trueTrail: THREE.Line;
  kalmanTrail: THREE.Line;
  forecastLine: THREE.Line;
  boxWireframe: THREE.LineSegments;
  gridHelper: THREE.GridHelper;
}

export class SceneBuilder {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;

  private objects!: SceneObjects;
  private truePoints: THREE.Vector3[] = [];
  private kalmanPoints: THREE.Vector3[] = [];

  // Camera orbit state
  private _theta = 0.6;
  private _phi = 0.55;
  private _radius = 52;
  private _isDragging = false;
  private _lastMouse = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.ambient);
    this.scene.fog = new THREE.Fog(COLORS.ambient, 80, 140);

    this.camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 500);
    this._syncCamera();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this._buildScene();
    this._attachOrbitListeners(canvas);
  }

  // ── Scene population ────────────────────────────────────────

  private _buildScene(): void {
    const boxSize = 20;

    // Ambient + directional lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(25, 45, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    this.scene.add(sun);

    const fill = new THREE.PointLight(0x38bdf8, 0.6, 80);
    fill.position.set(-20, 10, -10);
    this.scene.add(fill);

    // Box wireframe
    const boxGeo = new THREE.BoxGeometry(boxSize, boxSize, boxSize);
    const edges = new THREE.EdgesGeometry(boxGeo);
    const lineMat = new THREE.LineBasicMaterial({ color: COLORS.boxEdge, transparent: true, opacity: 0.7 });
    const boxWireframe = new THREE.LineSegments(edges, lineMat);
    this.scene.add(boxWireframe);

    // Semi-transparent box faces (subtle)
    const faceMat = new THREE.MeshBasicMaterial({
      color: 0x1e293b,
      transparent: true,
      opacity: 0.08,
      side: THREE.BackSide,
    });
    const faceMesh = new THREE.Mesh(boxGeo, faceMat);
    this.scene.add(faceMesh);

    // Grid on bottom of box
    const gridHelper = new THREE.GridHelper(boxSize, 10, 0x1e3a5f, 0x1e3a5f);
    gridHelper.position.y = -boxSize / 2;
    this.scene.add(gridHelper);

    // True ball (green)
    const trueBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 32, 32),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(COLORS.trueBall),
        roughness: 0.3,
        metalness: 0.1,
        emissive: new THREE.Color(COLORS.trueBall),
        emissiveIntensity: 0.25,
      })
    );
    trueBall.castShadow = true;
    this.scene.add(trueBall);

    // Kalman ball (cyan)
    const kalmanBall = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 32, 32),
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(COLORS.kalmanBall),
        roughness: 0.1,
        metalness: 0.3,
        transparent: true,
        opacity: 0.85,
        emissive: new THREE.Color(COLORS.kalmanBall),
        emissiveIntensity: 0.3,
      })
    );
    kalmanBall.castShadow = true;
    this.scene.add(kalmanBall);

    // Sensor marker (red cube, small)
    const sensorMarker = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.35),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.sensorMarker) })
    );
    sensorMarker.visible = false;
    this.scene.add(sensorMarker);

    // Trail lines
    const trueTrailGeo = new THREE.BufferGeometry();
    const trueTrailMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(COLORS.trueBall),
      transparent: true,
      opacity: 0.4,
    });
    const trueTrail = new THREE.Line(trueTrailGeo, trueTrailMat);
    this.scene.add(trueTrail);

    const kalmanTrailGeo = new THREE.BufferGeometry();
    const kalmanTrailMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(COLORS.kalmanBall),
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
    });
    const kalmanTrail = new THREE.Line(kalmanTrailGeo, kalmanTrailMat);
    this.scene.add(kalmanTrail);

    // Forecast ghost line
    const forecastGeo = new THREE.BufferGeometry();
    const forecastMat = new THREE.LineDashedMaterial({
      color: 0xfbbf24,
      dashSize: 0.4,
      gapSize: 0.3,
      transparent: true,
      opacity: 0.5,
    });
    const forecastLine = new THREE.Line(forecastGeo, forecastMat);
    this.scene.add(forecastLine);

    this.objects = {
      trueBall, kalmanBall, sensorMarker,
      trueTrail, kalmanTrail, forecastLine,
      boxWireframe, gridHelper,
    };
  }

  // ── Per-frame update API ────────────────────────────────────

  public updateTrueBall(pos: Vec3): void {
    this.objects.trueBall.position.set(pos[0], pos[1], pos[2]);
    this.truePoints.push(new THREE.Vector3(pos[0], pos[1], pos[2]));
    if (this.truePoints.length > TRAIL_MAX_POINTS) this.truePoints.shift();
    (this.objects.trueTrail.geometry as THREE.BufferGeometry).setFromPoints(this.truePoints);
  }

  public updateKalmanBall(pos: Vec3): void {
    this.objects.kalmanBall.position.set(pos[0], pos[1], pos[2]);
    this.kalmanPoints.push(new THREE.Vector3(pos[0], pos[1], pos[2]));
    if (this.kalmanPoints.length > TRAIL_MAX_POINTS) this.kalmanPoints.shift();
    (this.objects.kalmanTrail.geometry as THREE.BufferGeometry).setFromPoints(this.kalmanPoints);
  }

  public showSensorMarker(pos: Vec3): void {
    this.objects.sensorMarker.visible = true;
    this.objects.sensorMarker.position.set(pos[0], pos[1], pos[2]);
    (this.objects.sensorMarker.material as THREE.MeshBasicMaterial).opacity = 1;
  }

  public hideSensorMarker(): void {
    this.objects.sensorMarker.visible = false;
  }

  public updateForecast(path: Vec3[]): void {
    const pts = path.map(p => new THREE.Vector3(p[0], p[1], p[2]));
    (this.objects.forecastLine.geometry as THREE.BufferGeometry).setFromPoints(pts);
    this.objects.forecastLine.computeLineDistances();
  }

  public clearTrails(): void {
    this.truePoints = [];
    this.kalmanPoints = [];
    (this.objects.trueTrail.geometry as THREE.BufferGeometry).setFromPoints([]);
    (this.objects.kalmanTrail.geometry as THREE.BufferGeometry).setFromPoints([]);
    (this.objects.forecastLine.geometry as THREE.BufferGeometry).setFromPoints([]);
  }

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
  }

  private _attachOrbitListeners(canvas: HTMLCanvasElement): void {
    canvas.addEventListener('mousedown', (e) => {
      this._isDragging = true;
      this._lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => { this._isDragging = false; });
    canvas.addEventListener('mousemove', (e) => {
      if (!this._isDragging) return;
      const dx = e.clientX - this._lastMouse.x;
      const dy = e.clientY - this._lastMouse.y;
      this._lastMouse = { x: e.clientX, y: e.clientY };
      this._theta -= dx * 0.006;
      this._phi = Math.max(0.1, Math.min(Math.PI - 0.1, this._phi + dy * 0.006));
      this._syncCamera();
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this._radius = Math.max(20, Math.min(100, this._radius + e.deltaY * 0.05));
      this._syncCamera();
    }, { passive: false });

    // Touch support
    let lastTouchDist = 0;
    canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this._isDragging = true;
        this._lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
      }
    });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && this._isDragging) {
        const dx = e.touches[0].clientX - this._lastMouse.x;
        const dy = e.touches[0].clientY - this._lastMouse.y;
        this._lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this._theta -= dx * 0.006;
        this._phi = Math.max(0.1, Math.min(Math.PI - 0.1, this._phi + dy * 0.006));
        this._syncCamera();
      } else if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY,
        );
        this._radius = Math.max(20, Math.min(100, this._radius - (d - lastTouchDist) * 0.08));
        lastTouchDist = d;
        this._syncCamera();
      }
    }, { passive: false });
    canvas.addEventListener('touchend', () => { this._isDragging = false; });
  }
}
