import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@ids-ts/button'
import TextField from '@ids-ts/text-field'
import TextArea from '@ids-ts/textarea'
import Dropdown from '@ids-ts/dropdown'
import { MenuItem } from '@ids-ts/menu'
import { IconControl } from '@ids-ts/icon-control'
import { H3, B3 } from '@ids-ts/typography'
import PageMessage from '@ids-ts/page-message'
import '@ids-ts/page-message/dist/main.css'
import { Plus, Delete, Currency } from '@design-systems/icons'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, CardBody } from '../components/Card'
import { LoadingState } from '../components/LoadingState'
import { api, formatCurrency } from '../api'

type Line = { description: string; qty: string; amount: string; itemId?: string }

export default function InvoiceCreate() {
  const [customers, setCustomers] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [customerId, setCustomerId] = useState<string>('')
  const [dueDate, setDueDate] = useState('')
  const [memo, setMemo] = useState('')
  const [lines, setLines] = useState<Line[]>([{ description: '', qty: '1', amount: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([api.customers.list(), api.items.list()])
      .then(([c, i]) => { setCustomers(c); setItems(i) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0)

  const updateLine = (idx: number, patch: Partial<Line>) =>
    setLines(lines.map((l, i) => (i === idx ? { ...l, ...patch } : l)))

  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await api.invoices.create({ customerId, lines, dueDate, memo })
      navigate(`/invoices/${result.Id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState message="Loading customers and items…" />

  return (
    <>
      <PageHeader title="New invoice" subtitle="Create an invoice and send it to QuickBooks" />

      {error && (
        <div style={{ marginBottom: 16 }}>
          <PageMessage type="error" title="Could not create invoice" dismissible onClose={() => setError(null)}>
            {error}
          </PageMessage>
        </div>
      )}

      <form onSubmit={submit}>
        <Card>
          <CardHeader>
            <H3>Invoice details</H3>
          </CardHeader>
          <CardBody>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Dropdown
                label="Customer"
                value={customerId}
                onChange={(_e: any, info: any) => setCustomerId(info?.value || '')}
                enableFilterItems
              >
                {customers.map(c => (
                  <MenuItem key={c.Id} value={c.Id} menuItemLabel={c.DisplayName}>
                    {c.DisplayName}
                  </MenuItem>
                ))}
              </Dropdown>

              <TextField
                label="Due date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div style={{ marginTop: 16 }}>
              <TextArea
                label="Memo (shown to customer)"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                maxLength={500}
              />
            </div>
          </CardBody>
        </Card>

        <div style={{ marginTop: 16 }}>
          <Card>
            <CardHeader>
              <H3>Line items</H3>
            </CardHeader>
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {lines.map((line, idx) => (
                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}>
                    <TextField
                      label={idx === 0 ? 'Description' : ''}
                      value={line.description}
                      onChange={(e) => updateLine(idx, { description: e.target.value })}
                      placeholder="e.g. Consulting services"
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
                      disabled={lines.length === 1}
                    >
                      <Delete size="small" />
                    </IconControl>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16 }}>
                <Button priority="tertiary" size="small" type="button" onClick={() => setLines([...lines, { description: '', qty: '1', amount: '' }])}>
                  <Plus size="small" /> Add line
                </Button>
              </div>

              <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--color-container-border-primary, #e5e5e5)', textAlign: 'right' }}>
                <B3>Total</B3>
                <H3 style={{ marginTop: 4 }}>{formatCurrency(total)}</H3>
              </div>
            </CardBody>
          </Card>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <Button priority="secondary" type="button" onClick={() => navigate('/invoices')}>Cancel</Button>
          <Button type="submit" isLoading={submitting} disabled={!customerId || lines.some(l => !l.description || !l.amount)}>
            Create invoice
          </Button>
        </div>
      </form>
    </>
  )
}
