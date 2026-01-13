#!/usr/bin/env node

/**
 * Converts Playwright video recordings to optimized GIFs for marketing
 *
 * Usage: node scripts/convert-video-to-gif.js
 *
 * Looks for video files in test-results/ and converts them to GIF
 */

import { execFileSync } from 'child_process'
import { readdirSync, existsSync, mkdirSync, statSync } from 'fs'
import { join } from 'path'

const TEST_RESULTS_DIR = 'test-results'
const OUTPUT_DIR = 'public/marketing'
const OUTPUT_FILENAME = 'demo-day-click.gif'

// Find video files recursively
function findVideos(dir, videos = []) {
  if (!existsSync(dir)) return videos

  const files = readdirSync(dir)
  for (const file of files) {
    const fullPath = join(dir, file)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      findVideos(fullPath, videos)
    } else if (file.endsWith('.webm')) {
      videos.push(fullPath)
    }
  }
  return videos
}

// Main conversion
async function main() {
  console.log('Looking for video files in test-results/...')

  const videos = findVideos(TEST_RESULTS_DIR)

  if (videos.length === 0) {
    console.error('No video files found in test-results/')
    process.exit(1)
  }

  // Use the most recent video (by filename, they have timestamps)
  const videoPath = videos.sort().pop()
  console.log(`Found video: ${videoPath}`)

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
  }

  const outputPath = join(OUTPUT_DIR, OUTPUT_FILENAME)

  console.log(`Converting to GIF: ${outputPath}`)

  // FFmpeg conversion for high-quality GIF:
  // - fps=12: Good balance of smoothness and file size
  // - scale=960:-1: Scale to 960px width, maintain aspect ratio
  // - palettegen/paletteuse: Better color quality for GIFs
  try {
    // Pass 1: Generate color palette (full resolution for crisp output)
    console.log('Pass 1: Generating color palette...')
    execFileSync('ffmpeg', [
      '-y',
      '-i',
      videoPath,
      '-vf',
      'fps=15,scale=1280:-1:flags=lanczos,palettegen=stats_mode=diff:max_colors=256',
      '-y',
      '/tmp/palette.png',
    ], { stdio: 'inherit' })

    // Pass 2: Create GIF with optimized palette (full 1280px width)
    console.log('Pass 2: Creating GIF with optimized palette...')
    execFileSync('ffmpeg', [
      '-y',
      '-i',
      videoPath,
      '-i',
      '/tmp/palette.png',
      '-lavfi',
      'fps=15,scale=1280:-1:flags=lanczos [x]; [x][1:v] paletteuse=dither=floyd_steinberg:diff_mode=rectangle',
      '-y',
      outputPath,
    ], { stdio: 'inherit' })

    // Get file size
    const stat = statSync(outputPath)
    const sizeMB = (stat.size / 1024 / 1024).toFixed(2)

    console.log(`\nGIF created successfully!`)
    console.log(`  Path: ${outputPath}`)
    console.log(`  Size: ${sizeMB} MB`)
  } catch (error) {
    console.error('FFmpeg conversion failed:', error.message)
    process.exit(1)
  }
}

main()
