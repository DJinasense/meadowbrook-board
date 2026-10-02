import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// pdf.js (used for PDF attachment previews, see src/lib/pdfRender.js) fetches
// some support files at runtime rather than bundling them: fonts for PDFs that
// don't embed their own, and wasm decoders for scanner-produced images. They
// have to be reachable at a fixed URL, so copy them out of node_modules into
// public/pdfjs instead of committing ~2.5 MB of binaries to the repo.
// public/pdfjs is gitignored; this runs for both `vite dev` and `vite build`.
function copyPdfjsAssets() {
  return {
    name: 'copy-pdfjs-assets',
    buildStart() {
      const target = 'public/pdfjs'
      mkdirSync(target, { recursive: true })
      for (const dir of ['standard_fonts', 'wasm', 'iccs']) {
        const from = `node_modules/pdfjs-dist/${dir}`
        if (existsSync(from)) cpSync(from, `${target}/${dir}`, { recursive: true })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), copyPdfjsAssets()],
})
