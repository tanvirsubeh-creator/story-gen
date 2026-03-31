exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { prompt } = JSON.parse(event.body);

    // 1. Check if the API key exists at all
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Missing ANTHROPIC_API_KEY in Netlify settings." })
      };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
        system: "Return ONLY a valid JSON object: { \"title\": \"...\", \"body\": \"...\", \"views\": \"...\" }"
      })
    });

    const data = await response.json();

    // 2. If Anthropic sends an error (like 'invalid api key' or 'over quota')
    if (data.error) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Anthropic Error: ${data.error.message}` })
      };
    }

    const content = data.content[0].text;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: [{ text: content }]
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Connection Error: ${error.message}` }),
    };
  }
};
