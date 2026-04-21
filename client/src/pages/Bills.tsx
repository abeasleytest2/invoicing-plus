import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '@ids-ts/button'
import { B2, B3 } from '@ids-ts/typography'
import Badge from '@ids-ts/badge'
import PageMessage from '@ids-ts/page-message'
import '@ids-ts/page-message/dist/main.css'
import { Camera, Receipt } from '@design-systems/icons'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody } from '../components/Card'
import { LoadingState } from '../components/LoadingState'
import { DataTable, type Column } from '../components/DataTable'
import { api, formatCurrency, formatDate } from '../api'

function billStatus(b: any): 'paid' | 'overdue' | 'unpaid' {
  const balance = parseFloat(b.Balance) || 0
  if (balance === 0) return 'paid'
  if (b.DueDate && new Date(b.DueDate) < new Date()) return 'overdue'
  return 'unpaid'
}

export default function Bills() {
  const [bills, setBills] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.bills.list()
      .then(setBills)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const columns: Column<any>[] = [
    {
      id: 'docNumber',
      header: 'Bill #',
      sortValue: (b) => b.DocNumber || b.Id,
      filterType: 'text',
      filterValue: (b) => b.DocNumber || b.Id,
      cell: (b) => <B2>{b.DocNumber || b.Id}</B2>,
    },
    {
      id: 'vendor',
      header: 'Vendor',
      sortValue: (b) => b.VendorRef?.name || '',
      filterType: 'text',
      filterValue: (b) => b.VendorRef?.name || '',
      cell: (b) => <B3>{b.VendorRef?.name || '—'}</B3>,
    },
    {
      id: 'date',
      header: 'Date',
      sortValue: (b) => b.TxnDate ? new Date(b.TxnDate) : null,
      filterType: 'dateRange',
      filterValue: (b) => b.TxnDate ? new Date(b.TxnDate) : null,
      cell: (b) => <B3>{formatDate(b.TxnDate)}</B3>,
    },
    {
      id: 'due',
      header: 'Due',
      sortValue: (b) => b.DueDate ? new Date(b.DueDate) : null,
      filterType: 'dateRange',
      filterValue: (b) => b.DueDate ? new Date(b.DueDate) : null,
      cell: (b) => <B3>{formatDate(b.DueDate)}</B3>,
    },
    {
      id: 'amount',
      header: 'Amount',
      sortValue: (b) => parseFloat(b.TotalAmt) || 0,
      filterType: 'numberRange',
      filterValue: (b) => parseFloat(b.TotalAmt) || 0,
      cell: (b) => <B3>{formatCurrency(b.TotalAmt)}</B3>,
    },
    {
      id: 'balance',
      header: 'Balance',
      sortValue: (b) => parseFloat(b.Balance) || 0,
      filterType: 'numberRange',
      filterValue: (b) => parseFloat(b.Balance) || 0,
      cell: (b) => <B3>{formatCurrency(b.Balance)}</B3>,
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (b) => billStatus(b),
      filterType: 'select',
      filterValue: (b) => billStatus(b),
      filterOptions: [
        { value: 'paid', label: 'Paid' },
        { value: 'unpaid', label: 'Unpaid' },
        { value: 'overdue', label: 'Overdue' },
      ],
      cell: (b) => {
        const s = billStatus(b)
        return <Badge status={s === 'paid' ? 'success' : s === 'overdue' ? 'error' : 'info'} label={s.charAt(0).toUpperCase() + s.slice(1)} />
      },
    },
  ]

  if (loading) return <LoadingState message="Loading bills…" />

  return (
    <>
      <PageHeader
        title="Bills"
        subtitle="Money you owe to vendors"
        actions={
          <Link to="/bills/scan">
            <Button><Camera size="small" /> Scan receipt</Button>
          </Link>
        }
      />

      {error && (
        <div style={{ marginBottom: 16 }}>
          <PageMessage type="error" title="Couldn't load bills" dismissible={false}>{error}</PageMessage>
        </div>
      )}

      <Card>
        <CardBody>
          <DataTable
            columns={columns}
            data={bills}
            emptyTitle={bills.length === 0 ? 'No bills yet' : 'No matches'}
            emptyDescription={bills.length === 0 ? 'Scan a receipt or add a bill to track what you owe.' : 'Try different filters.'}
            emptyAction={bills.length === 0 ? (
              <Link to="/bills/scan"><Button><Receipt size="small" /> Scan receipt</Button></Link>
            ) : undefined}
          />
        </CardBody>
      </Card>
    </>
  )
}
