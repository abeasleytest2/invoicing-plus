import { Activity } from '@ids-ts/loader'
import { B2 } from '@ids-ts/typography'
import '@ids-ts/loader/dist/main.css'

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 48 }}>
      <Activity shape="dots" />
      <B2 as="p" style={{ color: 'var(--color-text-secondary, #6b7280)' }}>{message}</B2>
    </div>
  )
}
