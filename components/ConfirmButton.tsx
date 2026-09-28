'use client';

/** Lomakkeen lähetyspainike, joka kysyy varmistuksen ennen lähetystä. */
export default function ConfirmButton({ message, children, className, style }: { message: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <button type="submit" className={className} style={style} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>
      {children}
    </button>
  );
}
