export class BaseRenderer {
  constructor() {
    this.numPages  = 1
    this.scale     = 1.0
    this.container = null
    this.viewer    = null
    // Preferred zoom on open. HTML document renderers (DOCX/RTF/MD/ODF/DOC)
    // are one continuous page, so they fit to width. Paged renderers (PDF,
    // comic) override to 'page-height'; reflowable EPUB sets null (font zoom).
    this.defaultScaleOption = 'page-width'
  }

  async load(buffer, container, viewer) {
    this.container = container
    this.viewer    = viewer
  }

  scrollToPage(pageNum) {
    const el = this.container?.querySelector(`[data-page="${pageNum}"]`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Default scaling for HTML document renderers: zoom the fixed-width .doc-page.
  // CSS `zoom` (unlike `transform`) reflows the layout box, so the container
  // grows/shrinks and vertical scrolling stays correct.
  setScale(scale) {
    this.scale = scale
    this.container?.querySelectorAll('.doc-page').forEach(el => {
      el.style.zoom = scale === 1 ? '' : scale
    })
  }

  getPageWidth()  { return 816 }   // ~8.5in @96dpi, the .doc-page width
  getPageHeight() { return null }

  async preparePrint()  {}
  cleanupAfterPrint()   {}

  destroy() {
    if (this.container) this.container.innerHTML = ''
  }
}
