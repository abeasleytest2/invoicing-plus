import { useMemo, useState, type ReactNode } from 'react'
import { Table } from '@ids-ts/table'
import { B3 } from '@ids-ts/typography'
import TextField from '@ids-ts/text-field'
import DropdownButton from '@ids-ts/dropdown-button'
import { MenuItem } from '@ids-ts/menu'
import Button from '@ids-ts/button'
import { ArrowUp, ArrowDown, Filter, Close } from '@design-systems/icons'
import { EmptyState } from './EmptyState'
import './DataTable.css'

export type ColumnFilterType = 'text' | 'select' | 'numberRange' | 'dateRange'

export type Column<T> = {
  id: string
  header: string
  cell: (row: T) => ReactNode
  sortValue?: (row: T) => string | number | Date | null | undefined
  filterType?: ColumnFilterType
  filterValue?: (row: T) => string | number | Date | null | undefined
  filterOptions?: { value: string; label: string }[]
  mobileLabel?: string
  align?: 'left' | 'right'
}

type SortState = { columnId: string; direction: 'asc' | 'desc' } | null

type FilterValue =
  | { type: 'text'; value: string }
  | { type: 'select'; value: string }
  | { type: 'numberRange'; min: string; max: string }
  | { type: 'dateRange'; from: string; to: string }

type Filters = Record<string, FilterValue>

export function DataTable<T extends { Id?: string | number; id?: string | number }>(props: {
  columns: Column<T>[]
  data: T[]
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ReactNode
  getRowKey?: (row: T, idx: number) => string | number
  rowKey?: keyof T
}) {
  const { columns, data, emptyTitle, emptyDescription, emptyAction, getRowKey } = props
  const [sort, setSort] = useState<SortState>(null)
  const [filters, setFilters] = useState<Filters>({})
  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeFilterCount = Object.values(filters).filter(f => {
    if (f.type === 'text' || f.type === 'select') return f.value.length > 0
    if (f.type === 'numberRange') return f.min.length > 0 || f.max.length > 0
    if (f.type === 'dateRange') return f.from.length > 0 || f.to.length > 0
    return false
  }).length

  const filtered = useMemo(() => {
    if (activeFilterCount === 0) return data
    return data.filter(row => {
      for (const col of columns) {
        const filter = filters[col.id]
        if (!filter) continue
        const getValue = col.filterValue || col.sortValue
        const raw = getValue ? getValue(row) : null

        if (filter.type === 'text') {
          if (!filter.value) continue
          const s = raw == null ? '' : String(raw).toLowerCase()
          if (!s.includes(filter.value.toLowerCase())) return false
        } else if (filter.type === 'select') {
          if (!filter.value) continue
          if (String(raw ?? '') !== filter.value) return false
        } else if (filter.type === 'numberRange') {
          const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
          if (filter.min && !isNaN(parseFloat(filter.min)) && (isNaN(n) || n < parseFloat(filter.min))) return false
          if (filter.max && !isNaN(parseFloat(filter.max)) && (isNaN(n) || n > parseFloat(filter.max))) return false
        } else if (filter.type === 'dateRange') {
          const d = raw instanceof Date ? raw : raw ? new Date(String(raw)) : null
          if (!d || isNaN(d.getTime())) {
            if (filter.from || filter.to) return false
            continue
          }
          if (filter.from) {
            const from = new Date(filter.from)
            if (d < from) return false
          }
          if (filter.to) {
            const to = new Date(filter.to)
            to.setHours(23, 59, 59, 999)
            if (d > to) return false
          }
        }
      }
      return true
    })
  }, [data, columns, filters, activeFilterCount])

  const sorted = useMemo(() => {
    if (!sort) return filtered
    const col = columns.find(c => c.id === sort.columnId)
    if (!col || !col.sortValue) return filtered
    const dir = sort.direction === 'asc' ? 1 : -1
    const items = [...filtered]
    items.sort((a, b) => {
      const av = col.sortValue!(a)
      const bv = col.sortValue!(b)
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (av instanceof Date && bv instanceof Date) return (av.getTime() - bv.getTime()) * dir
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
      return String(av).localeCompare(String(bv)) * dir
    })
    return items
  }, [filtered, sort, columns])

  const handleSort = (columnId: string) => {
    setSort(prev => {
      if (!prev || prev.columnId !== columnId) return { columnId, direction: 'asc' }
      if (prev.direction === 'asc') return { columnId, direction: 'desc' }
      return null
    })
  }

  const clearFilters = () => setFilters({})

  const filterableColumns = columns.filter(c => c.filterType)

  const rowKey = (row: T, idx: number) => {
    if (getRowKey) return getRowKey(row, idx)
    if (props.rowKey) return String(row[props.rowKey])
    return String(row.Id ?? row.id ?? idx)
  }

  return (
    <div className="ip-data-table-wrapper">
      {filterableColumns.length > 0 && (
        <div className="ip-data-table-filters">
          <div className="ip-data-table-filters-bar">
            <Button
              priority="secondary"
              size="small"
              onClick={() => setFiltersOpen(o => !o)}
              aria-expanded={filtersOpen}
            >
              <Filter size="small" /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Button>
            {activeFilterCount > 0 && (
              <>
                <B3 className="ip-data-table-filter-count">
                  Showing {sorted.length} of {data.length}
                </B3>
                <Button priority="tertiary" size="small" onClick={clearFilters}>
                  <Close size="small" /> Clear
                </Button>
              </>
            )}
          </div>
          {filtersOpen && (
            <div className="ip-data-table-filters-row">
              {filterableColumns.map(col => (
                <FilterControl
                  key={col.id}
                  column={col}
                  value={filters[col.id]}
                  onChange={(v) => setFilters(prev => ({ ...prev, [col.id]: v }))}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          title={emptyTitle || (data.length === 0 ? 'No data' : 'No matches')}
          description={emptyDescription || (data.length === 0 ? 'Nothing to show yet.' : 'Try different filters.')}
          action={data.length === 0 ? emptyAction : undefined}
        />
      ) : (
        <div className="ip-data-table">
          <Table hover="row">
            <Table.Header>
              <Table.Row>
                {columns.map(col => {
                  const isSorted = sort?.columnId === col.id
                  const canSort = !!col.sortValue
                  return (
                    <Table.Cell component="th" key={col.id}>
                      {canSort ? (
                        <button
                          type="button"
                          className={`ip-sort-header ${isSorted ? 'is-sorted' : ''}`}
                          onClick={() => handleSort(col.id)}
                          aria-sort={isSorted ? (sort?.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                        >
                          {col.header}
                          <span className="ip-sort-icon" aria-hidden="true">
                            {isSorted && sort?.direction === 'asc' && <ArrowUp size="xsmall" />}
                            {isSorted && sort?.direction === 'desc' && <ArrowDown size="xsmall" />}
                            {!isSorted && <ArrowDown size="xsmall" />}
                          </span>
                        </button>
                      ) : (
                        col.header
                      )}
                    </Table.Cell>
                  )
                })}
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sorted.map((row, idx) => (
                <Table.Row key={rowKey(row, idx)}>
                  {columns.map(col => (
                    <Table.Cell key={col.id} mobileLabel={col.mobileLabel || col.header}>
                      {col.cell(row)}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      )}
    </div>
  )
}

function FilterControl<T>(props: {
  column: Column<T>
  value: FilterValue | undefined
  onChange: (v: FilterValue) => void
}) {
  const { column, value, onChange } = props

  if (column.filterType === 'text') {
    const v = (value?.type === 'text' ? value.value : '')
    return (
      <div className="ip-filter-field">
        <TextField
          label={`Filter ${column.header}`}
          size="small"
          placeholder={column.header}
          value={v}
          onChange={(e) => onChange({ type: 'text', value: e.target.value })}
          addonBefore={<Filter size="small" />}
          addonAfter={v ? (
            <button
              type="button"
              className="ip-filter-clear"
              onClick={() => onChange({ type: 'text', value: '' })}
              aria-label={`Clear ${column.header} filter`}
            >
              <Close size="small" />
            </button>
          ) : undefined}
        />
      </div>
    )
  }

  if (column.filterType === 'select') {
    const v = (value?.type === 'select' ? value.value : '')
    const selected = column.filterOptions?.find(o => o.value === v)
    const items = [
      <MenuItem key="__all" value="" menuItemLabel="All" onClick={() => onChange({ type: 'select', value: '' })}>All</MenuItem>,
      ...(column.filterOptions ?? []).map(opt => (
        <MenuItem
          key={opt.value}
          value={opt.value}
          menuItemLabel={opt.label}
          onClick={() => onChange({ type: 'select', value: opt.value })}
        >
          {opt.label}
        </MenuItem>
      )),
    ]
    return (
      <div className="ip-filter-field">
        <DropdownButton
          label={selected ? `${column.header}: ${selected.label}` : `${column.header}: All`}
          buttonPurpose="standard"
          buttonPriority="secondary"
          buttonSize="small"
        >
          {items}
        </DropdownButton>
      </div>
    )
  }

  if (column.filterType === 'numberRange') {
    const min = (value?.type === 'numberRange' ? value.min : '')
    const max = (value?.type === 'numberRange' ? value.max : '')
    return (
      <div className="ip-filter-field ip-filter-range">
        <TextField
          label={`${column.header} min`}
          size="small"
          placeholder={`${column.header} min`}
          type="number"
          value={min}
          onChange={(e) => onChange({ type: 'numberRange', min: e.target.value, max })}
        />
        <TextField
          label={`${column.header} max`}
          size="small"
          placeholder={`${column.header} max`}
          type="number"
          value={max}
          onChange={(e) => onChange({ type: 'numberRange', min, max: e.target.value })}
        />
      </div>
    )
  }

  if (column.filterType === 'dateRange') {
    const from = (value?.type === 'dateRange' ? value.from : '')
    const to = (value?.type === 'dateRange' ? value.to : '')
    return (
      <div className="ip-filter-field ip-filter-range">
        <TextField
          label={`${column.header} from`}
          size="small"
          type="date"
          value={from}
          onChange={(e) => onChange({ type: 'dateRange', from: e.target.value, to })}
        />
        <TextField
          label={`${column.header} to`}
          size="small"
          type="date"
          value={to}
          onChange={(e) => onChange({ type: 'dateRange', from, to: e.target.value })}
        />
      </div>
    )
  }

  return null
}
