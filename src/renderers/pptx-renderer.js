import { BaseRenderer } from './base-renderer.js'

const EMU_PER_PX = 9525  // 914400 EMU/inch ÷ 96 px/inch
const THUMB_W = 320      // rendered thumbnail width (CSS scales it down in the sidebar)
const THUMB_DELAY = 400  // start thumbnails after PptxViewJS's chart auto-rerender (~200ms)

/**
 * Renders PowerPoint (.pptx) presentations with PptxViewJS (MIT), one slide at a
 * time onto an HTML5 canvas. PptxViewJS paints the slide into the canvas's
 * current size, so the main view pins the canvas to native pixels (from
 * presentation.slideSize, EMU→px) and scales the wrapper via CSS zoom; slide
 * thumbnails are rendered into a small canvas and kept as <img>.
 *
 * All renders are serialised through a queue, and thumbnails are built after the
 * library's chart auto-rerender window, so nothing renders concurrently — that
 * race intermittently corrupted the first (cold) load. The load is also retried
 * once for resilience.
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
    this._gen    = 0                  // cancels stale thumbnail loops on reload/destroy
    this._chain  = Promise.resolve()  // serialises renders
    this.defaultScaleOption = 'page-fit'
    this.buildsThumbnailsAsync = true
  }

  async load(buffer, container, viewer) {
    await super.load(buffer, container, viewer)
    const gen = ++this._gen
    const { PPTXViewer } = await import('pptxviewjs')

    container.innerHTML = ''
    const wrap = document.createElement('div')
    wrap.className = 'pptx-slide'
    const canvas = document.createElement('canvas')
    wrap.appendChild(canvas)
    container.appendChild(wrap)
    this._wrap   = wrap
    this._canvas = canvas

    await this._loadWithRetry(buffer, gen, PPTXViewer)

    setTimeout(() => { if (gen === this._gen) this._buildThumbnails(gen) }, THUMB_DELAY)
  }

  async _loadWithRetry(buffer, gen, PPTXViewer) {
    let lastErr
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        this._chain = Promise.resolve()
        this._view = new PPTXViewer({ canvas: this._canvas, slideSizeMode: 'fit' })
        await this._view.loadFile(buffer)
        if (gen !== this._gen) return
        this.numPages = this._view.getSlideCount() || 1
        this._idx = 0
        const sz = this._view.presentation?.slideSize
        if (sz?.cx && sz?.cy) {
          this._slideW = Math.round(sz.cx / EMU_PER_PX)
          this._slideH = Math.round(sz.cy / EMU_PER_PX)
        }
        await this._renderSlide(0)
        return
      } catch (e) {
        lastErr = e
        await new Promise(r => setTimeout(r, 200))  // let the cold init settle, then retry
      }
    }
    throw lastErr
  }

  // Serialise a render task; the caller sees its result/error, but the chain
  // keeps going even if a task fails.
  _enqueue(task) {
    const result = this._chain.then(() => (this._view ? task() : undefined))
    this._chain = result.catch(() => {})
    return result
  }

  // PptxViewJS fits the slide into the canvas's current backing size, so pin the
  // canvas to the slide's native pixels (correct aspect) before rendering.
  _renderSlide(idx) {
    return this._enqueue(async () => {
      this._canvas.width  = this._slideW
      this._canvas.height = this._slideH
      await this._view.renderSlide(idx, this._canvas)
    })
  }

  async _buildThumbnails(gen) {
    const box = document.getElementById('thumbsContent')
    if (!box) return
    const tw = THUMB_W
    const th = Math.max(1, Math.round(tw * this._slideH / this._slideW))
    const canvas = document.createElement('canvas')
    canvas.width = tw
    canvas.height = th
    for (let i = 0; i < this.numPages; i++) {
      await this._enqueue(() => this._view.renderSlide(i, canvas)).catch(() => {})
      if (gen !== this._gen || !this._view) return

      // Use an <img> (not the canvas): max-width/height:auto scales an <img>
      // correctly to the sidebar width, whereas a <canvas> keeps its height.
      const img = document.createElement('img')
      img.src = canvas.toDataURL('image/png')
      const wrap = document.createElement('div')
      wrap.className = 'thumb'
      wrap.dataset.thumbPage = i + 1
      const lbl = document.createElement('div')
      lbl.className = 'thumb-label'
      lbl.textContent = i + 1
      wrap.append(img, lbl)
      wrap.addEventListener('click', () => this.viewer?.goToPage(i + 1))
      box.appendChild(wrap)
    }
    this._highlightThumb(this._idx + 1)
  }

  scrollToPage(n) {
    if (!this._view) return
    this._idx = Math.max(0, Math.min(this.numPages - 1, n - 1))
    this._renderSlide(this._idx).catch(() => {})
    this._highlightThumb(this._idx + 1)
  }

  _highlightThumb(pageNum) {
    document.querySelectorAll('#thumbsContent .thumb').forEach(t => {
      t.classList.toggle('active', +t.dataset.thumbPage === pageNum)
    })
  }

  setScale(scale) {
    this.scale = scale
    if (this._wrap) this._wrap.style.zoom = scale === 1 ? '' : scale
  }

  getPageWidth()  { return this._slideW }
  getPageHeight() { return this._slideH }

  destroy() {
    this._gen++
    this._view   = null
    this._wrap   = null
    this._canvas = null
    super.destroy()
  }
}
