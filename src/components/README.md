# React Bits components

Installed from the official free React Bits registry at https://reactbits.dev/r/{name}.json using the shadcn MCP installation command.

Variants: Iridescence, DecryptedText, CircularText, ScrollVelocity, TiltedCard, BorderGlow, and CountUp (JavaScript + CSS).

See `REACT-BITS-LICENSE.md` for the upstream license. These components are used inside Crevo; they are not offered as a separate component library.

Crevo integration lives in `StudioLanding.jsx` and `StudioMotion.jsx`. Animations respect system reduced motion and the persisted navigation motion toggle. The background shader is loaded only when visible and active. DecryptedText's screen-reader label was changed to expose stable, readable text.

TiltedCard also accepts children so Crevo can render live typography and geometry instead of images.

No React Bits Pro code or credentials are included.
