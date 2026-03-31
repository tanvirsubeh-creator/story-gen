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
    if (!ANTHROPIC_KEY) throw new Error("Missing ANTHROPIC_API_KEY");

    const genres = [
      { name: "horror",       color: "#ff2222" },
      { name: "motivational", color: "#f5c842" },
      { name: "mystery",      color: "#a78bfa" },
      { name: "funny",        color: "#34d399" },
      { name: "romance",      color: "#f472b6" },
      { name: "thriller",     color: "#60a5fa" }
    ];

    const genre = genres[Math.floor(Math.random() * genres.length)];
    console.log("Genre:", genre.name);

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
          content: "Write a " + genre.name + " short story for TikTok/YouTube Shorts.\nRules:\n- 160-180 words (must be at least 160 words)\n- Gripping hook first sentence\n- Surprising twist or emotional ending\n- Second person (you)\n- Short punchy sentences\nReturn ONLY valid JSON: {\"title\": \"MAX 5 WORDS ALL CAPS\", \"script\": \"the story\"}\nRaw JSON only. No markdown."
        }]
      })
    });

    if (!claudeRes.ok) {
      const e = await claudeRes.text();
      throw new Error("Claude failed: " + claudeRes.status + " - " + e);
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content[0].text.trim();

    let story;
    try {
      story = JSON.parse(rawText.replace(/```json|```/g, "").trim());
    } catch (e) {
      throw new Error("Claude bad JSON: " + rawText);
    }

    if (!story.title || !story.script) {
      throw new Error("Claude missing fields: " + JSON.stringify(story));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        title: story.title,
        script: story.script,
        genre: genre.name,
        genreColor: genre.color
      })
    };

  } catch (err) {
    console.error("generate-story error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
