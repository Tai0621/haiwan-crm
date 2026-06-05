// HAIWAN wordmark, recreated as a crisp inline SVG so it scales and inherits
// colour (currentColor). Matches the attached logo: geometric uppercase, wide
// letter-spacing, with the small left tick on the leading "H".
//
// To use the exact brand PNG instead, drop it at /public/haiwan-logo.png and
// swap the <svg> below for <img src="/haiwan-logo.png" .../>.
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 168 28"
      role="img"
      aria-label="HAIWAN"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* leading H with the signature left ticks */}
      <rect x="1" y="2" width="1.6" height="6" fill="currentColor" />
      <rect x="1" y="20" width="1.6" height="6" fill="currentColor" />
      <text
        x="0"
        y="22"
        fontFamily="'Helvetica Neue', Arial, sans-serif"
        fontSize="24"
        fontWeight="600"
        letterSpacing="6.5"
        fill="currentColor"
      >
        HAIWAN
      </text>
    </svg>
  );
}
