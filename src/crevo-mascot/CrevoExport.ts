import type { Object3D } from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'

interface RestState {
  p: [number, number, number]
  q: [number, number, number, number]
  s: [number, number, number]
  v: boolean
}

/**
 * Export the Crevo model as a binary glTF (.glb).
 *
 * The live scene is mid-animation, so the exporter works on a clone that is put
 * back into the rest pose captured when the character mounted. Helper meshes
 * (the shadow decal) and hidden nodes (the unused eye arcs) are stripped.
 *
 * Note: eye tracking, squash-and-stretch and moods are driven by code
 * (CrevoAnimations.ts), not baked clips, so the GLB is a static rest pose. To
 * ship animation in another runtime, port the controller and drive the named
 * nodes (`crevo-body-pivot`, `crevo-eye-left`, `crevo-crest-main`, …).
 */
export async function exportCrevoGLB(root: Object3D): Promise<ArrayBuffer> {
  const clone = root.clone(true)
  const doomed: Object3D[] = []

  clone.traverse((o) => {
    const rest = o.userData.crevoRest as RestState | undefined
    if (rest) {
      o.position.set(...rest.p)
      o.quaternion.set(...rest.q)
      o.scale.set(...rest.s)
      o.visible = rest.v
      delete o.userData.crevoRest
    }
    if (!o.visible || o.userData.crevoExcludeFromExport) doomed.push(o)
  })
  doomed.forEach((o) => o.parent?.remove(o))

  const exporter = new GLTFExporter()
  const result = await exporter.parseAsync(clone, { binary: true, onlyVisible: true })
  if (!(result instanceof ArrayBuffer)) throw new Error('GLTFExporter did not return binary data')
  return result
}
