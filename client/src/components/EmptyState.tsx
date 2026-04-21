import { H3, B2 } from '@ids-ts/typography'

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 12, padding: '64px 24px', textAlign: 'center',
      }}
    >
      {icon && <div style={{ color: 'var(--color-text-secondary, #6b7280)' }}>{icon}</div>}
      <H3>{title}</H3>
      {description && (
        <B2 as="p" style={{ color: 'var(--color-text-secondary, #6b7280)', maxWidth: 480 }}>
          {description}
        </B2>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  )
}
