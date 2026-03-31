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
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    const SHOTSTACK_KEY = process.env.SHOTSTACK_API_KEY;
    const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY;

    console.log("Keys present:", !!ANTHROPIC_KEY, !!SHOTSTACK_KEY, !!ELEVENLABS_KEY);

    if (!ANTHROPIC_KEY || !SHOTSTACK_KEY || !ELEVENLABS_KEY) {
      throw new Error("Missing API keys. Need: ANTHROPIC_API_KEY, SHOTSTACK_API_KEY, ELEVENLABS_API_KEY");
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
    console.log("Claude raw response:", JSON.stringify(claudeData));

    const rawText = claudeData.content[0].text.trim();
    console.log("Claude text:", rawText);

    let story;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      story = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr.message, "Raw:", rawText);
      throw new Error("Claude returned invalid JSON: " + rawText);
    }

    if (!story.title || !story.script) {
      throw new Error("Claude response missing title or script: " + JSON.stringify(story));
    }

    console.log("Story parsed:", story.title);

    // ─────────────────────────────────────────
    // STEP 2: Generate voiceover with ElevenLabs
    // ─────────────────────────────────────────
    // "Rachel" voice - change VOICE_ID to any voice from your ElevenLabs account
    const VOICE_ID = "52dslcefh91ObWaL5fyQ";

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

    // Convert audio to base64 for Shotstack
    const audioBuffer = await elevenRes.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");
    const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;

    console.log("ElevenLabs audio generated, size:", audioBuffer.byteLength, "bytes");

    // ─────────────────────────────────────────
    // STEP 3: Render video with Shotstack
    // Title shows for 3s, script for 7s, voiceover plays throughout
    // ─────────────────────────────────────────
    console.log("Calling Shotstack API...");
    const shotstackRes = await fetch("https://api.shotstack.io/v1/render", {
      method: "POST",
      headers: {
        "x-api-key": SHOTSTACK_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        timeline: {
          background: "#000000",
          soundtrack: {
            src: audioDataUrl,
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
