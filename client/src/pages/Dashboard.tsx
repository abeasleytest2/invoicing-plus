import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '@ids-ts/button'
import { Table } from '@ids-ts/table'
import { H3, B2, B3 } from '@ids-ts/typography'
import PageMessage from '@ids-ts/page-message'
import '@ids-ts/page-message/dist/main.css'
import { Plus } from '@design-systems/icons'
import { PageHeader } from '../components/PageHeader'
import { StatTile } from '../components/StatTile'
import { StatusBadge } from '../components/StatusBadge'
import { Card, CardHeader, CardBody } from '../components/Card'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { api, formatCurrency, formatDate, invoiceStatus } from '../api'

export default function Dashboard() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.dashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState message="Loading your dashboard…" />
  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <PageMessage type="error" title="Couldn't load dashboard" dismissible={false}>
          {error}. You might need to <a href="/connect">connect QuickBooks</a> first.
        </PageMessage>
      </>
    )
  }

  const { totals, recentInvoices } = data

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your invoicing and cash flow"
        actions={
          <Link to="/invoices/new">
            <Button><Plus size="small" /> New invoice</Button>
          </Link>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <StatTile label="Outstanding" value={formatCurrency(totals.outstanding)} sublabel="Unpaid balance" />
        <StatTile label="Overdue" value={formatCurrency(totals.overdue)} sublabel="Past due date" tone="error" />
        <StatTile label="Paid this month" value={formatCurrency(totals.paidThisMonth)} tone="success" />
        <StatTile label="Invoiced this month" value={formatCurrency(totals.invoicedThisMonth)} />
        <StatTile label="Customers" value={String(totals.customerCount)} />
        <StatTile label="Total invoices" value={String(totals.invoiceCount)} />
      </div>

      <Card>
        <CardHeader>
          <H3>Recent invoices</H3>
          <Link to="/invoices"><Button priority="tertiary" size="small">View all</Button></Link>
        </CardHeader>
        <CardBody>
          {recentInvoices.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              description="Create your first invoice to get started."
              action={<Link to="/invoices/new"><Button><Plus size="small" /> New invoice</Button></Link>}
            />
          ) : (
            <div className="ip-data-table">
            <Table hover="row">
              <Table.Header>
                <Table.Row>
                  <Table.Cell component="th">Invoice #</Table.Cell>
                  <Table.Cell component="th">Customer</Table.Cell>
                  <Table.Cell component="th">Amount</Table.Cell>
                  <Table.Cell component="th">Due</Table.Cell>
                  <Table.Cell component="th">Status</Table.Cell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {recentInvoices.map((inv: any) => (
                  <Table.Row key={inv.Id}>
                    <Table.Cell mobileLabel="Invoice"><Link to={`/invoices/${inv.Id}`}><B2>{inv.DocNumber || inv.Id}</B2></Link></Table.Cell>
                    <Table.Cell mobileLabel="Customer"><B3>{inv.CustomerRef?.name}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Amount"><B3>{formatCurrency(inv.TotalAmt)}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Due"><B3>{formatDate(inv.DueDate)}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Status"><StatusBadge status={invoiceStatus(inv)} /></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  )
}
