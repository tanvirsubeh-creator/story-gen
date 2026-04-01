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
    const genreColor    = body.genreColor || "#ff4500";
    const wordTimings   = body.wordTimings || [];
    const audioDuration = body.audioDuration || 60;

    if (!audioUrl || !title || !script) {
      throw new Error("Missing required fields: audioUrl, title, script");
    }

    console.log("Rendering: " + title + " | Words: " + wordTimings.length + " | Duration: " + audioDuration + "s");

    const totalDuration = audioDuration + 1;

    function esc(str) {
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    // Card HTML — transparent background, content only
    const cardHtml = "<html><head><style>" +
      "* { margin:0; padding:0; box-sizing:border-box; }" +
      "html, body { width:540px; height:960px; background:transparent; font-family:-apple-system,'Segoe UI',Arial,sans-serif; }" +
      ".card { width:540px; height:960px; display:flex; flex-direction:column; justify-content:center; padding:48px 36px; }" +
      ".header { display:flex; align-items:center; gap:14px; margin-bottom:20px; }" +
      ".avatar { width:56px; height:56px; border-radius:50%; background:#ff4500; display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:900; color:white; flex-shrink:0; }" +
      ".name-block { display:flex; flex-direction:column; gap:3px; }" +
      ".name-row { display:flex; align-items:center; gap:6px; }" +
      ".username { font-size:17px; font-weight:800; color:#0f1419; }" +
      ".check { width:19px; height:19px; border-radius:50%; background:#1d9bf0; display:inline-flex; align-items:center; justify-content:center; font-size:12px; color:white; font-weight:900; line-height:1; }" +
      ".views { font-size:14px; color:#536471; }" +
      ".body-text { font-size:28px; font-weight:600; color:#0f1419; line-height:1.4; }" +
      "</style></head><body>" +
      "<div class='card'>" +
      "<div class='header'>" +
      "<div class='avatar'>r/</div>" +
      "<div class='name-block'>" +
      "<div class='name-row'><span class='username'>r/AskReddit</span><span class='check'>&#10003;</span></div>" +
      "<div class='views'>&#128065; 832,832</div>" +
      "</div></div>" +
      "<div class='body-text'>" + esc(title) + "</div>" +
      "</div></body></html>";

    // White 1x1 PNG as a solid white full-frame background for the card
    var whiteClip = {
      asset: {
        type: "image",
        src: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/White_Square.svg/240px-White_Square.svg.png"
      },
      position: "center",
      start: 0,
      length: 3,
      fit: "cover",
      transition: { in: "fade", out: "fade" }
    };

    // Card HTML overlay
    var cardClip = {
      asset: { type: "html", html: cardHtml, width: 540, height: 960 },
      position: "center",
      start: 0,
      length: 3,
      transition: { in: "fade", out: "fade" }
    };

    // Word clips
    var wordClips = [];

    function wordHtml(word) {
      return "<html><head><style>" +
        "* { margin:0; padding:0; }" +
        "body { width:540px; height:960px; background:transparent; display:flex; align-items:center; justify-content:center; font-family:'IBM Plex Sans',Arial,sans-serif; }" +
        ".word { font-size:52px; font-weight:800; color:#ffffff; text-align:center; text-shadow:0 2px 12px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,1); padding:0 24px; line-height:1.2; }" +
        "</style></head><body><div class='word'>" + esc(word) + "</div></body></html>";
    }

    if (wordTimings.length > 0) {
      for (var i = 0; i < wordTimings.length; i++) {
        var wt = wordTimings[i];
        var start = parseFloat((wt.start + 3).toFixed(3));
        var length = parseFloat((wt.end - wt.start + 0.05).toFixed(3));
        if (length < 0.1) length = 0.1;
        wordClips.push({
          asset: { type: "html", html: wordHtml(wt.word), width: 540, height: 960 },
          position: "center",
          start: start,
          length: length
        });
      }
    } else {
      var words = script.split(/\s+/).filter(Boolean);
      var wordDuration = parseFloat((audioDuration / words.length).toFixed(3));
      for (var j = 0; j < words.length; j++) {
        wordClips.push({
          asset: { type: "html", html: wordHtml(words[j]), width: 540, height: 960 },
          position: "center",
          start: parseFloat((3 + j * wordDuration).toFixed(3)),
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
            { clips: wordClips },
            { clips: [cardClip] },
            { clips: [whiteClip] },
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
