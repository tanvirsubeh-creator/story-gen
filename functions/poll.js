exports.handler = async (event) => {
if (event.httpMethod !== “GET”) {
return { statusCode: 405, body: “Method Not Allowed” };
}

const renderId = event.queryStringParameters?.id;
if (!renderId) {
return { statusCode: 400, body: JSON.stringify({ error: “Missing render ID” }) };
}

const SHOTSTACK_KEY = process.env.SHOTSTACK_API_KEY;

try {
const res = await fetch(`https://api.shotstack.io/stage/render/${renderId}`, {
headers: { “x-api-key”: SHOTSTACK_KEY },
});

```
const data = await res.json();
const status = data?.response?.status;
const url = data?.response?.url;

return {
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ status, url }),
};
```

} catch (err) {
return {
statusCode: 500,
body: JSON.stringify({ error: err.message }),
};
}
};
