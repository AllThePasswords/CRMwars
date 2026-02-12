#!/usr/bin/env node
// generate-audio.js — Pre-generate SFX and music using ElevenLabs Sound Effects API.
// Usage: ELEVENLABS_API_KEY=sk_... node scripts/generate-audio.js

const fs = require('fs');
const path = require('path');

// ---- SFX definitions ----

const SFX = [
  { key: 'click-1', prompt: 'Short retro 8-bit beep click, 100ms, crisp, arcade game UI button' },
  { key: 'click-2', prompt: 'Short retro 8-bit tick, 80ms, sharp, video game menu select' },
  { key: 'click-3', prompt: 'Short retro 8-bit blip, 120ms, clean, pixel art game UI' },
  { key: 'confirm-1', prompt: 'Retro 8-bit confirmation chime, rising pitch, 150ms, satisfying' },
  { key: 'confirm-2', prompt: 'Retro 8-bit success beep, 180ms, cheerful, video game' },
  { key: 'build-1', prompt: 'Retro 8-bit cash register sound, coin drop, 200ms, chiptune' },
  { key: 'build-2', prompt: 'Retro 8-bit construction placed sound, 180ms, arcade' },
  { key: 'research-1', prompt: 'Retro 8-bit tech unlock, 200ms, ascending futuristic tone' },
  { key: 'error-1', prompt: 'Retro 8-bit error buzz, 100ms, low pitch, denied' },
  { key: 'error-2', prompt: 'Retro 8-bit negative sound, 120ms, game over style' },
  { key: 'select-1', prompt: 'Retro 8-bit unit select tick, 60ms, subtle, RTS game' },
  { key: 'select-2', prompt: 'Retro 8-bit selection beep, 70ms, quick, tactical' },
  { key: 'command-1', prompt: 'Retro 8-bit move order sound, 80ms, military, affirmative' },
  { key: 'command-2', prompt: 'Retro 8-bit command beep, 90ms, tactical, RTS game' },
];

const MUSIC = [
  { key: 'music-title', prompt: 'Atmospheric dark synthwave ambient loop, slow tempo, retro 80s, pulsing bass, strategic mood, video game title screen', duration: 22 },
  { key: 'music-game', prompt: 'Energetic driving synthwave chiptune loop, 120 BPM, retro 80s, arpeggiator, pulsing bass, competitive RTS game', duration: 22 },
];

// ---- Resolve API key ----

function getApiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;

  const configPath = path.join(__dirname, '..', 'public', 'config.js');
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf8');
    const match = content.match(/ELEVENLABS_API_KEY\s*=\s*['"]([^'"]+)['"]/);
    if (match) return match[1];
  }

  return null;
}

// ---- Sound Effects API fetch ----

async function fetchSFX(prompt, apiKey, durationSeconds) {
  const body = { text: prompt };
  if (durationSeconds) body.duration_seconds = durationSeconds;

  const res = await fetch('https://api.elevenlabs.io/v1/sound-generation', {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ---- Batch processing ----

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('ERROR: No API key found.');
    console.error('Set ELEVENLABS_API_KEY env var or create public/config.js with the key.');
    process.exit(1);
  }

  const outDir = path.join(__dirname, '..', 'public', 'audio');
  fs.mkdirSync(outDir, { recursive: true });

  const allItems = [
    ...SFX.map(s => ({ ...s, filename: `${s.key}.mp3` })),
    ...MUSIC.map(m => ({ ...m, filename: `${m.key}.mp3` })),
  ];

  const manifest = {};
  let generated = 0, skipped = 0, failed = 0;

  console.log(`Generating ${allItems.length} audio files to ${outDir}`);

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    const filePath = path.join(outDir, item.filename);
    manifest[item.key] = item.filename;

    // Skip if file already exists (incremental)
    if (fs.existsSync(filePath)) {
      skipped++;
      const progress = generated + skipped + failed;
      console.log(`  [${progress}/${allItems.length}] SKIP ${item.filename}`);
      continue;
    }

    try {
      const buf = await fetchSFX(item.prompt, apiKey, item.duration || undefined);
      fs.writeFileSync(filePath, buf);
      generated++;
      const progress = generated + skipped + failed;
      console.log(`  [${progress}/${allItems.length}] OK   ${item.filename}`);
    } catch (e) {
      failed++;
      const progress = generated + skipped + failed;
      console.error(`  [${progress}/${allItems.length}] FAIL ${item.filename}: ${e.message}`);
    }

    // Rate limit delay between requests (skip after last)
    if (i < allItems.length - 1) {
      await sleep(500);
    }
  }

  // Write manifest
  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\nDone! Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Manifest: ${manifestPath} (${Object.keys(manifest).length} entries)`);

  if (failed > 0) process.exit(1);
}

main();
