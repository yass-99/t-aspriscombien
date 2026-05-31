import sharp from 'sharp'
import { writeFile, copyFile } from 'node:fs/promises'

const SRC = 'logo.png'

async function png(size) {
  // RGBA explicite : requis pour les PNG encapsulés dans le conteneur ICO
  return sharp(SRC)
    .resize(size, size, { fit: 'cover' })
    .ensureAlpha()
    .toColourspace('srgb')
    .png({ palette: false, compressionLevel: 9 })
    .toBuffer()
}

// Static PNG icons (Next file-convention + manifest + general use)
await writeFile('app/icon.png', await png(512))
await writeFile('app/apple-icon.png', await png(180))
await writeFile('public/icon-192.png', await png(192))
await writeFile('public/icon-512.png', await png(512))
await copyFile(SRC, 'public/logo.png')

// favicon.ico : conteneur ICO encapsulant des PNG (sizes 16/32/48)
const sizes = [16, 32, 48]
const imgs = await Promise.all(sizes.map((s) => png(s)))
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)          // reserved
header.writeUInt16LE(1, 2)          // type 1 = icon
header.writeUInt16LE(sizes.length, 4)
const dir = Buffer.alloc(16 * sizes.length)
let offset = 6 + 16 * sizes.length
imgs.forEach((buf, i) => {
  const b = i * 16
  dir.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], b + 0) // width
  dir.writeUInt8(sizes[i] >= 256 ? 0 : sizes[i], b + 1) // height
  dir.writeUInt8(0, b + 2)          // palette
  dir.writeUInt8(0, b + 3)          // reserved
  dir.writeUInt16LE(1, b + 4)       // color planes
  dir.writeUInt16LE(32, b + 6)      // bpp
  dir.writeUInt32LE(buf.length, b + 8)
  dir.writeUInt32LE(offset, b + 12)
  offset += buf.length
})
await writeFile('app/favicon.ico', Buffer.concat([header, dir, ...imgs]))

console.log('icons generated OK')
