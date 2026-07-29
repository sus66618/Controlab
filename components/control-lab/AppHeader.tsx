"use client";

export function AppHeader({ title, onHome, trailing }: {
  title: string;
  onHome?: () => void;
  trailing?: React.ReactNode;
}) {
  return <header className="app-header">
    <button className="app-brand" onClick={onHome} aria-label="返回 Controlab 首页">
      <span className="brand-symbol">C</span><span><strong>Controlab</strong><small>CONTROL ANALYSIS</small></span>
    </button>
    <div className="header-center">{title}</div>
    <div className="header-trailing">{trailing ?? <div className="compute-status"><i />本地计算</div>}</div>
  </header>;
}
