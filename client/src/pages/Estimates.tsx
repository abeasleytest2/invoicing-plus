import { useEffect, useState } from 'react'
import Button from '@ids-ts/button'
import TextField from '@ids-ts/text-field'
import TextArea from '@ids-ts/textarea'
import Dropdown from '@ids-ts/dropdown'
import { MenuItem } from '@ids-ts/menu'
import { IconControl } from '@ids-ts/icon-control'
import { Table } from '@ids-ts/table'
import { B2, B3, H3 } from '@ids-ts/typography'
import Badge from '@ids-ts/badge'
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalActions } from '@ids-ts/modal-dialog'
import PageMessage from '@ids-ts/page-message'
import '@ids-ts/page-message/dist/main.css'
import { Plus, Delete, Currency } from '@design-systems/icons'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody } from '../components/Card'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { useApi, formatCurrency, formatDate } from '../api'

type Line = { description: string; qty: string; amount: string; itemId?: string }
type EstimateForm = { Id?: string; customerId: string; memo: string; lines: Line[] }

export default function Estimates() {
  const api = useApi()
  const [estimates, setEstimates] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EstimateForm | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    Promise.all([api.estimates.list(), api.customers.list(), api.items.list()])
      .then(([e, c, i]) => { setEstimates(e); setCustomers(c); setItems(i) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const openNew = () => setEditing({ customerId: '', memo: '', lines: [{ description: '', qty: '1', amount: '' }] })
  const openEdit = (est: any) => setEditing({
    Id: est.Id,
    customerId: est.CustomerRef?.value || '',
    memo: est.CustomerMemo?.value || '',
    lines: (est.Line || [])
      .filter((l: any) => l.DetailType === 'SalesItemLineDetail')
      .map((l: any) => ({
        description: l.Description || '',
        qty: String(l.SalesItemLineDetail?.Qty ?? 1),
        amount: String(l.Amount ?? 0),
        itemId: l.SalesItemLineDetail?.ItemRef?.value,
      })),
  })

  const updateLine = (idx: number, patch: Partial<Line>) => {
    if (!editing) return
    setEditing({ ...editing, lines: editing.lines.map((l, i) => i === idx ? { ...l, ...patch } : l) })
  }
  const addLine = () => editing && setEditing({ ...editing, lines: [...editing.lines, { description: '', qty: '1', amount: '' }] })
  const removeLine = (idx: number) => editing && setEditing({ ...editing, lines: editing.lines.filter((_, i) => i !== idx) })

  async function save() {
    if (!editing) return
    try {
      if (editing.Id) {
        await api.estimates.update(editing.Id, { customerId: editing.customerId, memo: editing.memo, lines: editing.lines })
      } else {
        await api.estimates.create({ customerId: editing.customerId, memo: editing.memo, lines: editing.lines })
      }
      setEditing(null)
      refresh()
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (loading) return <LoadingState />

  const total = editing ? editing.lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0) : 0
  const canSave = editing && editing.customerId && editing.lines.every(l => l.description && l.amount)

  return (
    <>
      <PageHeader
        title="Estimates"
        subtitle="Quotes you've sent to customers"
        actions={<Button onClick={openNew}><Plus size="small" /> New estimate</Button>}
      />
      {error && (
        <div style={{ marginBottom: 16 }}>
          <PageMessage type="error" title="Error" dismissible onClose={() => setError(null)}>{error}</PageMessage>
        </div>
      )}
      <Card>
        <CardBody>
          {estimates.length === 0 ? (
            <EmptyState
              title="No estimates yet"
              description="Send a quote to a customer before creating an invoice."
              action={<Button onClick={openNew}><Plus size="small" /> New estimate</Button>}
            />
          ) : (
            <div className="ip-data-table">
            <Table hover="row">
              <Table.Header>
                <Table.Row>
                  <Table.Cell component="th">Estimate #</Table.Cell>
                  <Table.Cell component="th">Customer</Table.Cell>
                  <Table.Cell component="th">Date</Table.Cell>
                  <Table.Cell component="th">Expires</Table.Cell>
                  <Table.Cell component="th">Amount</Table.Cell>
                  <Table.Cell component="th">Status</Table.Cell>
                  <Table.Cell component="th">Actions</Table.Cell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {estimates.map(est => (
                  <Table.Row key={est.Id}>
                    <Table.Cell mobileLabel="Estimate"><B2>{est.DocNumber || est.Id}</B2></Table.Cell>
                    <Table.Cell mobileLabel="Customer"><B3>{est.CustomerRef?.name}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Date"><B3>{formatDate(est.TxnDate)}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Expires"><B3>{formatDate(est.ExpirationDate)}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Amount"><B3>{formatCurrency(est.TotalAmt)}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Status"><Badge status="info" label={est.TxnStatus || 'Pending'} /></Table.Cell>
                    <Table.Cell mobileLabel="Actions">
                      <Button priority="secondary" size="small" onClick={() => openEdit(est)}>Edit</Button>
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
        <Modal open onClose={() => setEditing(null)} dismissible size="large">
          <ModalHeader dismissible onClose={() => setEditing(null)}>
            <ModalTitle title={editing.Id ? 'Edit estimate' : 'New estimate'} />
          </ModalHeader>
          <ModalContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Dropdown
                label="Customer"
                value={editing.customerId}
                onChange={(_e: any, info: any) => setEditing({ ...editing, customerId: info?.value || '' })}
                enableFilterItems
              >
                {customers.map(c => (
                  <MenuItem key={c.Id} value={c.Id} menuItemLabel={c.DisplayName}>{c.DisplayName}</MenuItem>
                ))}
              </Dropdown>
              <TextArea
                label="Memo"
                value={editing.memo}
                onChange={(e) => setEditing({ ...editing, memo: e.target.value })}
                maxLength={500}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {editing.lines.map((line, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                    <TextField
                      label={idx === 0 ? 'Description' : ''}
                      value={line.description}
                      onChange={(e) => updateLine(idx, { description: e.target.value })}
                      required
                    />
                    <Dropdown
                      label={idx === 0 ? 'Product/Service' : ''}
                      value={line.itemId || ''}
                      onChange={(_e: any, info: any) => updateLine(idx, { itemId: info?.value })}
                      enableFilterItems
                    >
                      {items.map(it => (
                        <MenuItem key={it.Id} value={it.Id} menuItemLabel={it.Name}>{it.Name}</MenuItem>
                      ))}
                    </Dropdown>
                    <TextField
                      label={idx === 0 ? 'Qty' : ''}
                      type="number"
                      value={line.qty}
                      onChange={(e) => updateLine(idx, { qty: e.target.value })}
                      required
                    />
                    <TextField
                      label={idx === 0 ? 'Amount' : ''}
                      type="number"
                      value={line.amount}
                      onChange={(e) => updateLine(idx, { amount: e.target.value })}
                      addonBefore={<Currency size="small" />}
                      required
                    />
                    <IconControl
                      aria-label="Remove line"
                      onClick={() => removeLine(idx)}
                      disabled={editing.lines.length === 1}
                    >
                      <Delete size="small" />
                    </IconControl>
                  </div>
                ))}
              </div>
              <div>
                <Button priority="tertiary" size="small" onClick={addLine}><Plus size="small" /> Add line</Button>
              </div>
              <div style={{ paddingTop: 12, borderTop: '1px solid var(--color-container-border-primary)', textAlign: 'right' }}>
                <B3>Total</B3>
                <H3 style={{ marginTop: 4 }}>{formatCurrency(total)}</H3>
              </div>
            </div>
          </ModalContent>
          <ModalActions alignment="right">
            <Button priority="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={!canSave}>{editing.Id ? 'Save' : 'Create'}</Button>
          </ModalActions>
        </Modal>
      )}
    </>
  )
}
