"use client";

import { Canvas } from '@react-three/fiber';
import { useGLTF} from '@react-three/drei';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';


import * as THREE from 'three';


function Model() {
    const { scene } = useGLTF('/rubikscube.glb');
    const modelRef = useRef<THREE.Object3D>(null);

    // Animate rotation
    useFrame(() => {
        if (modelRef.current) {
            modelRef.current.rotation.y += 0.0075;
            modelRef.current.rotation.z += 0.012;
            modelRef.current.rotation.x += 0.016;
        }
    });

    return <primitive ref={modelRef} object={scene} />;
}

export default function CubeScene() {
    return (
        <Canvas style={{ height: '50vh', width: '100%', backgroundColor: 'transparent'}}
                camera={{ position: [0, 0, 30], fov: 50 }}>
            <ambientLight intensity={.5} />
            <directionalLight position={[10, 10, 5]} intensity={1.2} />
            <Model />
            
            {/*<OrbitControls />*/}
        </Canvas>
    );
}

useGLTF.preload('/rubikscube.glb');