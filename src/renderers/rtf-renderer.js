import { BaseRenderer } from './base-renderer.js'

const BASE = import.meta.env.BASE_URL
const SCRIPTS = [
  `${BASE}rtfjs/jquery.min.js`,
  `${BASE}rtfjs/EMFJS.bundle.min.js`,
  `${BASE}rtfjs/WMFJS.bundle.min.js`,
  `${BASE}rtfjs/RTFJS.bundle.min.js`,
]

let _loaded = false

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const s = document.createElement('script')
    s.src = src
    s.onload  = resolve
    s.onerror = () => reject(new Error(`Failed to load: ${src}`))
    document.head.appendChild(s)
  })
}

async function ensureRTFJS() {
  if (_loaded && window.RTFJS) return
  // Load sequentially — each bundle depends on the previous one's global
  for (const src of SCRIPTS) await loadScript(src)
  if (!window.RTFJS) throw new Error('RTFJS global not set after script load')
  _loaded = true
}

export class RTFRenderer extends BaseRenderer {
  async load(buffer, container, viewer) {
    await super.load(buffer, container, viewer)

    await ensureRTFJS()

    const doc = new window.RTFJS.Document(buffer)
    const result = await doc.render()

    container.innerHTML = ''
    const page = document.createElement('div')
    page.className = 'doc-page'
    page.dataset.page = 1

    // render() returns jQuery-wrapped elements for some files — use jQuery append
    window.$(page).append(result)
    container.appendChild(page)

    this.numPages = 1
  }
}
