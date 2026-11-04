/** Rebuild only Mammoth's document markup; sandbox and srcdoc CSP are additional boundaries. */
export function sanitizeOfficeHtml(html) {
  const tags = new Set('p br hr h1 h2 h3 h4 h5 h6 strong em b i u s del sup sub blockquote pre code ul ol li table thead tbody tfoot tr th td caption a img span div'.split(' '));
  const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  return String(html).replace(/<script\b[^>]*>[\s\S]*?(?:<\/script\s*>|$)/gi, '').split(/(<[^>]*>)/g).map(part => {
    if (!part.startsWith('<')) return part;
    const match = /^<\s*(\/?)\s*([a-z][a-z0-9]*)\b([^>]*)>$/i.exec(part);
    if (!match || !tags.has(match[2].toLowerCase())) return '';
    const [, closing, rawTag, attributes] = match;
    const tag = rawTag.toLowerCase();
    if (closing) return `</${tag}>`;
    const safe = [];
    for (const attr of attributes.matchAll(/([^\s=/'"<>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      const name = attr[1].toLowerCase();
      const value = attr[2] ?? attr[3] ?? attr[4];
      if ((name === 'colspan' || name === 'rowspan') && /^\d{1,4}$/.test(value)) safe.push(`${name}="${value}"`);
      if (name === 'alt' || name === 'title') safe.push(`${name}="${escape(value)}"`);
      // No entity-encoded schemes, external images, styles, handlers, or active containers.
      if (tag === 'img' && name === 'src' && /^data:image\/(png|jpeg|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(value)) safe.push(`src="${escape(value)}"`);
      if (tag === 'a' && name === 'href' && /^(https?:\/\/|#)/i.test(value) && !/[\u0000-\u0020&]/.test(value)) safe.push(`href="${escape(value)}"`);
    }
    return `<${tag}${safe.length ? ' ' + safe.join(' ') : ''}>`;
  }).join('');
}
