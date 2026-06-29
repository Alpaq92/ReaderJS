import { BaseRenderer } from './base-renderer.js'

// MHTML (.mht/.mhtml) — a "Web Archive" MIME container holding a saved page plus
// its resources. mhtml-to-html unpacks the MIME parts and inlines every resource
// as a data: URI, producing one self-contained HTML string.
export class MHTMLRenderer extends BaseRenderer {
  async load(buffer, container, viewer) {
    await super.load(buffer, container, viewer)

    const { convert } = await import('mhtml-to-html/browser')

    // A saved web page is untrusted content: keep scripts disabled and never hit
    // the network — resources come inlined from the archive, not from origin.
    const { data: html } = await convert(new Uint8Array(buffer), {
      enableScripts: false,
      fetchMissingResources: false,
    })

    container.innerHTML = ''

    const page = document.createElement('div')
    page.className = 'doc-page mhtml-page'
    page.dataset.page = 1

    // Render in a sandboxed iframe so the page's CSS can't leak into the app and
    // no script can run (allow-scripts is intentionally omitted). allow-same-origin
    // only lets us measure the content height to size the frame.
    const frame = document.createElement('iframe')
    frame.className = 'mhtml-frame'
    frame.sandbox = 'allow-same-origin'
    frame.srcdoc = html
    frame.addEventListener('load', () => {
      const doc = frame.contentDocument
      if (doc) frame.style.height = `${doc.documentElement.scrollHeight}px`
    })

    page.appendChild(frame)
    container.appendChild(page)

    this.numPages = 1
  }
}
