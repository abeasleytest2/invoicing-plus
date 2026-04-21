const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const fs = require('fs');
const OAuthClient = require('intuit-oauth');
const QuickBooks = require('node-quickbooks');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CLIENT_DIST = path.join(__dirname, 'public-dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}
app.use(express.static(path.join(__dirname, 'public')));

const TOKENS_FILE = path.join(__dirname, 'tokens.json');

const oauthClient = new OAuthClient({
  clientId: process.env.QB_CLIENT_ID,
  clientSecret: process.env.QB_CLIENT_SECRET,
  environment: process.env.QB_ENVIRONMENT,
  redirectUri: process.env.QB_REDIRECT_URI,
});

function saveTokens(tokenData) {
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokenData, null, 2));
}

function loadTokens() {
  if (!fs.existsSync(TOKENS_FILE)) return null;
  return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8'));
}

async function refreshIfNeeded() {
  const tokens = loadTokens();
  if (!tokens) return null;
  if (Date.now() < tokens.expires_at - 60000) return tokens;
  try {
    oauthClient.setToken({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: 'bearer',
      expires_in: 3600,
      x_refresh_token_expires_in: 8726400,
    });
    const result = await oauthClient.refresh();
    const refreshed = result.getJson();
    const updated = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      realmId: tokens.realmId,
      expires_at: Date.now() + refreshed.expires_in * 1000,
    };
    saveTokens(updated);
    return updated;
  } catch (err) {
    console.error('Token refresh failed:', err.message);
    return tokens;
  }
}

async function getQbo() {
  const tokens = await refreshIfNeeded();
  if (!tokens) throw new Error('Not connected to QuickBooks. Visit /connect first.');
  return new QuickBooks(
    process.env.QB_CLIENT_ID,
    process.env.QB_CLIENT_SECRET,
    tokens.access_token,
    false,
    tokens.realmId,
    process.env.QB_ENVIRONMENT === 'sandbox',
    false,
    null,
    '2.0',
    tokens.refresh_token
  );
}

function cb(res) {
  return (err, data) => {
    if (err) {
      console.error('QBO error:', JSON.stringify(err, null, 2));
      return res.status(500).json({ error: err.fault || err.message || err });
    }
    res.json(data);
  };
}

app.get('/connect', (req, res) => {
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: 'init',
  });
  res.redirect(authUri);
});

app.get('/callback', async (req, res) => {
  try {
    const authResponse = await oauthClient.createToken(req.url);
    const token = authResponse.getJson();
    const realmId = req.query.realmId;
    saveTokens({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      realmId: realmId,
      expires_at: Date.now() + token.expires_in * 1000,
    });
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send('OAuth error: ' + err.message);
  }
});

const SYNC_FILE = path.join(__dirname, 'last-sync.json');
function loadSyncMeta() {
  if (!fs.existsSync(SYNC_FILE)) return null;
  try { return JSON.parse(fs.readFileSync(SYNC_FILE, 'utf8')); } catch { return null; }
}
function saveSyncMeta(meta) {
  fs.writeFileSync(SYNC_FILE, JSON.stringify(meta, null, 2));
}
function queryCount(qbo, method, responseKey) {
  return new Promise((resolve, reject) => {
    qbo[method]({ limit: 1000 }, (err, data) => {
      if (err) return reject(err);
      resolve((data?.QueryResponse?.[responseKey] || []).length);
    });
  });
}

app.post('/api/disconnect', (req, res) => {
  if (fs.existsSync(TOKENS_FILE)) fs.unlinkSync(TOKENS_FILE);
  if (fs.existsSync(SYNC_FILE)) fs.unlinkSync(SYNC_FILE);
  res.json({ success: true });
});

app.get('/api/status', (req, res) => {
  const tokens = loadTokens();
  const syncMeta = loadSyncMeta();
  res.json({ connected: !!tokens, realmId: tokens?.realmId || null, lastSync: syncMeta });
});

app.post('/api/sync', async (req, res) => {
  try {
    const qbo = await getQbo();
    const [customers, items, invoices, estimates, payments] = await Promise.all([
      queryCount(qbo, 'findCustomers', 'Customer'),
      queryCount(qbo, 'findItems', 'Item'),
      queryCount(qbo, 'findInvoices', 'Invoice'),
      queryCount(qbo, 'findEstimates', 'Estimate'),
      queryCount(qbo, 'findPayments', 'Payment'),
    ]);
    const meta = {
      syncedAt: new Date().toISOString(),
      counts: { customers, items, invoices, estimates, payments },
    };
    saveSyncMeta(meta);
    res.json(meta);
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: err.fault?.error?.[0]?.Message || err.message || String(err) });
  }
});

app.get('/api/company', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.getCompanyInfo(qbo.realmId, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/customers', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.findCustomers({ limit: 1000 }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Customer || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.post('/api/customers', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.createCustomer(req.body, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.put('/api/customers/:id', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.getCustomer(req.params.id, (err, existing) => {
      if (err) return cb(res)(err);
      const updated = { ...existing, ...req.body, Id: existing.Id, SyncToken: existing.SyncToken };
      qbo.updateCustomer(updated, cb(res));
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.delete('/api/customers/:id', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.getCustomer(req.params.id, (err, existing) => {
      if (err) return cb(res)(err);
      existing.Active = false;
      qbo.updateCustomer(existing, cb(res));
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/items', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.findItems({ limit: 1000 }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Item || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.post('/api/items', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.createItem(req.body, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.put('/api/items/:id', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.getItem(req.params.id, (err, existing) => {
      if (err) return cb(res)(err);
      const updated = { ...existing, ...req.body, Id: existing.Id, SyncToken: existing.SyncToken };
      qbo.updateItem(updated, cb(res));
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/invoices', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.findInvoices({ limit: 1000, desc: 'MetaData.CreateTime' }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Invoice || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/invoices/:id', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.getInvoice(req.params.id, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const qbo = await getQbo();
    const { customerId, lines, dueDate, memo } = req.body;

    qbo.findItems({ limit: 1 }, (itemErr, itemData) => {
      const defaultItem = itemData?.QueryResponse?.Item?.[0];
      const fallbackItemId = defaultItem?.Id || '1';

      const invoice = {
        CustomerRef: { value: customerId },
        DueDate: dueDate || undefined,
        CustomerMemo: memo ? { value: memo } : undefined,
        Line: lines.map((line) => {
          const qty = parseFloat(line.qty) || 1;
          const amount = parseFloat(line.amount) || 0;
          return {
            DetailType: 'SalesItemLineDetail',
            Amount: amount,
            Description: line.description,
            SalesItemLineDetail: {
              ItemRef: { value: line.itemId || fallbackItemId },
              Qty: qty,
              UnitPrice: amount / qty,
            },
          };
        }),
      };

      qbo.createInvoice(invoice, cb(res));
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.delete('/api/invoices/:id', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.getInvoice(req.params.id, (err, existing) => {
      if (err) return cb(res)(err);
      qbo.deleteInvoice(existing, cb(res));
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.post('/api/invoices/:id/send', async (req, res) => {
  try {
    const qbo = await getQbo();
    const email = req.body.email;
    qbo.sendInvoicePdf(req.params.id, email, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/invoices/:id/pdf', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.getInvoicePdf(req.params.id, (err, pdf) => {
      if (err) return res.status(500).json({ error: err });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=invoice-${req.params.id}.pdf`);
      res.send(pdf);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/estimates', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.findEstimates({ limit: 1000, desc: 'MetaData.CreateTime' }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Estimate || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.post('/api/estimates', async (req, res) => {
  try {
    const qbo = await getQbo();
    const { customerId, lines, memo } = req.body;
    qbo.findItems({ limit: 1 }, (itemErr, itemData) => {
      const fallbackItemId = itemData?.QueryResponse?.Item?.[0]?.Id || '1';
      const estimate = {
        CustomerRef: { value: customerId },
        CustomerMemo: memo ? { value: memo } : undefined,
        Line: lines.map((line) => {
          const qty = parseFloat(line.qty) || 1;
          const amount = parseFloat(line.amount) || 0;
          return {
            DetailType: 'SalesItemLineDetail',
            Amount: amount,
            Description: line.description,
            SalesItemLineDetail: {
              ItemRef: { value: line.itemId || fallbackItemId },
              Qty: qty,
              UnitPrice: amount / qty,
            },
          };
        }),
      };
      qbo.createEstimate(estimate, cb(res));
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.put('/api/estimates/:id', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.getEstimate(req.params.id, (err, existing) => {
      if (err) return cb(res)(err);
      const { customerId, lines, memo } = req.body;
      qbo.findItems({ limit: 1 }, (itemErr, itemData) => {
        const fallbackItemId = itemData?.QueryResponse?.Item?.[0]?.Id || '1';
        const updated = {
          ...existing,
          Id: existing.Id,
          SyncToken: existing.SyncToken,
          CustomerRef: customerId ? { value: customerId } : existing.CustomerRef,
          CustomerMemo: memo ? { value: memo } : existing.CustomerMemo,
          Line: lines ? lines.map((line) => {
            const qty = parseFloat(line.qty) || 1;
            const amount = parseFloat(line.amount) || 0;
            return {
              DetailType: 'SalesItemLineDetail',
              Amount: amount,
              Description: line.description,
              SalesItemLineDetail: {
                ItemRef: { value: line.itemId || fallbackItemId },
                Qty: qty,
                UnitPrice: amount / qty,
              },
            };
          }) : existing.Line,
        };
        qbo.updateEstimate(updated, cb(res));
      });
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/payments', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.findPayments({ limit: 1000, desc: 'MetaData.CreateTime' }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Payment || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.post('/api/payments', async (req, res) => {
  try {
    const qbo = await getQbo();
    const { customerId, amount, invoiceId } = req.body;
    const payment = {
      CustomerRef: { value: customerId },
      TotalAmt: parseFloat(amount),
      Line: invoiceId ? [{
        Amount: parseFloat(amount),
        LinkedTxn: [{ TxnId: invoiceId, TxnType: 'Invoice' }],
      }] : undefined,
    };
    qbo.createPayment(payment, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.put('/api/payments/:id', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.getPayment(req.params.id, (err, existing) => {
      if (err) return cb(res)(err);
      const { customerId, amount, invoiceId } = req.body;
      const total = amount != null ? parseFloat(amount) : existing.TotalAmt;
      const updated = {
        ...existing,
        Id: existing.Id,
        SyncToken: existing.SyncToken,
        CustomerRef: customerId ? { value: customerId } : existing.CustomerRef,
        TotalAmt: total,
        Line: invoiceId
          ? [{ Amount: total, LinkedTxn: [{ TxnId: invoiceId, TxnType: 'Invoice' }] }]
          : existing.Line,
      };
      qbo.updatePayment(updated, cb(res));
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/vendors', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.findVendors({ limit: 1000 }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Vendor || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.post('/api/vendors', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.createVendor(req.body, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/bills', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.findBills({ limit: 1000, desc: 'MetaData.CreateTime' }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Bill || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/bills/:id', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.getBill(req.params.id, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.post('/api/bills', async (req, res) => {
  try {
    const qbo = await getQbo();
    const { vendorId, amount, txnDate, dueDate, memo, accountId } = req.body;
    const bill = {
      VendorRef: { value: vendorId },
      TxnDate: txnDate || undefined,
      DueDate: dueDate || undefined,
      PrivateNote: memo || undefined,
      Line: [{
        DetailType: 'AccountBasedExpenseLineDetail',
        Amount: parseFloat(amount) || 0,
        Description: memo || undefined,
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: accountId || '7' },
        },
      }],
    };
    qbo.createBill(bill, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.post('/api/bills/:id/attach', upload.single('file'), async (req, res) => {
  try {
    const qbo = await getQbo();
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { Readable } = require('stream');
    const stream = Readable.from(req.file.buffer);
    qbo.upload(
      req.file.originalname,
      req.file.mimetype,
      stream,
      'Bill',
      req.params.id,
      cb(res)
    );
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.post('/api/receipts/upload', upload.single('file'), async (req, res) => {
  try {
    const qbo = await getQbo();
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { vendorId, amount, txnDate, dueDate, memo, accountId } = req.body;
    const bill = {
      VendorRef: { value: vendorId },
      TxnDate: txnDate || undefined,
      DueDate: dueDate || undefined,
      PrivateNote: memo || undefined,
      Line: [{
        DetailType: 'AccountBasedExpenseLineDetail',
        Amount: parseFloat(amount) || 0,
        Description: memo || undefined,
        AccountBasedExpenseLineDetail: {
          AccountRef: { value: accountId || '7' },
        },
      }],
    };
    qbo.createBill(bill, (billErr, createdBill) => {
      if (billErr) return cb(res)(billErr);
      const { Readable } = require('stream');
      const stream = Readable.from(req.file.buffer);
      qbo.upload(
        req.file.originalname,
        req.file.mimetype,
        stream,
        'Bill',
        createdBill.Id,
        (attachErr, attachable) => {
          res.json({ bill: createdBill, attachable: attachErr ? null : attachable, attachError: attachErr?.message });
        }
      );
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/accounts', async (req, res) => {
  try {
    const qbo = await getQbo();
    qbo.findAccounts({ AccountType: 'Expense', limit: 1000 }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Account || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/reports/:name', async (req, res) => {
  try {
    const qbo = await getQbo();
    const reportMap = {
      ProfitAndLoss: 'reportProfitAndLoss',
      BalanceSheet: 'reportBalanceSheet',
      CashFlow: 'reportCashFlow',
      AgedReceivables: 'reportAgedReceivables',
      AgedPayables: 'reportAgedPayables',
      CustomerBalance: 'reportCustomerBalance',
      GeneralLedger: 'reportGeneralLedger',
      TrialBalance: 'reportTrialBalance',
      TransactionList: 'reportTransactionList',
    };
    const method = reportMap[req.params.name];
    if (!method) return res.status(404).json({ error: 'Unknown report' });
    qbo[method](req.query, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/api/dashboard', async (req, res) => {
  try {
    const qbo = await getQbo();
    const fetchInvoices = new Promise((resolve) =>
      qbo.findInvoices({ limit: 1000 }, (err, data) => resolve(err ? [] : data.QueryResponse.Invoice || []))
    );
    const fetchCustomers = new Promise((resolve) =>
      qbo.findCustomers({ limit: 1000 }, (err, data) => resolve(err ? [] : data.QueryResponse.Customer || []))
    );
    const fetchPayments = new Promise((resolve) =>
      qbo.findPayments({ limit: 1000 }, (err, data) => resolve(err ? [] : data.QueryResponse.Payment || []))
    );

    const [invoices, customers, payments] = await Promise.all([fetchInvoices, fetchCustomers, fetchPayments]);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const outstanding = invoices.reduce((s, i) => s + (parseFloat(i.Balance) || 0), 0);
    const overdue = invoices
      .filter(i => i.Balance > 0 && i.DueDate && new Date(i.DueDate) < now)
      .reduce((s, i) => s + (parseFloat(i.Balance) || 0), 0);
    const paidThisMonth = payments
      .filter(p => new Date(p.TxnDate) >= monthStart)
      .reduce((s, p) => s + (parseFloat(p.TotalAmt) || 0), 0);
    const invoicedThisMonth = invoices
      .filter(i => new Date(i.TxnDate) >= monthStart)
      .reduce((s, i) => s + (parseFloat(i.TotalAmt) || 0), 0);

    res.json({
      totals: {
        outstanding,
        overdue,
        paidThisMonth,
        invoicedThisMonth,
        customerCount: customers.length,
        invoiceCount: invoices.length,
      },
      recentInvoices: invoices.slice(0, 5),
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

app.get('/*splat', (req, res) => {
  const indexPath = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Visit http://localhost:${PORT}/connect to connect QuickBooks`);
});
