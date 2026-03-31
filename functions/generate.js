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
    const ELEVENLABS_KEY    = process.env.ELEVENLABS_API_KEY;
    const CLOUDINARY_NAME   = process.env.CLOUDINARY_CLOUD_NAME;
    const CLOUDINARY_KEY    = process.env.CLOUDINARY_API_KEY;
    const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET;
    const VOICE_ID          = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";

    if (!ANTHROPIC_KEY || !ELEVENLABS_KEY || !CLOUDINARY_NAME || !CLOUDINARY_KEY || !CLOUDINARY_SECRET) {
      throw new Error("Missing API keys.");
    }

    // ─────────────────────────────────────────
    // Pick a random genre + background video
    // ─────────────────────────────────────────
    const genres = [
      { name: "horror",       bg: "https://videos.pexels.com/video-files/854173/854173-hd_1920_1080_25fps.mp4",   color: "#ff2222" },
      { name: "motivational", bg: "https://videos.pexels.com/video-files/1448735/1448735-hd_1920_1080_25fps.mp4", color: "#f5c842" },
      { name: "mystery",      bg: "https://videos.pexels.com/video-files/3045163/3045163-hd_1920_1080_25fps.mp4", color: "#a78bfa" },
      { name: "funny",        bg: "https://videos.pexels.com/video-files/4812205/4812205-hd_1920_1080_30fps.mp4", color: "#34d399" },
      { name: "romance",      bg: "https://videos.pexels.com/video-files/3571264/3571264-hd_1920_1080_30fps.mp4", color: "#f472b6" },
      { name: "thriller",     bg: "https://videos.pexels.com/video-files/2098402/2098402-hd_1920_1080_30fps.mp4", color: "#60a5fa" }
    ];

    const genre = genres[Math.floor(Math.random() * genres.length)];
    console.log("Genre:", genre.name);

    // ─────────────────────────────────────────
    // STEP 1: Claude — write story
    // ─────────────────────────────────────────
    console.log("Calling Claude...");
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
- 80-100 words long (strictly)
- Gripping hook in the first sentence
- Surprising twist or emotional ending
- Write in second person ("you")
- Short punchy sentences

Return ONLY a valid JSON object with exactly:
- "title": catchy title, max 5 words, ALL CAPS
- "script": the full story (80-100 words)

Raw JSON only. No markdown, no backticks.`
        }]
      })
    });

    if (!claudeRes.ok) {
      const e = await claudeRes.text();
      throw new Error(`Claude failed: ${claudeRes.status} - ${e}`);
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content[0].text.trim();
    console.log("Claude:", rawText);

    let story;
    try {
      story = JSON.parse(rawText.replace(/```json|```/g, "").trim());
    } catch (e) {
      throw new Error("Claude bad JSON: " + rawText);
    }

    if (!story.title || !story.script) {
      throw new Error("Claude missing fields: " + JSON.stringify(story));
    }

    // ─────────────────────────────────────────
    // STEP 2: ElevenLabs — generate voiceover
    // ─────────────────────────────────────────
    console.log("Calling ElevenLabs...");
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
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
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      }
    );

    if (!elevenRes.ok) {
      const e = await elevenRes.text();
      throw new Error(`ElevenLabs failed: ${elevenRes.status} - ${e}`);
    }

    const audioBuffer = await elevenRes.arrayBuffer();
    console.log("Audio size:", audioBuffer.byteLength, "bytes");

    // ─────────────────────────────────────────
    // STEP 3: Cloudinary — upload audio
    // ─────────────────────────────────────────
    console.log("Uploading to Cloudinary...");

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "storygen";
    const signature = crypto
      .createHash("sha256")
      .update(`folder=${folder}&timestamp=${timestamp}${CLOUDINARY_SECRET}`)
      .digest("hex");

    const boundary = "----FB" + Math.random().toString(36).slice(2);
    const CRLF = "\r\n";

    const buildPart = (name, value) =>
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`;

    const formBody =
      buildPart("api_key", CLOUDINARY_KEY) +
      buildPart("timestamp", timestamp.toString()) +
      buildPart("signature", signature) +
      buildPart("folder", folder);

    const fileHeader =
      `--${boundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="voiceover.mp3"${CRLF}` +
      `Content-Type: audio/mpeg${CRLF}${CRLF}`;

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
      const e = await cloudinaryRes.text();
      throw new Error(`Cloudinary failed: ${cloudinaryRes.status} - ${e}`);
    }

    const cloudinaryData = await cloudinaryRes.json();
    const audioUrl = cloudinaryData.secure_url;
    console.log("Audio URL:", audioUrl);

    // Return everything needed for the render step
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        audioUrl,
        title: story.title,
        script: story.script,
        genre: genre.name,
        genreColor: genre.color,
        genreBg: genre.bg
      })
    };

  } catch (err) {
    console.error("generate error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
