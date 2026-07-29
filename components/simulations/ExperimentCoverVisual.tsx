import type { SimulationExperimentId } from "@/lib/simulation/experimentCatalog";

export function ExperimentCoverVisual({ experimentId }: { experimentId: SimulationExperimentId }) {
  if (experimentId === "spring-mass") {
    return <div className="simulation-card-visual cover-spring-mass" aria-hidden="true">
      <span className="cover-ground" /><span className="cover-wall" />
      <span className="cover-spring" /><span className="cover-damper" />
      <span className="cover-mass"><i /><i /></span>
    </div>;
  }
  if (experimentId === "dc-motor") {
    return <div className="simulation-card-visual cover-dc-motor" aria-hidden="true">
      <span className="cover-terminal terminal-positive" /><span className="cover-terminal terminal-negative" />
      <span className="cover-motor-body"><i className="cover-rotor" /></span>
      <span className="cover-shaft" /><span className="cover-load"><i /><i /></span>
    </div>;
  }
  if (experimentId === "passive-rlc") {
    return <div className="simulation-card-visual cover-passive-rlc" aria-hidden="true">
      <span className="cover-circuit-loop" /><span className="cover-source">U</span>
      <span className="cover-resistor">R</span><span className="cover-inductor">L</span>
      <span className="cover-capacitor">C</span>
    </div>;
  }
  if (experimentId === "active-mfb") {
    return <div className="simulation-card-visual cover-active-mfb" aria-hidden="true">
      <span className="cover-active-wire" /><span className="cover-active-r1">R₁</span>
      <span className="cover-active-r2">R₂</span><span className="cover-active-c1">C₁</span>
      <span className="cover-active-c2">C₂</span><span className="cover-opamp">−</span>
      <span className="cover-feedback">R₃</span><span className="cover-opamp-ground" />
    </div>;
  }
  return <div className="simulation-card-visual cover-cart-pole" aria-hidden="true">
    <span className="cover-track" /><span className="cover-cart"><i /><i /></span>
    <span className="cover-pole" /><span className="cover-pivot" />
    <span className="cover-upright" />
  </div>;
}
