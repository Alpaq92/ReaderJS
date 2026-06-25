// foliate-js's own pdf.js bundles a copy of pdf.mjs via a `new URL(`vendor/pdfjs/...`)`
// pattern that Vite's production build cannot resolve (it lacks a `./` prefix and
// gets treated as an asset glob). ReaderJS never routes PDFs through foliate — it
// has its own PDFRenderer (pdfjs-dist) — so we alias foliate's `./pdf.js` to this
// stub in vite.config.js. The `import('./pdf.js')` branch in foliate's makeBook is
// only reached for PDF input, which never happens here.
export const makePDF = () => {
  throw new Error('PDFs are handled by ReaderJS PDFRenderer, not foliate-js')
}
