import { BaseRenderer } from './base-renderer.js'

export class MDRenderer extends BaseRenderer {
  async load(buffer, container, viewer) {
    await super.load(buffer, container, viewer)

    const { marked } = await import('marked')

    const text = new TextDecoder().decode(buffer)
    const html = await marked.parse(text, { async: false })

    container.innerHTML = ''

    const page = document.createElement('div')
    page.className = 'doc-page'
    page.dataset.page = 1
    page.innerHTML = html
    container.appendChild(page)

    this.numPages = 1
  }
}
