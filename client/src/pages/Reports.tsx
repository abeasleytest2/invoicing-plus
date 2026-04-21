import { useEffect, useState } from 'react'
import Dropdown from '@ids-ts/dropdown'
import { MenuItem } from '@ids-ts/menu'
import { H3, B2, B3, Demi } from '@ids-ts/typography'
import PageMessage from '@ids-ts/page-message'
import '@ids-ts/page-message/dist/main.css'
import { PageHeader } from '../components/PageHeader'
import { Card, CardHeader, CardBody } from '../components/Card'
import { LoadingState } from '../components/LoadingState'
import { api } from '../api'

const reportOptions = [
  { value: 'ProfitAndLoss', label: 'Profit & Loss' },
  { value: 'BalanceSheet', label: 'Balance Sheet' },
  { value: 'CashFlow', label: 'Cash Flow' },
  { value: 'AgedReceivables', label: 'Aged Receivables' },
  { value: 'AgedPayables', label: 'Aged Payables' },
  { value: 'CustomerBalance', label: 'Customer Balance' },
  { value: 'TrialBalance', label: 'Trial Balance' },
  { value: 'GeneralLedger', label: 'General Ledger' },
  { value: 'TransactionList', label: 'Transaction List' },
]

export default function Reports() {
  const [selected, setSelected] = useState('ProfitAndLoss')
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    api.reports.get(selected)
      .then(setReport)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [selected])

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Financial reports from QuickBooks"
        actions={
          <div style={{ minWidth: 240 }}>
            <Dropdown value={selected} onChange={(_e: any, info: any) => setSelected(info?.value)}>
              {reportOptions.map(r => (
                <MenuItem key={r.value} value={r.value} menuItemLabel={r.label}>{r.label}</MenuItem>
              ))}
            </Dropdown>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <H3>{reportOptions.find(r => r.value === selected)?.label}</H3>
        </CardHeader>
        <CardBody>
          {loading ? <LoadingState /> : error ? (
            <PageMessage type="error" title="Couldn't load report" dismissible={false}>{error}</PageMessage>
          ) : (
            <ReportRenderer report={report} />
          )}
        </CardBody>
      </Card>
    </>
  )
}

function ReportRenderer({ report }: { report: any }) {
  if (!report) return <B2 as="p">No data.</B2>
  const header = report.Header || {}
  const rows = report.Rows?.Row || []

  return (
    <div>
      <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--color-container-border-primary, #e5e5e5)' }}>
        <B2 as="p"><Demi>{header.ReportName}</Demi></B2>
        {header.StartPeriod && header.EndPeriod && (
          <B3 as="p" style={{ color: 'var(--color-text-secondary, #6b7280)' }}>
            {header.StartPeriod} – {header.EndPeriod}
          </B3>
        )}
      </div>
      <ReportRows rows={rows} level={0} />
    </div>
  )
}

function ReportRows({ rows, level }: { rows: any[]; level: number }) {
  return (
    <div>
      {rows.map((row, i) => {
        if (row.type === 'Section') {
          return (
            <div key={i} style={{ marginBottom: 8 }}>
              {row.Header?.ColData && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 0', paddingLeft: level * 16, fontWeight: 600 }}>
                  <B3>{row.Header.ColData[0]?.value}</B3>
                  <B3>{row.Header.ColData[row.Header.ColData.length - 1]?.value}</B3>
                </div>
              )}
              {row.Rows?.Row && <ReportRows rows={row.Rows.Row} level={level + 1} />}
              {row.Summary?.ColData && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 0', paddingLeft: level * 16, borderTop: '1px solid var(--color-container-border-primary, #e5e5e5)', fontWeight: 600 }}>
                  <B3>{row.Summary.ColData[0]?.value}</B3>
                  <B3>{row.Summary.ColData[row.Summary.ColData.length - 1]?.value}</B3>
                </div>
              )}
            </div>
          )
        }
        const data = row.ColData || []
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '6px 0', paddingLeft: level * 16 }}>
            <B3>{data[0]?.value || '—'}</B3>
            <B3>{data[data.length - 1]?.value || '—'}</B3>
          </div>
        )
      })}
    </div>
  )
}
