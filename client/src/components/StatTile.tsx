import { D3, B3, Demi } from '@ids-ts/typography'
import './StatTile.css'

type StatTileProps = {
  label: string
  value: string
  sublabel?: string
  tone?: 'default' | 'success' | 'error' | 'warning'
}

export function StatTile({ label, value, sublabel, tone = 'default' }: StatTileProps) {
  return (
    <div className={`ip-stat ip-stat-${tone}`}>
      <B3 as="p" className="ip-stat-label">{label}</B3>
      <D3 as="p" className="ip-stat-value">{value}</D3>
      {sublabel && <B3 as="p" className="ip-stat-sub"><Demi>{sublabel}</Demi></B3>}
    </div>
  )
}
