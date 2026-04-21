import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Button from '@ids-ts/button'
import Badge from '@ids-ts/badge'
import { H3, B2, B3, Demi } from '@ids-ts/typography'
import {
  Home, Currency, Person, BoxPlus, Cash, ChartBar,
  NotePlus, Receipt, Settings as SettingsIcon,
} from '@design-systems/icons'
import { api } from './api'
import './Layout.css'

type NavItem = { to: string; label: string; Icon: any }

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', Icon: Home },
  { to: '/invoices', label: 'Invoices', Icon: Currency },
  { to: '/estimates', label: 'Estimates', Icon: NotePlus },
  { to: '/payments', label: 'Payments', Icon: Cash },
  { to: '/bills', label: 'Bills', Icon: Receipt },
  { to: '/customers', label: 'Customers', Icon: Person },
  { to: '/items', label: 'Products & Services', Icon: BoxPlus },
  { to: '/reports', label: 'Reports', Icon: ChartBar },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [realmId, setRealmId] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.status().then(s => {
      setConnected(s.connected)
      setRealmId(s.realmId)
    }).catch(() => setConnected(false))
  }, [])

  async function disconnect() {
    await api.disconnect()
    setConnected(false)
    navigate('/')
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">I+</div>
          <H3>InvoicingPlus</H3>
        </div>
        <nav className="nav">
          {navItems.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <Icon size="medium" />
              <B2>{label}</B2>
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="connection">
            {connected === null ? (
              <B3>Checking connection…</B3>
            ) : connected ? (
              <>
                <Badge status="success" label="Connected to QuickBooks" />
                <B3><Demi>Company:</Demi> {realmId}</B3>
                <Button priority="tertiary" size="small" onClick={disconnect}>Disconnect</Button>
              </>
            ) : (
              <>
                <Badge status="error" label="Not connected" />
                <Button size="small" onClick={() => { window.location.href = '/connect' }}>Connect to QuickBooks</Button>
              </>
            )}
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  )
}
