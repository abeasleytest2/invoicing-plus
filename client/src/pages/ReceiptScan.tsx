import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '@ids-ts/button'
import TextField from '@ids-ts/text-field'
import TextArea from '@ids-ts/textarea'
import Dropdown from '@ids-ts/dropdown'
import { MenuItem } from '@ids-ts/menu'
import { H3, B2, B3 } from '@ids-ts/typography'
import PageMessage from '@ids-ts/page-message'
import '@ids-ts/page-message/dist/main.css'
import { Camera, Currency, Plus } from '@design-systems/icons'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, CardBody } from '../components/Card'
import { LoadingState } from '../components/LoadingState'
import { useApi } from '../api'
import './ReceiptScan.css'

export default function ReceiptScan() {
  const api = useApi()
  const [vendors, setVendors] = useState<any[]>([])
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [vendorId, setVendorId] = useState('')
  const [newVendorName, setNewVendorName] = useState('')
  const [amount, setAmount] = useState('')
  const [txnDate, setTxnDate] = useState(new Date().toISOString().slice(0, 10))
  const [dueDate, setDueDate] = useState('')
  const [accountId, setAccountId] = useState('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([api.vendors.list(), api.accounts.list()])
      .then(([v, a]) => {
        setVendors(v)
        setAccounts(a)
        if (a.length > 0) setAccountId(a[0].Id)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function createVendor() {
    if (!newVendorName.trim()) return
    try {
      const v = await api.vendors.create({ DisplayName: newVendorName.trim() })
      const list = await api.vendors.list()
      setVendors(list)
      setVendorId(v.Id)
      setNewVendorName('')
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('Please take or select a photo of the receipt.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const result = await api.receipts.upload(file, {
        vendorId,
        amount,
        txnDate,
        dueDate,
        memo,
        accountId,
      })
      if (result.attachError) {
        setError(`Bill created, but image couldn't attach: ${result.attachError}`)
      }
      navigate('/bills')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState message="Loading vendors…" />

  const canSubmit = file && vendorId && amount && txnDate && accountId

  return (
    <>
      <PageHeader title="Scan receipt" subtitle="Turn a receipt photo into a bill in QuickBooks" />

      {error && (
        <div style={{ marginBottom: 16 }}>
          <PageMessage type="error" title="Error" dismissible onClose={() => setError(null)}>{error}</PageMessage>
        </div>
      )}

      <form onSubmit={submit}>
        <Card>
          <CardHeader><H3>Receipt photo</H3></CardHeader>
          <CardBody>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {preview ? (
              <div className="ip-receipt-preview">
                <img src={preview} alt="Receipt preview" />
                <div className="ip-receipt-preview-actions">
                  <Button type="button" priority="secondary" onClick={() => fileInput.current?.click()}>
                    <Camera size="small" /> Retake
                  </Button>
                  <Button type="button" priority="tertiary" onClick={() => setFile(null)}>Remove</Button>
                </div>
              </div>
            ) : (
              <div className="ip-receipt-drop" onClick={() => fileInput.current?.click()} role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.current?.click() }}
              >
                <Camera size="large" />
                <B2>Tap to take a photo or choose an image</B2>
                <B3>JPG or PNG up to 10 MB</B3>
              </div>
            )}
          </CardBody>
        </Card>

        <div style={{ marginTop: 16 }}>
          <Card>
            <CardHeader><H3>Bill details</H3></CardHeader>
            <CardBody>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Dropdown
                  label="Vendor"
                  value={vendorId}
                  onChange={(_e: any, info: any) => setVendorId(info?.value || '')}
                  enableFilterItems
                >
                  {vendors.map(v => (
                    <MenuItem key={v.Id} value={v.Id} menuItemLabel={v.DisplayName}>{v.DisplayName}</MenuItem>
                  ))}
                </Dropdown>
                <Dropdown
                  label="Expense account"
                  value={accountId}
                  onChange={(_e: any, info: any) => setAccountId(info?.value || '')}
                  enableFilterItems
                >
                  {accounts.map(a => (
                    <MenuItem key={a.Id} value={a.Id} menuItemLabel={a.Name}>{a.Name}</MenuItem>
                  ))}
                </Dropdown>
              </div>

              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Add new vendor"
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    placeholder="Vendor name"
                  />
                </div>
                <Button type="button" priority="secondary" onClick={createVendor} disabled={!newVendorName.trim()}>
                  <Plus size="small" /> Add
                </Button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginTop: 16 }}>
                <TextField
                  label="Amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  addonBefore={<Currency size="small" />}
                  required
                />
                <TextField
                  label="Date"
                  type="date"
                  value={txnDate}
                  onChange={(e) => setTxnDate(e.target.value)}
                  required
                />
                <TextField
                  label="Due date (optional)"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <TextArea
                  label="Memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  maxLength={500}
                />
              </div>
            </CardBody>
          </Card>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
          <Button priority="secondary" type="button" onClick={() => navigate('/bills')}>Cancel</Button>
          <Button type="submit" isLoading={submitting} disabled={!canSubmit}>Create bill</Button>
        </div>
      </form>
    </>
  )
}
