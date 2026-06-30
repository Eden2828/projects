// Builds a self-contained Elementor HTML-widget snippet from proposal-editor.html.
// The whole app is base64-embedded and loaded into a sandboxed iframe via srcdoc,
// so it never affects the host page, and auto-resizes to its content height.
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'proposal-editor.html');
const OUT = path.join(__dirname, 'elementor-embed.html');

const html = fs.readFileSync(SRC, 'utf8');
const b64 = Buffer.from(html, 'utf8').toString('base64');

const snippet = `<!-- ===== ThinkDigital — מחולל הצעות | הדבק בלוק זה בווידג'ט HTML של Elementor ===== -->
<iframe id="tdProposalFrame" title="מחולל הצעות ThinkDigital"
        style="width:100%;height:90vh;min-height:560px;border:0;display:block;background:#111;border-radius:10px">
</iframe>
<script>
(function () {
  var B64 = "${b64}";
  function decodeUtf8(b64) {
    var bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8').decode(bytes);
  }
  var html = decodeUtf8(B64).replace('<body>',
    '<body><script>window.__TD_FORCE_FULLSCREEN__=true;<\\/script>');
  document.getElementById('tdProposalFrame').srcdoc = html;
})();
</script>
`;

fs.writeFileSync(OUT, snippet, 'utf8');
console.log('Wrote', OUT, '(' + Math.round(snippet.length/1024) + ' KB)');
