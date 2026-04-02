'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import {
  buildSpeakerGroup,
  buildDefaultSpeakerGroup,
  BRAND_MESHES,
  type BrandId,
} from './speaker-meshes';

interface SpeakerCanvasProps {
  activeBrand: string | null;
}

export function SpeakerCanvas({ activeBrand }: SpeakerCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    speakerGroup: THREE.Group;
    animId: number;
  } | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Camera — isometric-ish perspective
    const camera = new THREE.PerspectiveCamera(35, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(2.5, 1.8, 2.5);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    mount.appendChild(renderer.domElement);

    // Dot-matrix grid floor
    const gridHelper = new THREE.GridHelper(6, 24, 0x00ff44, 0x003311);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    // Speaker group
    const speakerGroup = buildDefaultSpeakerGroup();
    scene.add(speakerGroup);

    // Ambient glow — point light with neon green
    const light = new THREE.PointLight(0x00ff88, 2, 10);
    light.position.set(1, 2, 2);
    scene.add(light);

    // Animation loop — slow rotation
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      speakerGroup.rotation.y += 0.003;
      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = { renderer, scene, camera, speakerGroup, animId };

    // Handle resize
    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(animId);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, []);

  // Swap mesh when activeBrand changes
  useEffect(() => {
    const refs = sceneRef.current;
    if (!refs) return;

    refs.scene.remove(refs.speakerGroup);

    let newGroup: THREE.Group;
    if (activeBrand && activeBrand in BRAND_MESHES) {
      newGroup = buildSpeakerGroup(BRAND_MESHES[activeBrand as BrandId]);
    } else {
      newGroup = buildDefaultSpeakerGroup();
    }

    // Preserve current rotation
    newGroup.rotation.y = refs.speakerGroup.rotation.y;
    refs.scene.add(newGroup);
    sceneRef.current = { ...refs, speakerGroup: newGroup };
  }, [activeBrand]);

  return <div ref={mountRef} className="absolute inset-0" />;
}
