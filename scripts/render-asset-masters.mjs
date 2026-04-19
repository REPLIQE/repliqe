/**
 * Renders SVG masters under resources/ to the PNG filenames @capacitor/assets expects.
 *
 * Inputs (SVG):
 *   resources/icon-ios.svg                  → resources/icon-only.png        (2048×2048)
 *   resources/icon-android-foreground.svg   → resources/icon-foreground.png  (2048×2048)
 *   resources/icon-android-background.svg   → resources/icon-background.png  (2048×2048)
 *   resources/splash.svg                    → resources/splash.png           (2732×2732)
 *                                           → resources/splash-dark.png      (2732×2732, same source)
 *
 * Also emits PWA-sized PNGs to public/:
 *   favicon-16.png  (16×16)
 *   favicon-32.png  (32×32)
 *   apple-touch-icon.png (180×180)
 *   icon-192.png    (192×192)
 *   icon-512.png    (512×512)
 *
 * The web set is rendered from the iOS icon (full-bleed) so the app's tile shape matches
 * across iOS home screen, Android adaptive icons, and the PWA install banner.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const resources = resolve(root, 'resources')
const publicDir = resolve(root, 'public')

const NATIVE_BG = '#0D0D1A'

async function rasterize(inputSvgPath, outputPngPath, size, opts = {}) {
  const svg = await readFile(inputSvgPath)
  let pipeline = sharp(svg, { density: 384 }).resize(size, size, { fit: 'contain' })
  if (opts.background) pipeline = pipeline.flatten({ background: opts.background })
  const buf = await pipeline.png({ compressionLevel: 9 }).toBuffer()
  await writeFile(outputPngPath, buf)
  return { outputPngPath, size }
}

const tasks = [
  // iOS app icon — full bleed, opaque.
  { src: 'icon-ios.svg', out: 'icon-only.png', size: 2048, background: NATIVE_BG, dest: resources },
  // Android adaptive icon layers.
  { src: 'icon-android-foreground.svg', out: 'icon-foreground.png', size: 2048, dest: resources },
  { src: 'icon-android-background.svg', out: 'icon-background.png', size: 2048, background: NATIVE_BG, dest: resources },
  // Splash master — same source for light + dark since the app is dark-only.
  { src: 'splash.svg', out: 'splash.png', size: 2732, background: NATIVE_BG, dest: resources },
  { src: 'splash.svg', out: 'splash-dark.png', size: 2732, background: NATIVE_BG, dest: resources },
  // Web/PWA derived from the iOS master so the visual matches the home-screen icon.
  { src: 'icon-ios.svg', out: 'favicon-16.png', size: 16, background: NATIVE_BG, dest: publicDir },
  { src: 'icon-ios.svg', out: 'favicon-32.png', size: 32, background: NATIVE_BG, dest: publicDir },
  { src: 'icon-ios.svg', out: 'apple-touch-icon.png', size: 180, background: NATIVE_BG, dest: publicDir },
  { src: 'icon-ios.svg', out: 'icon-192.png', size: 192, background: NATIVE_BG, dest: publicDir },
  { src: 'icon-ios.svg', out: 'icon-512.png', size: 512, background: NATIVE_BG, dest: publicDir },
]

await mkdir(publicDir, { recursive: true })

for (const t of tasks) {
  const inputPath = resolve(resources, t.src)
  const outputPath = resolve(t.dest, t.out)
  const { size } = await rasterize(inputPath, outputPath, t.size, { background: t.background })
  console.log(`✓ ${t.src} → ${outputPath.replace(root + '/', '')} (${size}×${size})`)
}

console.log('\nDone.')
