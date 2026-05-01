const express = require("express");
const https = require("https");

const app = express();

const symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META"];

const UPDATE_URL = "https://dpwl.atwebpages.com/share/api_update.php?secret=update_secret";
const INDEX_URL = "https://dpwl.atwebpages.com/share/update_index.php?key=my_secure_key_123";

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
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
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, () => resolve(true))
      .on("error", () => resolve(false));
  });
}

async function runUpdate() {
  const results = [];

  for (const symbol of symbols) {
    try {
      const apiUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
      const json = await getJson(apiUrl);

      const q = json.quoteResponse?.result?.[0];

      if (!q || !q.regularMarketPrice) {
        throw new Error("Yahoo price not found");
      }

      const price = q.regularMarketPrice;
      const open  = q.regularMarketOpen || price;
      const high  = q.regularMarketDayHigh || price;
      const low   = q.regularMarketDayLow || price;

      const updateUrl =
        `${UPDATE_URL}&symbol=${symbol}&price=${price}&open=${open}&high=${high}&low=${low}`;

      await hitUrl(updateUrl);

      results.push({
        symbol,
        success: true,
        source: "Yahoo Finance",
        price
      });

    } catch (e) {
      results.push({
        symbol,
        success: false,
        error: String(e.message || e)
      });
    }
  }

  await hitUrl(INDEX_URL);

  return results;
}

app.get("/", (req, res) => {
  res.send("Stock worker running");
});

app.get("/run", async (req, res) => {
  const results = await runUpdate();

  res.json({
    success: true,
    message: "Worker completed",
    results,
    time: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server started");
});
