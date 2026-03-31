exports.handler = async (event) => {
    // 1. Only allow POST requests
    if (event.httpMethod !== "POST") {
        return { 
            statusCode: 405, 
            body: JSON.stringify({ error: "Method Not Allowed" }) 
        };
    }

    try {
        const { prompt } = JSON.parse(event.body);

        // 2. Check if API Key exists in Netlify Environment Variables
        if (!process.env.ANTHROPIC_API_KEY) {
            return {
                statusCode: 500,
                body: JSON.stringify({ error: "Missing ANTHROPIC_API_KEY in Netlify settings." })
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
                model: "claude-3-5-sonnet-20240620",
                max_tokens: 1500,
                messages: [
                    { role: "user", content: prompt }
                ]
            })
        });

        const data = await response.json();

        // 3. Handle cases where Anthropic returns an error (like 401 or 400)
        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify({ 
                    error: "Anthropic API Error", 
                    details: data.error || data 
                })
            };
        }

        // 4. Success - Send the full data back to index.html
        return {
            statusCode: 200,
            body: JSON.stringify(data)
        };

    } catch (error) {
        // 5. Catch system/network errors
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Server Error", message: error.message })
        };
    }
};
