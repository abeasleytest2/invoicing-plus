import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Button from '@ids-ts/button'
import TextField from '@ids-ts/text-field'
import { Tabs, Tab } from '@ids-ts/tabs'
import { B2, B3 } from '@ids-ts/typography'
import DropdownButton from '@ids-ts/dropdown-button'
import { MenuItem } from '@ids-ts/menu'
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalActions } from '@ids-ts/modal-dialog'
import PageMessage from '@ids-ts/page-message'
import '@ids-ts/page-message/dist/main.css'
import { Plus, Search, Send, Delete } from '@design-systems/icons'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody } from '../components/Card'
import { StatusBadge } from '../components/StatusBadge'
import { LoadingState } from '../components/LoadingState'
import { DataTable, type Column } from '../components/DataTable'
import { api, formatCurrency, formatDate, invoiceStatus } from '../api'

export default function Invoices() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'unpaid' | 'overdue' | 'paid'>('all')
  const [search, setSearch] = useState('')
  const [toDelete, setToDelete] = useState<any | null>(null)
  const [sendEmail, setSendEmail] = useState<{ inv: any; email: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const refresh = () => {
    setLoading(true)
    setError(null)
    api.invoices.list()
      .then(setInvoices)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [])

  const tabFiltered = useMemo(() => {
    let list = invoices
    if (tab !== 'all') list = list.filter(i => invoiceStatus(i) === tab)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(i =>
        (i.DocNumber || '').toLowerCase().includes(q) ||
        (i.CustomerRef?.name || '').toLowerCase().includes(q),
      )
    }
    return list
  }, [invoices, tab, search])

  async function handleAction(action: string, inv: any) {
    if (action === 'view') navigate(`/invoices/${inv.Id}`)
    if (action === 'pdf') window.open(api.invoices.pdfUrl(inv.Id), '_blank')
    if (action === 'delete') setToDelete(inv)
    if (action === 'send') setSendEmail({ inv, email: '' })
  }

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await api.invoices.remove(toDelete.Id)
      setToDelete(null)
      refresh()
    } catch (e: any) {
      setError(e.message)
      setToDelete(null)
    }
  }

  async function confirmSend() {
    if (!sendEmail) return
    try {
      await api.invoices.send(sendEmail.inv.Id, sendEmail.email)
      setSendEmail(null)
    } catch (e: any) {
      setError(e.message)
      setSendEmail(null)
    }
  }

  const columns: Column<any>[] = [
    {
      id: 'docNumber',
      header: 'Invoice #',
      sortValue: (i) => i.DocNumber || i.Id,
      filterType: 'text',
      filterValue: (i) => i.DocNumber || i.Id,
      cell: (i) => <Link to={`/invoices/${i.Id}`}><B2>{i.DocNumber || i.Id}</B2></Link>,
    },
    {
      id: 'customer',
      header: 'Customer',
      sortValue: (i) => i.CustomerRef?.name || '',
      filterType: 'text',
      filterValue: (i) => i.CustomerRef?.name || '',
      cell: (i) => <B3>{i.CustomerRef?.name || '—'}</B3>,
    },
    {
      id: 'date',
      header: 'Date',
      sortValue: (i) => i.TxnDate ? new Date(i.TxnDate) : null,
      filterType: 'dateRange',
      filterValue: (i) => i.TxnDate ? new Date(i.TxnDate) : null,
      cell: (i) => <B3>{formatDate(i.TxnDate)}</B3>,
    },
    {
      id: 'due',
      header: 'Due',
      sortValue: (i) => i.DueDate ? new Date(i.DueDate) : null,
      filterType: 'dateRange',
      filterValue: (i) => i.DueDate ? new Date(i.DueDate) : null,
      cell: (i) => <B3>{formatDate(i.DueDate)}</B3>,
    },
    {
      id: 'amount',
      header: 'Amount',
      sortValue: (i) => parseFloat(i.TotalAmt) || 0,
      filterType: 'numberRange',
      filterValue: (i) => parseFloat(i.TotalAmt) || 0,
      cell: (i) => <B3>{formatCurrency(i.TotalAmt)}</B3>,
    },
    {
      id: 'balance',
      header: 'Balance',
      sortValue: (i) => parseFloat(i.Balance) || 0,
      filterType: 'numberRange',
      filterValue: (i) => parseFloat(i.Balance) || 0,
      cell: (i) => <B3>{formatCurrency(i.Balance)}</B3>,
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (i) => invoiceStatus(i),
      filterType: 'select',
      filterValue: (i) => invoiceStatus(i),
      filterOptions: [
        { value: 'paid', label: 'Paid' },
        { value: 'unpaid', label: 'Unpaid' },
        { value: 'overdue', label: 'Overdue' },
      ],
      cell: (i) => <StatusBadge status={invoiceStatus(i)} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (i) => (
        <DropdownButton
          label="Actions"
          buttonPurpose="standard"
          buttonPriority="secondary"
          buttonSize="small"
        >
          <MenuItem value="view" menuItemLabel="View" onClick={() => handleAction('view', i)}>View</MenuItem>
          <MenuItem value="pdf" menuItemLabel="Download PDF" onClick={() => handleAction('pdf', i)}>Download PDF</MenuItem>
          <MenuItem value="send" menuItemLabel="Email" onClick={() => handleAction('send', i)}>Email</MenuItem>
          <MenuItem value="delete" menuItemLabel="Delete" onClick={() => handleAction('delete', i)}>Delete</MenuItem>
        </DropdownButton>
      ),
    },
  ]

  if (loading) return <LoadingState message="Loading invoices…" />

  return (
    <>
      {error && (
        <PageMessage type="error" title="Couldn't load invoices" dismissible={false}>{error}</PageMessage>
      )}
      <PageHeader
        title="Invoices"
        subtitle="Create, send, and manage invoices"
        actions={
          <Link to="/invoices/new">
            <Button><Plus size="small" /> New invoice</Button>
          </Link>
        }
      />

      <Card>
        <CardBody>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <TextField
                label="Search invoices"
                placeholder="Search by invoice # or customer"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                addonBefore={<Search size="small" />}
              />
            </div>
          </div>

          <Tabs selected={tab} onChange={(id) => setTab(id as any)} isHorizontalRuleVisible>
            <Tab id="all" title={`All (${invoices.length})`} />
            <Tab id="unpaid" title={`Unpaid (${invoices.filter(i => invoiceStatus(i) === 'unpaid').length})`} />
            <Tab id="overdue" title={`Overdue (${invoices.filter(i => invoiceStatus(i) === 'overdue').length})`} />
            <Tab id="paid" title={`Paid (${invoices.filter(i => invoiceStatus(i) === 'paid').length})`} />
          </Tabs>

          <div style={{ marginTop: 16 }}>
            <DataTable
              columns={columns}
              data={tabFiltered}
              emptyTitle={invoices.length === 0 ? 'No invoices yet' : 'No matching invoices'}
              emptyDescription={invoices.length === 0 ? 'Create your first invoice to start billing customers.' : 'Try a different search or filter.'}
              emptyAction={invoices.length === 0 ? <Link to="/invoices/new"><Button><Plus size="small" /> New invoice</Button></Link> : undefined}
            />
          </div>
        </CardBody>
      </Card>

      {toDelete && (
        <Modal open onClose={() => setToDelete(null)} dismissible size="small">
          <ModalHeader dismissible onClose={() => setToDelete(null)}>
            <ModalTitle title="Delete invoice?" />
          </ModalHeader>
          <ModalContent>
            Invoice #{toDelete.DocNumber || toDelete.Id} for {formatCurrency(toDelete.TotalAmt)} will be permanently removed from QuickBooks.
          </ModalContent>
          <ModalActions alignment="right">
            <Button priority="secondary" onClick={() => setToDelete(null)}>Cancel</Button>
            <Button purpose="destructive" onClick={confirmDelete}><Delete size="small" /> Delete</Button>
          </ModalActions>
        </Modal>
      )}

      {sendEmail && (
        <Modal open onClose={() => setSendEmail(null)} dismissible size="small">
          <ModalHeader dismissible onClose={() => setSendEmail(null)}>
            <ModalTitle title="Email invoice" />
          </ModalHeader>
          <ModalContent>
            <TextField
              label="Recipient email"
              value={sendEmail.email}
              onChange={(e) => setSendEmail({ ...sendEmail, email: e.target.value })}
              placeholder="customer@example.com"
              type="email"
            />
          </ModalContent>
          <ModalActions alignment="right">
            <Button priority="secondary" onClick={() => setSendEmail(null)}>Cancel</Button>
            <Button onClick={confirmSend} disabled={!sendEmail.email}><Send size="small" /> Send</Button>
          </ModalActions>
        </Modal>
      )}
    </>
  )
}
