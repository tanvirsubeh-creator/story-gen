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

    console.log("Keys present:", !!ANTHROPIC_KEY, !!SHOTSTACK_KEY, !!ELEVENLABS_KEY, !!CLOUDINARY_NAME);

    if (!ANTHROPIC_KEY || !SHOTSTACK_KEY || !ELEVENLABS_KEY || !CLOUDINARY_NAME || !CLOUDINARY_KEY || !CLOUDINARY_SECRET) {
      throw new Error("Missing API keys. Check: ANTHROPIC_API_KEY, SHOTSTACK_API_KEY, ELEVENLABS_API_KEY, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET");
    }

    // ─────────────────────────────────────────
    // STEP 1: Generate story with Claude
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
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `Write a 50 word viral short story. Return ONLY a valid JSON object with exactly these two keys: "title" (a short catchy title, max 6 words) and "script" (the story text, max 50 words). No markdown, no backticks, no extra text - just the raw JSON object.`
        }]
      })
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("Claude API error:", errText);
      throw new Error(`Claude API failed: ${claudeRes.status} - ${errText}`);
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content[0].text.trim();
    console.log("Claude text:", rawText);

    let story;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      story = JSON.parse(cleaned);
    } catch (parseErr) {
      throw new Error("Claude returned invalid JSON: " + rawText);
    }

    if (!story.title || !story.script) {
      throw new Error("Claude response missing title or script: " + JSON.stringify(story));
    }

    console.log("Story parsed:", story.title);

    // ─────────────────────────────────────────
    // STEP 2: Generate voiceover with ElevenLabs
    // ─────────────────────────────────────────
    const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "52dslcefh91ObWaL5fyQ";

    console.log("Calling ElevenLabs API...");
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
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    );

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error("ElevenLabs error:", errText);
      throw new Error(`ElevenLabs API failed: ${elevenRes.status} - ${errText}`);
    }

    const audioBuffer = await elevenRes.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");
    console.log("ElevenLabs audio generated, size:", audioBuffer.byteLength, "bytes");

    // ─────────────────────────────────────────
    // STEP 3: Upload audio to Cloudinary
    // ─────────────────────────────────────────
    console.log("Uploading audio to Cloudinary...");

    // Build Cloudinary signature
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "storygen";

    // Create signature using crypto (built into Node)
    const crypto = require("crypto");
    const sigString = `folder=${folder}&resource_type=video&timestamp=${timestamp}${CLOUDINARY_SECRET}`;
    const signature = crypto.createHash("sha256").update(sigString).digest("hex");

    // Build multipart form data for Cloudinary upload
    const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
    const CRLF = "\r\n";

    const buildPart = (name, value) =>
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`;

    let formBody = "";
    formBody += buildPart("api_key", CLOUDINARY_KEY);
    formBody += buildPart("timestamp", timestamp.toString());
    formBody += buildPart("signature", signature);
    formBody += buildPart("folder", folder);
    formBody += buildPart("resource_type", "video"); // Cloudinary uses "video" for audio files

    // Add the audio file part
    const fileHeader = `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="voiceover.mp3"${CRLF}Content-Type: audio/mpeg${CRLF}${CRLF}`;
    const fileFooter = `${CRLF}--${boundary}--${CRLF}`;

    // Combine all parts as a Buffer
    const formPrefix = Buffer.from(formBody, "utf8");
    const fileHeaderBuf = Buffer.from(fileHeader, "utf8");
    const audioData = Buffer.from(audioBuffer);
    const fileFooterBuf = Buffer.from(fileFooter, "utf8");

    const fullBody = Buffer.concat([formPrefix, fileHeaderBuf, audioData, fileFooterBuf]);

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
      console.error("Cloudinary error:", errText);
      throw new Error(`Cloudinary upload failed: ${cloudinaryRes.status} - ${errText}`);
    }

    const cloudinaryData = await cloudinaryRes.json();
    const audioUrl = cloudinaryData.secure_url;
    console.log("Audio uploaded to Cloudinary:", audioUrl);

    // ─────────────────────────────────────────
    // STEP 4: Render video with Shotstack
    // ─────────────────────────────────────────
    console.log("Calling Shotstack API...");
    const shotstackRes = await fetch("https://api.shotstack.io/stage/render", {
      method: "POST",
      headers: {
        "x-api-key": SHOTSTACK_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        timeline: {
          background: "#000000",
          soundtrack: {
            src: audioUrl,
            effect: "fadeOut"
          },
          tracks: [
            {
              clips: [
                {
                  asset: {
                    type: "title",
                    text: story.title,
                    style: "future",
                    color: "#ffffff",
                    size: "large"
                  },
                  start: 0,
                  length: 3,
                  transition: { in: "fade", out: "fade" }
                },
                {
                  asset: {
                    type: "title",
                    text: story.script,
                    style: "future",
                    color: "#ffffff",
                    size: "small"
                  },
                  start: 3,
                  length: 7,
                  transition: { in: "fade", out: "fade" }
                }
              ]
            }
          ]
        },
        output: {
          format: "mp4",
          resolution: "sd"
        }
      })
    });

    if (!shotstackRes.ok) {
      const errText = await shotstackRes.text();
      console.error("Shotstack error:", errText);
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
        script: story.script
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
