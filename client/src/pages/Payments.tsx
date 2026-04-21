import { useEffect, useState } from 'react'
import Button from '@ids-ts/button'
import TextField from '@ids-ts/text-field'
import Dropdown from '@ids-ts/dropdown'
import { MenuItem } from '@ids-ts/menu'
import { Table } from '@ids-ts/table'
import { B2, B3 } from '@ids-ts/typography'
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalActions } from '@ids-ts/modal-dialog'
import PageMessage from '@ids-ts/page-message'
import '@ids-ts/page-message/dist/main.css'
import { Plus, Currency } from '@design-systems/icons'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody } from '../components/Card'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { api, formatCurrency, formatDate } from '../api'

type PaymentForm = { Id?: string; customerId: string; amount: string; invoiceId: string }

export default function Payments() {
  const [payments, setPayments] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<PaymentForm | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    Promise.all([api.payments.list(), api.customers.list(), api.invoices.list()])
      .then(([p, c, i]) => { setPayments(p); setCustomers(c); setInvoices(i) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const openNew = () => setEditing({ customerId: '', amount: '', invoiceId: '' })
  const openEdit = (p: any) => setEditing({
    Id: p.Id,
    customerId: p.CustomerRef?.value || '',
    amount: p.TotalAmt != null ? String(p.TotalAmt) : '',
    invoiceId: p.Line?.[0]?.LinkedTxn?.[0]?.TxnId || '',
  })

  async function save() {
    if (!editing) return
    const payload = {
      customerId: editing.customerId,
      amount: editing.amount,
      invoiceId: editing.invoiceId || undefined,
    }
    try {
      if (editing.Id) {
        await api.payments.update(editing.Id, payload)
      } else {
        await api.payments.create(payload)
      }
      setEditing(null)
      refresh()
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (loading) return <LoadingState />

  const customerInvoices = editing
    ? invoices.filter(i => i.CustomerRef?.value === editing.customerId)
    : []

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle="Record of customer payments"
        actions={<Button onClick={openNew}><Plus size="small" /> Record payment</Button>}
      />
      {error && (
        <div style={{ marginBottom: 16 }}>
          <PageMessage type="error" title="Error" dismissible onClose={() => setError(null)}>{error}</PageMessage>
        </div>
      )}
      <Card>
        <CardBody>
          {payments.length === 0 ? (
            <EmptyState
              title="No payments yet"
              description="When customers pay invoices, they'll show up here."
              action={<Button onClick={openNew}><Plus size="small" /> Record payment</Button>}
            />
          ) : (
            <div className="ip-data-table">
            <Table hover="row">
              <Table.Header>
                <Table.Row>
                  <Table.Cell component="th">Date</Table.Cell>
                  <Table.Cell component="th">Customer</Table.Cell>
                  <Table.Cell component="th">Amount</Table.Cell>
                  <Table.Cell component="th">Method</Table.Cell>
                  <Table.Cell component="th">Reference</Table.Cell>
                  <Table.Cell component="th">Actions</Table.Cell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {payments.map(p => (
                  <Table.Row key={p.Id}>
                    <Table.Cell mobileLabel="Date"><B3>{formatDate(p.TxnDate)}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Customer"><B2>{p.CustomerRef?.name}</B2></Table.Cell>
                    <Table.Cell mobileLabel="Amount"><B3>{formatCurrency(p.TotalAmt)}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Method"><B3>{p.PaymentMethodRef?.name || '—'}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Reference"><B3>{p.PaymentRefNum || '—'}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Actions">
                      <Button priority="secondary" size="small" onClick={() => openEdit(p)}>Edit</Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
            </div>
          )}
        </CardBody>
      </Card>

      {editing && (
        <Modal open onClose={() => setEditing(null)} dismissible size="medium">
          <ModalHeader dismissible onClose={() => setEditing(null)}>
            <ModalTitle title={editing.Id ? 'Edit payment' : 'Record payment'} />
          </ModalHeader>
          <ModalContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Dropdown
                label="Customer"
                value={editing.customerId}
                onChange={(_e: any, info: any) => setEditing({ ...editing, customerId: info?.value || '', invoiceId: '' })}
                enableFilterItems
              >
                {customers.map(c => (
                  <MenuItem key={c.Id} value={c.Id} menuItemLabel={c.DisplayName}>{c.DisplayName}</MenuItem>
                ))}
              </Dropdown>
              <TextField
                label="Amount"
                type="number"
                value={editing.amount}
                onChange={(e) => setEditing({ ...editing, amount: e.target.value })}
                addonBefore={<Currency size="small" />}
                required
              />
              <Dropdown
                label="Apply to invoice (optional)"
                value={editing.invoiceId}
                onChange={(_e: any, info: any) => setEditing({ ...editing, invoiceId: info?.value || '' })}
                disabled={!editing.customerId}
              >
                {[
                  <MenuItem key="__none" value="" menuItemLabel="— None —">— None —</MenuItem>,
                  ...customerInvoices.map(inv => (
                    <MenuItem key={inv.Id} value={inv.Id} menuItemLabel={`#${inv.DocNumber || inv.Id} · ${formatCurrency(inv.Balance)}`}>
                      #{inv.DocNumber || inv.Id} · {formatCurrency(inv.Balance)}
                    </MenuItem>
                  )),
                ]}
              </Dropdown>
            </div>
          </ModalContent>
          <ModalActions alignment="right">
            <Button priority="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={!editing.customerId || !editing.amount}>{editing.Id ? 'Save' : 'Record'}</Button>
          </ModalActions>
        </Modal>
      )}
    </>
  )
}
