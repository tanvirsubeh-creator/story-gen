exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: "Method Not Allowed" };

  try {
    const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
    const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY;
    const SHOTSTACK_KEY = process.env.SHOTSTACK_API_KEY;

    if (!ANTHROPIC_KEY || !ELEVEN_KEY || !SHOTSTACK_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: "Missing API keys." }) };
    }

    // 1. Generate script with Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: "Write a viral 300-word TikTok story. Return ONLY a JSON object with: title, script, captions (array of 8), and views."
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    const story = JSON.parse(claudeData.content[0].text.match(/{[\s\S]*}/)[0]);

    // 2. Generate voiceover with ElevenLabs
    const ADAM_VOICE_ID = "pNInz6obpgDQGcFmaJgB";
    const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ADAM_VOICE_ID}`, {
      method: "POST",
      headers: { "xi-api-key": ELEVEN_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        text: story.script,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    // Note: In a production environment, you would upload this audio to S3 
    // and pass the URL to Shotstack. For this demo, we assume the asset is managed.

    // 3. Request Video Render from Shotstack
    const shotstackRes = await fetch("https://api.shotstack.io/stage/render", {
      method: "POST",
      headers: { "x-api-key": SHOTSTACK_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        timeline: {
          tracks: [
            { clips: (story.captions || []).map((text, i) => ({
                asset: { type: "title", text: text, style: "subtitle" },
                start: i * 10, length: 9
              })) 
            },
            { clips: [{ asset: { type: "video", src: "https://cdn.coverr.co/videos/coverr-a-player-running-on-a-minecraft-map-8792/1080p.mp4" }, start: 0, length: 90 }]}
          ]
        },
        output: { format: "mp4", resolution: "hd" }
      }),
    });

    const shotstackData = await shotstackRes.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        title: story.title,
        script: story.script,
        renderId: shotstackData.response.id
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
