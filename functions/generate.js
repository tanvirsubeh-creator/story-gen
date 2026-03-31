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

    console.log("Keys present:", !!ANTHROPIC_KEY, !!SHOTSTACK_KEY);

    if (!ANTHROPIC_KEY || !SHOTSTACK_KEY) {
      throw new Error("Missing API Keys in Netlify settings");
    }

    // 1. Request story from Claude
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
          content: `Write a 50 word viral short story. Return ONLY a valid JSON object with exactly these two keys: "title" (a short catchy title, max 6 words) and "script" (the story text). No markdown, no backticks, no extra text - just the raw JSON object.`
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

    // Safely parse JSON - strip any accidental markdown fences
    let story;
    try {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      story = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr.message, "Raw text:", rawText);
      throw new Error("Claude returned invalid JSON: " + rawText);
    }

    if (!story.title || !story.script) {
      throw new Error("Claude response missing title or script fields: " + JSON.stringify(story));
    }

    console.log("Story parsed:", story.title);

    // 2. Submit render to Shotstack
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
      console.error("Shotstack API error:", errText);
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
        title: story.title
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
