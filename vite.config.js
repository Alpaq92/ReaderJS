import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// foliate-js's pdf.js bundles pdf.mjs via a `new URL(`vendor/pdfjs/…`)` pattern
// that Vite's production build can't resolve. ReaderJS never opens PDFs through
// foliate (PDFRenderer handles them), so intercept foliate's conditional
// `import('./pdf.js')` at resolve time and redirect it to a harmless stub.
const stubFoliatePdf = {
  name: 'stub-foliate-pdf',
  enforce: 'pre',
  resolveId(source, importer) {
    if (source === './pdf.js' && importer?.replace(/\\/g, '/').includes('/foliate-js/')) {
      return fileURLToPath(new URL('./src/foliate-pdf-stub.js', import.meta.url))
    }
  },
}

export default defineConfig({
  plugins: [stubFoliatePdf],
  optimizeDeps: {
    include: ['pdfjs-dist', 'mammoth']
  },
  build: {
    target: 'es2020'
  }
})
