exports.handler = async (event) => {
if (event.httpMethod !== “POST”) {
return { statusCode: 405, body: “Method Not Allowed” };
}

try {
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
const SHOTSTACK_KEY = process.env.SHOTSTACK_API_KEY;

```
if (!ANTHROPIC_KEY || !ELEVEN_KEY || !SHOTSTACK_KEY) {
  return {
    statusCode: 500,
    body: JSON.stringify({ error: "Missing API keys in Netlify settings." }),
  };
}

// ── 1. Generate script with Claude ──────────────────────────────────────
const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": ANTHROPIC_KEY,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a viral TikTok story writer. Write a dramatic, emotional, first-person story that is exactly 2 minutes when read aloud (about 280-300 words). 
```

It should be gripping from the first sentence.
Return ONLY a valid JSON object with these keys:

- “title”: catchy title (max 8 words)
- “script”: the full 2-minute narration script
- “captions”: array of 8 caption strings, each 1-2 sentences, evenly spaced across the story
- “views”: a fake viral view count like “2.4M”
  Do not include any other text.`,
  },
  ],
  }),
  });
  
  const claudeData = await claudeRes.json();
  if (!claudeRes.ok) {
  return {
  statusCode: 500,
  body: JSON.stringify({ error: `Claude error: ${claudeData.error?.message}` }),
  };
  }
  
  const rawText = claudeData.content[0].text;
  const jsonMatch = rawText.match(/{[\s\S]*}/);
  const story = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
  
  // ── 2. Generate voiceover with ElevenLabs (Adam voice) ───────────────────
  const ADAM_VOICE_ID = “pNInz6obpgDQGcFmaJgB”;
  const elevenRes = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${ADAM_VOICE_ID}`,
  {
  method: “POST”,
  headers: {
  “xi-api-key”: ELEVEN_KEY,
  “content-type”: “application/json”,
  },
  body: JSON.stringify({
  text: story.script,
  model_id: “eleven_monolingual_v1”,
  voice_settings: { stability: 0.5, similarity_boost: 0.75 },
  }),
  }
  );
  
  if (!elevenRes.ok) {
  const err = await elevenRes.text();
  return {
  statusCode: 500,
  body: JSON.stringify({ error: `ElevenLabs error: ${err}` }),
  };
  }
  
  const audioBuffer = await elevenRes.arrayBuffer();
  const audioBase64 = Buffer.from(audioBuffer).toString(“base64”);
  const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
  
  // ── 3. Upload audio to Shotstack ingest ──────────────────────────────────
  const ingestRes = await fetch(“https://api.shotstack.io/ingest/stage/sources”, {
  method: “POST”,
  headers: {
  “x-api-key”: SHOTSTACK_KEY,
  “content-type”: “application/json”,
  },
  body: JSON.stringify({ url: audioDataUrl }),
  });
  
  const ingestData = await ingestRes.json();
  const audioUrl = ingestData?.data?.attributes?.url || null;
  
  // ── 4. Build Shotstack video timeline ────────────────────────────────────
  const MINECRAFT_VIDEO =
  “https://cdn.coverr.co/videos/coverr-minecraft-like-game-7619/1080p.mp4”;
  
  const captionClips = (story.captions || []).map((text, i) => ({
  asset: {
  type: “title”,
  text: text,
  style: “subtitle”,
  color: “#ffffff”,
  size: “medium”,
  background: “rgba(0,0,0,0.55)”,
  position: “bottom”,
  },
  start: i * 15,
  length: 14,
  transition: { in: “fade”, out: “fade” },
  }));
  
  const timeline = {
  soundtrack: audioUrl
  ? { src: audioUrl, effect: “fadeOut” }
  : undefined,
  tracks: [
  { clips: captionClips },
  {
  clips: [
  {
  asset: { type: “video”, src: MINECRAFT_VIDEO, volume: 0.1 },
  start: 0,
  length: 120,
  fit: “cover”,
  },
  ],
  },
  ],
  };
  
  const shotstackRes = await fetch(“https://api.shotstack.io/stage/render”, {
  method: “POST”,
  headers: {
  “x-api-key”: SHOTSTACK_KEY,
  “content-type”: “application/json”,
  },
  body: JSON.stringify({
  timeline,
  output: { format: “mp4”, resolution: “hd”, fps: 30 },
  }),
  });
  
  const shotstackData = await shotstackRes.json();
  if (!shotstackRes.ok) {
  return {
  statusCode: 500,
  body: JSON.stringify({
  error: `Shotstack error: ${JSON.stringify(shotstackData)}`,
  }),
  };
  }
  
  const renderId = shotstackData?.response?.id;
  
  return {
  statusCode: 200,
  headers: { “Content-Type”: “application/json” },
  body: JSON.stringify({
  title: story.title,
  views: story.views,
  script: story.script,
  renderId,
  }),
  };
  } catch (err) {
  return {
  statusCode: 500,
  body: JSON.stringify({ error: `System Error: ${err.message}` }),
  };
  }
  };
