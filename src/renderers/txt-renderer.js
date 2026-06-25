import { BaseRenderer } from './base-renderer.js'

/**
 * Renders plain-text files (.txt / .text / .log). The content is placed in a
 * <pre> so line breaks and whitespace are preserved; `textContent` escapes it,
 * so no untrusted markup is ever parsed.
 */
export class TXTRenderer extends BaseRenderer {
  async load(buffer, container, viewer) {
    await super.load(buffer, container, viewer)

    // TextDecoder('utf-8') strips a UTF-8 BOM and replaces invalid bytes.
    const text = new TextDecoder('utf-8').decode(buffer)

    container.innerHTML = ''

    const page = document.createElement('div')
    page.className = 'doc-page'
    page.dataset.page = 1

    const pre = document.createElement('pre')
    pre.className = 'txt-content'
    pre.textContent = text

    page.appendChild(pre)
    container.appendChild(page)

    this.numPages = 1
  }
}
