const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  try {
    const { ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, SHOTSTACK_API_KEY } = process.env;

    // 1. Claude Script Generation
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        messages: [{ role: "user", content: "Return a JSON object with 'title' and 'script' for a 1 minute viral story." }]
      })
    });

    const claudeData = await claudeRes.json();
    const story = JSON.parse(claudeData.content[0].text.match(/{[\s\S]*}/)[0]);

    // 2. Shotstack Render
    const shotstackRes = await fetch("https://api.shotstack.io/v1/render", {
      method: "POST",
      headers: { 
        "x-api-key": SHOTSTACK_KEY, 
        "content-type": "application/json" 
      },
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

