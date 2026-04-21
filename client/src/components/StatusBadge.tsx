import Badge from '@ids-ts/badge'

const statusMap = {
  paid: { status: 'success' as const, label: 'Paid' },
  unpaid: { status: 'info' as const, label: 'Unpaid' },
  overdue: { status: 'error' as const, label: 'Overdue' },
  draft: { status: 'draft' as const, label: 'Draft' },
}

export function StatusBadge({ status }: { status: 'paid' | 'unpaid' | 'overdue' | 'draft' }) {
  const cfg = statusMap[status]
  return <Badge status={cfg.status} label={cfg.label} />
}
