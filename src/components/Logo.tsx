/** apiNest 品牌 Logo：AN 融合几何标（随明暗主题变色） */
export default function Logo({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      role="img"
      aria-label="apiNest"
    >
      {/* 左竖 */}
      <path d="M192 292H304V732H192Z" fill="var(--an-1)" />
      {/* 底部横杠 */}
      <path d="M304 556H624V632H304Z" fill="var(--an-2)" />
      {/* 斜笔画（与右竖构成 A 的意象） */}
      <path d="M192 292H328L832 732H696Z" fill="var(--an-3)" />
      {/* 右竖 */}
      <path d="M720 292H832V732H720Z" fill="var(--an-4)" />
    </svg>
  );
}
