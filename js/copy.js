// Prepares what goes on the clipboard: the HTML Seal reads, and a plain text
// version for anything that cannot take HTML.
(function (root) {
  // The preview adds a class here and there for the screen; Seal must not see them.
  const SCREEN_ONLY = / (?:class|id|contenteditable|spellcheck|data-[a-z-]+)="[^"]*"/g;
  const KEEP = /data-native-color/;

  function sealHtml(html) {
    return String(html)
      .replace(/<(\/?)(\w+)([^>]*)>/g, (tag, slash, name, attrs) => {
        if (KEEP.test(attrs)) return `<${slash}${name}${attrs}>`;
        return `<${slash}${name}${attrs.replace(SCREEN_ONLY, '')}>`;
      })
      .replace(/<br\s*\/?>/g, '<br>')
      // The browser adds <tbody> when it parses a table; Seal does not need it.
      .replace(/<\/?(?:tbody|thead|tfoot)[^>]*>/g, '')
      .trim();
  }

  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
  const decode = (text) => text.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, name) => ENTITIES[name]);

  // Plain text: titles on their own line, steps numbered, table cells separated by tabs.
  const BLOCK = /^<(\/?)(h[1-6]|p|li|ol|ul|tr|td|th|table|br)\b[^>]*>$/i;

  function plainText(html) {
    let out = '';
    let counter = 0;
    const tokens = String(html).split(/(<\/?(?:h[1-6]|p|li|ol|ul|tr|td|th|table|br)\b[^>]*>)/i);
    for (const token of tokens) {
      // Only a token that is exactly one of those tags is a separator; the rest is content.
      const tag = token.match(BLOCK);
      if (!tag) { out += token; continue; }
      const [, slash, name] = [tag[0], tag[1], tag[2].toLowerCase()];
      if (name === 'ol' || name === 'ul') { counter = 0; if (slash) out += '\n'; continue; }
      if (!slash && name === 'li') { out += `${++counter}. `; continue; }
      if (!slash && (name === 'td' || name === 'th')) { out += out.endsWith('\n') || !out ? '' : '\t'; continue; }
      if (slash && /^(h[1-6]|p|li|tr)$/.test(name)) { out += '\n'; continue; }
      if (name === 'br') out += '\n';
    }
    return decode(out.replace(/<[^>]+>/g, ''))
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  const Copy = { sealHtml, plainText };

  if (typeof module !== 'undefined' && module.exports) module.exports = Copy;
  else root.Copy = Copy;
})(this);
