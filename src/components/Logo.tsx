export function LogoMark({ size = 38 }: { size?: number }) {
  return (
    <img
      src="/logo.jpg"
      alt="Noir Royale"
      width={size}
      height={size}
      style={{ objectFit: 'cover', borderRadius: size * 0.24, boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }}
    />
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <a className="logo" href="/" aria-label="Noir Royale home">
      <span className="logo-mark">
        <LogoMark />
      </span>
      {!compact && (
        <span className="logo-word">
          <b>NOIR&nbsp;ROYALE</b>
          <span>Virtual&nbsp;Casino</span>
        </span>
      )}
    </a>
  );
}