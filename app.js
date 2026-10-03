// ============================================================
//  BillPro – Main Application Logic
//  Fully functional billing software with localStorage
// ============================================================

// ===== STATE =====
let invoiceItems = [];
let currentInvoiceIndex = null;
let gstRate = 0;          // current GST percentage
let gstType = 'cgst';     // 'cgst' = CGST+SGST, 'igst' = IGST

// ===== LOAD DATA =====
function getData(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}
function getObj(key) {
  try { return JSON.parse(localStorage.getItem(key)) || {}; } catch { return {}; }
}
function setData(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

// ===== INIT =====
window.addEventListener('DOMContentLoaded', () => {
  initDate();
  initInvoiceNumber();
  updateDatelistInputs();
  updateDashboard();
  updateSidebarShopName();
  renderInvoiceList();
  renderProductList();
  renderCustomerList();
  renderLivePreview();
});

function initDate() {
  const d = document.getElementById('current-date');
  const invDate = document.getElementById('inv-date');
  const now = new Date();
  const str = now.toLocaleDateString('en-IN', { weekday:'short', year:'numeric', month:'short', day:'numeric' });
  if (d) d.textContent = str;
  if (invDate) invDate.value = now.toISOString().split('T')[0];
}

function initInvoiceNumber() {
  const inv = document.getElementById('inv-number');
  if (!inv) return;
  const invoices = getData('invoices');
  inv.value = 'INV-' + String(invoices.length + 1).padStart(4, '0');
}

// ===== NAVIGATION =====
function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = document.getElementById('section-' + name);
  const navItem = document.getElementById('nav-' + name);
  if (section) section.classList.remove('hidden');
  if (navItem) navItem.classList.add('active');

  const titles = { dashboard:'Dashboard', 'new-invoice':'New Invoice', invoices:'All Invoices', products:'Products', customers:'Customers' };
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = titles[name] || name;

  if (name === 'new-invoice') {
    updateDatelistInputs();
    renderLivePreview();
  }
  if (name === 'invoices') renderInvoiceList();
  if (name === 'products') renderProductList();
  if (name === 'customers') renderCustomerList();
  if (name === 'dashboard') updateDashboard();

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ===== DATALIST UPDATES =====
function updateDatelistInputs() {
  const products = getData('products');
  const customers = getData('customers');

  const pDl = document.getElementById('product-datalist');
  const cDl = document.getElementById('customer-datalist');

  if (pDl) {
    pDl.innerHTML = products.map(p => `<option value="${escHtml(p.name)}">${p.name} – Rs.${p.price}</option>`).join('');
  }
  if (cDl) {
    cDl.innerHTML = customers.map(c => `<option value="${escHtml(c.name)}">${c.name}${c.phone ? ' – ' + c.phone : ''}</option>`).join('');
  }
}

// ===== AUTO-FILL PRICE =====
function autoFillPrice() {
  const name = document.getElementById('item-name').value.trim().toLowerCase();
  const products = getData('products');
  const match = products.find(p => p.name.toLowerCase() === name);
  if (match) {
    document.getElementById('item-price').value = match.price;
  }
}

// ===== GST CONTROLS =====
function setGstRate(rate) {
  // Deactivate all rate buttons
  document.querySelectorAll('.gst-rate-btn').forEach(b => b.classList.remove('active'));
  const customRow = document.getElementById('gst-custom-row');

  if (rate === 'custom') {
    document.getElementById('gst-btn-custom').classList.add('active');
    customRow.classList.remove('hidden');
    const gstInput = document.getElementById('gst');
    gstRate = parseFloat(gstInput?.value) || 0;
  } else {
    const btnId = 'gst-btn-' + rate;
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');
    customRow.classList.add('hidden');
    gstRate = rate;
    // Also set the hidden input value for buildInvoiceData
    const gstInput = document.getElementById('gst');
    if (gstInput) gstInput.value = rate;
  }
  recalcTotals();
}

function setGstType(type) {
  gstType = type;
  document.querySelectorAll('.gst-type-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('gst-type-' + type)?.classList.add('active');
  recalcTotals();
}

// ===== ADD ITEM TO INVOICE =====
function addItemToInvoice() {
  const name = document.getElementById('item-name').value.trim();
  const qty = parseFloat(document.getElementById('item-qty').value) || 1;
  const price = parseFloat(document.getElementById('item-price').value);

  if (!name) { showToast('Item ka naam likhein!', 'error'); return; }
  if (!price || price <= 0) { showToast('Price likhein!', 'error'); return; }

  invoiceItems.push({ name, qty, price });

  document.getElementById('item-name').value = '';
  document.getElementById('item-qty').value = 1;
  document.getElementById('item-price').value = '';

  renderItemsTable();
  recalcTotals();
  renderLivePreview();
}

function removeItem(idx) {
  invoiceItems.splice(idx, 1);
  renderItemsTable();
  recalcTotals();
  renderLivePreview();
}

function renderItemsTable() {
  const tbody = document.getElementById('items-tbody');
  if (!tbody) return;

  if (invoiceItems.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6"><div class="empty-state-small"><span>Upar se items add karein</span></div></td></tr>`;
    return;
  }

  tbody.innerHTML = invoiceItems.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escHtml(item.name)}</td>
      <td>${item.qty}</td>
      <td>Rs.${item.price.toFixed(2)}</td>
      <td><strong>Rs.${(item.qty * item.price).toFixed(2)}</strong></td>
      <td><button class="remove-item-btn" onclick="removeItem(${i})">&#10005;</button></td>
    </tr>
  `).join('');
}

function recalcTotals() {
  const subtotalVal = invoiceItems.reduce((s, it) => s + it.qty * it.price, 0);
  const discPct = parseFloat(document.getElementById('discount').value) || 0;

  // Get current GST rate (from state or input)
  const customRow = document.getElementById('gst-custom-row');
  const isCustom = customRow && !customRow.classList.contains('hidden');
  if (isCustom) {
    gstRate = parseFloat(document.getElementById('gst')?.value) || 0;
  }

  const discAmt = subtotalVal * (discPct / 100);
  const afterDisc = subtotalVal - discAmt;
  const gstAmt = afterDisc * (gstRate / 100);
  const grandTotal = afterDisc + gstAmt;

  const st = document.getElementById('subtotal');
  const gt = document.getElementById('grand-total');
  if (st) st.textContent = 'Rs.' + subtotalVal.toFixed(2);
  if (gt) gt.textContent = 'Rs.' + grandTotal.toFixed(2);

  // Show/hide GST breakdown
  const breakdown = document.getElementById('gst-breakdown');
  if (breakdown) {
    if (gstRate > 0) {
      breakdown.style.display = 'flex';
      if (gstType === 'cgst') {
        const half = gstRate / 2;
        const halfAmt = gstAmt / 2;
        document.getElementById('gst-label-left').textContent  = `CGST (${half}%)`;
        document.getElementById('gst-label-right').textContent = `SGST (${half}%)`;
        document.getElementById('gst-amt-left').textContent    = 'Rs.' + halfAmt.toFixed(2);
        document.getElementById('gst-amt-right').textContent   = 'Rs.' + halfAmt.toFixed(2);
      } else {
        document.getElementById('gst-label-left').textContent  = `IGST (${gstRate}%)`;
        document.getElementById('gst-label-right').textContent = '';
        document.getElementById('gst-amt-left').textContent    = 'Rs.' + gstAmt.toFixed(2);
        document.getElementById('gst-amt-right').textContent   = '';
      }
    } else {
      breakdown.style.display = 'none';
    }
  }

  renderLivePreview();
}

function getGrandTotal() {
  const subtotalVal = invoiceItems.reduce((s, it) => s + it.qty * it.price, 0);
  const discPct = parseFloat(document.getElementById('discount')?.value) || 0;
  const discAmt = subtotalVal * (discPct / 100);
  const afterDisc = subtotalVal - discAmt;
  const gstAmt = afterDisc * (gstRate / 100);
  return afterDisc + gstAmt;
}

// ===== LIVE PREVIEW =====
function renderLivePreview() {
  const previewEl = document.getElementById('invoice-preview');
  if (!previewEl) return;

  const shop = getObj('shopSettings');
  const customer = document.getElementById('inv-customer')?.value || '';
  const invNo = document.getElementById('inv-number')?.value || 'INV-0001';
  const invDate = document.getElementById('inv-date')?.value || '';
  const notes = document.getElementById('inv-notes')?.value || '';
  const discPct = parseFloat(document.getElementById('discount')?.value) || 0;

  const subtotalVal = invoiceItems.reduce((s, it) => s + it.qty * it.price, 0);
  const discAmt = subtotalVal * (discPct / 100);
  const afterDisc = subtotalVal - discAmt;
  const gstAmt = afterDisc * (gstRate / 100);
  const grandTotal = afterDisc + gstAmt;

  // Build GST breakdown lines for preview
  let gstLines = '';
  if (gstRate > 0) {
    if (gstType === 'cgst') {
      const half = gstRate / 2;
      const halfAmt = gstAmt / 2;
      gstLines = `
        <div>CGST (${half}%): Rs.${halfAmt.toFixed(2)}</div>
        <div>SGST (${half}%): Rs.${halfAmt.toFixed(2)}</div>`;
    } else {
      gstLines = `<div>IGST (${gstRate}%): +Rs.${gstAmt.toFixed(2)}</div>`;
    }
  }

  previewEl.innerHTML = `
    <div class="inv-preview-wrap">
      <div class="inv-preview-header">
        <h3>${escHtml(shop.name || 'My Shop')}</h3>
        ${shop.address ? `<p>${escHtml(shop.address)}</p>` : ''}
        ${shop.phone ? `<p>Ph: ${escHtml(shop.phone)}</p>` : ''}
        ${shop.gst ? `<p>GST No: ${escHtml(shop.gst)}</p>` : ''}
      </div>
      <div class="inv-preview-meta">
        <div>
          <div><strong>Invoice #:</strong> ${escHtml(invNo)}</div>
          <div><strong>Date:</strong> ${invDate ? formatDate(invDate) : '–'}</div>
        </div>
        <div style="text-align:right">
          <div><strong>Customer:</strong> ${customer ? escHtml(customer) : '–'}</div>
        </div>
      </div>
      <table class="inv-preview-table">
        <thead>
          <tr><th>#</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
        </thead>
        <tbody>
          ${invoiceItems.length === 0 ? `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);padding:12px">No items added yet</td></tr>` :
            invoiceItems.map((it, i) => `<tr>
              <td>${i+1}</td>
              <td>${escHtml(it.name)}</td>
              <td>${it.qty}</td>
              <td>Rs.${it.price.toFixed(2)}</td>
              <td>Rs.${(it.qty*it.price).toFixed(2)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      <div class="inv-preview-totals">
        <div>Subtotal: Rs.${subtotalVal.toFixed(2)}</div>
        ${discPct > 0 ? `<div>Discount (${discPct}%): -Rs.${discAmt.toFixed(2)}</div>` : ''}
        ${gstPct > 0 ? `<div>GST (${gstPct}%): +Rs.${gstAmt.toFixed(2)}</div>` : ''}
        <div class="grand">Grand Total: Rs.${grandTotal.toFixed(2)}</div>
      </div>
      ${notes ? `<div style="margin-top:10px;font-size:11px;color:var(--text-muted)">Note: ${escHtml(notes)}</div>` : ''}
      <div class="inv-preview-footer">${escHtml(shop.footer || 'Shukriya! Phir tashreef layen.')}</div>
    </div>
  `;
}

// ===== SAVE INVOICE =====
function buildInvoiceData() {
  const shop = getObj('shopSettings');
  const customer = document.getElementById('inv-customer').value.trim();
  const phone = document.getElementById('inv-phone').value.trim();
  const invNo = document.getElementById('inv-number').value.trim();
  const invDate = document.getElementById('inv-date').value;
  const notes = document.getElementById('inv-notes').value.trim();
  const discPct = parseFloat(document.getElementById('discount').value) || 0;
  const gstPct = parseFloat(document.getElementById('gst').value) || 0;

  const subtotalVal = invoiceItems.reduce((s, it) => s + it.qty * it.price, 0);
  const discAmt = subtotalVal * (discPct / 100);
  const afterDisc = subtotalVal - discAmt;
  const gstAmt = afterDisc * (gstPct / 100);
  const grandTotal = afterDisc + gstAmt;

  return { invNo, customer, phone, invDate, notes, discPct, gstPct, subtotal: subtotalVal, discAmt, gstAmt, grandTotal, items: [...invoiceItems], shopSnapshot: { ...shop }, createdAt: new Date().toISOString() };
}

function saveInvoice() {
  const data = buildInvoiceData();
  if (!data.customer) { showToast('Customer ka naam likhein!', 'error'); return; }
  if (data.items.length === 0) { showToast('Kam az kam ek item add karein!', 'error'); return; }

  const invoices = getData('invoices');
  if (currentInvoiceIndex !== null) {
    invoices[currentInvoiceIndex] = data;
    showToast('Invoice update ho gayi!', 'success');
  } else {
    invoices.push(data);
    showToast('Invoice save ho gayi!', 'success');
  }
  setData('invoices', invoices);

  // Auto-save customer
  saveCustomerFromInvoice(data.customer, data.phone);

  currentInvoiceIndex = null;
  clearInvoice();
  updateDashboard();
}

function saveAndPrint() {
  const data = buildInvoiceData();
  if (!data.customer) { showToast('Customer ka naam likhein!', 'error'); return; }
  if (data.items.length === 0) { showToast('Kam az kam ek item add karein!', 'error'); return; }

  const invoices = getData('invoices');
  invoices.push(data);
  setData('invoices', invoices);
  saveCustomerFromInvoice(data.customer, data.phone);

  printInvoiceData(data);

  currentInvoiceIndex = null;
  clearInvoice();
  updateDashboard();
  showToast('Invoice save aur print ho rahi hai!', 'success');
}

function clearInvoice() {
  invoiceItems = [];
  currentInvoiceIndex = null;
  document.getElementById('inv-customer').value = '';
  document.getElementById('inv-phone').value = '';
  document.getElementById('inv-notes').value = '';
  document.getElementById('discount').value = 0;
  document.getElementById('gst').value = 0;
  initDate();
  initInvoiceNumber();
  renderItemsTable();
  recalcTotals();
  renderLivePreview();
}

// ===== PRINT =====
function printInvoiceData(inv) {
  const html = buildPrintHTML(inv);
  const frame = document.getElementById('print-frame');
  frame.srcdoc = html;
  frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); };
}

function buildPrintHTML(inv) {
  const rows = inv.items.map((it, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${escHtml(it.name)}</td>
      <td>${it.qty}</td>
      <td>Rs.${it.price.toFixed(2)}</td>
      <td>Rs.${(it.qty*it.price).toFixed(2)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Invoice ${escHtml(inv.invNo)}</title>
<style>
  * { box-sizing: border-box; margin:0; padding:0; }
  body { font-family: Arial, sans-serif; padding: 32px; color: #111; font-size: 13px; }
  h1 { font-size: 26px; font-weight: 900; color: #7c3aed; }
  .shop-sub { font-size:12px; color:#555; line-height:1.6; margin-top:4px; }
  .divider { border:none; border-top:1px solid #ddd; margin:16px 0; }
  .meta { display:flex; justify-content:space-between; margin:16px 0; font-size:13px; }
  .meta-block { line-height:1.8; }
  table { width:100%; border-collapse:collapse; margin:16px 0; }
  th { background:#7c3aed; color:white; padding:10px 12px; text-align:left; font-size:12px; }
  td { padding:9px 12px; border-bottom:1px solid #eee; }
  tbody tr:nth-child(even) { background:#f9f6ff; }
  .totals { text-align:right; margin-top:8px; line-height:2; }
  .grand { font-size:20px; font-weight:900; color:#7c3aed; }
  .footer { text-align:center; margin-top:24px; padding-top:16px; border-top:2px dashed #ddd; font-size:12px; color:#888; }
  @media print { body { padding:16px; } }
</style>
</head>
<body>
  <h1>${escHtml(inv.shopSnapshot.name || 'My Shop')}</h1>
  <div class="shop-sub">
    ${inv.shopSnapshot.address ? escHtml(inv.shopSnapshot.address) + '<br>' : ''}
    ${inv.shopSnapshot.phone ? 'Ph: ' + escHtml(inv.shopSnapshot.phone) + '<br>' : ''}
    ${inv.shopSnapshot.gst ? 'GST: ' + escHtml(inv.shopSnapshot.gst) + '<br>' : ''}
    ${inv.shopSnapshot.owner ? 'Owner: ' + escHtml(inv.shopSnapshot.owner) : ''}
  </div>
  <hr class="divider">
  <div class="meta">
    <div class="meta-block">
      <strong>Invoice #:</strong> ${escHtml(inv.invNo)}<br>
      <strong>Date:</strong> ${inv.invDate ? formatDate(inv.invDate) : '–'}
    </div>
    <div class="meta-block" style="text-align:right">
      <strong>Customer:</strong> ${escHtml(inv.customer)}<br>
      ${inv.phone ? `<strong>Phone:</strong> ${escHtml(inv.phone)}` : ''}
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div>Subtotal: Rs.${inv.subtotal.toFixed(2)}</div>
    ${inv.discPct > 0 ? `<div>Discount (${inv.discPct}%): -Rs.${inv.discAmt.toFixed(2)}</div>` : ''}
    ${inv.gstPct > 0 ? `<div>GST (${inv.gstPct}%): +Rs.${inv.gstAmt.toFixed(2)}</div>` : ''}
    <div class="grand">Grand Total: Rs.${inv.grandTotal.toFixed(2)}</div>
  </div>
  ${inv.notes ? `<p style="margin-top:10px;font-size:12px;color:#666">Note: ${escHtml(inv.notes)}</p>` : ''}
  <div class="footer">${escHtml(inv.shopSnapshot.footer || 'Shukriya! Phir tashreef layen.')}</div>
</body></html>`;
}

// ===== INVOICE LIST =====
function renderInvoiceList() {
  const container = document.getElementById('invoice-list-container');
  if (!container) return;

  const invoices = getData('invoices');
  const query = (document.getElementById('invoice-search')?.value || '').toLowerCase();

  const filtered = invoices.filter(inv =>
    inv.customer?.toLowerCase().includes(query) ||
    inv.invNo?.toLowerCase().includes(query) ||
    inv.phone?.toLowerCase().includes(query)
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>${invoices.length === 0 ? 'Koi invoice save nahi ki gayi abhi tak' : 'Koi result nahi mila'}</p>${invoices.length === 0 ? `<button class="btn btn-primary" onclick="showSection('new-invoice')">Pehla Invoice Banao</button>` : ''}</div>`;
    return;
  }

  const rows = filtered.map((inv, i) => {
    const realIdx = invoices.indexOf(inv);
    return `<tr onclick="viewInvoice(${realIdx})">
      <td>${escHtml(inv.invNo)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar-sm">${inv.customer.charAt(0).toUpperCase()}</div>
          <div>
            <div style="font-weight:600">${escHtml(inv.customer)}</div>
            ${inv.phone ? `<div style="font-size:11px;color:var(--text-muted)">${escHtml(inv.phone)}</div>` : ''}
          </div>
        </div>
      </td>
      <td>${inv.invDate ? formatDate(inv.invDate) : '–'}</td>
      <td>${inv.items.length} items</td>
      <td><strong>Rs.${inv.grandTotal.toFixed(2)}</strong></td>
      <td>
        <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-secondary" onclick="viewInvoice(${realIdx})">View</button>
          <button class="btn btn-sm btn-ghost" onclick="printInvoiceByIndex(${realIdx})">Print</button>
          <button class="btn btn-sm btn-danger" onclick="deleteInvoice(${realIdx})">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  container.innerHTML = `
    <table class="invoice-table">
      <thead>
        <tr>
          <th>Invoice #</th>
          <th>Customer</th>
          <th>Date</th>
          <th>Items</th>
          <th>Amount</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

let currentViewInvoiceIndex = null;

function viewInvoice(idx) {
  const invoices = getData('invoices');
  const inv = invoices[idx];
  if (!inv) return;

  currentViewInvoiceIndex = idx;
  const rows = inv.items.map((it, i) => `
    <tr>
      <td>${i+1}</td>
      <td>${escHtml(it.name)}</td>
      <td>${it.qty}</td>
      <td>Rs.${it.price.toFixed(2)}</td>
      <td>Rs.${(it.qty*it.price).toFixed(2)}</td>
    </tr>
  `).join('');

  document.getElementById('view-invoice-content').innerHTML = `
    <div style="background:linear-gradient(135deg,rgba(124,58,237,0.1),transparent);border-radius:12px;padding:20px;margin-bottom:16px">
      <h2 style="font-family:Outfit,sans-serif;font-size:22px;font-weight:800;background:linear-gradient(135deg,#fff,#a78bfa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">${escHtml(inv.shopSnapshot.name || 'My Shop')}</h2>
      ${inv.shopSnapshot.address ? `<p style="font-size:12px;color:var(--text-muted);margin-top:4px">${escHtml(inv.shopSnapshot.address)}</p>` : ''}
      ${inv.shopSnapshot.phone ? `<p style="font-size:12px;color:var(--text-muted)">Ph: ${escHtml(inv.shopSnapshot.phone)}</p>` : ''}
    </div>
    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:16px">
      <div><div><strong>Invoice #:</strong> ${escHtml(inv.invNo)}</div><div><strong>Date:</strong> ${inv.invDate ? formatDate(inv.invDate) : '–'}</div></div>
      <div style="text-align:right"><div><strong>Customer:</strong> ${escHtml(inv.customer)}</div>${inv.phone ? `<div><strong>Phone:</strong> ${escHtml(inv.phone)}</div>` : ''}</div>
    </div>
    <table class="inv-preview-table" style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
      <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:right;font-size:13px;color:var(--text-muted)">
      <div>Subtotal: Rs.${inv.subtotal.toFixed(2)}</div>
      ${inv.discPct > 0 ? `<div>Discount (${inv.discPct}%): -Rs.${inv.discAmt.toFixed(2)}</div>` : ''}
      ${inv.gstPct > 0 ? `<div>GST (${inv.gstPct}%): +Rs.${inv.gstAmt.toFixed(2)}</div>` : ''}
      <div style="font-size:20px;font-weight:800;color:#a78bfa;margin-top:8px">Grand Total: Rs.${inv.grandTotal.toFixed(2)}</div>
    </div>
    ${inv.notes ? `<p style="margin-top:12px;font-size:12px;color:var(--text-muted)">Note: ${escHtml(inv.notes)}</p>` : ''}
  `;

  document.getElementById('view-invoice-modal').classList.remove('hidden');
}

function closeViewInvoice() {
  document.getElementById('view-invoice-modal').classList.add('hidden');
  currentViewInvoiceIndex = null;
}

function printSavedInvoice() {
  if (currentViewInvoiceIndex === null) return;
  const invoices = getData('invoices');
  printInvoiceData(invoices[currentViewInvoiceIndex]);
}

function printInvoiceByIndex(idx) {
  const invoices = getData('invoices');
  printInvoiceData(invoices[idx]);
}

function deleteInvoice(idx) {
  if (!confirm('Kya aap yeh invoice delete karna chahte hain?')) return;
  const invoices = getData('invoices');
  invoices.splice(idx, 1);
  setData('invoices', invoices);
  renderInvoiceList();
  updateDashboard();
  showToast('Invoice delete ho gayi!', 'success');
}

// ===== PRODUCTS =====
function openProductModal(idx = -1) {
  const modal = document.getElementById('product-modal');
  const titleEl = document.getElementById('product-modal-title');
  document.getElementById('product-edit-index').value = idx;

  if (idx >= 0) {
    const products = getData('products');
    const p = products[idx];
    titleEl.textContent = 'Edit Product';
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-price').value = p.price;
    document.getElementById('p-unit').value = p.unit;
    document.getElementById('p-category').value = p.category || '';
  } else {
    titleEl.textContent = 'Add Product';
    document.getElementById('p-name').value = '';
    document.getElementById('p-price').value = '';
    document.getElementById('p-unit').value = 'Piece';
    document.getElementById('p-category').value = '';
  }

  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('p-name').focus(), 100);
}

function closeProductModal() { document.getElementById('product-modal').classList.add('hidden'); }

function saveProduct() {
  const name = document.getElementById('p-name').value.trim();
  const price = parseFloat(document.getElementById('p-price').value);
  const unit = document.getElementById('p-unit').value;
  const category = document.getElementById('p-category').value.trim();
  const idx = parseInt(document.getElementById('product-edit-index').value);

  if (!name) { showToast('Product ka naam likhein!', 'error'); return; }
  if (!price || price <= 0) { showToast('Price likhein!', 'error'); return; }

  const products = getData('products');
  const data = { name, price, unit, category };

  if (idx >= 0) { products[idx] = data; } else { products.push(data); }
  setData('products', products);

  closeProductModal();
  renderProductList();
  updateDashboard();
  updateDatelistInputs();
  showToast(idx >= 0 ? 'Product update ho gaya!' : 'Product save ho gaya!', 'success');
}

function deleteProduct(idx) {
  if (!confirm('Product delete karna chahte hain?')) return;
  const products = getData('products');
  products.splice(idx, 1);
  setData('products', products);
  renderProductList();
  updateDashboard();
  updateDatelistInputs();
  showToast('Product delete ho gaya!', 'success');
}

function renderProductList() {
  const container = document.getElementById('product-list-container');
  if (!container) return;

  const products = getData('products');
  if (products.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📦</div><p>Koi product add nahi kiya abhi tak</p><button class="btn btn-primary" onclick="openProductModal()">Pehla Product Add Karein</button></div>`;
    return;
  }

  const cards = products.map((p, i) => `
    <div class="product-card">
      <div class="product-card-name">${escHtml(p.name)}</div>
      <div class="product-card-price">Rs.${p.price.toFixed(2)}</div>
      <div class="product-card-meta">
        <span>📦 ${escHtml(p.unit)}</span>
        ${p.category ? `<span>• ${escHtml(p.category)}</span>` : ''}
      </div>
      <div class="product-card-actions">
        <button class="btn btn-sm btn-secondary" onclick="openProductModal(${i})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct(${i})">Delete</button>
      </div>
    </div>
  `).join('');

  container.innerHTML = `<div class="product-grid">${cards}</div>`;
}

// ===== CUSTOMERS =====
function openCustomerModal(idx = -1) {
  const modal = document.getElementById('customer-modal');
  const titleEl = document.getElementById('customer-modal-title');
  document.getElementById('customer-edit-index').value = idx;

  if (idx >= 0) {
    const customers = getData('customers');
    const c = customers[idx];
    titleEl.textContent = 'Edit Customer';
    document.getElementById('c-name').value = c.name;
    document.getElementById('c-phone').value = c.phone || '';
    document.getElementById('c-city').value = c.city || '';
    document.getElementById('c-address').value = c.address || '';
  } else {
    titleEl.textContent = 'Add Customer';
    document.getElementById('c-name').value = '';
    document.getElementById('c-phone').value = '';
    document.getElementById('c-city').value = '';
    document.getElementById('c-address').value = '';
  }

  modal.classList.remove('hidden');
  setTimeout(() => document.getElementById('c-name').focus(), 100);
}

function closeCustomerModal() { document.getElementById('customer-modal').classList.add('hidden'); }

function saveCustomer() {
  const name = document.getElementById('c-name').value.trim();
  const phone = document.getElementById('c-phone').value.trim();
  const city = document.getElementById('c-city').value.trim();
  const address = document.getElementById('c-address').value.trim();
  const idx = parseInt(document.getElementById('customer-edit-index').value);

  if (!name) { showToast('Customer ka naam likhein!', 'error'); return; }

  const customers = getData('customers');
  const data = { name, phone, city, address };

  if (idx >= 0) { customers[idx] = data; } else { customers.push(data); }
  setData('customers', customers);

  closeCustomerModal();
  renderCustomerList();
  updateDashboard();
  updateDatelistInputs();
  showToast(idx >= 0 ? 'Customer update ho gaya!' : 'Customer save ho gaya!', 'success');
}

function saveCustomerFromInvoice(name, phone) {
  if (!name) return;
  const customers = getData('customers');
  const exists = customers.find(c => c.name.toLowerCase() === name.toLowerCase());
  if (!exists) {
    customers.push({ name, phone: phone || '', city: '', address: '' });
    setData('customers', customers);
  }
}

function deleteCustomer(idx) {
  if (!confirm('Customer delete karna chahte hain?')) return;
  const customers = getData('customers');
  customers.splice(idx, 1);
  setData('customers', customers);
  renderCustomerList();
  updateDashboard();
  showToast('Customer delete ho gaya!', 'success');
}

function renderCustomerList() {
  const container = document.getElementById('customer-list-container');
  if (!container) return;

  const customers = getData('customers');
  if (customers.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><p>Koi customer record nahi hai abhi tak</p><button class="btn btn-primary" onclick="openCustomerModal()">Pehla Customer Add Karein</button></div>`;
    return;
  }

  const rows = customers.map((c, i) => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="avatar-sm">${c.name.charAt(0).toUpperCase()}</div>
          <strong>${escHtml(c.name)}</strong>
        </div>
      </td>
      <td>${c.phone ? escHtml(c.phone) : '<span style="color:var(--text-dim)">–</span>'}</td>
      <td>${c.city ? escHtml(c.city) : '<span style="color:var(--text-dim)">–</span>'}</td>
      <td>${c.address ? escHtml(c.address) : '<span style="color:var(--text-dim)">–</span>'}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-secondary" onclick="openCustomerModal(${i})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCustomer(${i})">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="customer-table">
      <thead><tr><th>Name</th><th>Phone</th><th>City</th><th>Address</th><th>Actions</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

// ===== SHOP SETTINGS =====
function openShopSettings() {
  const shop = getObj('shopSettings');
  document.getElementById('s-name').value = shop.name || '';
  document.getElementById('s-owner').value = shop.owner || '';
  document.getElementById('s-phone').value = shop.phone || '';
  document.getElementById('s-address').value = shop.address || '';
  document.getElementById('s-gst').value = shop.gst || '';
  document.getElementById('s-footer').value = shop.footer || '';
  document.getElementById('shop-modal').classList.remove('hidden');
}

function closeShopSettings() { document.getElementById('shop-modal').classList.add('hidden'); }

function saveShopSettings() {
  const name = document.getElementById('s-name').value.trim();
  if (!name) { showToast('Shop ka naam likhein!', 'error'); return; }

  const shop = {
    name,
    owner: document.getElementById('s-owner').value.trim(),
    phone: document.getElementById('s-phone').value.trim(),
    address: document.getElementById('s-address').value.trim(),
    gst: document.getElementById('s-gst').value.trim(),
    footer: document.getElementById('s-footer').value.trim(),
  };

  setData('shopSettings', shop);
  closeShopSettings();
  updateSidebarShopName();
  renderLivePreview();
  showToast('Shop settings save ho gayi!', 'success');
}

function updateSidebarShopName() {
  const shop = getObj('shopSettings');
  const el = document.getElementById('sidebar-shop-name');
  if (el) el.textContent = shop.name || 'My Shop';
  const avatar = document.querySelector('.shop-avatar');
  if (avatar && shop.name) avatar.textContent = shop.name.charAt(0).toUpperCase();
}

// ===== DASHBOARD =====
function updateDashboard() {
  const invoices = getData('invoices');
  const products = getData('products');
  const customers = getData('customers');

  const revenue = invoices.reduce((s, inv) => s + (inv.grandTotal || 0), 0);

  const ti = document.getElementById('stat-total-inv');
  const sr = document.getElementById('stat-revenue');
  const sc = document.getElementById('stat-customers');
  const sp = document.getElementById('stat-products');

  if (ti) ti.textContent = invoices.length;
  if (sr) sr.textContent = 'Rs.' + revenue.toFixed(0);
  if (sc) sc.textContent = customers.length;
  if (sp) sp.textContent = products.length;

  // Recent invoices
  const recentEl = document.getElementById('recent-invoices-list');
  if (recentEl) {
    if (invoices.length === 0) {
      recentEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📄</div><p>Koi invoice nahi mili abhi tak</p><button class="btn btn-primary" onclick="showSection('new-invoice')">Pehla Invoice Banao</button></div>`;
    } else {
      const recent = [...invoices].reverse().slice(0, 5);
      recentEl.innerHTML = `
        <table class="invoice-table">
          <thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Amount</th></tr></thead>
          <tbody>
            ${recent.map((inv, i) => {
              const realIdx = invoices.length - 1 - i;
              return `<tr onclick="viewInvoice(${realIdx})" style="cursor:pointer">
                <td>${escHtml(inv.invNo)}</td>
                <td><div style="display:flex;align-items:center;gap:8px"><div class="avatar-sm" style="width:28px;height:28px;font-size:11px">${inv.customer.charAt(0).toUpperCase()}</div>${escHtml(inv.customer)}</div></td>
                <td>${inv.invDate ? formatDate(inv.invDate) : '–'}</td>
                <td><strong>Rs.${inv.grandTotal.toFixed(2)}</strong></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `;
    }
  }
}

// ===== UTILITIES =====
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer = null;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  const icon = type === 'success' ? '✅' : '❌';
  t.innerHTML = `<span>${icon}</span> ${msg}`;
  t.className = `toast ${type}`;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast hidden'; }, 3000);
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});

// ===== KEYBOARD SHORTCUTS =====
document.addEventListener('keydown', (e) => {
  // Esc: Close all modals
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.add('hidden'));
    return;
  }

  // Don't fire shortcuts if user is typing in an input/textarea
  const tag = document.activeElement?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  // Alt + key shortcuts
  if (e.altKey) {
    switch (e.key.toLowerCase()) {
      case 'd':
        e.preventDefault();
        showSection('dashboard');
        flashShortcut('Alt+D → Dashboard');
        break;
      case 'n':
        e.preventDefault();
        showSection('new-invoice');
        flashShortcut('Alt+N → New Invoice');
        break;
      case 'i':
        e.preventDefault();
        showSection('invoices');
        flashShortcut('Alt+I → All Invoices');
        break;
      case 'p':
        e.preventDefault();
        showSection('products');
        openProductModal();
        flashShortcut('Alt+P → Add Product');
        break;
      case 'c':
        e.preventDefault();
        showSection('customers');
        openCustomerModal();
        flashShortcut('Alt+C → Add Customer');
        break;
      case 's':
        e.preventDefault();
        openShopSettings();
        flashShortcut('Alt+S → Shop Settings');
        break;
      case 'enter':
        e.preventDefault();
        const activeSection = document.querySelector('.section:not(.hidden)');
        if (activeSection && activeSection.id === 'section-new-invoice') {
          saveInvoice();
          flashShortcut('Alt+Enter → Invoice Save');
        }
        break;
    }
  }
});

// Flash shortcut hint in toast
function flashShortcut(msg) {
  showToast('⌨️  ' + msg, 'success');
}

// Live preview update on customer/date input
['inv-customer', 'inv-phone', 'inv-date', 'inv-notes'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', renderLivePreview);
});
