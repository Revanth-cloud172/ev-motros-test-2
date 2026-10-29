import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Eye, RotateCcw, Layers, Zap, Info, ShieldAlert, Cpu } from 'lucide-react';
import { FaultId, MotorTelemetry } from '../simulation/types';
import { MOTOR_SPECS } from '../simulation/motorPhysics';

interface MotorVisualizationProps {
  telemetry: MotorTelemetry;
  activeFaultId: FaultId;
}

interface ComponentInfo {
  name: string;
  category: string;
  material: string;
  specs: string;
  status: string;
}

const MOTOR_COMPONENTS: Record<string, ComponentInfo> = {
  shaft: {
    name: 'Rotor Drive Shaft',
    category: 'Mechanical Power Transmission',
    material: 'Forged 42CrMo4 Alloy Steel, Hardened & Ground',
    specs: 'Diameter: 45 mm, Length: 380 mm, Max Shear: 450 Nm',
    status: 'Nominal rotational inertia',
  },
  rotor: {
    name: 'IPM Rotor Core & Magnets',
    category: 'Magnetic Flux Generator',
    material: '0.27mm Low-loss Silicon Steel + Sintered NdFeB N45UH Magnets',
    specs: '8 Poles (4 Pole Pairs), V-Shape interior magnet configuration',
    status: 'Field weakening enabled above 4800 RPM',
  },
  statorCoils: {
    name: '3-Phase Stator Windings',
    category: 'Electromagnetic Field Exchanger',
    material: 'Oxygen-Free Copper (OFC) Magnet Wire, Class H Enamel',
    specs: '48 Slots, Distributed Double-Layer Lap Winding, Star Connected',
    status: 'Monitoring thermal gradient (Nomex-410 slot liner)',
  },
  housing: {
    name: 'Liquid-Cooled Stator Housing',
    category: 'Structural Enclosure & Heat Sink',
    material: 'A356-T6 Die-Cast Aluminum with Spiral Cooling Jacket',
    specs: 'Ethylene Glycol 50/50, Flow: 12 L/min, Heat Transfer: 8 kW',
    status: 'Convective heat dissipation active',
  },
  bearings: {
    name: 'Precision Deep Groove Ball Bearings',
    category: 'Rotational Support & Alignment',
    material: 'Ceramic Hybrid Si3N4 Balls, Chrome Steel Rings (SKF 6208)',
    specs: 'Dynamic Load: 32.5 kN, Limiting Speed: 16,000 RPM, C3 clearance',
    status: 'Monitored under ISO 10816 vibration rules',
  },
  terminals: {
    name: 'High-Voltage 3-Phase Terminal Box',
    category: 'Electrical Power Interface',
    material: 'Silver-Plated Copper Busbars with PPS Insulator',
    specs: 'Phases U, V, W. Rated: 600V DC / 450A RMS Peak',
    status: 'Shielded HV interlock (HVIL) loop closed',
  },
};

export const MotorVisualization: React.FC<MotorVisualizationProps> = ({
  telemetry,
  activeFaultId,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [use3DFallback, setUse3DFallback] = useState(false);
  const [isCutaway, setIsCutaway] = useState(true);
  const [selectedComponent, setSelectedComponent] = useState<string>('rotor');
  const [cameraView, setCameraView] = useState<'iso' | 'front' | 'side'>('iso');

  // Three.js instances stored in refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const rotorGroupRef = useRef<THREE.Group | null>(null);
  const statorCoilsMeshRef = useRef<THREE.Mesh[]>([]);
  const housingMeshRef = useRef<THREE.Mesh | null>(null);
  const bearingsGroupRef = useRef<THREE.Group | null>(null);
  const arcLightRef = useRef<THREE.PointLight | null>(null);
  const frameIdRef = useRef<number>(0);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 420;

    try {
      // Scene
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xf8fafc); // Clean neutral slate-50
      sceneRef.current = scene;

      // Camera
      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
      camera.position.set(4.5, 3.2, 5.2);
      cameraRef.current = camera;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;

      // Controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controls.maxDistance = 14;
      controls.minDistance = 2.0;
      controls.target.set(0, 0, 0);
      controlsRef.current = controls;

      // Lighting Rig
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
      scene.add(ambientLight);

      const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.0);
      dirLight1.position.set(6, 10, 8);
      dirLight1.castShadow = true;
      scene.add(dirLight1);

      const dirLight2 = new THREE.DirectionalLight(0xe2e8f0, 1.0);
      dirLight2.position.set(-6, -4, -6);
      scene.add(dirLight2);

      // Fault dynamic point light (for thermal/overcurrent glow)
      const arcLight = new THREE.PointLight(0xff6b00, 0, 4);
      arcLight.position.set(0, 0, 0);
      scene.add(arcLight);
      arcLightRef.current = arcLight;

      // Studio Ground Grid & Soft Shadow Catcher
      const grid = new THREE.GridHelper(12, 24, 0xcbd5e1, 0xe2e8f0);
      grid.position.y = -1.6;
      scene.add(grid);

      // --- MOTOR ASSEMBLY MODELING ---
      const motorAssembly = new THREE.Group();
      scene.add(motorAssembly);

      // 1. ROTOR & SHAFT GROUP (rotates with motor speed)
      const rotorGroup = new THREE.Group();
      motorAssembly.add(rotorGroup);
      rotorGroupRef.current = rotorGroup;

      // 1a. Drive Shaft
      const shaftGeom = new THREE.CylinderGeometry(0.24, 0.24, 4.4, 32);
      shaftGeom.rotateZ(Math.PI / 2);
      const shaftMat = new THREE.MeshStandardMaterial({
        color: 0xd4d4d8,
        metalness: 0.85,
        roughness: 0.2,
      });
      const shaft = new THREE.Mesh(shaftGeom, shaftMat);
      shaft.castShadow = true;
      rotorGroup.add(shaft);

      // Shaft Keyway slot feature
      const keywayGeom = new THREE.BoxGeometry(0.8, 0.08, 0.08);
      keywayGeom.translate(1.6, 0.22, 0);
      const keywayMat = new THREE.MeshStandardMaterial({ color: 0x52525b, metalness: 0.9, roughness: 0.4 });
      const keyway = new THREE.Mesh(keywayGeom, keywayMat);
      rotorGroup.add(keyway);

      // 1b. Rotor Laminated Core
      const rotorCoreGeom = new THREE.CylinderGeometry(1.02, 1.02, 2.2, 32);
      rotorCoreGeom.rotateZ(Math.PI / 2);
      const rotorCoreMat = new THREE.MeshStandardMaterial({
        color: 0x475569,
        metalness: 0.6,
        roughness: 0.35,
      });
      const rotorCore = new THREE.Mesh(rotorCoreGeom, rotorCoreMat);
      rotorCore.castShadow = true;
      rotorGroup.add(rotorCore);

      // 1c. Permanent Magnet Poles (8 exterior/interior pole segments)
      const poleCount = 8;
      for (let i = 0; i < poleCount; i++) {
        const angle = (i * Math.PI * 2) / poleCount;
        const magnetGeom = new THREE.BoxGeometry(2.0, 0.12, 0.35);
        const isNorth = i % 2 === 0;
        const magnetMat = new THREE.MeshStandardMaterial({
          color: isNorth ? 0xef4444 : 0x3b82f6, // Visual N (Red) / S (Blue) pole differentiation
          metalness: 0.5,
          roughness: 0.3,
        });
        const magnet = new THREE.Mesh(magnetGeom, magnetMat);
        magnet.position.set(0, Math.cos(angle) * 0.96, Math.sin(angle) * 0.96);
        magnet.rotation.x = -angle;
        rotorGroup.add(magnet);
      }

      // 2. BEARINGS (Drive End & Non-Drive End)
      const bearingsGroup = new THREE.Group();
      motorAssembly.add(bearingsGroup);
      bearingsGroupRef.current = bearingsGroup;

      const bearingGeom = new THREE.TorusGeometry(0.45, 0.12, 16, 32);
      bearingGeom.rotateY(Math.PI / 2);
      const bearingMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        metalness: 0.9,
        roughness: 0.15,
      });
      const deBearing = new THREE.Mesh(bearingGeom, bearingMat);
      deBearing.position.set(1.4, 0, 0);
      const ndeBearing = new THREE.Mesh(bearingGeom, bearingMat);
      ndeBearing.position.set(-1.4, 0, 0);
      bearingsGroup.add(deBearing, ndeBearing);

      // 3. STATOR WINDINGS (Copper Coils - Stator teeth)
      const coilCount = 24;
      statorCoilsMeshRef.current = [];
      for (let i = 0; i < coilCount; i++) {
        const angle = (i * Math.PI * 2) / coilCount;
        const coilGeom = new THREE.BoxGeometry(2.4, 0.22, 0.18);
        const coilMat = new THREE.MeshStandardMaterial({
          color: 0xb45309, // Rich copper bronze
          metalness: 0.75,
          roughness: 0.25,
          emissive: 0x000000,
        });
        const coil = new THREE.Mesh(coilGeom, coilMat);
        coil.position.set(0, Math.cos(angle) * 1.35, Math.sin(angle) * 1.35);
        coil.rotation.x = -angle;
        motorAssembly.add(coil);
        statorCoilsMeshRef.current.push(coil);
      }

      // 4. STATOR IRON CORE (Laminations)
      const statorCoreGeom = new THREE.CylinderGeometry(1.68, 1.68, 2.28, 36, 1, true);
      statorCoreGeom.rotateZ(Math.PI / 2);
      const statorCoreMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        side: THREE.DoubleSide,
        roughness: 0.6,
      });
      const statorCore = new THREE.Mesh(statorCoreGeom, statorCoreMat);
      motorAssembly.add(statorCore);

      // 5. STATOR HOUSING WITH COOLING FINS
      // Use partial angle when isCutaway is true
      const housingGeom = new THREE.CylinderGeometry(1.88, 1.88, 2.8, 36, 1, true, 0, Math.PI * 1.5);
      housingGeom.rotateZ(Math.PI / 2);
      const housingMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        metalness: 0.45,
        roughness: 0.4,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
      });
      const housing = new THREE.Mesh(housingGeom, housingMat);
      housingMeshRef.current = housing;
      motorAssembly.add(housing);

      // Housing Cooling Ribs (Axial fins)
      for (let i = 0; i < 16; i++) {
        const angle = (i * Math.PI * 1.5) / 16;
        const finGeom = new THREE.BoxGeometry(2.7, 0.2, 0.05);
        const fin = new THREE.Mesh(finGeom, housingMat);
        fin.position.set(0, Math.cos(angle) * 1.95, Math.sin(angle) * 1.95);
        fin.rotation.x = -angle;
        housing.add(fin);
      }

      // Front & Rear End-Bell Covers
      const endBellGeom = new THREE.RingGeometry(0.35, 1.88, 32);
      endBellGeom.rotateY(Math.PI / 2);
      const rearBell = new THREE.Mesh(endBellGeom, housingMat);
      rearBell.position.set(-1.4, 0, 0);
      housing.add(rearBell);

      // 6. TERMINAL BOX & BUSBARS (Phases U, V, W)
      const tBoxGeom = new THREE.BoxGeometry(0.9, 0.5, 0.8);
      tBoxGeom.translate(0, 2.1, 0);
      const tBoxMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.3, roughness: 0.7 });
      const tBox = new THREE.Mesh(tBoxGeom, tBoxMat);
      motorAssembly.add(tBox);

      // Phase Terminals (U, V, W colored conductors)
      const phaseColors = [0xef4444, 0xf59e0b, 0x3b82f6];
      for (let p = 0; p < 3; p++) {
        const lugGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.3, 16);
        const lugMat = new THREE.MeshStandardMaterial({ color: phaseColors[p], metalness: 0.8, roughness: 0.2 });
        const lug = new THREE.Mesh(lugGeom, lugMat);
        lug.position.set(-0.25 + p * 0.25, 2.45, 0);
        motorAssembly.add(lug);
      }

      // Animation Loop
      let lastTime = performance.now();
      const animate = (time: number) => {
        frameIdRef.current = requestAnimationFrame(animate);
        const dt = (time - lastTime) / 1000;
        lastTime = time;

        controls.update();

        // Rotate rotor proportional to simulated speed
        if (rotorGroupRef.current) {
          // speed in RPM -> rad/s = RPM * 2*pi / 60
          const speedRadS = (telemetry.speedRpm * 2 * Math.PI) / 60;
          // Scale visual rotation slightly so high RPM looks smooth without frame aliasing
          const visualOmega = Math.min(speedRadS * 0.15, 25.0);
          rotorGroupRef.current.rotation.x += visualOmega * dt;
        }

        renderer.render(scene, camera);
      };
      frameIdRef.current = requestAnimationFrame(animate);

      // Resize Handler
      const handleResize = () => {
        if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
        const newW = containerRef.current.clientWidth;
        const newH = containerRef.current.clientHeight;
        cameraRef.current.aspect = newW / newH;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(newW, newH);
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(frameIdRef.current);
        renderer.dispose();
        if (containerRef.current && renderer.domElement) {
          containerRef.current.removeChild(renderer.domElement);
        }
      };
    } catch (err) {
      console.warn('Three.js initialization failed, falling back to SVG renderer:', err);
      setUse3DFallback(true);
    }
  }, []);

  // Update dynamic visual states based on telemetry & faults
  useEffect(() => {
    if (use3DFallback) return;

    // 1. Thermal Stator Glow
    // Over 90°C: transition copper to glowing orange-red
    const tempC = telemetry.windingTempC;
    const isOverheating = activeFaultId === 'overheating' || tempC > 115;
    const heatRatio = Math.max(0, Math.min(1, (tempC - 70) / 65));

    statorCoilsMeshRef.current.forEach((mesh) => {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (isOverheating || heatRatio > 0.4) {
        mat.emissive.setHex(0xff3300);
        mat.emissiveIntensity = heatRatio * 1.5;
        mat.color.setHex(0xff4500);
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
        mat.color.setHex(0xb45309);
      }
    });

    // 2. Arc light for electrical/thermal effects
    if (arcLightRef.current) {
      if (activeFaultId === 'overcurrent') {
        arcLightRef.current.color.setHex(0x38bdf8); // Blue electrical arc glow
        arcLightRef.current.intensity = 3.5;
      } else if (isOverheating) {
        arcLightRef.current.color.setHex(0xff5722); // Orange thermal glow
        arcLightRef.current.intensity = 2.8;
      } else {
        arcLightRef.current.intensity = 0;
      }
    }

    // 3. Bearing wear vibration jitter on bearings
    if (bearingsGroupRef.current) {
      if (activeFaultId === 'bearing_wear' || telemetry.vibrationRms > 4.5) {
        const jitter = (Math.random() - 0.5) * 0.04;
        bearingsGroupRef.current.position.y = jitter;
        bearingsGroupRef.current.position.z = jitter * 0.8;
      } else {
        bearingsGroupRef.current.position.set(0, 0, 0);
      }
    }

    // 4. Cutaway toggle on housing
    if (housingMeshRef.current) {
      const mat = housingMeshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = isCutaway ? 0.35 : 0.95;
    }
  }, [telemetry, activeFaultId, isCutaway, use3DFallback]);

  // Camera presets
  const setCameraPreset = (preset: 'iso' | 'front' | 'side') => {
    setCameraView(preset);
    if (!cameraRef.current || !controlsRef.current) return;
    if (preset === 'iso') {
      cameraRef.current.position.set(4.5, 3.2, 5.2);
    } else if (preset === 'front') {
      cameraRef.current.position.set(6.5, 0, 0);
    } else if (preset === 'side') {
      cameraRef.current.position.set(0, 1.2, 6.5);
    }
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  const activeCompInfo = MOTOR_COMPONENTS[selectedComponent] || MOTOR_COMPONENTS.rotor;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col h-full">
      {/* Visualizer Header */}
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="font-semibold text-slate-800 text-sm tracking-tight flex items-center gap-1.5">
            PMSM Digital Twin Assembly
            <span className="text-[11px] font-normal text-slate-500 font-mono">150kW-IPM</span>
          </h3>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsCutaway(!isCutaway)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md border flex items-center gap-1.5 transition-colors ${
              isCutaway
                ? 'bg-slate-800 text-white border-slate-800 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle Cutaway View to inspect interior rotor & windings"
          >
            <Layers className="w-3.5 h-3.5" />
            {isCutaway ? 'Cutaway View' : 'Full Housing'}
          </button>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 text-xs">
            <button
              onClick={() => setCameraPreset('iso')}
              className={`px-2 py-0.5 rounded font-medium ${
                cameraView === 'iso' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Iso
            </button>
            <button
              onClick={() => setCameraPreset('front')}
              className={`px-2 py-0.5 rounded font-medium ${
                cameraView === 'front' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Shaft
            </button>
            <button
              onClick={() => setCameraPreset('side')}
              className={`px-2 py-0.5 rounded font-medium ${
                cameraView === 'side' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Side
            </button>
          </div>

          <button
            onClick={() => setCameraPreset('iso')}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            title="Reset Orbit Camera"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3D Canvas / Fallback Container */}
      <div className="relative flex-1 min-h-[340px] bg-gradient-to-b from-slate-50 to-slate-100/50 overflow-hidden">
        {/* Three.js DOM Element mounts here */}
        <div ref={containerRef} className="w-full h-full" />

        {/* Fallback SVG Motor Cutaway Visualization if WebGL is unavailable */}
        {use3DFallback && (
          <div className="absolute inset-0 flex items-center justify-center p-6 bg-slate-50">
            <svg
              viewBox="0 0 500 350"
              className="w-full max-w-[440px] drop-shadow-md select-none"
            >
              {/* Stator Housing */}
              <rect x="70" y="50" width="360" height="250" rx="14" fill="#94a3b8" stroke="#64748b" strokeWidth="3" />
              <text x="250" y="38" textAnchor="middle" fill="#475569" className="text-[12px] font-bold font-mono">
                STATOR HOUSING (LIQUID COOLED)
              </text>

              {/* Cooling fins */}
              {[-60, -30, 0, 30, 60].map((dy, idx) => (
                <rect key={idx} x="50" y={175 + dy} width="20" height="12" rx="2" fill="#cbd5e1" stroke="#94a3b8" />
              ))}
              {[-60, -30, 0, 30, 60].map((dy, idx) => (
                <rect key={idx} x="430" y={175 + dy} width="20" height="12" rx="2" fill="#cbd5e1" stroke="#94a3b8" />
              ))}

              {/* Stator Coils */}
              <rect
                x="110"
                y="85"
                width="280"
                height="180"
                rx="8"
                fill={telemetry.windingTempC > 115 ? '#ef4444' : '#b45309'}
                stroke="#78350f"
                strokeWidth="2"
                className="transition-colors duration-500"
              />
              <text x="250" y="105" textAnchor="middle" fill="#fef3c7" className="text-[11px] font-semibold">
                COPPER WINDINGS (Class H Nomex) - {telemetry.windingTempC.toFixed(0)}°C
              </text>

              {/* Rotor Assembly */}
              <g
                style={{
                  transformOrigin: '250px 175px',
                  animation: `spin ${Math.max(0.1, 60 / Math.max(10, telemetry.speedRpm))}s linear infinite`,
                }}
              >
                {/* Rotor Core */}
                <circle cx="250" cy="175" r="58" fill="#334155" stroke="#1e293b" strokeWidth="2" />
                {/* 8 Magnetic Poles */}
                {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, idx) => {
                  const rad = (angle * Math.PI) / 180;
                  const x = 250 + Math.cos(rad) * 44;
                  const y = 175 + Math.sin(rad) * 44;
                  return (
                    <circle
                      key={idx}
                      cx={x}
                      cy={y}
                      r="9"
                      fill={idx % 2 === 0 ? '#dc2626' : '#2563eb'}
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  );
                })}
                {/* Shaft Center */}
                <circle cx="250" cy="175" r="18" fill="#e2e8f0" stroke="#64748b" strokeWidth="2" />
                <rect x="246" y="157" width="8" height="6" fill="#475569" />
              </g>

              {/* Drive Shaft extending out */}
              <rect x="15" y="165" width="55" height="20" rx="3" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
              <text x="35" y="202" textAnchor="middle" fill="#64748b" className="text-[10px] font-mono">
                SHAFT
              </text>
            </svg>
          </div>
        )}

        {/* Dynamic Rotation & RPM HUD Overlay */}
        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs border border-slate-200/90 rounded-lg p-2.5 shadow-xs flex flex-col gap-1 pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Shaft Velocity</span>
            <span className="text-xs font-mono font-semibold text-slate-800">
              {telemetry.speedRpm.toFixed(0)} <span className="text-[10px] text-slate-500 font-normal">RPM</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Angular Speed</span>
            <span className="text-xs font-mono font-semibold text-slate-800">
              {((telemetry.speedRpm * 2 * Math.PI) / 60).toFixed(1)} <span className="text-[10px] text-slate-500 font-normal">rad/s</span>
            </span>
          </div>

          {activeFaultId !== 'none' && (
            <div className="mt-1 pt-1 border-t border-slate-100 flex items-center gap-1.5 text-amber-700 text-xs font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate max-w-[170px]">Visualizing: {activeFaultId.replace('_', ' ')}</span>
            </div>
          )}
        </div>

        {/* Quick Component Selection Pills */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {Object.entries(MOTOR_COMPONENTS).map(([key, comp]) => (
            <button
              key={key}
              onClick={() => setSelectedComponent(key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all border ${
                selectedComponent === key
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white/85 backdrop-blur-xs text-slate-700 border-slate-200 hover:bg-white hover:border-slate-300'
              }`}
            >
              {comp.name.split(' ')[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Component Engineering Inspector Footer */}
      <div className="p-3 bg-slate-50/80 border-t border-slate-200 text-xs flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div className="flex items-start gap-2">
          <Cpu className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-slate-800 flex items-center gap-2">
              {activeCompInfo.name}
              <span className="text-[10px] font-normal text-slate-500 font-mono">({activeCompInfo.category})</span>
            </div>
            <div className="text-slate-600 text-[11px] mt-0.5">
              <span className="font-medium text-slate-700">Material:</span> {activeCompInfo.material}
            </div>
          </div>
        </div>

        <div className="text-slate-500 text-[11px] md:text-right font-mono bg-white px-2.5 py-1.5 rounded-md border border-slate-200 shrink-0">
          <div>{activeCompInfo.specs}</div>
          <div className="text-emerald-700 font-medium">{activeCompInfo.status}</div>
        </div>
      </div>
    </div>
  );
};
