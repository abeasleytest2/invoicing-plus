import { useEffect, useState } from 'react'
import Button from '@ids-ts/button'
import TextField from '@ids-ts/text-field'
import { B2, B3 } from '@ids-ts/typography'
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalActions } from '@ids-ts/modal-dialog'
import PageMessage from '@ids-ts/page-message'
import '@ids-ts/page-message/dist/main.css'
import { Plus, Search } from '@design-systems/icons'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody } from '../components/Card'
import { LoadingState } from '../components/LoadingState'
import { DataTable, type Column } from '../components/DataTable'
import { useApi, formatCurrency } from '../api'

type CustomerForm = { Id?: string; DisplayName: string; email: string; phone: string }

export default function Customers() {
  const api = useApi()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<CustomerForm | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    setError(null)
    api.customers.list()
      .then(setCustomers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  async function save() {
    if (!editing) return
    const payload = {
      DisplayName: editing.DisplayName,
      PrimaryEmailAddr: editing.email ? { Address: editing.email } : undefined,
      PrimaryPhone: editing.phone ? { FreeFormNumber: editing.phone } : undefined,
    }
    try {
      if (editing.Id) {
        await api.customers.update(editing.Id, payload)
      } else {
        await api.customers.create(payload)
      }
      setEditing(null)
      refresh()
    } catch (e: any) {
      setError(e.message)
    }
  }

  const openEdit = (c: any) => setEditing({
    Id: c.Id,
    DisplayName: c.DisplayName || '',
    email: c.PrimaryEmailAddr?.Address || '',
    phone: c.PrimaryPhone?.FreeFormNumber || '',
  })
  const openNew = () => setEditing({ DisplayName: '', email: '', phone: '' })

  if (loading) return <LoadingState />

  const filtered = customers.filter(c =>
    (c.DisplayName || '').toLowerCase().includes(search.toLowerCase()),
  )

  const columns: Column<any>[] = [
    {
      id: 'name',
      header: 'Name',
      sortValue: (c) => (c.DisplayName || '').toLowerCase(),
      filterType: 'text',
      filterValue: (c) => c.DisplayName || '',
      cell: (c) => <B2>{c.DisplayName}</B2>,
    },
    {
      id: 'email',
      header: 'Email',
      sortValue: (c) => c.PrimaryEmailAddr?.Address || '',
      filterType: 'text',
      filterValue: (c) => c.PrimaryEmailAddr?.Address || '',
      cell: (c) => <B3>{c.PrimaryEmailAddr?.Address || '—'}</B3>,
    },
    {
      id: 'phone',
      header: 'Phone',
      sortValue: (c) => c.PrimaryPhone?.FreeFormNumber || '',
      filterType: 'text',
      filterValue: (c) => c.PrimaryPhone?.FreeFormNumber || '',
      cell: (c) => <B3>{c.PrimaryPhone?.FreeFormNumber || '—'}</B3>,
    },
    {
      id: 'balance',
      header: 'Balance',
      sortValue: (c) => parseFloat(c.Balance) || 0,
      filterType: 'numberRange',
      filterValue: (c) => parseFloat(c.Balance) || 0,
      cell: (c) => <B3>{formatCurrency(c.Balance)}</B3>,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: (c) => (
        <Button priority="secondary" size="small" onClick={() => openEdit(c)}>Edit</Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Manage your customer list"
        actions={<Button onClick={openNew}><Plus size="small" /> New customer</Button>}
      />

      {error && (
        <div style={{ marginBottom: 16 }}>
          <PageMessage type="error" title="Error" dismissible onClose={() => setError(null)}>{error}</PageMessage>
        </div>
      )}

      <Card>
        <CardBody>
          <div style={{ marginBottom: 16 }}>
            <TextField
              label="Search customers"
              placeholder="Search customers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              addonBefore={<Search size="small" />}
            />
          </div>

          <DataTable
            columns={columns}
            data={filtered}
            emptyTitle={customers.length === 0 ? 'No customers yet' : 'No matches'}
            emptyDescription={customers.length === 0 ? 'Add your first customer to start invoicing.' : 'Try a different search.'}
            emptyAction={customers.length === 0 ? <Button onClick={openNew}><Plus size="small" /> New customer</Button> : undefined}
          />
        </CardBody>
      </Card>

      {editing && (
        <Modal open onClose={() => setEditing(null)} dismissible size="medium">
          <ModalHeader dismissible onClose={() => setEditing(null)}>
            <ModalTitle title={editing.Id ? 'Edit customer' : 'New customer'} />
          </ModalHeader>
          <ModalContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <TextField label="Display name" value={editing.DisplayName} onChange={(e) => setEditing({ ...editing, DisplayName: e.target.value })} required />
              <TextField label="Email" type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} />
              <TextField label="Phone" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
            </div>
          </ModalContent>
          <ModalActions alignment="right">
            <Button priority="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={!editing.DisplayName}>{editing.Id ? 'Save' : 'Create'}</Button>
          </ModalActions>
        </Modal>
      )}
    </>
  )
}
