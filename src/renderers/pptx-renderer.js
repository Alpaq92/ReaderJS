import { BaseRenderer } from './base-renderer.js'

const EMU_PER_PX = 9525  // 914400 EMU/inch ÷ 96 px/inch

/**
 * Renders PowerPoint (.pptx) presentations with PptxViewJS (MIT), one slide at a
 * time onto an HTML5 canvas. PptxViewJS always paints at the slide's native pixel
 * size, so zoom/fit is done by CSS-scaling the canvas (read native size from
 * presentation.slideSize, in EMU). The toolbar's page navigation drives slide
 * changes. (Charts are rendered via Chart.js.)
 */
export class PPTXRenderer extends BaseRenderer {
  constructor() {
    super()
    this._view   = null
    this._wrap   = null
    this._canvas = null
    this._idx    = 0
    this._slideW = 960
    this._slideH = 720
    this.defaultScaleOption = 'page-fit'  // show the whole slide on open
  }

  async load(buffer, container, viewer) {
    await super.load(buffer, container, viewer)
    const { PPTXViewer } = await import('pptxviewjs')

    container.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.className = 'pptx-slide'
    const canvas = document.createElement('canvas')
    wrap.appendChild(canvas)
    container.appendChild(wrap)
    this._wrap   = wrap
    this._canvas = canvas

    // 'fit' makes PptxViewJS paint at the slide's native pixel size; we scale the
    // wrapper with CSS zoom for fit/zoom (touching canvas.style confuses its
    // post-load re-render and distorts the slide).
    this._view = new PPTXViewer({ canvas, slideSizeMode: 'fit' })
    await this._view.loadFile(buffer)
    this.numPages = this._view.getSlideCount() || 1
    this._idx = 0

    const sz = this._view.presentation?.slideSize
    if (sz?.cx && sz?.cy) {
      this._slideW = Math.round(sz.cx / EMU_PER_PX)
      this._slideH = Math.round(sz.cy / EMU_PER_PX)
    }

    await this._renderSlide(0)
  }

  // PptxViewJS fits the slide into the canvas's *current* backing size, so pin
  // the canvas to the slide's native pixels (correct 4:3/16:9 aspect) first.
  async _renderSlide(idx) {
    this._canvas.width  = this._slideW
    this._canvas.height = this._slideH
    await this._view.renderSlide(idx, this._canvas).catch(() => {})
  }

  scrollToPage(n) {
    if (!this._view) return
    this._idx = Math.max(0, Math.min(this.numPages - 1, n - 1))
    this._renderSlide(this._idx)
  }

  setScale(scale) {
    this.scale = scale
    if (this._wrap) this._wrap.style.zoom = scale === 1 ? '' : scale
  }

  getPageWidth()  { return this._slideW }
  getPageHeight() { return this._slideH }

  destroy() {
    this._view   = null
    this._canvas = null
    super.destroy()
  }
}
