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

    const audioUrl      = body.audioUrl;
    const title         = body.title;
    const script        = body.script;
    const genreColor    = body.genreColor || "#ffffff";
    const wordTimings   = body.wordTimings || [];
    const audioDuration = body.audioDuration || 60;

    if (!audioUrl || !title || !script) {
      throw new Error("Missing required fields: audioUrl, title, script");
    }

    console.log("Rendering: " + title + " | Words: " + wordTimings.length + " | Duration: " + audioDuration + "s");

    const totalDuration = audioDuration + 1;

    // Title card for first 2 seconds
    var clips = [{
      asset: {
        type: "title",
        text: title,
        style: "future",
        color: genreColor,
        size: "large"
      },
      position: "center",
      start: 0,
      length: 2,
      transition: { in: "fade", out: "fade" }
    }];

    // Word-by-word clips using exact timestamps from ElevenLabs
    if (wordTimings.length > 0) {
      for (var i = 0; i < wordTimings.length; i++) {
        var wt = wordTimings[i];
        var start = parseFloat((wt.start + 2).toFixed(3));
        var length = parseFloat((wt.end - wt.start + 0.05).toFixed(3));
        if (length < 0.1) length = 0.1;
        clips.push({
          asset: {
            type: "title",
            text: wt.word,
            style: "future",
            color: "#ffffff",
            size: "small",
            background: "rgba(0,0,0,0)"
          },
          position: "center",
          start: start,
          length: length
        });
      }
    } else {
      // Fallback: estimated timing if no wordTimings
      var words = script.split(/\s+/).filter(Boolean);
      var wordDuration = parseFloat(((audioDuration) / words.length).toFixed(3));
      for (var j = 0; j < words.length; j++) {
        clips.push({
          asset: {
            type: "title",
            text: words[j],
            style: "future",
            color: "#ffffff",
            size: "small",
            background: "rgba(0,0,0,0)"
          },
          position: "center",
          start: parseFloat((2 + j * wordDuration).toFixed(3)),
          length: parseFloat((wordDuration + 0.05).toFixed(3))
        });
      }
    }

    // Minecraft parkour background
    var bgClip = {
      asset: {
        type: "video",
        src: "https://res.cloudinary.com/dzcvfc1nc/video/upload/v1775000828/v24044gl0000d1mgkrfog65sk4j7nmog_esryqw.mp4",
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
            { clips: clips },
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
