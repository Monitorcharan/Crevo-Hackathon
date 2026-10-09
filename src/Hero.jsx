import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Float, Lightformer } from '@react-three/drei'
import * as THREE from 'three'

function Ribbon({ phase = 0, bandWidth = 0.82, offset = [0, 0, 0], reduced = false }) {
  const group = useRef()
  const geometry = useMemo(() => {
    const vertices = [], normals = [], indices = []
    const segments = 220
    for (let i = 0; i <= segments; i++) {
      const t = i / segments
      const a = t * Math.PI * 2.7 - 1.15 + phase
      const radius = 1.25 + 0.35 * Math.sin(t * Math.PI * 4)
      const center = new THREE.Vector3(Math.cos(a) * radius, Math.sin(a * 0.73) * 0.78, Math.sin(a) * 0.72)
      const tangent = new THREE.Vector3(-Math.sin(a), Math.cos(a * 0.73) * 0.55, Math.cos(a)).normalize()
      const side = new THREE.Vector3(0, 0, 1).cross(tangent).normalize().applyAxisAngle(tangent, t * Math.PI * 5)
      for (const edge of [-1, 1]) {
        const p = center.clone().addScaledVector(side, edge * bandWidth * (0.7 + 0.3 * Math.sin(t * Math.PI)))
        vertices.push(p.x, p.y, p.z)
        normals.push(0, 0, 1)
      }
      if (i < segments) {
        const j = i * 2
        indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
    g.setIndex(indices)
    g.computeVertexNormals()
    return g
  }, [phase, bandWidth])
  useFrame(({ clock }) => {
    if (group.current && !reduced) {
      group.current.rotation.y = -0.3 + Math.sin(clock.elapsedTime * 0.18) * 0.2
      group.current.rotation.z = Math.sin(clock.elapsedTime * 0.13) * 0.08
    }
  })
  return <group ref={group} position={offset} rotation={[0.25, -0.3, -0.1]}>
    <mesh geometry={geometry}>
      <meshPhysicalMaterial color="#e4e5e8" metalness={1} roughness={0.12} side={THREE.DoubleSide} clearcoat={1} clearcoatRoughness={0.06} envMapIntensity={2.5} />
    </mesh>
  </group>
}

export default function Hero() {
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return <div className="hero-canvas" aria-hidden="true">
    <Canvas camera={{ position: [0, 0, 5.8], fov: 45 }} dpr={[1, 1.7]} gl={{ antialias: true, alpha: true }} fallback={<div className="hero-fallback"/>}>
      <Environment resolution={256}>
        <Lightformer intensity={3} color="#ffffff" position={[-3, 2, 3]} scale={[7, 1.3, 1]}/>
        <Lightformer intensity={3} color="#fa99d4" position={[2, 3, -1]} scale={[2, 5, 1]}/>
        <Lightformer intensity={3} color="#8be9ff" position={[3, -2, 2]} scale={[4, 1, 1]}/>
      </Environment>
      <ambientLight intensity={1.5} />
      <directionalLight position={[-4, 6, 5]} intensity={4} color="#ffffff" />
      <directionalLight position={[5, -3, 3]} intensity={3} color="#b1c6ff" />
      <pointLight position={[0, 0, -2]} intensity={35} color="#d5fb55" />
      <Float speed={reduced ? 0 : 0.45} rotationIntensity={reduced ? 0 : 0.04} floatIntensity={reduced ? 0 : 0.18}>
        <Ribbon phase={0} bandWidth={0.83} offset={[0.3, 0.15, 0]} reduced={reduced}/>
        <Ribbon phase={1.2} bandWidth={0.48} offset={[-0.4, -0.15, -0.55]} reduced={reduced}/>
        <Ribbon phase={2.2} bandWidth={0.22} offset={[0.5, 0.3, 0.8]} reduced={reduced}/>
      </Float>
    </Canvas>
  </div>
}
