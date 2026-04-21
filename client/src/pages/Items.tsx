import { useEffect, useState } from 'react'
import Button from '@ids-ts/button'
import TextField from '@ids-ts/text-field'
import Dropdown from '@ids-ts/dropdown'
import { MenuItem } from '@ids-ts/menu'
import { Table } from '@ids-ts/table'
import { B2, B3 } from '@ids-ts/typography'
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalActions } from '@ids-ts/modal-dialog'
import Badge from '@ids-ts/badge'
import PageMessage from '@ids-ts/page-message'
import '@ids-ts/page-message/dist/main.css'
import { Plus, Currency } from '@design-systems/icons'
import { PageHeader } from '../components/PageHeader'
import { Card, CardBody } from '../components/Card'
import { LoadingState } from '../components/LoadingState'
import { EmptyState } from '../components/EmptyState'
import { useApi, formatCurrency } from '../api'

type ItemForm = { Id?: string; Name: string; Type: string; UnitPrice: string }

export default function Items() {
  const api = useApi()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<ItemForm | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = () => {
    setLoading(true)
    setError(null)
    api.items.list()
      .then(setItems)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { refresh() }, [])

  const openNew = () => setEditing({ Name: '', Type: 'Service', UnitPrice: '' })
  const openEdit = (it: any) => setEditing({
    Id: it.Id,
    Name: it.Name || '',
    Type: it.Type || 'Service',
    UnitPrice: it.UnitPrice != null ? String(it.UnitPrice) : '',
  })

  async function save() {
    if (!editing) return
    const payload = {
      Name: editing.Name,
      Type: editing.Type || 'Service',
      UnitPrice: parseFloat(editing.UnitPrice) || 0,
      IncomeAccountRef: { value: '1' },
    }
    try {
      if (editing.Id) {
        await api.items.update(editing.Id, payload)
      } else {
        await api.items.create(payload)
      }
      setEditing(null)
      refresh()
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (loading) return <LoadingState />

  return (
    <>
      <PageHeader
        title="Products & Services"
        subtitle="Items you invoice your customers for"
        actions={<Button onClick={openNew}><Plus size="small" /> New item</Button>}
      />

      {error && (
        <div style={{ marginBottom: 16 }}>
          <PageMessage type="error" title="Error" dismissible onClose={() => setError(null)}>{error}</PageMessage>
        </div>
      )}

      <Card>
        <CardBody>
          {items.length === 0 ? (
            <EmptyState
              title="No items yet"
              description="Add products or services you sell to invoice customers for them."
              action={<Button onClick={openNew}><Plus size="small" /> New item</Button>}
            />
          ) : (
            <div className="ip-data-table">
            <Table hover="row">
              <Table.Header>
                <Table.Row>
                  <Table.Cell component="th">Name</Table.Cell>
                  <Table.Cell component="th">Type</Table.Cell>
                  <Table.Cell component="th">Price</Table.Cell>
                  <Table.Cell component="th">Status</Table.Cell>
                  <Table.Cell component="th">Actions</Table.Cell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {items.map(it => (
                  <Table.Row key={it.Id}>
                    <Table.Cell mobileLabel="Name"><B2>{it.Name}</B2></Table.Cell>
                    <Table.Cell mobileLabel="Type"><B3>{it.Type}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Price"><B3>{formatCurrency(it.UnitPrice)}</B3></Table.Cell>
                    <Table.Cell mobileLabel="Status">
                      <Badge status={it.Active ? 'success' : 'draft'} label={it.Active ? 'Active' : 'Inactive'} />
                    </Table.Cell>
                    <Table.Cell mobileLabel="Actions">
                      <Button priority="secondary" size="small" onClick={() => openEdit(it)}>Edit</Button>
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
            <ModalTitle title={editing.Id ? 'Edit product or service' : 'New product or service'} />
          </ModalHeader>
          <ModalContent>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <TextField label="Name" value={editing.Name} onChange={(e) => setEditing({ ...editing, Name: e.target.value })} required />
              <Dropdown label="Type" value={editing.Type} onChange={(_e: any, info: any) => setEditing({ ...editing, Type: info?.value })}>
                <MenuItem value="Service" menuItemLabel="Service">Service</MenuItem>
                <MenuItem value="NonInventory" menuItemLabel="Non-inventory">Non-inventory</MenuItem>
                <MenuItem value="Inventory" menuItemLabel="Inventory">Inventory</MenuItem>
              </Dropdown>
              <TextField label="Price" type="number" value={editing.UnitPrice} onChange={(e) => setEditing({ ...editing, UnitPrice: e.target.value })} addonBefore={<Currency size="small" />} />
            </div>
          </ModalContent>
          <ModalActions alignment="right">
            <Button priority="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={!editing.Name}>{editing.Id ? 'Save' : 'Create'}</Button>
          </ModalActions>
        </Modal>
      )}
    </>
  )
}
