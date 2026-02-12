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

// ---- ffmpeg overlap + mix concatenation ----
// Each 22s segment naturally fades out at end and fades in at start.
// We overlap them so the fade-out of one plays simultaneously with
// the fade-in of the next — producing seamless transitions.

const SEGMENT_SPACING = 16; // seconds between segment starts (22s - 6s overlap)

function mergeSegments(segmentPaths, outputPath) {
  if (segmentPaths.length === 0) throw new Error('No segments to merge');
  if (segmentPaths.length === 1) {
    fs.copyFileSync(segmentPaths[0], outputPath);
    return;
  }

  const n = segmentPaths.length;

  // Build ffmpeg inputs
  const inputs = segmentPaths.map(p => `-i "${p}"`).join(' ');

  // Build filter: delay each segment by i * SEGMENT_SPACING seconds, then amix all
  const filters = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      filters.push(`[0]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[s0]`);
    } else {
      const delayMs = i * SEGMENT_SPACING * 1000;
      filters.push(`[${i}]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,adelay=${delayMs}|${delayMs}[s${i}]`);
    }
  }

  const mixInputs = Array.from({ length: n }, (_, i) => `[s${i}]`).join('');
  filters.push(`${mixInputs}amix=inputs=${n}:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11`);

  const filterStr = filters.join(';');

  execSync(
    `ffmpeg -y ${inputs} -filter_complex "${filterStr}" -b:a 192k "${outputPath}"`,
    { stdio: 'pipe', maxBuffer: 50 * 1024 * 1024 }
  );
}

// Verify the output has no silence gaps
function verifyContinuousAudio(filePath) {
  const result = execSync(
    `ffmpeg -i "${filePath}" -af silencedetect=noise=-30dB:d=0.5 -f null - 2>&1`,
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  const gaps = [];
  const lines = result.split('\n');
  for (const line of lines) {
    const startMatch = line.match(/silence_start:\s*([\d.]+)/);
    const endMatch = line.match(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/);
    if (startMatch) gaps.push({ start: parseFloat(startMatch[1]) });
    if (endMatch && gaps.length > 0) {
      gaps[gaps.length - 1].end = parseFloat(endMatch[1]);
      gaps[gaps.length - 1].duration = parseFloat(endMatch[2]);
    }
  }
  // Filter out start/end silence (first 1s and last 1s)
  const duration = parseFloat(
    execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`, { encoding: 'utf8' }).trim()
  );
  const interiorGaps = gaps.filter(g => g.start > 1 && (g.end || 0) < duration - 1);
  return { gaps: interiorGaps, duration, totalGaps: gaps.length };
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
    const expectedDuration = 22 + (numSegs - 1) * SEGMENT_SPACING;

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

    // Merge all segments with overlap into final track
    const expectedDur = 22 + (numSegs - 1) * SEGMENT_SPACING;
    console.log(`  [${track.key}] Merging ${numSegs} segments (${SEGMENT_SPACING}s spacing, ~${Math.round(expectedDur / 60)}m${expectedDur % 60}s)...`);
    try {
      mergeSegments(segPaths, finalPath);
      // Verify no silence gaps
      const check = verifyContinuousAudio(finalPath);
      if (check.gaps.length > 0) {
        console.warn(`  [${track.key}] WARNING: ${check.gaps.length} silence gaps detected:`);
        check.gaps.forEach(g => console.warn(`    ${g.start.toFixed(1)}s - ${(g.end||0).toFixed(1)}s (${(g.duration||0).toFixed(1)}s)`));
      } else {
        console.log(`  [${track.key}] VERIFIED: No silence gaps. Duration: ${Math.round(check.duration)}s`);
      }
      console.log(`  [${track.key}] DONE -> ${track.key}.mp3`);
    } catch (e) {
      failed++;
      console.error(`  [${track.key}] MERGE FAIL: ${e.message}`);
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
