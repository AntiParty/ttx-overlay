// Get parameters from URL
const urlParams = new URLSearchParams(window.location.search);

// Configuration with defaults
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

// Set CSS variables for colors
document.documentElement.style.setProperty("--buy-color", config.buyColor);
document.documentElement.style.setProperty("--sell-color", config.sellColor);

// Position alerts container
const alertsContainer = document.getElementById("alerts-container");
if (config.position === "bottom") {
  alertsContainer.style.top = "auto";
  alertsContainer.style.bottom = "20px";
}

// State management
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

    // Check if data is an array (direct response) or has a data property
    const transactions = Array.isArray(data) ? data : (data.data || []);

    if (transactions.length > 0) {
      // On first load, process the most recent transactions first
      if (isInitialLoad) {
        isInitialLoad = false;
        const recentTransactions = transactions
          .slice(0, config.initialLoadCount)
          .filter(tx => 
            (tx.action.toLowerCase() === "buy" && config.showPurchases) ||
            (tx.action.toLowerCase() === "sell" && config.showSales)
          );

        if (recentTransactions.length > 0) {
          recentTransactions.reverse().forEach(tx => {
            alertQueue.push(tx);
          });
          lastProcessedId = Math.max(...recentTransactions.map(tx => tx.id));
        } else {
          lastProcessedId = 0;
        }
      }
      // On subsequent checks, look for new transactions
      else {
        const newTransactions = transactions.filter(tx => 
          tx.id > lastProcessedId &&
          ((tx.action.toLowerCase() === "buy" && config.showPurchases) ||
           (tx.action.toLowerCase() === "sell" && config.showSales))
        );

        if (newTransactions.length > 0) {
          // Add new transactions to queue (newest first)
          newTransactions.reverse().forEach(tx => {
            alertQueue.push(tx);
          });
          lastProcessedId = Math.max(...newTransactions.map(tx => tx.id));
        }
      }

      processQueue();
    }
  } catch (error) {
    console.error("Error checking transactions:", error);
  }

  // Schedule next check
  setTimeout(checkForNewTransactions, 10000);
}


function processQueue() {
  if (isProcessingQueue || alertQueue.length === 0) return;

  isProcessingQueue = true;
  const activeAlerts = document.querySelectorAll(".alert");

  // If we have space for more alerts
  if (activeAlerts.length < config.maxAlerts) {
    const transaction = alertQueue.shift();
    showTransactionAlert(transaction);

    // Process next alert after a short delay
    setTimeout(() => {
      isProcessingQueue = false;
      processQueue();
    }, 300);
  } else {
    // Try again after current alerts start disappearing
    setTimeout(() => {
      isProcessingQueue = false;
      processQueue();
    }, 500);
  }
}

function showTransactionAlert(transaction) {
  // Normalize the action to lowercase for comparison
  const action = transaction.action.toLowerCase();
  const isPurchase = action === "buy";
  const actionText = isPurchase ? "Buy" : "Sell";
  const alertClass = isPurchase ? "purchase" : "sale";
  const actionVerb = isPurchase ? "bought" : "sold";

  // Create avatar URL with fallback
  const avatarUrl = transaction.user?.avatar_url || 
                   'https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517fe-def4-11e9-948e-784f43822e80-profile_image-70x70.png';

  const alertDiv = document.createElement("div");
  alertDiv.className = `alert ${alertClass}`;

  alertDiv.innerHTML = `
    <img src="${avatarUrl}" class="avatar" 
         onerror="this.src='https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517fe-def4-11e9-948e-784f43822e80-profile_image-70x70.png'">
    <div class="message">
      <div class="username">${transaction.user?.name || 'Unknown'}</div>
      <div class="action">
        <span class="transaction-type">${actionText}</span>
        ${actionVerb} <span class="quantity">${transaction.quantity}</span> 
        shares of <span class="ticker">${config.ticker}</span> 
        at <span class="value">$${transaction.value}</span> each
      </div>
    </div>
  `;

  // Add to container
  alertsContainer.appendChild(alertDiv);

  // Remove alert after display time
  setTimeout(() => {
    alertDiv.classList.add('fade-out');
    alertDiv.addEventListener('animationend', () => {
      alertDiv.remove();
    }, { once: true });
  }, config.displayTime);
}

// Start checking for transactions
checkForNewTransactions();