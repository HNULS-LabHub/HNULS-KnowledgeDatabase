/**
 * @file Generate icon files (ICO and PNG) from SVG source
 * @description Converts build/icon.svg to icon.ico (multi-size) and icon.png
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// --- helpers ---
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// --- constants ---
const projectRoot = path.resolve(__dirname, '..')
const buildDir = path.join(projectRoot, 'build')
const svgSource = path.join(buildDir, 'icon.svg')
const icoOutput = path.join(buildDir, 'icon.ico')
const pngOutput = path.join(buildDir, 'icon.png')

// ICO sizes recommended by Electron
const ICO_SIZES = [16, 32, 48, 64, 128, 256]

/**
 * Check if required tools are available
 */
async function checkDependencies() {
  try {
    // Check if sharp is available (will be installed as dev dependency)
    await import('sharp')
    console.log('✅ sharp is available')
    return true
  } catch (error) {
    console.error('❌ Missing required dependency: sharp')
    console.error('Please run: npm install --save-dev sharp')
    return false
  }
}

/**
 * Convert SVG to PNG at specified size
 */
async function svgToPng(svgPath, pngPath, size) {
  const sharp = (await import('sharp')).default
  
  await sharp(svgPath, { density: 300 })
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(pngPath)
}

/**
 * Generate ICO file with multiple sizes
 */
async function generateIco() {
  console.log('🎨 Generating ICO file...')
  
  // Create temporary directory for PNG files
  const tempDir = path.join(buildDir, '.temp-icons')
  await fs.mkdir(tempDir, { recursive: true })
  
  try {
    // Generate PNG files for each size
    const pngFiles = []
    for (const size of ICO_SIZES) {
      const tempPng = path.join(tempDir, `icon_${size}.png`)
      await svgToPng(svgSource, tempPng, size)
      pngFiles.push(tempPng)
      console.log(`  ✓ Generated ${size}x${size} PNG`)
    }
    
    // Convert PNGs to ICO using png-to-ico
    try {
      const pngToIco = (await import('png-to-ico')).default
      const buffers = await Promise.all(
        pngFiles.map(file => fs.readFile(file))
      )
      const icoBuffer = await pngToIco(buffers)
      await fs.writeFile(icoOutput, icoBuffer)
      console.log(`✅ Successfully generated ${path.relative(projectRoot, icoOutput)}`)
    } catch (error) {
      console.error('❌ Error: png-to-ico not found')
      console.error('Please run: npm install --save-dev png-to-ico')
      throw error
    }
  } finally {
    // Clean up temporary files
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

/**
 * Generate PNG file (256x256 for general use)
 */
async function generatePng() {
  console.log('🎨 Generating PNG file...')
  await svgToPng(svgSource, pngOutput, 256)
  console.log(`✅ Successfully generated ${path.relative(projectRoot, pngOutput)}`)
}

/**
 * Check if source SVG exists
 */
async function checkSource() {
  try {
    await fs.access(svgSource)
    return true
  } catch (error) {
    console.error(`❌ Source file not found: ${path.relative(projectRoot, svgSource)}`)
    console.error('Please create build/icon.svg first')
    return false
  }
}

async function main() {
  console.log('🚀 Starting icon generation...')
  console.log(`Source: ${path.relative(projectRoot, svgSource)}`)
  
  // Check prerequisites
  if (!(await checkSource())) {
    process.exit(1)
  }
  
  if (!(await checkDependencies())) {
    process.exit(1)
  }
  
  try {
    // Generate both ICO and PNG
    await Promise.all([
      generateIco(),
      generatePng()
    ])
    
    console.log('🎉 Icon generation finished.')
  } catch (error) {
    console.error('❌ Icon generation failed:', error)
    process.exit(1)
  }
}

main()
