#!/usr/bin/env node
// generate-audio.js — Pre-generate SFX and music using ElevenLabs Sound Effects API.
// Usage: ELEVENLABS_API_KEY=sk_... node scripts/generate-audio.js

const fs = require('fs');
const path = require('path');

// ---- SFX definitions ----

const SFX = [
  { key: 'click-1', prompt: 'Subtle modern UI click sound, clean soft tap, 100ms, minimal, professional game interface' },
  { key: 'click-2', prompt: 'Gentle digital interface tap, light tactile click, 80ms, polished, subtle resonance' },
  { key: 'click-3', prompt: 'Clean soft button press sound, delicate click with tiny reverb tail, 120ms, modern game UI' },
  { key: 'confirm-1', prompt: 'Elegant confirmation tone, gentle ascending two-note chime, warm and satisfying, 200ms, modern UI' },
  { key: 'confirm-2', prompt: 'Soft success notification sound, pleasant rising tone with subtle shimmer, 180ms, clean and warm' },
  { key: 'build-1', prompt: 'Solid placement thud with light metallic ring, construction confirmation, 250ms, grounded and satisfying' },
  { key: 'build-2', prompt: 'Mechanical lock-in-place sound, sturdy click with brief harmonic ring, 200ms, building game' },
  { key: 'research-1', prompt: 'Discovery unlock sound, bright crystalline ascending tone with soft electric hum, 300ms, technology reveal' },
  { key: 'error-1', prompt: 'Soft denial tone, brief low two-note descending sound, 120ms, gentle but clear rejection, modern UI' },
  { key: 'error-2', prompt: 'Muted warning buzz, short low-frequency pulse, 100ms, not harsh, professional game feedback' },
  { key: 'select-1', prompt: 'Quick subtle selection tick, soft high-frequency tap, 60ms, barely there, refined game interface' },
  { key: 'select-2', prompt: 'Light digital ping, minimal selection indicator, 70ms, clean and unobtrusive, strategy game' },
  { key: 'command-1', prompt: 'Crisp command acknowledgment, brief focused ping with authority, 80ms, military strategy game' },
  { key: 'command-2', prompt: 'Short tactical confirmation beep, clean and decisive, 90ms, subtle authority, strategy game command' },
];

const MUSIC = [
  { key: 'music-title', prompt: 'Ambient cinematic soundtrack, slow evolving pad layers, deep warm bass drone, soft distant piano melody, gentle atmospheric reverb, mysterious and inviting mood, corporate strategy game menu screen, seamless loop, 22 seconds', duration: 22 },
  { key: 'music-game', prompt: 'Mid-tempo cinematic strategy game soundtrack, layered orchestral strings with soft electronic pulse, steady subtle percussion, hopeful yet focused mood, clean modern production, warm analog synth pads underneath, seamless loop, 22 seconds', duration: 22 },
  { key: 'music-battle', prompt: 'Intense cinematic strategy game soundtrack, driving rhythmic percussion, urgent string ostinato, powerful brass stabs, rising tension, layered electronic bass, competitive high-stakes mood, dramatic and focused energy, seamless loop, 22 seconds', duration: 22 },
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
