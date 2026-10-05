export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

export function printHtml(title: string, bodyHtml: string) {
  const w = window.open("", "_blank", "width=900,height=1100");
  if (!w) return false;
  w.document
    .write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;600&display=swap" rel="stylesheet">
<style>body{font-family:'IBM Plex Sans Thai',sans-serif;color:#262626;padding:40px;max-width:780px;margin:auto}
h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}td,th{border:1px solid #ddd;padding:6px 8px;text-align:left}
.demo{border:2px dashed #b8860b;color:#8a6500;padding:6px 10px;font-weight:600;font-size:12px;margin-bottom:16px;display:inline-block}
.bar{height:4px;background:linear-gradient(90deg,#6db3e8 0 33%,#1c3a8c 33% 66%,#e2231a 66%);margin:12px 0 20px}.muted{color:#777;font-size:12px}</style></head>
<body><div class="demo">เอกสารตัวอย่าง — ไม่มีผลทางกฎหมาย</div>${bodyHtml}
<script>setTimeout(()=>window.print(),400)</script></body></html>`);
  w.document.close();
  return true;
}
