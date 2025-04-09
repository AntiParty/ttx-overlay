// Get parameters from URL
const urlParams = new URLSearchParams(window.location.search);


const config = {
  creatorSlug: urlParams.get("creator") || "antiparty",
  ticker: urlParams.get("ticker") || "ANTI",
  showPurchases: urlParams.get("purchases") !== "0",
  showSales: urlParams.get("sales") !== "0",
  position: urlParams.get("position") || "top",
  maxAlerts: parseInt(urlParams.get("max")) || 3,
  displayTime: parseInt(urlParams.get("duration")) || 5000,
  initialLoadCount: parseInt(urlParams.get("initial")) || 0,
  buyColor: "#" + (urlParams.get("buyColor") || "00ff7f"),
  sellColor: "#" + (urlParams.get("sellColor") || "ff4757"),
};

document.documentElement.style.setProperty("--buy-color", config.buyColor);
document.documentElement.style.setProperty("--sell-color", config.sellColor);

const alertsContainer = document.getElementById("alerts-container");
if (config.position === "bottom") {
  alertsContainer.style.top = "auto";
  alertsContainer.style.bottom = "20px";
}

let lastProcessedId = 0;
let isInitialLoad = true;
let alertQueue = [];
let isProcessingQueue = false;

async function checkForNewTransactions() {
  try {
    const response = await fetch(
      `https://api.ttx.gg/creators/${config.creatorSlug}/transactions`
    );
    const data = await response.json();

    if (data && data.length > 0) {
      if (isInitialLoad) {
        isInitialLoad = false;
        const recentTransactions = data
          .slice(0, config.initialLoadCount)
          .filter(
            (tx) =>
              (tx.action === "Buy" && config.showPurchases) ||
              (tx.action === "Sell" && config.showSales)
          );

        recentTransactions.reverse().forEach((tx) => {
          alertQueue.push(tx);
        });

        lastProcessedId = Math.max(...data.map((tx) => tx.id));
      }
      else {
        const newTransactions = data.filter(
          (tx) =>
            tx.id > lastProcessedId &&
            ((tx.action === "Buy" && config.showPurchases) ||
              (tx.action === "Sell" && config.showSales))
        );

        if (newTransactions.length > 0) {
          newTransactions.reverse().forEach((tx) => {
            alertQueue.push(tx);
          });

          lastProcessedId = Math.max(...newTransactions.map((tx) => tx.id));
        }
      }

      processQueue();
    }
  } catch (error) {
    console.error("Error checking transactions:", error);
  }

  setTimeout(checkForNewTransactions, 10000);
}

function processQueue() {
  if (isProcessingQueue || alertQueue.length === 0) return;

  isProcessingQueue = true;
  const activeAlerts = document.querySelectorAll(".alert");

  if (activeAlerts.length < config.maxAlerts) {
    const transaction = alertQueue.shift();
    showTransactionAlert(transaction);
y
    setTimeout(() => {
      isProcessingQueue = false;
      processQueue();
    }, 300);
  } else {
    setTimeout(() => {
      isProcessingQueue = false;
      processQueue();
    }, 500);
  }
}

function showTransactionAlert(transaction) {
  const isPurchase = transaction.action === "Buy";
  const actionText = isPurchase ? "BUY" : "SELL";
  const alertClass = isPurchase ? "purchase" : "sale";
  const actionVerb = isPurchase ? "bought" : "sold";

  const alertDiv = document.createElement("div");
  alertDiv.className = `alert ${alertClass}`;

  alertDiv.innerHTML = `
    <img src="${transaction.user.avatar_url}" class="avatar" 
         onerror="this.src='https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517fe-def4-11e9-948e-784f43822e80-profile_image-70x70.png'">
    <div class="message">
        <div class="username">${transaction.user.name}</div>
        <div class="action">
            <span class="transaction-type">${actionText}</span>
            ${actionVerb} <span class="quantity">${transaction.quantity}</span> 
            shares of <span class="ticker">${config.ticker}</span> 
            at <span class="value">$${transaction.value}</span> each
        </div>
    </div>
  `;

  alertsContainer.appendChild(alertDiv);


  setTimeout(() => {
    alertDiv.addEventListener(
      "animationend",
      () => {
        if (alertDiv.parentNode) {
          alertDiv.parentNode.removeChild(alertDiv);
        }
      },
      { once: true }
    );
  }, 3000);
}


checkForNewTransactions();