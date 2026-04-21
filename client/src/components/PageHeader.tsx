import { H1, B2 } from '@ids-ts/typography'
import './PageHeader.css'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="ip-page-header">
      <div>
        <H1>{title}</H1>
        {subtitle && <B2 as="p" className="ip-page-subtitle">{subtitle}</B2>}
      </div>
      {actions && <div className="ip-page-actions">{actions}</div>}
    </div>
  )
}
