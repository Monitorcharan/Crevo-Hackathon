import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import {
  Color,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Group,
  type Mesh,
} from 'three'
import type { Pose } from './CrevoAnimations'
import { clamp, smoothstep } from './CrevoAnimations'
import {
  EYE_RADIUS,
  alignToNormal,
  bodySurfaceFrame,
  createEyeArcGeometry,
} from './CrevoGeometry'

export interface CrevoEyesHandle {
  /** Apply the current pose to both eyes. Called from the character's `useFrame`. */
  update: (pose: Readonly<Pose>) => void
}

/** Where the eyes rest on the face (radians around / above the body centre). */
const EYE_YAW = 0.5
const EYE_PITCH = 0.12
/** Maximum extra travel when looking fully to one side / up-down. */
const LOOK_YAW = 0.24
const LOOK_PITCH = 0.22

const _pos = new Vector3()
const _nrm = new Vector3()
const _q = new Quaternion()
const _roll = new Quaternion()
const _zAxis = new Vector3(0, 0, 1)

interface EyeRefs {
  group: Group | null
  ball: Mesh | null
  sparkles: Group | null
  arc: Mesh | null
}

/**
 * Crevo's eyes. Each eye is a glossy dark ellipsoid that slides across the body
 * surface when looking around. Happy / sleepy expressions cross-fade to a curved
 * arc (∩ for smiling, ∪ for sleeping) instead of using any facial geometry.
 */
export const CrevoEyes = forwardRef<CrevoEyesHandle>(function CrevoEyes(_props, ref) {
  const res = useMemo(
    () => ({
      ball: new SphereGeometry(1, 32, 24),
      arc: createEyeArcGeometry(),
      spark: new SphereGeometry(1, 14, 10),
      eyeMat: new MeshPhysicalMaterial({
        color: new Color('#0b0c0a'),
        roughness: 0.08,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1.6,
      }),
      sparkMat: new MeshBasicMaterial({ color: new Color('#ffffff'), toneMapped: false }),
    }),
    [],
  )

  useEffect(
    () => () => {
      res.ball.dispose()
      res.arc.dispose()
      res.spark.dispose()
      res.eyeMat.dispose()
      res.sparkMat.dispose()
    },
    [res],
  )

  const left = useRef<EyeRefs>({ group: null, ball: null, sparkles: null, arc: null })
  const right = useRef<EyeRefs>({ group: null, ball: null, sparkles: null, arc: null })

  useImperativeHandle(
    ref,
    () => ({
      update(pose) {
        const lookYaw = pose.eyeLookX * LOOK_YAW
        const lookPitch = pose.eyeLookY * LOOK_PITCH
        const arcAmount = Math.max(pose.eyeSmile, pose.eyeClosed)
        const openness = Math.max(0, pose.eyeOpen * (1 - clamp(pose.blink, 0, 1)) * (1 - arcAmount))
        const arcSigned = pose.eyeSmile - pose.eyeClosed // +∩  / -∪
        const arcThickness = smoothstep(0, 0.35, arcAmount)

        for (const side of [-1, 1] as const) {
          const e = side === -1 ? left.current : right.current
          if (!e.group || !e.ball || !e.arc || !e.sparkles) continue

          // Position + orientation on the body surface.
          bodySurfaceFrame(side * EYE_YAW + lookYaw, EYE_PITCH + lookPitch, _pos, _nrm)
          e.group.position.copy(_pos)
          alignToNormal(_nrm, _q)
          _roll.setFromAxisAngle(_zAxis, -side * pose.eyeTilt)
          e.group.quaternion.copy(_q).multiply(_roll)
          e.group.scale.setScalar(pose.eyeSize)

          // Eyeball (squashes vertically to blink / squint).
          const ballVisible = openness > 0.03
          e.ball.visible = ballVisible
          if (ballVisible) e.ball.scale.set(EYE_RADIUS.x, EYE_RADIUS.y * openness, EYE_RADIUS.z)

          // Catch-lights fade out as the eye closes.
          const spark = clamp((openness - 0.2) / 0.6, 0, 1)
          e.sparkles.visible = spark > 0.01
          e.sparkles.scale.setScalar(spark)

          // Arc (smile / sleep).
          const arcVisible = arcThickness > 0.01
          e.arc.visible = arcVisible
          if (arcVisible) e.arc.scale.set(arcThickness, arcSigned * 1.0 || 0.001, arcThickness)
        }
      },
    }),
    [],
  )

  const eye = (side: -1 | 1, store: React.MutableRefObject<EyeRefs>) => (
    <group
      name={side === -1 ? 'crevo-eye-left' : 'crevo-eye-right'}
      ref={(g) => {
        store.current.group = g
      }}
    >
      <mesh
        name="crevo-eyeball"
        ref={(m) => {
          store.current.ball = m
        }}
        geometry={res.ball}
        material={res.eyeMat}
        position={[0, 0, -0.025]}
        scale={[EYE_RADIUS.x, EYE_RADIUS.y, EYE_RADIUS.z]}
      />
      <group
        name="crevo-eye-sparkles"
        ref={(g) => {
          store.current.sparkles = g
        }}
      >
        <mesh
          geometry={res.spark}
          material={res.sparkMat}
          position={[-0.052, 0.088, 0.088]}
          scale={0.036}
        />
        <mesh
          geometry={res.spark}
          material={res.sparkMat}
          position={[0.056, -0.075, 0.082]}
          scale={0.017}
        />
      </group>
      <mesh
        name="crevo-eye-arc"
        ref={(m) => {
          store.current.arc = m
        }}
        geometry={res.arc}
        material={res.eyeMat}
        position={[0, -0.02, 0.055]}
        scale={0.001}
        visible={false}
      />
    </group>
  )

  return (
    <group name="crevo-eyes">
      {eye(-1, left)}
      {eye(1, right)}
    </group>
  )
})
