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

    if (!ANTHROPIC_KEY || !SHOTSTACK_KEY) {
      throw new Error("Missing API Keys in Netlify settings");
    }

    // 1. Simple Story Request to Claude
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 500,
        messages: [{ role: "user", content: "Write a 50 word story. Return ONLY a JSON object with keys 'title' and 'script'." }]
      })
    });

    const claudeData = await claudeRes.json();
    const story = JSON.parse(claudeData.content[0].text.match(/{[\s\S]*}/)[0]);

    // 2. Simple Video Request to Shotstack
    const shotstackRes = await fetch("https://api.shotstack.io/v1/render", {
      method: "POST",
      headers: { "x-api-key": SHOTSTACK_KEY, "content-type": "application/json" },
      body: JSON.stringify({
        timeline: {
          tracks: [{
            clips: [{
              asset: { type: "title", text: story.title },
              start: 0, length: 5
            }]
          }]
        },
        output: { format: "mp4", resolution: "sd" }
      })
    });

    const shotstackData = await shotstackRes.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        renderId: shotstackData.response.id, 
        title: story.title 
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
