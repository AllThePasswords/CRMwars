#!/usr/bin/env node
// generate-voices.js — Pre-generate ElevenLabs TTS audio as static MP3 assets.
// Usage: ELEVENLABS_API_KEY=sk_... node scripts/generate-voices.js

const fs = require('fs');
const path = require('path');

// ---- Voice data (mirrored from index.html) ----

const VOICE_LINES = {
  select: {
    sales_rep: ["Ready to sell!", "What's the target?", "Always be closing.", "Point me at a prospect.", "Let's get after it.", "Show me the money.", "I've got my pitch ready.", "Where do you need me boss?"],
    sr_sales_rep: ["Senior rep reporting.", "I'll handle the big fish.", "Nobody closes like me.", "Ready for the hard sell.", "Time to steal some accounts.", "I eat quotas for breakfast.", "Let me at their best customers.", "Experience wins deals."],
    marketer: ["Marketing is live!", "Let's build some buzz.", "I'll bring them to us.", "Content is king.", "Generating demand!", "Brand awareness incoming.", "Let me work my magic.", "Prospects won't know what hit them."],
    service_rep: ["Customer success, standing by.", "I'll keep them loyal.", "Nobody poaches on my watch.", "CS rep reporting in.", "Retention is my game.", "I've got our accounts covered.", "They'll never want to leave.", "Send me where you need me."],
    ai_agent: ["AI systems online.", "Processing targets.", "Neural networks engaged.", "Efficiency optimized.", "I compute, therefore I close.", "Running sales algorithm.", "Target acquired. Probability: high.", "Beep boop. Just kidding. Let's sell."],
    talent_acq: ["HR on standby.", "I see talent everywhere.", "Who's their best closer?", "Time to make an offer they can't refuse.", "Headhunter ready.", "Let me check their LinkedIn.", "I know everyone in this industry.", "Talent acquisition, reporting in."]
  },
  command: {
    sales_rep: ["I'm on it!", "On my way.", "Consider it done.", "Moving out!", "Let's close this one.", "Get the gong ready!"],
    sr_sales_rep: ["I'll handle this personally.", "This one's mine.", "Watch and learn.", "Easy money.", "I'll have them signing by tonight."],
    marketer: ["Heading out!", "I'll spread the word.", "On the move.", "Marketing blitz incoming."],
    service_rep: ["On my way to defend.", "CS incoming.", "I'll block the poach.", "Heading to protect the account."],
    ai_agent: ["Executing directive.", "Target locked.", "Optimal route calculated.", "Processing... en route.", "Compliance probability: 94%."],
    talent_acq: ["Sourcing the target.", "Making contact.", "Setting up the interview.", "Extending the offer.", "They won't say no to this package."]
  },
  system: {
    building: ["Construction underway.", "Building in progress.", "Expanding operations.", "New facility under construction."],
    buildComplete: ["Construction complete!", "Building ready for business.", "New facility online.", "Structure complete. Looking good."],
    training: ["New recruit in training.", "Rep onboarding started.", "Training in progress.", "Getting them sales-ready."],
    trainComplete: {
      sales_rep: ["Sales rep trained and ready to close deals!", "New rep reporting for duty.", "Fresh legs on the team. Let's go!", "Ready to get after it, boss!"],
      sr_sales_rep: ["Senior rep locked and loaded.", "Heavy hitter ready to roll.", "The closer has arrived.", "Time to show them how it's done."],
      marketer: ["Marketer ready to generate buzz!", "Brand champion reporting in.", "Let's make some noise!", "The pipeline builder is here."],
      service_rep: ["CS rep trained and ready!", "Customer defender online.", "No poaching on my watch.", "Customer success expert reporting."],
      ai_agent: ["AI SDR fully operational.", "Machine learning complete. Ready to sell.", "Artificial intelligence, real results.", "Neural nets trained. Targets loading."],
      talent_acq: ["Talent Acquisition specialist ready.", "Headhunter on the prowl.", "Time to poach their best people.", "HR's secret weapon is online."]
    },
    researching: ["R and D in progress.", "Scientists are working on it.", "Research underway.", "Lab is cooking something up."],
    researchComplete: ["Research complete! New tech unlocked.", "Breakthrough! Technology upgraded.", "R and D delivers again.", "Tech upgrade ready to deploy."],
    dealWon: ["Deal closed! Get the gong!", "Ka-ching! Another one signed.", "Winner winner, chicken dinner!", "That's how we do it!", "Revenue baby! Let's go!", "Signed, sealed, delivered!"],
    dealStolen: ["Hostile takeover! We stole one!", "Poached from the competition!", "That's our customer now!", "Ripped it right from under them!"],
    enemyStole: ["They stole one of our accounts!", "We lost a customer! Fight back!", "Competitor took one. Not cool.", "Account lost. Time to retaliate."],
    poachSuccess: ["We poached their best rep!", "Welcome to the team! Great hire.", "Their loss, our gain!", "Talent acquired! They'll be furious."],
    poachFail: ["They got away. Back to sourcing.", "Offer rejected. We'll find another.", "Poach attempt failed. Regroup."],
    negotiationWon: ["Our HR outplayed theirs!", "Talent war won! We captured their recruiter.", "Hostile takeover of their HR department!"],
    negotiationLost: ["We lost the talent war!", "Their recruiter got the upper hand.", "HR battle lost. Regroup."],
    sabotageSuccess: ["Their loyalty is crumbling!", "Sabotage successful. Their customers are wavering.", "Marketing blitz landed. They're losing faith."],
    customerChurned: ["Customer left. We need CS reps out there.", "Churn alert! Deploy service reps.", "We lost one to churn. Lock down the rest."],
    winCondProgress: ["Almost there! Just a few more accounts!", "We're closing in on victory!", "The finish line is in sight!"],
    lowCash: ["Budget's getting tight.", "Cash reserves running low.", "Watch the burn rate, boss."],
    enemyGrowing: ["They're pulling ahead.", "Competitor is gaining ground.", "We need to pick up the pace."],
    acquisition: ["Initiating hostile takeover!", "M and A department activated.", "Preparing acquisition paperwork."],
    acquisitionComplete: ["Acquisition complete! Their customers are ours.", "Hostile takeover successful!", "We just bought the competition."],
    acquisitionThreat: ["Hostile takeover incoming! Shore up the balance sheet!", "They're trying to acquire us! Get cash above fifty K!", "M and A threat detected. We need revenue, now!"],
    firstDeal: ["First deal! We're in business!", "Our first customer. Let's get more!"],
    share50: ["You control half the market!", "Fifty percent market share. Dominant."],
    share75: ["Seventy-five percent! Total domination is near."],
    idleUnits: ["Idle reps detected. Deploy them!", "We have reps sitting around. Put them to work."],
    bleeding: ["We're bleeding cash.", "Burn rate exceeds revenue. Cut costs or close deals."]
  }
};

const ELEVEN_VOICES = {
  sales_rep:    'JBFqnCBsd6RMkjVDRZzb',
  sr_sales_rep: 'EXAVITQu4vr4xnSDxMaL',
  marketer:     'MF3mGyEYCl7XYWbV9V6O',
  service_rep:  'ThT5KcBeYPX3keUQqHPh',
  ai_agent:     'VR6AewLTigWG4xSOukaG',
  talent_acq:   'pNInz6obpgDQGcFmaJgB',
  system:       '21m00Tcm4TlvDq8ikWAM',
};

// ---- Collect all voice lines with deterministic filenames ----

function getAllLines() {
  const lines = [];

  for (const [type, arr] of Object.entries(VOICE_LINES.select)) {
    arr.forEach((text, i) => {
      lines.push({ text, type, filename: `select-${type}-${i}.mp3` });
    });
  }

  for (const [type, arr] of Object.entries(VOICE_LINES.command)) {
    arr.forEach((text, i) => {
      lines.push({ text, type, filename: `command-${type}-${i}.mp3` });
    });
  }

  for (const [key, val] of Object.entries(VOICE_LINES.system)) {
    if (key === 'trainComplete') {
      for (const [subtype, arr] of Object.entries(val)) {
        arr.forEach((text, i) => {
          lines.push({ text, type: subtype, filename: `system-trainComplete_${subtype}-${i}.mp3` });
        });
      }
    } else if (Array.isArray(val)) {
      val.forEach((text, i) => {
        lines.push({ text, type: 'system', filename: `system-${key}-${i}.mp3` });
      });
    }
  }

  return lines;
}

// ---- Resolve API key ----

function getApiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;

  // Fallback: try to read from public/config.js
  const configPath = path.join(__dirname, '..', 'public', 'config.js');
  if (fs.existsSync(configPath)) {
    const content = fs.readFileSync(configPath, 'utf8');
    const match = content.match(/ELEVENLABS_API_KEY\s*=\s*['"]([^'"]+)['"]/);
    if (match) return match[1];
  }

  return null;
}

// ---- TTS fetch ----

async function fetchTTS(text, voiceId, apiKey) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ---- Batch processing with delays ----

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

  const outDir = path.join(__dirname, '..', 'public', 'voices');
  fs.mkdirSync(outDir, { recursive: true });

  const lines = getAllLines();
  const manifest = {};
  let generated = 0, skipped = 0, failed = 0;

  console.log(`Generating ${lines.length} voice lines to ${outDir}`);

  for (let i = 0; i < lines.length; i += 3) {
    const batch = lines.slice(i, i + 3);

    await Promise.all(batch.map(async (line) => {
      const cacheKey = line.text + '||' + line.type;
      const filePath = path.join(outDir, line.filename);
      manifest[cacheKey] = line.filename;

      // Skip if file already exists
      if (fs.existsSync(filePath)) {
        skipped++;
        const progress = generated + skipped + failed;
        console.log(`  [${progress}/${lines.length}] SKIP ${line.filename}`);
        return;
      }

      const voiceId = ELEVEN_VOICES[line.type] || ELEVEN_VOICES.system;
      try {
        const buf = await fetchTTS(line.text, voiceId, apiKey);
        fs.writeFileSync(filePath, buf);
        generated++;
        const progress = generated + skipped + failed;
        console.log(`  [${progress}/${lines.length}] OK   ${line.filename}`);
      } catch (e) {
        failed++;
        const progress = generated + skipped + failed;
        console.error(`  [${progress}/${lines.length}] FAIL ${line.filename}: ${e.message}`);
      }
    }));

    // Rate limit delay between batches (skip after last batch)
    if (i + 3 < lines.length) {
      await sleep(200);
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
