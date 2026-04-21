import { useEffect, useState } from 'react'
import Button from '@ids-ts/button'
import { H3, B2, B3, Demi } from '@ids-ts/typography'
import PageMessage from '@ids-ts/page-message'
import '@ids-ts/page-message/dist/main.css'
import { Refresh } from '@design-systems/icons'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, CardBody } from '../components/Card'
import { LoadingState } from '../components/LoadingState'
import { useApi, type SyncMeta } from '../api'

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleString()
}

export default function Settings() {
  const api = useApi()
  const [status, setStatus] = useState<any>(null)
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMeta, setSyncMeta] = useState<SyncMeta | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [syncSuccess, setSyncSuccess] = useState(false)

  useEffect(() => {
    api.status().then(s => {
      setStatus(s)
      setSyncMeta(s.lastSync)
      if (s.connected) return api.company().then(setCompany).catch(() => null)
    }).finally(() => setLoading(false))
  }, [])

  async function runSync() {
    setSyncing(true)
    setSyncError(null)
    setSyncSuccess(false)
    try {
      const meta = await api.sync()
      setSyncMeta(meta)
      setSyncSuccess(true)
    } catch (e: any) {
      setSyncError(e.message)
    } finally {
      setSyncing(false)
    }
  }

  if (loading) return <LoadingState />

  return (
    <>
      <PageHeader title="Settings" subtitle="QuickBooks connection and preferences" />

      <Card>
        <CardHeader><H3>QuickBooks connection</H3></CardHeader>
        <CardBody>
          {status?.connected ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Row label="Status" value={<B3><Demi>Connected</Demi></B3>} />
              <Row label="Realm / Company ID" value={<B3>{status.realmId}</B3>} />
              {company && (
                <>
                  <Row label="Company name" value={<B3>{company.CompanyName}</B3>} />
                  <Row label="Legal name" value={<B3>{company.LegalName}</B3>} />
                  <Row label="Country" value={<B3>{company.Country}</B3>} />
                </>
              )}
              <div style={{ marginTop: 12 }}>
                <Button purpose="destructive" priority="secondary" onClick={async () => {
                  await api.disconnect()
                  window.location.href = '/'
                }}>Disconnect QuickBooks</Button>
              </div>
            </div>
          ) : (
            <div>
              <B2 as="p" style={{ marginBottom: 12 }}>You're not connected to QuickBooks.</B2>
              <Button onClick={async () => { const { url } = await api.connectUrl(); window.location.href = url }}>Connect to QuickBooks</Button>
            </div>
          )}
        </CardBody>
      </Card>

      {status?.connected && (
        <div style={{ marginTop: 16 }}>
          <Card>
            <CardHeader><H3>Data sync</H3></CardHeader>
            <CardBody>
              <B2 as="p" style={{ marginBottom: 16 }}>
                Refresh data from QuickBooks to pull in the latest customers, invoices, items, estimates, and payments.
              </B2>

              {syncError && (
                <div style={{ marginBottom: 16 }}>
                  <PageMessage type="error" title="Sync failed" dismissible onClose={() => setSyncError(null)}>{syncError}</PageMessage>
                </div>
              )}
              {syncSuccess && !syncError && (
                <div style={{ marginBottom: 16 }}>
                  <PageMessage type="success" title="Sync complete" dismissible onClose={() => setSyncSuccess(false)}>
                    Pulled the latest data from QuickBooks.
                  </PageMessage>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Row
                  label="Last synced"
                  value={<B3>{syncMeta ? `${formatRelative(syncMeta.syncedAt)} (${new Date(syncMeta.syncedAt).toLocaleString()})` : 'Never'}</B3>}
                />
                {syncMeta && (
                  <>
                    <Row label="Customers" value={<B3>{syncMeta.counts.customers}</B3>} />
                    <Row label="Products & services" value={<B3>{syncMeta.counts.items}</B3>} />
                    <Row label="Invoices" value={<B3>{syncMeta.counts.invoices}</B3>} />
                    <Row label="Estimates" value={<B3>{syncMeta.counts.estimates}</B3>} />
                    <Row label="Payments" value={<B3>{syncMeta.counts.payments}</B3>} />
                  </>
                )}
              </div>

              <div style={{ marginTop: 16 }}>
                <Button onClick={runSync} isLoading={syncing} disabled={syncing}>
                  <Refresh size="small" /> {syncing ? 'Syncing…' : 'Sync now'}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <Card>
          <CardHeader><H3>About InvoicingPlus</H3></CardHeader>
          <CardBody>
            <B2 as="p">
              InvoicingPlus is a simple interface for creating and managing invoices in QuickBooks Online. Built with the Intuit Design System.
            </B2>
          </CardBody>
        </Card>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16, padding: '6px 0' }}>
      <B3 style={{ color: 'var(--color-text-secondary, #6b7280)' }}>{label}</B3>
      {value}
    </div>
  )
}
