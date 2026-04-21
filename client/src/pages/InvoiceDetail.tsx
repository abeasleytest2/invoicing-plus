import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Button from '@ids-ts/button'
import TextField from '@ids-ts/text-field'
import { Table } from '@ids-ts/table'
import { H3, B2, B3, Demi } from '@ids-ts/typography'
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalActions } from '@ids-ts/modal-dialog'
import PageMessage from '@ids-ts/page-message'
import '@ids-ts/page-message/dist/main.css'
import { ChevronLeft, Download, Send, Delete, Cash } from '@design-systems/icons'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, CardBody } from '../components/Card'
import { StatusBadge } from '../components/StatusBadge'
import { LoadingState } from '../components/LoadingState'
import { useApi, formatCurrency, formatDate, invoiceStatus } from '../api'

export default function InvoiceDetail() {
  const api = useApi()
  const { id } = useParams()
  const navigate = useNavigate()
  const [inv, setInv] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [emailModal, setEmailModal] = useState<{ email: string } | null>(null)
  const [paymentModal, setPaymentModal] = useState<{ amount: string } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    api.invoices.get(id).then(setInv).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [id])

  if (loading) return <LoadingState />
  if (error || !inv) {
    return (
      <>
        <PageHeader title="Invoice" />
        <PageMessage type="error" title="Couldn't load invoice" dismissible={false}>{error}</PageMessage>
      </>
    )
  }

  async function doDelete() {
    try {
      await api.invoices.remove(inv.Id)
      navigate('/invoices')
    } catch (e: any) {
      setActionError(e.message)
      setConfirmDelete(false)
    }
  }

  async function sendEmail() {
    if (!emailModal) return
    try {
      await api.invoices.send(inv.Id, emailModal.email)
      setEmailModal(null)
    } catch (e: any) {
      setActionError(e.message)
    }
  }

  async function recordPayment() {
    if (!paymentModal) return
    try {
      await api.payments.create({
        customerId: inv.CustomerRef.value,
        amount: paymentModal.amount,
        invoiceId: inv.Id,
      })
      setPaymentModal(null)
      const refreshed = await api.invoices.get(inv.Id)
      setInv(refreshed)
    } catch (e: any) {
      setActionError(e.message)
    }
  }

  return (
    <>
      <Link to="/invoices" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12, color: 'var(--color-text-secondary, #6b7280)' }}>
        <ChevronLeft size="small" /> <B3>Back to invoices</B3>
      </Link>

      {actionError && (
        <div style={{ marginBottom: 16 }}>
          <PageMessage type="error" title="Action failed" dismissible onClose={() => setActionError(null)}>{actionError}</PageMessage>
        </div>
      )}

      <PageHeader
        title={`Invoice #${inv.DocNumber || inv.Id}`}
        subtitle={inv.CustomerRef?.name}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button priority="secondary" onClick={() => window.open(api.invoices.pdfUrl(inv.Id), '_blank', 'noopener,noreferrer')}><Download size="small" /> PDF</Button>
            <Button priority="secondary" onClick={() => setEmailModal({ email: '' })}><Send size="small" /> Email</Button>
            {parseFloat(inv.Balance) > 0 && (
              <Button onClick={() => setPaymentModal({ amount: String(inv.Balance) })}><Cash size="small" /> Record payment</Button>
            )}
            <Button purpose="destructive" priority="secondary" onClick={() => setConfirmDelete(true)}><Delete size="small" /> Delete</Button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <Card>
          <CardHeader><H3>Line items</H3></CardHeader>
          <CardBody>
            <div className="ip-data-table">
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Cell component="th">Description</Table.Cell>
                  <Table.Cell component="th">Qty</Table.Cell>
                  <Table.Cell component="th">Rate</Table.Cell>
                  <Table.Cell component="th">Amount</Table.Cell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {(inv.Line || []).filter((l: any) => l.DetailType === 'SalesItemLineDetail').map((line: any, idx: number) => (
                  <Table.Row key={idx}>
                    <Table.Cell mobileLabel="Description"><B2>{line.Description || line.SalesItemLineDetail?.ItemRef?.name}</B2></Table.Cell>
                    <Table.Cell mobileLabel="Qty"><B3>{line.SalesItemLineDetail?.Qty}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Rate"><B3>{formatCurrency(line.SalesItemLineDetail?.UnitPrice)}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Amount"><B3>{formatCurrency(line.Amount)}</B3></Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
            </div>

            {inv.CustomerMemo?.value && (
              <div style={{ marginTop: 16, padding: 12, background: 'var(--color-container-background-secondary, #f5f7f8)', borderRadius: 'var(--radius-medium, 8px)' }}>
                <B3><Demi>Memo:</Demi> {inv.CustomerMemo.value}</B3>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader><H3>Summary</H3></CardHeader>
          <CardBody>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Row label="Status" value={<StatusBadge status={invoiceStatus(inv)} />} />
              <Row label="Invoice date" value={formatDate(inv.TxnDate)} />
              <Row label="Due date" value={formatDate(inv.DueDate)} />
              <Row label="Subtotal" value={formatCurrency(inv.TotalAmt)} />
              <Row label="Total" value={<Demi>{formatCurrency(inv.TotalAmt)}</Demi>} />
              <Row label="Balance due" value={<Demi>{formatCurrency(inv.Balance)}</Demi>} />
            </div>
          </CardBody>
        </Card>
      </div>

      {confirmDelete && (
        <Modal open onClose={() => setConfirmDelete(false)} dismissible size="small">
          <ModalHeader dismissible onClose={() => setConfirmDelete(false)}>
            <ModalTitle title="Delete invoice?" />
          </ModalHeader>
          <ModalContent>This will permanently remove the invoice from QuickBooks.</ModalContent>
          <ModalActions alignment="right">
            <Button priority="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button purpose="destructive" onClick={doDelete}>Delete</Button>
          </ModalActions>
        </Modal>
      )}

      {emailModal && (
        <Modal open onClose={() => setEmailModal(null)} dismissible size="small">
          <ModalHeader dismissible onClose={() => setEmailModal(null)}>
            <ModalTitle title="Email invoice" />
          </ModalHeader>
          <ModalContent>
            <TextField
              label="Recipient email"
              value={emailModal.email}
              onChange={(e) => setEmailModal({ email: e.target.value })}
              type="email"
            />
          </ModalContent>
          <ModalActions alignment="right">
            <Button priority="secondary" onClick={() => setEmailModal(null)}>Cancel</Button>
            <Button onClick={sendEmail} disabled={!emailModal.email}>Send</Button>
          </ModalActions>
        </Modal>
      )}

      {paymentModal && (
        <Modal open onClose={() => setPaymentModal(null)} dismissible size="small">
          <ModalHeader dismissible onClose={() => setPaymentModal(null)}>
            <ModalTitle title="Record payment" />
          </ModalHeader>
          <ModalContent>
            <TextField
              label="Amount"
              type="number"
              value={paymentModal.amount}
              onChange={(e) => setPaymentModal({ amount: e.target.value })}
            />
          </ModalContent>
          <ModalActions alignment="right">
            <Button priority="secondary" onClick={() => setPaymentModal(null)}>Cancel</Button>
            <Button onClick={recordPayment} disabled={!paymentModal.amount}>Record payment</Button>
          </ModalActions>
        </Modal>
      )}
    </>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
      <B3 style={{ color: 'var(--color-text-secondary, #6b7280)' }}>{label}</B3>
      <B3>{value}</B3>
    </div>
  )
}
