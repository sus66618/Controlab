export function DcMotorScene({ state, voltage, loadTorque, torqueConstant }: { state: number[]; voltage: number; loadTorque: number; torqueConstant: number }) {
  const [current, speed, angle] = state;
  const degrees = (angle * 180 / Math.PI) % 360;
  const electromagneticTorque = torqueConstant * current;
  return <div className="dc-motor-scene"><svg viewBox="0 0 900 360" role="img" aria-label={`直流电机，转速 ${speed.toFixed(2)} 弧度每秒`}>
    <defs><linearGradient id="motor-case" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#263541" /><stop offset=".55" stopColor="#101921" /><stop offset="1" stopColor="#344653" /></linearGradient><radialGradient id="motor-rotor"><stop stopColor="#657782" /><stop offset=".65" stopColor="#202d36" /><stop offset="1" stopColor="#0a1015" /></radialGradient></defs>
    <path className="motor-wire positive" d="M110 110H250" /><path className="motor-wire negative" d="M110 245H250" /><circle className="motor-terminal positive" cx="105" cy="110" r="9" /><circle className="motor-terminal negative" cx="105" cy="245" r="9" /><text className="motor-voltage" x="85" y="82">u = {voltage.toFixed(2)} V</text>
    <path className="motor-case" fill="url(#motor-case)" d="M250 78h260c42 0 75 34 75 76v60c0 42-33 76-75 76H250z" /><ellipse className="motor-cap" cx="250" cy="184" rx="46" ry="106" /><g transform={`translate(250 184) rotate(${degrees})`}><circle className="motor-rotor" fill="url(#motor-rotor)" r="69" /><path className="motor-spoke" d="M-54 0H54M0-54V54M-38-38L38 38M38-38L-38 38" /></g>
    <path className="motor-shaft" d="M585 184H760" /><g transform={`translate(760 184) rotate(${degrees})`}><circle className="motor-load" r="58" /><path d="M-44 0H44M0-44V44" /></g>
    <g className="motor-readouts"><text x="320" y="130">i</text><text x="352" y="130">{current.toFixed(3)} A</text><text x="320" y="165">ω</text><text x="352" y="165">{speed.toFixed(2)} rad/s</text><text x="320" y="200">Tₑ</text><text x="352" y="200">{electromagneticTorque.toFixed(3)} N·m</text><text x="320" y="235">Tₗ</text><text x="352" y="235">{loadTorque.toFixed(3)} N·m</text></g>
    <path className={`motor-direction ${speed < 0 ? "negative" : ""}`} d={speed >= 0 ? "M706 104a92 92 0 0 1 102 38l-8-30m8 30l-31-3" : "M808 104a92 92 0 0 0-102 38l8-30m-8 30l31-3"} />
    <text className="scene-caption" x="95" y="326">电气动态驱动机械转动 · 角度动画按 2π 周期显示</text>
  </svg></div>;
}
