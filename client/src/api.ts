import { useAuth } from '@clerk/clerk-react'
import { useMemo } from 'react'

const BASE = ''

export type SyncMeta = {
  syncedAt: string
  counts: { customers: number; items: number; invoices: number; estimates: number; payments: number }
}

type Fetcher = (path: string, init?: RequestInit) => Promise<Response>

function buildApi(fetcher: Fetcher) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetcher(BASE + path, init)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error?.message || body.error || `Request failed: ${res.status}`)
    }
    return res.json()
  }

  return {
    status: () => request<{ connected: boolean; realmId: string | null; lastSync: SyncMeta | null }>('/api/status'),
    connectUrl: () => request<{ url: string }>('/api/connect-url'),
    sync: () => request<SyncMeta>('/api/sync', { method: 'POST' }),
    disconnect: () => request<{ success: boolean }>('/api/disconnect', { method: 'POST' }),
    company: () => request<any>('/api/company'),
    dashboard: () => request<any>('/api/dashboard'),

    customers: {
      list: () => request<any[]>('/api/customers'),
      create: (data: any) => request<any>('/api/customers', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => request<any>(`/api/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      remove: (id: string) => request<any>(`/api/customers/${id}`, { method: 'DELETE' }),
    },

    items: {
      list: () => request<any[]>('/api/items'),
      create: (data: any) => request<any>('/api/items', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => request<any>(`/api/items/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    },

    invoices: {
      list: () => request<any[]>('/api/invoices'),
      get: (id: string) => request<any>(`/api/invoices/${id}`),
      create: (data: any) => request<any>('/api/invoices', { method: 'POST', body: JSON.stringify(data) }),
      remove: (id: string) => request<any>(`/api/invoices/${id}`, { method: 'DELETE' }),
      send: (id: string, email: string) => request<any>(`/api/invoices/${id}/send`, { method: 'POST', body: JSON.stringify({ email }) }),
      pdfUrl: (id: string) => `/api/invoices/${id}/pdf`,
    },

    estimates: {
      list: () => request<any[]>('/api/estimates'),
      create: (data: any) => request<any>('/api/estimates', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => request<any>(`/api/estimates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    },

    payments: {
      list: () => request<any[]>('/api/payments'),
      create: (data: any) => request<any>('/api/payments', { method: 'POST', body: JSON.stringify(data) }),
      update: (id: string, data: any) => request<any>(`/api/payments/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    },

    vendors: {
      list: () => request<any[]>('/api/vendors'),
      create: (data: any) => request<any>('/api/vendors', { method: 'POST', body: JSON.stringify(data) }),
    },

    accounts: {
      list: () => request<any[]>('/api/accounts'),
    },

    bills: {
      list: () => request<any[]>('/api/bills'),
      get: (id: string) => request<any>(`/api/bills/${id}`),
      create: (data: any) => request<any>('/api/bills', { method: 'POST', body: JSON.stringify(data) }),
      attach: async (id: string, file: File) => {
        const fd = new FormData()
        fd.append('file', file)
        const r = await fetcher(`/api/bills/${id}/attach`, { method: 'POST', body: fd })
        if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error?.message || b.error || `Upload failed`) }
        return r.json()
      },
    },

    receipts: {
      upload: async (file: File, fields: Record<string, string>) => {
        const fd = new FormData()
        fd.append('file', file)
        for (const [k, v] of Object.entries(fields)) fd.append(k, v)
        const r = await fetcher('/api/receipts/upload', { method: 'POST', body: fd })
        if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error?.message || b.error || `Upload failed`) }
        return r.json()
      },
    },

    reports: {
      get: (name: string, params?: Record<string, string>) => {
        const q = params ? '?' + new URLSearchParams(params).toString() : ''
        return request<any>(`/api/reports/${name}${q}`)
      },
    },
  }
}

export function useApi() {
  const { getToken } = useAuth()

  return useMemo(() => {
    const fetcher: Fetcher = async (path, init = {}) => {
      const token = await getToken()
      const headers = new Headers(init.headers)
      if (token) headers.set('Authorization', `Bearer ${token}`)
      const isFormData = init.body instanceof FormData
      if (!isFormData && init.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json')
      }
      return fetch(path, { ...init, headers })
    }
    return buildApi(fetcher)
  }, [getToken])
}

export function formatCurrency(n: number | string | undefined): string {
  const num = Number(n) || 0
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
}

export function formatDate(d: string | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function invoiceStatus(inv: any): 'paid' | 'overdue' | 'unpaid' | 'draft' {
  const balance = parseFloat(inv.Balance) || 0
  if (balance === 0) return 'paid'
  if (inv.DueDate && new Date(inv.DueDate) < new Date()) return 'overdue'
  return 'unpaid'
}
