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
    const ELEVENLABS_KEY    = process.env.ELEVENLABS_API_KEY;
    const CLOUDINARY_NAME   = process.env.CLOUDINARY_CLOUD_NAME;
    const CLOUDINARY_KEY    = process.env.CLOUDINARY_API_KEY;
    const CLOUDINARY_SECRET = process.env.CLOUDINARY_API_SECRET;
    const VOICE_ID          = "52dslcefh91ObWaL5fyQ";

    if (!ELEVENLABS_KEY || !CLOUDINARY_NAME || !CLOUDINARY_KEY || !CLOUDINARY_SECRET) {
      throw new Error("Missing API keys.");
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      throw new Error("Invalid request body");
    }

    const script = body.script;
    if (!script) throw new Error("Missing field: script");

    // Use ElevenLabs with-timestamps endpoint for precise word timing
    const elevenRes = await fetch("https://api.elevenlabs.io/v1/text-to-speech/" + VOICE_ID + "/with-timestamps", {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_KEY,
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify({
        text: script,
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });

    if (!elevenRes.ok) {
      const e = await elevenRes.text();
      throw new Error("ElevenLabs failed: " + elevenRes.status + " - " + e);
    }

    const elevenData = await elevenRes.json();

    // Decode base64 audio
    const audioBase64 = elevenData.audio_base64;
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Extract word-level timestamps
    const alignment = elevenData.alignment;
    // alignment.characters, alignment.character_start_times_seconds, alignment.character_end_times_seconds
    // Build word timestamps from character alignment
    const wordTimings = [];
    if (alignment && alignment.characters) {
      const chars = alignment.characters;
      const starts = alignment.character_start_times_seconds;
      const ends = alignment.character_end_times_seconds;

      let wordStart = null;
      let wordChars = "";
      let wordStartTime = 0;
      let wordEndTime = 0;

      for (var i = 0; i < chars.length; i++) {
        const ch = chars[i];
        if (ch === " " || i === chars.length - 1) {
          if (ch !== " ") {
            wordChars += ch;
            wordEndTime = ends[i];
          }
          if (wordChars.trim().length > 0) {
            wordTimings.push({
              word: wordChars.trim(),
              start: wordStartTime,
              end: wordEndTime
            });
          }
          wordChars = "";
          wordStart = null;
        } else {
          if (wordStart === null) {
            wordStart = i;
            wordStartTime = starts[i];
          }
          wordChars += ch;
          wordEndTime = ends[i];
        }
      }
    }

    const audioDuration = wordTimings.length > 0 ? wordTimings[wordTimings.length - 1].end + 0.5 : 60;

    // Upload to Cloudinary
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "storygen";
    const signature = crypto.createHash("sha256").update("folder=" + folder + "&timestamp=" + timestamp + CLOUDINARY_SECRET).digest("hex");

    const boundary = "----FB" + Math.random().toString(36).slice(2);
    const CRLF = "\r\n";

    const buildPart = function(name, value) {
      return "--" + boundary + CRLF + "Content-Disposition: form-data; name=\"" + name + "\"" + CRLF + CRLF + value + CRLF;
    };

    const formBody =
      buildPart("api_key", CLOUDINARY_KEY) +
      buildPart("timestamp", timestamp.toString()) +
      buildPart("signature", signature) +
      buildPart("folder", folder);

    const fileHeader =
      "--" + boundary + CRLF +
      "Content-Disposition: form-data; name=\"file\"; filename=\"voiceover.mp3\"" + CRLF +
      "Content-Type: audio/mpeg" + CRLF + CRLF;

    const fileFooter = CRLF + "--" + boundary + "--" + CRLF;

    const fullBody = Buffer.concat([
      Buffer.from(formBody, "utf8"),
      Buffer.from(fileHeader, "utf8"),
      audioBuffer,
      Buffer.from(fileFooter, "utf8")
    ]);

    const cloudinaryRes = await fetch("https://api.cloudinary.com/v1_1/" + CLOUDINARY_NAME + "/video/upload", {
      method: "POST",
      headers: {
        "Content-Type": "multipart/form-data; boundary=" + boundary,
        "Content-Length": fullBody.length.toString()
      },
      body: fullBody
    });

    if (!cloudinaryRes.ok) {
      const e = await cloudinaryRes.text();
      throw new Error("Cloudinary failed: " + cloudinaryRes.status + " - " + e);
    }

    const cloudinaryData = await cloudinaryRes.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        audioUrl: cloudinaryData.secure_url,
        wordTimings: wordTimings,
        audioDuration: audioDuration
      })
    };

  } catch (err) {
    console.error("generate-audio error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
