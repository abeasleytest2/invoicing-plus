import { Routes, Route } from 'react-router-dom'
import { SignedIn, SignedOut, SignIn, SignUp } from '@clerk/clerk-react'
import Layout from './Layout'
import Dashboard from './pages/Dashboard'
import Invoices from './pages/Invoices'
import InvoiceCreate from './pages/InvoiceCreate'
import InvoiceDetail from './pages/InvoiceDetail'
import Customers from './pages/Customers'
import Items from './pages/Items'
import Payments from './pages/Payments'
import Estimates from './pages/Estimates'
import Bills from './pages/Bills'
import ReceiptScan from './pages/ReceiptScan'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import './Auth.css'

export default function App() {
  return (
    <>
      <SignedIn>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/invoices" element={<Invoices />} />
            <Route path="/invoices/new" element={<InvoiceCreate />} />
            <Route path="/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/items" element={<Items />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/estimates" element={<Estimates />} />
            <Route path="/bills" element={<Bills />} />
            <Route path="/bills/scan" element={<ReceiptScan />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </SignedIn>
      <SignedOut>
        <div className="auth-screen">
          <div className="auth-brand">
            <div className="auth-brand-mark">I+</div>
            <h1>InvoicingPlus</h1>
            <p>Sign in to manage your QuickBooks invoices, customers, and reports.</p>
          </div>
          <Routes>
            <Route path="/sign-up/*" element={<SignUp routing="path" path="/sign-up" signInUrl="/" />} />
            <Route path="*" element={<SignIn routing="path" path="/" signUpUrl="/sign-up" />} />
          </Routes>
        </div>
      </SignedOut>
    </>
  )
}
