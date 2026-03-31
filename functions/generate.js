const crypto = require("crypto");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const ANTHROPIC_KEY     = process.env.ANTHROPIC_API_KEY;
    const SHOTSTACK_KEY     = process.env.SHOTSTACK_API_KEY;
    const ELEVENLABS_KEY    = process.env.ELEVENLABS_API_KEY;
    const CLOUDINARY_NAME   = process.env.CLOUDINARY_CLOUD_NAME;
    const CLOUDINARY_KEY    = process.env.CLOUDINARY_API_KEY;
    const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET;
    const VOICE_ID          = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

    if (!ANTHROPIC_KEY || !SHOTSTACK_KEY || !ELEVENLABS_KEY || !CLOUDINARY_NAME || !CLOUDINARY_KEY || !CLOUDINARY_SECRET) {
      throw new Error("Missing one or more required API keys in Netlify environment variables.");
    }

    // ─────────────────────────────────────────
    // STEP 1: Pick a random genre + background
    // ─────────────────────────────────────────
    const genres = [
      {
        name: "horror",
        bg: "https://videos.pexels.com/video-files/854173/854173-hd_1920_1080_25fps.mp4",
        color: "#ff2222"
      },
      {
        name: "motivational",
        bg: "https://videos.pexels.com/video-files/1448735/1448735-hd_1920_1080_25fps.mp4",
        color: "#f5c842"
      },
      {
        name: "mystery",
        bg: "https://videos.pexels.com/video-files/3045163/3045163-hd_1920_1080_25fps.mp4",
        color: "#a78bfa"
      },
      {
        name: "funny and viral",
        bg: "https://videos.pexels.com/video-files/4812205/4812205-hd_1920_1080_30fps.mp4",
        color: "#34d399"
      },
      {
        name: "romance",
        bg: "https://videos.pexels.com/video-files/3571264/3571264-hd_1920_1080_30fps.mp4",
        color: "#f472b6"
      },
      {
        name: "thriller",
        bg: "https://videos.pexels.com/video-files/2098402/2098402-hd_1920_1080_30fps.mp4",
        color: "#60a5fa"
      }
    ];

    const genre = genres[Math.floor(Math.random() * genres.length)];
    console.log("Selected genre:", genre.name);

    // ─────────────────────────────────────────
    // STEP 2: Generate story with Claude
    // ─────────────────────────────────────────
    console.log("Calling Claude API...");
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        messages: [{
          role: "user",
          content: `Write a ${genre.name} short story designed to go viral on TikTok and YouTube Shorts.
          
Rules:
- The story must be between 80-100 words long (no more, no less)
- It must have a gripping hook in the first sentence
- It must have a surprising twist or emotional ending
- Write in second person ("you") to pull the viewer in
- Use short punchy sentences

Return ONLY a valid JSON object with exactly these two keys:
- "title": a short catchy title (max 5 words, ALL CAPS)
- "script": the full story text (80-100 words)

No markdown, no backticks, no extra text. Raw JSON only.`
        }]
      })
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      throw new Error(`Claude API failed: ${claudeRes.status} - ${errText}`);
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content[0].text.trim();
    console.log("Claude text:", rawText);

    let story;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      story = JSON.parse(cleaned);
    } catch (e) {
      throw new Error("Claude returned invalid JSON: " + rawText);
    }

    if (!story.title || !story.script) {
      throw new Error("Claude missing title or script: " + JSON.stringify(story));
    }

    console.log("Story:", story.title);

    // ─────────────────────────────────────────
    // STEP 3: Generate voiceover with ElevenLabs
    // ─────────────────────────────────────────
    console.log("Calling ElevenLabs...");
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${52dslcefh91ObWaL5fyQ}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_KEY,
          "content-type": "application/json",
          "accept": "audio/mpeg"
        },
        body: JSON.stringify({
          text: story.script,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    );

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      throw new Error(`ElevenLabs API failed: ${elevenRes.status} - ${errText}`);
    }

    const audioBuffer = await elevenRes.arrayBuffer();
    console.log("Audio size:", audioBuffer.byteLength, "bytes");

    // ─────────────────────────────────────────
    // STEP 4: Upload audio to Cloudinary
    // ─────────────────────────────────────────
    console.log("Uploading to Cloudinary...");

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "storygen";
    const sigString = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_SECRET}`;
    const signature = crypto.createHash("sha256").update(sigString).digest("hex");

    const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
    const CRLF = "\r\n";

    const buildPart = (name, value) =>
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`;

    let formBody = "";
    formBody += buildPart("api_key", CLOUDINARY_KEY);
    formBody += buildPart("timestamp", timestamp.toString());
    formBody += buildPart("signature", signature);
    formBody += buildPart("folder", folder);

    const fileHeader = `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="voiceover.mp3"${CRLF}Content-Type: audio/mpeg${CRLF}${CRLF}`;
    const fileFooter = `${CRLF}--${boundary}--${CRLF}`;

    const fullBody = Buffer.concat([
      Buffer.from(formBody, "utf8"),
      Buffer.from(fileHeader, "utf8"),
      Buffer.from(audioBuffer),
      Buffer.from(fileFooter, "utf8")
    ]);

    const cloudinaryRes = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_NAME}/video/upload`,
      {
        method: "POST",
        headers: {
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
          "Content-Length": fullBody.length.toString()
        },
        body: fullBody
      }
    );

    if (!cloudinaryRes.ok) {
      const errText = await cloudinaryRes.text();
      throw new Error(`Cloudinary upload failed: ${cloudinaryRes.status} - ${errText}`);
    }

    const cloudinaryData = await cloudinaryRes.json();
    const audioUrl = cloudinaryData.secure_url;
    console.log("Audio URL:", audioUrl);

    // ─────────────────────────────────────────
    // STEP 5: Build word-by-word subtitle clips
    // ─────────────────────────────────────────
    // Estimate ~2.5 words per second for natural speech pacing
    const WORDS_PER_SECOND = 2.5;
    const WORDS_PER_SCREEN = 4; // show 4 words at a time on screen

    const words = story.script.split(/\s+/).filter(Boolean);
    const clipDuration = WORDS_PER_SCREEN / WORDS_PER_SECOND; // ~1.6s per clip
    const totalDuration = Math.ceil(words.length / WORDS_PER_SECOND) + 2; // +2s buffer

    console.log(`Words: ${words.length}, Total duration: ${totalDuration}s`);

    // Group words into chunks of WORDS_PER_SCREEN
    const subtitleClips = [];
    for (let i = 0; i < words.length; i += WORDS_PER_SCREEN) {
      const chunk = words.slice(i, i + WORDS_PER_SCREEN).join(" ");
      const startTime = (i / WORDS_PER_SECOND);

      subtitleClips.push({
        asset: {
          type: "title",
          text: chunk,
          style: "future",
          color: "#ffffff",
          size: "medium",
          background: "rgba(0,0,0,0.55)",
          position: "bottom"
        },
        position: "bottom",
        offset: { y: 0.1 },
        start: parseFloat(startTime.toFixed(2)),
        length: parseFloat((clipDuration + 0.1).toFixed(2)),
        transition: { in: "fade", out: "fade" }
      });
    }

    // Title card at the very start
    const titleClip = {
      asset: {
        type: "title",
        text: story.title,
        style: "future",
        color: genre.color,
        size: "large"
      },
      start: 0,
      length: 2.5,
      transition: { in: "fade", out: "fade" }
    };

    // ─────────────────────────────────────────
    // STEP 6: Render with Shotstack
    // ─────────────────────────────────────────
    console.log("Calling Shotstack...");
    const shotstackRes = await fetch("https://api.shotstack.io/stage/render", {
      method: "POST",
      headers: {
        "x-api-key": SHOTSTACK_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        timeline: {
          soundtrack: {
            src: audioUrl,
            effect: "fadeOut",
            volume: 1
          },
          tracks: [
            // Track 1: Title + subtitles (top layer)
            {
              clips: [titleClip, ...subtitleClips]
            },
            // Track 2: Background video (bottom layer, looped to fill duration)
            {
              clips: [
                {
                  asset: {
                    type: "video",
                    src: genre.bg,
                    volume: 0
                  },
                  start: 0,
                  length: totalDuration,
                  fit: "cover",
                  scale: 1,
                  filter: "blur" // subtle blur on bg so text is readable
                }
              ]
            }
          ]
        },
        output: {
          format: "mp4",
          resolution: "sd",
          aspectRatio: "9:16", // vertical for TikTok/Shorts
          fps: 25
        }
      })
    });

    if (!shotstackRes.ok) {
      const errText = await shotstackRes.text();
      throw new Error(`Shotstack API failed: ${shotstackRes.status} - ${errText}`);
    }

    const shotstackData = await shotstackRes.json();
    console.log("Shotstack response:", JSON.stringify(shotstackData));

    if (!shotstackData.response || !shotstackData.response.id) {
      throw new Error("Shotstack returned no render ID: " + JSON.stringify(shotstackData));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        renderId: shotstackData.response.id,
        title: story.title,
        script: story.script,
        genre: genre.name
      })
    };

  } catch (err) {
    console.error("Function error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
