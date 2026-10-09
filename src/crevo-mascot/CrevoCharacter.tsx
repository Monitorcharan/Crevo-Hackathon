import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import {
  CanvasTexture,
  Color,
  DoubleSide,
  LinearFilter,
  MathUtils,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Group,
  type Mesh,
  type Object3D,
} from 'three'
import { CrevoEyes, type CrevoEyesHandle } from './CrevoEyes'
import { REST_POSE, type CrevoController, type Pose } from './CrevoAnimations'
import { BODY_HALF_HEIGHT, BODY_LIFT, createBodyGeometry, createCrestGeometry } from './CrevoGeometry'

/** Brand palette. */
export const CREVO_COLORS = {
  lime: '#D7FF45',
  charcoal: '#242424',
  nearBlack: '#151515',
  softWhite: '#F5F5F2',
} as const

/**
 * Communication channel between the DOM wrapper (pointer input, export) and the
 * WebGL scene. A plain mutable object so updating it never triggers a React render.
 */
export interface CrevoBridge {
  /** Screen-space hit test against the character silhouette. */
  hitTest: ((clientX: number, clientY: number) => boolean) | null
  /** World-space metrics used to translate drag deltas into movement. */
  metrics: { worldPerPx: number; maxX: number; maxY: number }
  exportGLB: (() => Promise<ArrayBuffer>) | null
  invalidate: (() => void) | null
}

export const createBridge = (): CrevoBridge => ({
  hitTest: null,
  metrics: { worldPerPx: 0.01, maxX: 0, maxY: 0 },
  exportGLB: null,
  invalidate: null,
})

/* ------------------------------------------------------------------ */
/* Camera rig                                                          */
/* ------------------------------------------------------------------ */

const FOV = 28
const CAMERA_TARGET = new Vector3(0, 1.62, 0)
const CAMERA_PITCH = 0.1
/** World height visible at zoom = 1 (character ≈ 2.95 tall plus hop headroom). */
const BASE_VIEW_HEIGHT = 3.95
const MIN_VIEW_WIDTH = 2.7
const CHARACTER_HALF_WIDTH = 1.05
const CHARACTER_TOP = 3.1

function CameraRig({ bridge, zoom, dragBounds }: { bridge: CrevoBridge; zoom: number; dragBounds: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)

  useLayoutEffect(() => {
    const z = Math.max(0.2, zoom)
    const aspect = width / Math.max(1, height)
    let viewH = BASE_VIEW_HEIGHT / z
    let viewW = viewH * aspect
    if (viewW < MIN_VIEW_WIDTH / z) {
      viewW = MIN_VIEW_WIDTH / z
      viewH = viewW / aspect
    }
    const dist = viewH / (2 * Math.tan(MathUtils.degToRad(FOV) / 2))
    camera.fov = FOV
    camera.near = 0.1
    camera.far = dist + 20
    camera.position.set(0, CAMERA_TARGET.y + Math.sin(CAMERA_PITCH) * dist, Math.cos(CAMERA_PITCH) * dist)
    camera.lookAt(CAMERA_TARGET)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    const bounds = MathUtils.clamp(dragBounds, 0, 1)
    bridge.metrics = {
      worldPerPx: viewH / Math.max(1, height),
      maxX: Math.max(0, viewW / 2 - CHARACTER_HALF_WIDTH) * bounds,
      maxY: Math.max(0, CAMERA_TARGET.y + viewH / 2 - CHARACTER_TOP) * bounds,
    }
    bridge.invalidate?.()
  }, [camera, width, height, zoom, dragBounds, bridge])

  return null
}

/* ------------------------------------------------------------------ */
/* Studio lighting                                                     */
/* ------------------------------------------------------------------ */

/**
 * Soft-box studio set built from procedural light-formers, so we get believable
 * reflections on the glossy surfaces without downloading an HDR.
 * Rendered into a cube map exactly once (`frames={1}`).
 */
function Studio() {
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[2.5, 5, 4]} intensity={1.4} color="#fffdf2" />
      <Environment resolution={128} frames={1} environmentIntensity={0.85}>
        <color attach="background" args={['#3a3d34']} />
        {/* key soft-box, upper left */}
        <Lightformer form="rect" intensity={5} color="#ffffff" position={[-3.5, 4.5, 4]} scale={[5, 3, 1]} target={[0, 1.5, 0]} />
        {/* rim, back right */}
        <Lightformer form="rect" intensity={3.2} color="#f5f5f2" position={[4.5, 2.5, -3]} scale={[1.6, 5, 1]} target={[0, 1.5, 0]} />
        {/* cool fill, lower left */}
        <Lightformer form="rect" intensity={1.2} color="#dfe8ff" position={[-5, 0.5, 1]} scale={[1.5, 3, 1]} target={[0, 1.5, 0]} />
        {/* top light */}
        <Lightformer form="ring" intensity={2} color="#ffffff" position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={3} />
      </Environment>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

function createShadowTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(0,0,0,0.6)')
  grd.addColorStop(0.5, 'rgba(0,0,0,0.3)')
  grd.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  const tex = new CanvasTexture(c)
  tex.minFilter = LinearFilter
  tex.generateMipmaps = false
  return tex
}

function useCharacterResources() {
  const res = useMemo(() => {
    const shadowTexture = createShadowTexture()
    return {
      body: createBodyGeometry(),
      crestMain: createCrestGeometry('main'),
      crestMinor: createCrestGeometry('minor'),
      foot: new SphereGeometry(1, 28, 20),
      bead: new SphereGeometry(1, 28, 20),
      ring: new TorusGeometry(1, 0.085, 12, 40),
      shadowTexture,
      lime: new MeshPhysicalMaterial({
        color: new Color(CREVO_COLORS.lime),
        roughness: 0.42,
        metalness: 0,
        clearcoat: 0.55,
        clearcoatRoughness: 0.3,
        sheen: 0.5,
        sheenRoughness: 0.55,
        sheenColor: new Color('#f1ffb0'),
        emissive: new Color('#b4ee1c'),
        emissiveIntensity: 0.2,
        envMapIntensity: 1.1,
      }),
      beadMat: new MeshPhysicalMaterial({
        color: new Color(CREVO_COLORS.charcoal),
        roughness: 0.18,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMapIntensity: 1.3,
      }),
      ringMat: new MeshStandardMaterial({
        color: new Color(CREVO_COLORS.lime),
        emissive: new Color(CREVO_COLORS.lime),
        emissiveIntensity: 0.5,
        roughness: 0.4,
        transparent: true,
      }),
      shadowMat: new MeshBasicMaterial({
        map: shadowTexture,
        color: new Color('#050505'),
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        toneMapped: false,
        side: DoubleSide,
      }),
    }
  }, [])

  useEffect(
    () => () => {
      res.body.dispose()
      res.crestMain.dispose()
      res.crestMinor.dispose()
      res.foot.dispose()
      res.bead.dispose()
      res.ring.dispose()
      res.shadowTexture.dispose()
      res.lime.dispose()
      res.beadMat.dispose()
      res.ringMat.dispose()
      res.shadowMat.dispose()
    },
    [res],
  )
  return res
}

/* ------------------------------------------------------------------ */
/* Character                                                           */
/* ------------------------------------------------------------------ */

const CREST_MAIN_BASE_Z = -0.2
const RING_SCALE = 0.17
const BEAD_SCALE = 0.095
const CREST_MINOR_BASE_Z = 0.22
const FOOT_X = 0.38

interface CrevoCharacterProps {
  controller: CrevoController
  bridge: CrevoBridge
  zoom?: number
  dragBounds?: number
  onReady?: () => void
}

export function CrevoCharacter({ controller, bridge, zoom = 1, dragBounds = 1, onReady }: CrevoCharacterProps) {
  const res = useCharacterResources()
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)

  const shadow = useRef<Group>(null)
  const figure = useRef<Group>(null)
  const model = useRef<Group>(null)
  const bodyPivot = useRef<Group>(null)
  const crestMain = useRef<Group>(null)
  const crestMinor = useRef<Group>(null)
  const beadGroup = useRef<Group>(null)
  const beadMesh = useRef<Mesh>(null)
  const ringMesh = useRef<Mesh>(null)
  const feetPivot = useRef<Group>(null)
  const footL = useRef<Mesh>(null)
  const footR = useRef<Mesh>(null)
  const eyes = useRef<CrevoEyesHandle>(null)
  const readyRef = useRef(onReady)
  readyRef.current = onReady
  const announced = useRef(false)

  /** Writes a pose onto the scene graph. No allocations. */
  const apply = (pose: Readonly<Pose>) => {
    const sy = 1 + pose.stretch
    const sxz = 1 / Math.sqrt(Math.max(0.2, sy))

    if (figure.current) figure.current.position.set(pose.offsetX, pose.offsetY, 0)
    if (shadow.current) {
      const height = pose.offsetY + pose.bodyY
      const s = 1 / (1 + height * 0.6)
      shadow.current.position.set(pose.offsetX + pose.bodyX * 0.5, 0.004, 0)
      shadow.current.scale.set(s * sxz, 1, s * sxz * 0.82)
      res.shadowMat.opacity = 0.55 / (1 + height * 1.3)
    }

    const pivot = bodyPivot.current
    if (pivot) {
      pivot.position.set(pose.bodyX, BODY_LIFT + pose.bodyY, 0)
      pivot.rotation.set(pose.tiltX, pose.yaw + pose.spin, pose.tiltZ, 'YXZ')
      pivot.scale.set(sxz, sy, sxz)
    }
    res.lime.emissiveIntensity = 0.2 + 0.28 * Math.max(-0.4, pose.glow)

    // Feet stay planted (lifting only when the body hops or they're kicked).
    if (feetPivot.current) {
      feetPivot.current.position.x = pose.bodyX
      feetPivot.current.rotation.y = pose.yaw + pose.spin
    }
    const lift = Math.max(0, pose.bodyY) * 0.85
    if (footL.current) footL.current.position.y = 0.12 + lift + Math.max(0, pose.footL)
    if (footR.current) footR.current.position.y = 0.12 + lift + Math.max(0, pose.footR)

    // Crest: main hook leans right, little one leans left; they sway out of phase.
    const perk = pose.crestPerk
    const lean = perk > 0 ? perk * 0.12 : perk * 0.55
    if (crestMain.current) {
      const c = crestMain.current
      c.rotation.set(pose.crestCurl * 0.4, 0, CREST_MAIN_BASE_Z + pose.crestSway + lean)
      c.scale.setScalar(1 + 0.08 * Math.max(0, perk))
    }
    if (crestMinor.current) {
      const c = crestMinor.current
      c.rotation.set(-pose.crestCurl * 0.3, 0, CREST_MINOR_BASE_Z + pose.crestSway * 0.8 - lean * 0.9)
      c.scale.setScalar(1 + 0.1 * Math.max(0, perk))
    }

    // Floating bead orbits above the crest.
    if (beadGroup.current) {
      const r = pose.beadRadius
      const ph = pose.beadPhase
      const bob = Math.sin(ph * 0.5) * 0.02
      beadGroup.current.position.set(Math.cos(ph) * r, Math.sin(ph) * r * 0.65 + bob, Math.sin(ph) * r * 0.5)
      const glow = Math.max(-0.8, pose.beadGlow)
      beadGroup.current.scale.setScalar(1 + 0.25 * glow)
      if (ringMesh.current) {
        ringMesh.current.rotation.set(Math.PI * 0.5 - 0.5, ph * 0.6, 0)
        ringMesh.current.scale.setScalar(RING_SCALE * (1 + 0.3 * Math.max(0, glow)))
      }
      res.ringMat.emissiveIntensity = Math.max(0.05, 0.55 + 1.1 * glow)
      res.ringMat.opacity = MathUtils.clamp(0.85 + 0.3 * glow, 0.25, 1)
    }

    eyes.current?.update(pose)
  }

  // Initial placement before the first paint, then capture the rest pose for GLB export.
  useLayoutEffect(() => {
    apply(REST_POSE)
    model.current?.traverse((o: Object3D) => {
      o.userData.crevoRest = {
        p: o.position.toArray(),
        q: o.quaternion.toArray(),
        s: o.scale.toArray(),
        v: o.visible,
      }
    })
    apply(controller.pose)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bridge: hit-testing, export, wake-up for demand-driven rendering.
  useEffect(() => {
    const raycaster = new Raycaster()
    const ndc = new Vector2()
    bridge.hitTest = (cx, cy) => {
      const root = model.current
      if (!root) return false
      const el = gl.domElement
      const r = el.getBoundingClientRect()
      if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return false
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
      camera.updateMatrixWorld()
      raycaster.setFromCamera(ndc, camera)
      return raycaster.intersectObject(root, true).length > 0
    }
    bridge.exportGLB = async () => {
      const root = model.current
      if (!root) throw new Error('Crevo model is not mounted')
      const { exportCrevoGLB } = await import('./CrevoExport')
      return exportCrevoGLB(root)
    }
    bridge.invalidate = invalidate
    controller.onWake = invalidate
    invalidate()
    return () => {
      bridge.hitTest = null
      bridge.exportGLB = null
      bridge.invalidate = null
      controller.onWake = undefined
    }
  }, [bridge, controller, gl, camera, invalidate])

  useFrame((state, dt) => {
    const pose = controller.update(dt)
    apply(pose)
    // Demand-driven (reduced-motion) mode: keep rendering until the pose has settled.
    if (state.frameloop === 'demand' && !controller.settled) state.invalidate()
    if (!announced.current) {
      announced.current = true
      readyRef.current?.()
    }
  })

  return (
    <>
      <Studio />
      <CameraRig bridge={bridge} zoom={zoom} dragBounds={dragBounds} />

      <group>
        {/* Soft contact shadow: a gradient decal, no extra render pass. */}
        <group ref={shadow} name="crevo-shadow-root">
          <mesh
            name="crevo-shadow"
            rotation-x={-Math.PI / 2}
            scale={[2.4, 2.4, 1]}
            material={res.shadowMat}
            renderOrder={-1}
            raycast={() => null}
            userData={{ crevoExcludeFromExport: true }}
          >
            <planeGeometry args={[1, 1]} />
          </mesh>
        </group>

        <group ref={figure} name="crevo-figure">
          <group ref={model} name="crevo">
            <group ref={bodyPivot} name="crevo-body-pivot">
              <group position={[0, BODY_HALF_HEIGHT, 0]}>
                <mesh name="crevo-body" geometry={res.body} material={res.lime} />
                <CrevoEyes ref={eyes} />

                {/* Main crest: a swooping hook that makes the silhouette. */}
                <group ref={crestMain} name="crevo-crest-main" position={[0.12, 0.74, -0.06]}>
                  <mesh geometry={res.crestMain} material={res.lime} />
                  {/* Floating accent that orbits above the crest tip. */}
                  <group position={[0.46, 1.08, 0.04]}>
                    <group ref={beadGroup} name="crevo-bead">
                      <mesh ref={beadMesh} geometry={res.bead} material={res.beadMat} scale={BEAD_SCALE} />
                      <mesh ref={ringMesh} geometry={res.ring} material={res.ringMat} scale={RING_SCALE} />
                    </group>
                  </group>
                </group>

                {/* Minor crest: smaller counter-flick for an asymmetric silhouette. */}
                <group ref={crestMinor} name="crevo-crest-minor" position={[-0.3, 0.72, 0.02]}>
                  <mesh geometry={res.crestMinor} material={res.lime} />
                </group>
              </group>
            </group>

            <group ref={feetPivot} name="crevo-feet">
              <mesh
                ref={footL}
                name="crevo-foot-left"
                geometry={res.foot}
                material={res.lime}
                position={[-FOOT_X, 0.12, 0.14]}
                scale={[0.26, 0.13, 0.32]}
              />
              <mesh
                ref={footR}
                name="crevo-foot-right"
                geometry={res.foot}
                material={res.lime}
                position={[FOOT_X, 0.12, 0.14]}
                scale={[0.26, 0.13, 0.32]}
              />
            </group>
          </group>
        </group>
      </group>
    </>
  )
}
