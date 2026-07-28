import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Controlab · 在线控制实验室",
  description: "输入传递函数，交互探索时域响应、Bode 图、根轨迹与奈奎斯特图。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async /></body></html>;
}
