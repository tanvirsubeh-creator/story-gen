exports.handler = async (event) => {
    if (event.httpMethod !== "POST") {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ error: "Method Not Allowed" }) 
        };
    }

    try {
        const { prompt } = JSON.parse(event.body);

        if (!process.env.ANTHROPIC_API_KEY) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Missing API Key in Netlify Settings" })
            };
        }

        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-api-key": process.env.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01"
            },
            body: JSON.stringify({
                model: "claude-3-haiku-20240307", // Swapped to Haiku
                max_tokens: 1500,
                messages: [
                    { role: "user", content: prompt }
                ]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify({ 
                    error: data.error?.message || "Anthropic API Error" 
                })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Server Error: " + error.message })
        };
    }
};
