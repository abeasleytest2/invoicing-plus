const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const fs = require('fs');
const OAuthClient = require('intuit-oauth');
const QuickBooks = require('node-quickbooks');
const multer = require('multer');
const { clerkMiddleware, requireAuth, getAuth } = require('@clerk/express');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(clerkMiddleware());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const CLIENT_DIST = path.join(__dirname, 'public-dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}
app.use(express.static(path.join(__dirname, 'public')));

const oauthClient = new OAuthClient({
  clientId: process.env.QB_CLIENT_ID,
  clientSecret: process.env.QB_CLIENT_SECRET,
  environment: process.env.QB_ENVIRONMENT,
  redirectUri: process.env.QB_REDIRECT_URI,
});

async function ensureUser(userId) {
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: { id: userId },
  });
}

async function getConnection(userId) {
  return prisma.qboConnection.findUnique({ where: { userId } });
}

async function refreshIfNeeded(conn) {
  if (!conn) return null;
  if (Date.now() < conn.expiresAt.getTime() - 60000) return conn;
  try {
    oauthClient.setToken({
      access_token: conn.accessToken,
      refresh_token: conn.refreshToken,
      token_type: 'bearer',
      expires_in: 3600,
      x_refresh_token_expires_in: 8726400,
    });
    const result = await oauthClient.refresh();
    const refreshed = result.getJson();
    return prisma.qboConnection.update({
      where: { userId: conn.userId },
      data: {
        accessToken: refreshed.access_token,
        refreshToken: refreshed.refresh_token,
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    });
  } catch (err) {
    console.error('Token refresh failed:', err.message);
    return conn;
  }
}

async function getQbo(userId) {
  const conn = await refreshIfNeeded(await getConnection(userId));
  if (!conn) throw new Error('Not connected to QuickBooks. Visit /connect first.');
  return new QuickBooks(
    process.env.QB_CLIENT_ID,
    process.env.QB_CLIENT_SECRET,
    conn.accessToken,
    false,
    conn.realmId,
    process.env.QB_ENVIRONMENT === 'sandbox',
    false,
    null,
    '2.0',
    conn.refreshToken
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

app.get('/connect', requireAuth(), async (req, res) => {
  const { userId } = getAuth(req);
  await ensureUser(userId);
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: userId,
  });
  res.redirect(authUri);
});

app.get('/callback', async (req, res) => {
  try {
    const userId = req.query.state;
    if (!userId) return res.status(400).send('Missing state param');
    const authResponse = await oauthClient.createToken(req.url);
    const token = authResponse.getJson();
    const realmId = req.query.realmId;
    await ensureUser(userId);
    await prisma.qboConnection.upsert({
      where: { userId },
      update: {
        realmId,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
      },
      create: {
        userId,
        realmId,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: new Date(Date.now() + token.expires_in * 1000),
      },
    });
    res.redirect('/');
  } catch (err) {
    console.error('OAuth callback error:', err);
    res.status(500).send('OAuth error: ' + err.message);
  }
});

const api = express.Router();
api.use(requireAuth());
api.use((req, res, next) => {
  req.userId = getAuth(req).userId;
  next();
});

api.post('/disconnect', async (req, res) => {
  await prisma.qboConnection.deleteMany({ where: { userId: req.userId } });
  res.json({ success: true });
});

api.get('/connect-url', async (req, res) => {
  await ensureUser(req.userId);
  const authUri = oauthClient.authorizeUri({
    scope: [OAuthClient.scopes.Accounting],
    state: req.userId,
  });
  res.json({ url: authUri });
});

api.get('/status', async (req, res) => {
  const conn = await getConnection(req.userId);
  res.json({ connected: !!conn, realmId: conn?.realmId || null, lastSync: null });
});

api.post('/sync', async (req, res) => {
  try {
    await getQbo(req.userId);
    res.json({ syncedAt: new Date().toISOString(), counts: {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

api.get('/company', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.getCompanyInfo(qbo.realmId, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.get('/customers', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.findCustomers({ limit: 1000 }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Customer || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.post('/customers', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.createCustomer(req.body, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.put('/customers/:id', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.getCustomer(req.params.id, (err, existing) => {
      if (err) return cb(res)(err);
      const updated = { ...existing, ...req.body, Id: existing.Id, SyncToken: existing.SyncToken };
      qbo.updateCustomer(updated, cb(res));
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.delete('/customers/:id', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.getCustomer(req.params.id, (err, existing) => {
      if (err) return cb(res)(err);
      existing.Active = false;
      qbo.updateCustomer(existing, cb(res));
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.get('/items', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.findItems({ limit: 1000 }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Item || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.post('/items', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.createItem(req.body, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.put('/items/:id', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.getItem(req.params.id, (err, existing) => {
      if (err) return cb(res)(err);
      const updated = { ...existing, ...req.body, Id: existing.Id, SyncToken: existing.SyncToken };
      qbo.updateItem(updated, cb(res));
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.get('/invoices', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.findInvoices({ limit: 1000, desc: 'MetaData.CreateTime' }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Invoice || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.get('/invoices/:id', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.getInvoice(req.params.id, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.post('/invoices', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
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

api.delete('/invoices/:id', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.getInvoice(req.params.id, (err, existing) => {
      if (err) return cb(res)(err);
      qbo.deleteInvoice(existing, cb(res));
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.post('/invoices/:id/send', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    const email = req.body.email;
    qbo.sendInvoicePdf(req.params.id, email, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.get('/invoices/:id/pdf', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.getInvoicePdf(req.params.id, (err, pdf) => {
      if (err) return res.status(500).json({ error: err });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename=invoice-${req.params.id}.pdf`);
      res.send(pdf);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.get('/estimates', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.findEstimates({ limit: 1000, desc: 'MetaData.CreateTime' }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Estimate || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.post('/estimates', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
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

api.put('/estimates/:id', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
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

api.get('/payments', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.findPayments({ limit: 1000, desc: 'MetaData.CreateTime' }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Payment || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.post('/payments', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
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

api.put('/payments/:id', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
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

api.get('/vendors', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.findVendors({ limit: 1000 }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Vendor || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.post('/vendors', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.createVendor(req.body, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.get('/bills', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.findBills({ limit: 1000, desc: 'MetaData.CreateTime' }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Bill || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.get('/bills/:id', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.getBill(req.params.id, cb(res));
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.post('/bills', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
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

api.post('/bills/:id/attach', upload.single('file'), async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
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

api.post('/receipts/upload', upload.single('file'), async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
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

api.get('/accounts', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
    qbo.findAccounts({ AccountType: 'Expense', limit: 1000 }, (err, data) => {
      if (err) return cb(res)(err);
      res.json(data.QueryResponse.Account || []);
    });
  } catch (err) { res.status(401).json({ error: err.message }); }
});

api.get('/reports/:name', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
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

api.get('/dashboard', async (req, res) => {
  try {
    const qbo = await getQbo(req.userId);
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

app.use('/api', api);

app.get('/*splat', (req, res) => {
  const indexPath = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
