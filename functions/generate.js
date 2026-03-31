// No external imports needed if we use the built-in fetch properly
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };

  try {
    const { ANTHROPIC_API_KEY, ELEVENLABS_API_KEY, SHOTSTACK_API_KEY } = process.env;

    // 1. Claude Call (Simplified to avoid JSON parsing errors)
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1024,
        messages: [{
          role: "user", 
          content: "Write a 100 word scary story. Return as a JSON object with keys 'title' and 'script'." 
        }],
      }),
    });

    const claudeData = await claudeRes.json();
    if (!claudeRes.ok) throw new Error(`Claude: ${claudeData.error?.message}`);
    
    // Safety check for the JSON inside Claude's text response
    const storyText = claudeData.content[0].text;
    const story = JSON.parse(storyText.match(/{[\s\S]*}/)[0]);

    // 2. Shotstack Call (Using 'v1' instead of 'stage' to be safer)
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
      }),
    });

    const shotstackData = await shotstackRes.json();
    if (!shotstackRes.ok) throw new Error(`Shotstack: ${JSON.stringify(shotstackData)}`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        renderId: shotstackData.response.id,
        title: story.title
      }),
    };

  } catch (err) {
    // This will now show up in your browser console!
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
