import './Card.css'

export function Card({ children, style, className = '' }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return <section className={'ip-card ' + className} style={style}>{children}</section>
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <header className="ip-card-header">{children}</header>
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="ip-card-body">{children}</div>
}
