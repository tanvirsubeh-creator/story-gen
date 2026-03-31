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
    const SHOTSTACK_KEY = process.env.SHOTSTACK_API_KEY;
    if (!SHOTSTACK_KEY) throw new Error("Missing SHOTSTACK_API_KEY");

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      throw new Error("Invalid request body");
    }

    const audioUrl   = body.audioUrl;
    const title      = body.title;
    const script     = body.script;
    const genreColor = body.genreColor || "#ffffff";

    if (!audioUrl || !title || !script) {
      throw new Error("Missing required fields: audioUrl, title, script");
    }

    console.log("Rendering: " + title + " | Audio: " + audioUrl);

    // Word-by-word subtitles
    // Average narration speed ~2.8 words per second for dramatic delivery
    const WORDS_PER_SECOND = 2.8;
    const words = script.split(/\s+/).filter(Boolean);
    const totalDuration = Math.ceil(words.length / WORDS_PER_SECOND) + 2;
    const wordDuration = parseFloat((1 / WORDS_PER_SECOND).toFixed(3));

    console.log("Words: " + words.length + ", Duration: " + totalDuration + "s");

    // Title card for first 2 seconds
    var titleClip = {
      asset: {
        type: "title",
        text: title,
        style: "future",
        color: genreColor,
        size: "large"
      },
      start: 0,
      length: 2,
      transition: { in: "fade", out: "fade" }
    };

    // One clip per word
    var subtitleClips = [titleClip];
    for (var i = 0; i < words.length; i++) {
      var startTime = parseFloat((2 + i * wordDuration).toFixed(3));
      subtitleClips.push({
        asset: {
          type: "title",
          text: words[i],
          style: "future",
          color: "#ffffff",
          size: "large",
          background: "rgba(0,0,0,0.6)"
        },
        position: "center",
        start: startTime,
        length: parseFloat((wordDuration + 0.05).toFixed(3)),
        transition: { in: "fade", out: "fade" }
      });
    }

    // Minecraft parkour background — looping freely available video
    var bgClip = {
      asset: {
        type: "video",
        src: "https://cdn.coverr.co/videos/coverr-minecraft-parkour-1920x1080-original-40827/1920x1080.mp4",
        volume: 0
      },
      start: 0,
      length: totalDuration,
      fit: "cover"
    };

    console.log("Calling Shotstack...");
    const shotstackRes = await fetch("https://api.shotstack.io/stage/render", {
      method: "POST",
      headers: {
        "x-api-key": SHOTSTACK_KEY,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        timeline: {
          soundtrack: {
            src: audioUrl,
            effect: "fadeOut",
            volume: 1
          },
          tracks: [
            { clips: subtitleClips },
            { clips: [bgClip] }
          ]
        },
        output: {
          format: "mp4",
          resolution: "sd",
          aspectRatio: "9:16",
          fps: 25
        }
      })
    });

    if (!shotstackRes.ok) {
      const e = await shotstackRes.text();
      throw new Error("Shotstack failed: " + shotstackRes.status + " - " + e);
    }

    const shotstackData = await shotstackRes.json();
    console.log("Shotstack response: " + JSON.stringify(shotstackData));

    if (!shotstackData.response || !shotstackData.response.id) {
      throw new Error("No render ID returned: " + JSON.stringify(shotstackData));
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ renderId: shotstackData.response.id })
    };

  } catch (err) {
    console.error("render error:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
