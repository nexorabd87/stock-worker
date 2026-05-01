process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const express = require("express");
const https = require("https");

const app = express();

const symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META"];

const UPDATE_URL = "https://dpwl.atwebpages.com/share/api_update.php?secret=update_secret";
const INDEX_URL = "https://dpwl.atwebpages.com/share/update_index.php?key=my_secure_key_123";

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json"
        }
      },
      (res) => {
        let data = "";

        res.on("data", chunk => {
          data += chunk;
        });

        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error("Invalid JSON response"));
          }
        });
      }
    ).on("error", err => reject(err));
  });
}

function hitUrl(url) {
  return new Promise((resolve) => {
    https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      },
      (res) => {
        let data = "";

        res.on("data", chunk => {
          data += chunk;
        });

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: data
          });
        });
      }
    ).on("error", (err) => {
      resolve({
        statusCode: 0,
        body: err.message
      });
    });
  });
}

async function fetchFromYahooChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m`;
  const json = await getJson(url);

  const result = json.chart?.result?.[0];

  if (!result) {
    throw new Error("No chart result");
  }

  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};

  const closeList = Array.isArray(quote.close) ? quote.close.filter(v => v) : [];
  const openList  = Array.isArray(quote.open)  ? quote.open.filter(v => v)  : [];
  const highList  = Array.isArray(quote.high)  ? quote.high.filter(v => v)  : [];
  const lowList   = Array.isArray(quote.low)   ? quote.low.filter(v => v)   : [];

  const price =
    meta.regularMarketPrice ||
    closeList[closeList.length - 1];

  const open =
    meta.regularMarketOpen ||
    openList[0] ||
    price;

  const high =
    meta.regularMarketDayHigh ||
    (highList.length ? Math.max(...highList) : price);

  const low =
    meta.regularMarketDayLow ||
    (lowList.length ? Math.min(...lowList) : price);

  if (!price || price <= 0) {
    throw new Error("No price");
  }

  return {
    price: Number(price),
    open: Number(open),
    high: Number(high),
    low: Number(low)
  };
}

app.get("/", (req, res) => {
  res.send("Stock worker running");
});

app.get("/run", async (req, res) => {
  const results = [];

  for (const symbol of symbols) {
    try {
      const { price, open, high, low } = await fetchFromYahooChart(symbol);

      const updateUrl =
        `${UPDATE_URL}&symbol=${encodeURIComponent(symbol)}` +
        `&price=${encodeURIComponent(price)}` +
        `&open=${encodeURIComponent(open)}` +
        `&high=${encodeURIComponent(high)}` +
        `&low=${encodeURIComponent(low)}`;

      const updateResponse = await hitUrl(updateUrl);

      results.push({
        symbol,
        success: true,
        source: "yahoo-chart",
        price,
        open,
        high,
        low,
        updateResponse
      });

    } catch (e) {
      results.push({
        symbol,
        success: false,
        error: String(e.message || e)
      });
    }
  }

  const indexResponse = await hitUrl(INDEX_URL);

  res.json({
    success: true,
    message: "Worker completed",
    results,
    indexResponse,
    time: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});
