/**
 * Procedural geometry for Crevo. Pure three.js (no React) so it can be reused by
 * a GLB export script, a React Native renderer (expo-three), or tests.
 *
 * Everything here is a single smooth surface: vertices are welded after the
 * deformation so there are no UV-seam or pole shading artefacts.
 */
import {
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Curve,
} from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const TAU = Math.PI * 2

/* ------------------------------------------------------------------ */
/* Body                                                                */
/* ------------------------------------------------------------------ */

/** Half-height of the (unscaled) body shape. */
export const BODY_HALF_HEIGHT = 0.92
/** Height of the body's lowest point above the ground plane (feet fill the gap). */
export const BODY_LIFT = 0.12

/**
 * Maps a point on the unit sphere onto Crevo's body: a soft pear, slightly
 * wider and deeper at the bottom, narrower and rounder at the top.
 */
export function deformBody(x: number, y: number, z: number, out: Vector3): Vector3 {
  const k = (1 - y) * 0.5 // 0 at the top pole, 1 at the bottom pole
  const sx = 0.8 + 0.17 * k
  const sz = 0.8 + 0.1 * k
  return out.set(x * sx, y * BODY_HALF_HEIGHT, z * sz)
}

export function createBodyGeometry(widthSegments = 64, heightSegments = 48): BufferGeometry {
  const sphere = new SphereGeometry(1, widthSegments, heightSegments)
  const pos = sphere.getAttribute('position')
  const v = new Vector3()
  for (let i = 0; i < pos.count; i++) {
    deformBody(pos.getX(i), pos.getY(i), pos.getZ(i), v)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  // Weld the UV seam and the poles, then recompute smooth normals across the weld.
  sphere.deleteAttribute('uv')
  sphere.deleteAttribute('normal')
  const welded = mergeVertices(sphere, 1e-5)
  welded.computeVertexNormals()
  sphere.dispose()
  return welded
}

const _a = new Vector3()
const _b = new Vector3()
const _c = new Vector3()

/**
 * Position + outward normal on the body surface for a given yaw / pitch
 * (direction from the body centre, before deformation). Used to slide the
 * eyes across the face as they track.
 */
export function bodySurfaceFrame(yaw: number, pitch: number, position: Vector3, normal: Vector3): void {
  const e = 1e-3
  surfacePoint(yaw, pitch, position)
  surfacePoint(yaw + e, pitch, _a).sub(position)
  surfacePoint(yaw, pitch + e, _b).sub(position)
  normal.crossVectors(_a, _b).normalize()
  // Make sure it points away from the centre.
  if (normal.dot(_c.copy(position)) < 0) normal.negate()
}

function surfacePoint(yaw: number, pitch: number, out: Vector3): Vector3 {
  const cp = Math.cos(pitch)
  return deformBody(Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp, out)
}

const _fwd = new Vector3(0, 0, 1)
/** Quaternion that turns local +Z onto `normal`. */
export function alignToNormal(normal: Vector3, out: Quaternion): Quaternion {
  return out.setFromUnitVectors(_fwd, normal)
}

/* ------------------------------------------------------------------ */
/* Tapered tube (crest + eye arcs)                                     */
/* ------------------------------------------------------------------ */

/**
 * A tube along `curve` whose radius is `radiusAt(t)`. Ring vertices wrap with
 * modular indices (no duplicated seam vertices), so shading is seamless.
 */
export function createTaperedTube(
  curve: Curve<Vector3>,
  radiusAt: (t: number) => number,
  tubularSegments = 56,
  radialSegments = 24,
): BufferGeometry {
  const frames = curve.computeFrenetFrames(tubularSegments, false)
  const positions: number[] = []
  const indices: number[] = []
  const p = new Vector3()

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments
    curve.getPointAt(t, p)
    const n = frames.normals[i]
    const b = frames.binormals[i]
    const r = radiusAt(t)
    for (let j = 0; j < radialSegments; j++) {
      const a = (j / radialSegments) * TAU
      const cs = Math.cos(a)
      const sn = Math.sin(a)
      positions.push(
        p.x + r * (cs * n.x + sn * b.x),
        p.y + r * (cs * n.y + sn * b.y),
        p.z + r * (cs * n.z + sn * b.z),
      )
    }
  }
  for (let i = 0; i < tubularSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * radialSegments + j
      const b = i * radialSegments + ((j + 1) % radialSegments)
      const c = (i + 1) * radialSegments + ((j + 1) % radialSegments)
      const d = (i + 1) * radialSegments + j
      indices.push(a, b, d, b, c, d)
    }
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/** Quarter-ellipse rounding used to cap the end of a tube: 1 in the middle, 0 at the very end. */
const capRound = (d: number, cap: number): number => {
  if (d >= cap) return 1
  const u = (cap - d) / cap
  return Math.sqrt(Math.max(0, 1 - u * u))
}

/** Crest geometry, authored with its base at the local origin (buried in the head). */
export const CREST_MAIN_POINTS: readonly [number, number, number][] = [
  [0, -0.32, 0],
  [0.01, 0.06, 0],
  [0.08, 0.38, 0],
  [0.26, 0.62, 0],
  [0.5, 0.74, 0],
  [0.7, 0.68, 0],
]
export const CREST_MINOR_POINTS: readonly [number, number, number][] = [
  [0, -0.3, 0],
  [-0.015, 0.02, 0],
  [-0.1, 0.27, 0],
  [-0.27, 0.42, 0],
]

export function createCrestGeometry(kind: 'main' | 'minor'): BufferGeometry {
  const pts = (kind === 'main' ? CREST_MAIN_POINTS : CREST_MINOR_POINTS).map(([x, y, z]) => new Vector3(x, y, z))
  const curve = new CatmullRomCurve3(pts, false, 'centripetal')
  const r0 = kind === 'main' ? 0.235 : 0.16
  const tip = kind === 'main' ? 0.3 : 0.32
  return createTaperedTube(
    curve,
    (t) => r0 * (1 - (1 - tip) * Math.pow(t, 1.15)) * capRound(1 - t, 0.1),
    64,
    28,
  )
}

/* ------------------------------------------------------------------ */
/* Eyes                                                                */
/* ------------------------------------------------------------------ */

export const EYE_RADIUS = { x: 0.165, y: 0.225, z: 0.11 } as const

/** Smile arc (∩) lying in the XY plane, facing +Z. Flip with a negative Y scale for ∪. */
export function createEyeArcGeometry(): BufferGeometry {
  const R = 0.165
  const from = (28 * Math.PI) / 180
  const to = (152 * Math.PI) / 180
  const pts: Vector3[] = []
  const n = 12
  for (let i = 0; i <= n; i++) {
    const a = from + ((to - from) * i) / n
    pts.push(new Vector3(Math.cos(a) * R, Math.sin(a) * R - R * 0.35, 0))
  }
  const curve = new CatmullRomCurve3(pts, false, 'centripetal')
  const r0 = 0.052
  return createTaperedTube(
    curve,
    (t) => r0 * (0.72 + 0.28 * Math.sin(Math.PI * t)) * capRound(Math.min(t, 1 - t), 0.1),
    36,
    14,
  )
}
