/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  // 主题色走 CSS 变量（明暗切换只改 html 的 data-theme 属性），Tailwind 不参与暗色逻辑
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        line: "var(--border)",
        ink: "var(--text)",
        "ink-2": "var(--text-2)",
        "ink-3": "var(--text-3)",
        accent: "var(--accent)",
        "accent-soft": "var(--accent-soft)",
      },
    },
  },
  plugins: [],
};
