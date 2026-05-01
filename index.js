const express = require("express");
const https = require("https");

const app = express();

const API_KEY = "CFAREV2J5MLA1IXX";
const symbols = ["AAPL","MSFT","GOOGL","AMZN","META"];

const UPDATE_URL = "https://dpwl.atwebpages.com/share/api_update.php?secret=update_secret";
const INDEX_URL = "https://dpwl.atwebpages.com/share/update_index.php?key=my_secure_key_123";

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject("Invalid JSON");
        }
      });
    }).on("error", err => reject(err.message));
  });
}

function hitUrl(url) {
  return new Promise((resolve) => {
    https.get(url, () => resolve()).on("error", () => resolve());
  });
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

app.get("/run", async (req, res) => {
  const results = [];

  for (const symbol of symbols) {
    try {
      const apiUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;
      const json = await getJson(apiUrl);

      const q = json["Global Quote"];
      const price = q?.["05. price"];
      const open = q?.["02. open"];
      const high = q?.["03. high"];
      const low = q?.["04. low"];

      if (!price) throw new Error("No price");

      const url = `${UPDATE_URL}&symbol=${symbol}&price=${price}&open=${open}&high=${high}&low=${low}`;

      await hitUrl(url);

      results.push({ symbol, success: true, price });

      await delay(15000);

    } catch (e) {
      results.push({ symbol, success: false, error: String(e) });
    }
  }

  await hitUrl(INDEX_URL);

  res.json({
    success: true,
    results,
    time: new Date().toISOString()
  });
});

app.get("/", (req,res)=>{
  res.send("Worker running");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log("Server started");
});