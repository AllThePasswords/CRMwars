#!/usr/bin/env node
// generate-audio.js — Pre-generate SFX and music using ElevenLabs Sound Effects API.
// Music tracks are built from multiple 22s segments crossfaded into ~8 minute files.
// Usage: ELEVENLABS_API_KEY=sk_... node scripts/generate-audio.js
// Requires: ffmpeg (for music concatenation)

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

// ---- Music definitions — each track has a base prompt + 22 variation suffixes ----
// Each variation produces a unique 22s segment; all segments are crossfaded into ~8 min.

const MUSIC = [
  {
    key: 'music-title',
    base: 'Ambient cinematic soundtrack, slow evolving pad layers, deep warm bass drone, gentle atmospheric reverb, mysterious and inviting mood, corporate strategy game menu screen, 22 seconds',
    variations: [
      'soft distant piano melody, opening theme',
      'ethereal choir pads building slowly, wide stereo',
      'delicate piano arpeggios with soft tape delay',
      'deep sub bass pulse with distant wind textures',
      'crystalline bell tones drifting over warm drone',
      'soft analog synthesizer sweep with gentle filter movement',
      'ambient strings fading in and out, emotional',
      'subtle granular texture with warmth and space',
      'distant melodic fragments over deep evolving pad',
      'soft Rhodes electric piano chords with tape echo',
      'slowly building atmospheric tension, harmonic overtones',
      'gentle cinematic swell with emotional string layer',
      'minimal ambient pulse with soft spectral shimmer',
      'ethereal vocal texture blending into warm bass',
      'soft marimba melody over ambient pad layers',
      'deep space atmosphere with distant tonal movements',
      'warm analog pad evolving with subtle modulation',
      'gentle harp-like arpeggios floating over bass drone',
      'slow cinematic build with emotional piano notes',
      'ambient electronic textures with warm organic feel',
      'mysterious evolving soundscape with gentle tonal shifts',
      'soft closing movement with fading piano and reverb tail',
    ],
  },
  {
    key: 'music-game',
    base: 'Mid-tempo cinematic strategy game soundtrack, layered orchestral strings with soft electronic pulse, steady subtle percussion, hopeful yet focused mood, clean modern production, 22 seconds',
    variations: [
      'warm analog synth pads underneath, opening statement',
      'building string section with soft snare rhythm',
      'electronic arpeggio pattern over orchestral bed',
      'bold French horn melody with pulsing bass',
      'quiet bridge section, soft piano with string tremolo',
      'driving cello ostinato with electronic hi-hats',
      'hopeful ascending melody, layered synth and strings',
      'percussive breakdown with filtered synth stabs',
      'sweeping orchestral crescendo with timpani rolls',
      'intimate section, solo violin over warm pad',
      'rhythmic pulse building with layered percussion',
      'bright brass accents over flowing string lines',
      'electronic bass groove with orchestral countermelody',
      'atmospheric bridge, reverb-heavy piano and pads',
      'energetic section with driving snare and strings',
      'melodic development, woodwinds joining string theme',
      'synth lead melody with orchestral accompaniment',
      'dynamic shift, powerful low brass and percussion',
      'gentle interlude, acoustic guitar texture with pads',
      'building momentum, full orchestra with electronic pulse',
      'triumphant melody restated with full arrangement',
      'resolving section, warm chords fading gently',
    ],
  },
  {
    key: 'music-battle',
    base: 'Intense cinematic strategy game soundtrack, driving rhythmic percussion, urgent string ostinato, powerful brass, rising tension, layered electronic bass, competitive high-stakes mood, 22 seconds',
    variations: [
      'dramatic opening with timpani and brass stabs',
      'fast string tremolo with aggressive electronic bass',
      'pounding war drums with dissonant brass chords',
      'urgent violin ostinato over driving beat',
      'powerful horn section with relentless percussion',
      'electronic glitch percussion with orchestral hits',
      'menacing low brass melody with snare rolls',
      'intense staccato strings with rising synth tension',
      'massive orchestral hit followed by driving rhythm',
      'chaotic battle energy, layered percussion breakdown',
      'dark cello theme with aggressive electronic pulse',
      'epic brass fanfare over thunderous drums',
      'suspenseful quiet section, tense pizzicato strings',
      'explosive return with full orchestra and percussion',
      'relentless driving rhythm with distorted bass',
      'fierce string runs with powerful brass counterpoint',
      'electronic warfare sounds merged with orchestral drama',
      'climactic build with layered percussion crescendo',
      'intense melodic peak, triumphant yet dangerous',
      'aggressive synth arpeggios with orchestral backing',
      'final battle energy, everything at full intensity',
      'dramatic conclusion with sustained brass and fade',
    ],
  },
];

const CROSSFADE_DURATION = 6; // seconds of overlap between segments

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

// ---- ffmpeg preprocessing + crossfade concatenation ----

// Trim silence from start/end and normalize volume (no manual fades — acrossfade handles transitions)
function preprocessSegment(inputPath, outputPath) {
  const af = [
    // Trim leading silence (below -45dB for >50ms)
    'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB',
    // Trim trailing silence (reverse, trim, reverse back)
    'areverse',
    'silenceremove=start_periods=1:start_silence=0.05:start_threshold=-45dB',
    'areverse',
    // Normalize loudness to consistent level
    'loudnorm=I=-16:TP=-1.5:LRA=11',
  ].join(',');
  execSync(
    `ffmpeg -y -i "${inputPath}" -af "${af}" -b:a 192k "${outputPath}"`,
    { stdio: 'pipe' }
  );
}

function crossfadeSegments(segmentPaths, outputPath, tmpDir) {
  if (segmentPaths.length === 0) throw new Error('No segments to concatenate');
  if (segmentPaths.length === 1) {
    fs.copyFileSync(segmentPaths[0], outputPath);
    return;
  }

  // Pre-process each segment: trim silence, normalize, add fades
  const prepDir = path.join(tmpDir, '_prepped');
  fs.mkdirSync(prepDir, { recursive: true });
  const preppedPaths = [];

  for (let i = 0; i < segmentPaths.length; i++) {
    const prepPath = path.join(prepDir, `prep_${String(i).padStart(2, '0')}.mp3`);
    preppedPaths.push(prepPath);
    if (!fs.existsSync(prepPath)) {
      console.log(`    preprocess seg ${i + 1}/${segmentPaths.length}`);
      preprocessSegment(segmentPaths[i], prepPath);
    }
  }

  // Crossfade iteratively with equal-power (exp) curves
  let currentPath = preppedPaths[0];

  for (let i = 1; i < preppedPaths.length; i++) {
    const nextPath = preppedPaths[i];
    const isLast = i === preppedPaths.length - 1;
    const mergedPath = isLast ? outputPath : path.join(tmpDir, `_merge_tmp_${i}.mp3`);

    execSync(
      `ffmpeg -y -i "${currentPath}" -i "${nextPath}" -filter_complex "acrossfade=d=${CROSSFADE_DURATION}:c1=exp:c2=exp" -b:a 192k "${mergedPath}"`,
      { stdio: 'pipe' }
    );

    // Clean up intermediate merge file
    if (i >= 2) {
      const prevMerge = path.join(tmpDir, `_merge_tmp_${i - 1}.mp3`);
      if (fs.existsSync(prevMerge)) fs.unlinkSync(prevMerge);
    }

    currentPath = mergedPath;
  }

  // Clean up preprocessed files
  preppedPaths.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p); });
  if (fs.existsSync(prepDir)) fs.rmdirSync(prepDir);
}

// ---- Batch processing ----

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const crossfadeOnly = process.argv.includes('--crossfade-only');

  const apiKey = crossfadeOnly ? null : getApiKey();
  if (!crossfadeOnly && !apiKey) {
    console.error('ERROR: No API key found.');
    console.error('Set ELEVENLABS_API_KEY env var or create public/config.js with the key.');
    console.error('Or use --crossfade-only to re-crossfade existing segments.');
    process.exit(1);
  }

  // Check ffmpeg
  try {
    execSync('ffmpeg -version', { stdio: 'pipe' });
  } catch {
    console.error('ERROR: ffmpeg not found. Install ffmpeg to build music tracks.');
    process.exit(1);
  }

  const outDir = path.join(__dirname, '..', 'public', 'audio');
  const segDir = path.join(outDir, '_segments');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(segDir, { recursive: true });

  const manifest = {};
  let generated = 0, skipped = 0, failed = 0;

  // ---- Phase 1: Generate SFX ----
  if (crossfadeOnly) {
    console.log('\n=== Phase 1: Skipping SFX (--crossfade-only) ===');
    SFX.forEach(item => { manifest[item.key] = `${item.key}.mp3`; });
  } else {
  console.log(`\n=== Phase 1: Generating ${SFX.length} SFX files ===`);

  for (let i = 0; i < SFX.length; i++) {
    const item = SFX[i];
    const filePath = path.join(outDir, `${item.key}.mp3`);
    manifest[item.key] = `${item.key}.mp3`;

    if (fs.existsSync(filePath)) {
      skipped++;
      console.log(`  [${i + 1}/${SFX.length}] SKIP ${item.key}.mp3`);
      continue;
    }

    try {
      const buf = await fetchSFX(item.prompt, apiKey);
      fs.writeFileSync(filePath, buf);
      generated++;
      console.log(`  [${i + 1}/${SFX.length}] OK   ${item.key}.mp3`);
    } catch (e) {
      failed++;
      console.error(`  [${i + 1}/${SFX.length}] FAIL ${item.key}.mp3: ${e.message}`);
    }

    if (i < SFX.length - 1) await sleep(500);
  }
  } // end if !crossfadeOnly

  // ---- Phase 2: Generate music (multi-segment + crossfade) ----
  const totalSegments = MUSIC.reduce((s, m) => s + m.variations.length, 0);
  console.log(`\n=== Phase 2: Generating ${MUSIC.length} music tracks (${totalSegments} segments total) ===`);

  for (const track of MUSIC) {
    const finalPath = path.join(outDir, `${track.key}.mp3`);
    manifest[track.key] = `${track.key}.mp3`;

    if (!crossfadeOnly && fs.existsSync(finalPath)) {
      skipped++;
      console.log(`\n  [${track.key}] SKIP (already exists)`);
      continue;
    }

    // Delete existing final file if re-crossfading
    if (crossfadeOnly && fs.existsSync(finalPath)) fs.unlinkSync(finalPath);

    const numSegs = track.variations.length;
    const expectedDuration = numSegs * 22 - (numSegs - 1) * CROSSFADE_DURATION;

    const segPaths = [];
    let segFailed = false;

    if (crossfadeOnly) {
      console.log(`\n  [${track.key}] Re-crossfading ${numSegs} existing segments...`);
      for (let s = 0; s < numSegs; s++) {
        const segPath = path.join(segDir, `${track.key}_seg${String(s).padStart(2, '0')}.mp3`);
        if (!fs.existsSync(segPath)) {
          console.error(`    seg ${s + 1}/${numSegs} MISSING — cannot crossfade-only`);
          segFailed = true; break;
        }
        segPaths.push(segPath);
      }
    } else {
      console.log(`\n  [${track.key}] Generating ${numSegs} segments (~${Math.round(expectedDuration / 60)}m ${expectedDuration % 60}s)...`);
      for (let s = 0; s < numSegs; s++) {
        const segPath = path.join(segDir, `${track.key}_seg${String(s).padStart(2, '0')}.mp3`);
        segPaths.push(segPath);

        if (fs.existsSync(segPath)) {
          console.log(`    seg ${s + 1}/${numSegs} SKIP`);
          continue;
        }

        const prompt = `${track.base}, ${track.variations[s]}`;
        try {
          const buf = await fetchSFX(prompt, apiKey, 22);
          fs.writeFileSync(segPath, buf);
          generated++;
          console.log(`    seg ${s + 1}/${numSegs} OK`);
        } catch (e) {
          failed++;
          segFailed = true;
          console.error(`    seg ${s + 1}/${numSegs} FAIL: ${e.message}`);
        }

        await sleep(500);
      }
    }

    if (segFailed) {
      console.error(`  [${track.key}] Skipping crossfade — some segments failed or missing`);
      continue;
    }

    // Crossfade all segments into final track
    console.log(`  [${track.key}] Crossfading ${numSegs} segments with ffmpeg...`);
    try {
      crossfadeSegments(segPaths, finalPath, segDir);
      console.log(`  [${track.key}] DONE -> ${track.key}.mp3`);
    } catch (e) {
      failed++;
      console.error(`  [${track.key}] CROSSFADE FAIL: ${e.message}`);
    }
  }

  // Keep segments for potential re-crossfading (use --clean to remove)
  if (process.argv.includes('--clean') && fs.existsSync(segDir)) {
    console.log('\nCleaning up segments...');
    fs.readdirSync(segDir).forEach(f => fs.unlinkSync(path.join(segDir, f)));
    fs.rmdirSync(segDir);
  } else if (fs.existsSync(segDir)) {
    console.log(`\nSegments kept in ${segDir} (use --clean to remove)`);
  }

  // Write manifest
  const manifestPath = path.join(outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\nDone! Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}`);
  console.log(`Manifest: ${manifestPath} (${Object.keys(manifest).length} entries)`);

  if (failed > 0) process.exit(1);
}

main();
