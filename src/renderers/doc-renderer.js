import { BaseRenderer } from './base-renderer.js'

const ALIGN = ['', 'center', 'right', 'justify']

let _loaded = false
let _loading = null

function ensureDocToText() {
  if (window.docToText) return Promise.resolve()
  if (_loading) return _loading
  _loading = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `${import.meta.env.BASE_URL}jsdoc/docToText.js`
    s.onload = () => { _loaded = true; resolve() }
    s.onerror = () => reject(new Error('Failed to load /jsdoc/docToText.js'))
    document.head.appendChild(s)
  })
  return _loading
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function ppCss(pp) {
  if (!pp) return ''
  let c = ''
  if (pp.indL)  c += `margin-left:${pp.indL / 20}pt;`
  if (pp.indR)  c += `margin-right:${pp.indR / 20}pt;`
  if (pp.ind1)  c += `text-indent:${pp.ind1 / 20}pt;`
  if (pp.spB)   c += `margin-bottom:${pp.spB / 20}pt;`
  if (pp.spA)   c += `margin-top:${pp.spA / 20}pt;`
  if (pp.line)  c += `line-height:${pp.lineMult ? (pp.line / 240) : (Math.abs(pp.line) / 20) + 'pt'};`
  return c
}

function runStyle(r) {
  let css = ''
  if (r.b) css += 'font-weight:bold;'
  if (r.i) css += 'font-style:italic;'
  const deco = (r.u ? 'underline ' : '') + (r.strike ? 'line-through' : '')
  if (deco.trim()) css += `text-decoration:${deco.trim()};`
  if (r.size)  css += `font-size:${r.size}pt;`
  if (r.font)  css += `font-family:'${String(r.font).replace(/['\\<>]/g, '')}';`
  if (r.color != null) css += `color:rgb(${r.color & 255},${(r.color >> 8) & 255},${(r.color >> 16) & 255});`
  return css
}

function runsHtml(runs, imgUrls) {
  let s = ''
  for (const r of (runs || [])) {
    if (r.image && r.image.bytes) {
      try {
        const url = URL.createObjectURL(new Blob([r.image.bytes], { type: r.image.mime || 'image/png' }))
        imgUrls.push(url)
        s += `<img class="docimg" src="${url}" alt="embedded image">`
      } catch (_) { }
    } else if (r.ftnRef != null) {
      s += `<sup class="ftnref" title="footnote ${r.ftnRef + 1}">${r.ftnRef + 1}</sup>`
    } else if (r.endRef != null) {
      const rn = ['i','ii','iii','iv','v','vi','vii','viii','ix','x'][r.endRef] || (r.endRef + 1)
      s += `<sup class="ftnref" title="endnote ${r.endRef + 1}">${rn}</sup>`
    } else if (r.comRef != null) {
      s += `<sup class="comref" title="comment ${r.comRef + 1}">✎</sup>`
    } else if (r.text) {
      const css = runStyle(r)
      let inner = css ? `<span style="${css}">${esc(r.text)}</span>` : esc(r.text)
      if (r.url) inner = `<a href="${esc(r.url)}" target="_blank" rel="noopener nofollow">${inner}</a>`
      s += inner
    }
  }
  return s
}

function renderModel(paras, imgUrls) {
  let html = '', i = 0, listTag = null
  const closeList = () => { if (listTag) { html += `</${listTag}>`; listTag = null } }

  while (i < paras.length) {
    const p = paras[i]
    if (p.kind === 'cell' || p.kind === 'rowEnd') {
      closeList()
      const rows = []; let cur = []
      while (i < paras.length && (paras[i].kind === 'cell' || paras[i].kind === 'rowEnd')) {
        cur.push(paras[i])
        if (paras[i].kind === 'rowEnd') {
          rows.push({ cells: cur.slice(), tblw: paras[i].tblw, shd: paras[i].tblShd })
          cur = []
        }
        i++
      }
      if (cur.length) rows.push({ cells: cur, tblw: null, shd: null })

      const gridObj = {}
      rows.forEach(rw => { if (rw.tblw) rw.tblw.forEach(b => { gridObj[b] = 1 }) })
      const grid = Object.keys(gridObj).map(Number).sort((a, b) => a - b)
      const sized = grid.length > 2
      let cg = ''
      if (sized) {
        const tot = grid[grid.length - 1] - grid[0]
        if (tot > 0) {
          cg = '<colgroup>'
          for (let gi = 0; gi < grid.length - 1; gi++)
            cg += `<col style="width:${((grid[gi + 1] - grid[gi]) / tot * 100).toFixed(2)}%">`
          cg += '</colgroup>'
        }
      }
      html += `<table class="doc-table${sized ? ' sized' : ''}">${cg}<tbody>`
      rows.forEach(rw => {
        html += '<tr>'
        for (let ci = 0; ci < rw.cells.length; ci++) {
          let cs = 1
          if (rw.tblw && rw.tblw.length === rw.cells.length + 1 && grid.length > 2) {
            const lo = rw.tblw[ci], hi = rw.tblw[ci + 1]
            let n = 0
            for (let gk = 0; gk < grid.length; gk++) if (grid[gk] > lo && grid[gk] < hi) n++
            cs = n + 1
          }
          const shc = (rw.shd && rw.shd[ci] != null) ? rw.shd[ci] : null
          const bg  = shc != null ? `rgb(${shc & 0xFF},${(shc >> 8) & 0xFF},${(shc >> 16) & 0xFF})` : ''
          html += `<td${cs > 1 ? ` colspan="${cs}"` : ''}${bg ? ` style="background:${bg}"` : ''}>${runsHtml(rw.cells[ci].runs, imgUrls) || '&nbsp;'}</td>`
        }
        html += '</tr>'
      })
      html += '</tbody></table>'
    } else {
      const alignCss = p.align ? `text-align:${ALIGN[p.align]};` : ''
      const inner = runsHtml(p.runs, imgUrls)
      if (p.list) {
        const tag = p.list.kind === 'number' ? 'ol' : 'ul'
        if (listTag !== tag) { closeList(); html += `<${tag}>`; listTag = tag }
        html += `<li${alignCss ? ` style="${alignCss}"` : ''}>${inner || '&nbsp;'}</li>`
      } else {
        closeList()
        const st = alignCss + ppCss(p.pp)
        html += `<p${st ? ` style="${st}"` : ''}>${inner || '<br>'}</p>`
      }
      i++
    }
  }
  closeList()
  return html || '<p><em>(document contains no main-body text)</em></p>'
}

// Build readable HTML from the \t/\n-delimited raw HTML string fallback.
function toHtml(text) {
  const lines = text.split('\n')
  let html = '', i = 0
  while (i < lines.length) {
    if (lines[i].includes('\t')) {
      const rows = []
      while (i < lines.length && lines[i].includes('\t')) { rows.push(lines[i].split('\t')); i++ }
      html += '<table class="doc-table"><tbody>'
      for (let r = 0; r < rows.length; r++) {
        const tag = r === 0 ? 'th' : 'td'
        html += '<tr>' + rows[r].map(c => `<${tag}>${c}</${tag}>`).join('') + '</tr>'
      }
      html += '</tbody></table>'
    } else {
      if (lines[i].trim()) html += `<p>${lines[i]}</p>`
      i++
    }
  }
  return html || '<p><em>(document contains no main-body text)</em></p>'
}

export class DOCRenderer extends BaseRenderer {
  constructor() {
    super()
    this._imgUrls = []
  }

  async load(buffer, container, viewer) {
    await super.load(buffer, container, viewer)
    await ensureDocToText()

    const docToText = window.docToText
    if (typeof docToText !== 'function') {
      throw new Error('docToText library failed to load.')
    }

    let model = null
    try { model = docToText.model(buffer) } catch (_) { }

    let html
    if (model && model.body) {
      html = renderModel(model.body, this._imgUrls)

      if (model.props) {
        const bits = []
        ;[['title', 'Title'], ['author', 'Author'], ['subject', 'Subject']].forEach(([k, l]) => {
          if (model.props[k]) bits.push(`<b>${l}:</b> ${esc(model.props[k])}`)
        })
        if (bits.length) html = `<div class="docprops">${bits.join(' &nbsp;·&nbsp; ')}</div>` + html
      }

      const STORIES = [['footnotes','Footnotes'],['endnotes','Endnotes'],['annotations','Comments'],['textboxes','Text boxes']]
      for (const [key, label] of STORIES) {
        if (model[key] && model[key].length) {
          html += `<h3 class="sec">${label}</h3>` + renderModel(model[key], this._imgUrls)
        }
      }
      if (model.header && model.header.length) html += '<h3 class="sec">Header</h3>' + renderModel(model.header, this._imgUrls)
      if (model.footer && model.footer.length) html += '<h3 class="sec">Footer</h3>' + renderModel(model.footer, this._imgUrls)
    } else {
      let sections = null
      try { sections = docToText.html(buffer) } catch (_) { }
      if (!sections || !sections.body) {
        throw new Error('Could not read .doc file — may be Word 6/95, encrypted, or corrupt.')
      }
      html = toHtml(sections.body)
    }

    container.innerHTML = ''
    const page = document.createElement('div')
    page.className = 'doc-page'
    page.dataset.page = 1
    page.innerHTML = html
    container.appendChild(page)

    this.numPages = 1
  }

  destroy() {
    this._imgUrls.forEach(u => URL.revokeObjectURL(u))
    this._imgUrls = []
    super.destroy()
  }
}
