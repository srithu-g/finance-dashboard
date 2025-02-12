// ✅ Import Firebase Config Properly
import { app, db, auth } from "./config.js";


// ✅ Import Firebase Modules
import { 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
    doc, setDoc, getDoc, updateDoc, arrayUnion 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔹 Firebase Configuration (Replace with your actual credentials)
// For Firebase JS SDK v7.20.0 and later, measurementId is optional



let transactions = [];
let incomeChart, categoryChart;

// 🔹 Login
document.getElementById("login-btn").addEventListener("click", async () => {
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        localStorage.setItem("userId", userCredential.user.uid);
        loadDashboard(userCredential.user.uid);
    } catch (error) {
        document.getElementById("auth-error").innerText = "Invalid login. Try again!";
        document.getElementById("auth-error").style.display = "block";
    }
});

// 🔹 Signup
document.getElementById("signup-btn").addEventListener("click", async () => {
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;

    if (!email || !password) {
        document.getElementById("auth-error").innerText = "Please fill in both fields!";
        document.getElementById("auth-error").style.display = "block";
        return;
    }

    try {
        // Create a new user with email and password
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // Initialize user data in Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
            income: 0,
            savings: 0,
            transactions: []
        });

        // Store the userId in localStorage
        localStorage.setItem("userId", userCredential.user.uid);

        // Load the dashboard for the newly signed-up user
        loadDashboard(userCredential.user.uid);
    } catch (error) {
        console.error("Signup Error:", error); // Log the full error message

        // Display specific error messages based on the error code
        let errorMessage = "Signup failed. Try again!";
        if (error.code === "auth/email-already-in-use") {
            errorMessage = "This email is already in use. Try logging in.";
        } else if (error.code === "auth/invalid-email") {
            errorMessage = "The email address is not valid.";
        } else if (error.code === "auth/weak-password") {
            errorMessage = "The password is too weak. Choose a stronger password.";
        }

        document.getElementById("auth-error").innerText = errorMessage;
        document.getElementById("auth-error").style.display = "block";
    }
});

// 🔹 Logout
document.getElementById("logout-btn").addEventListener("click", async () => {
    try {
        await signOut(auth);  // Firebase signOut
        localStorage.removeItem("userId"); // Remove userId from localStorage

        // Hide dashboard and show login/signup screen
        document.getElementById("dashboard").style.display = "none";
        document.getElementById("auth-container").style.display = "block";

        // Clear any stored data
        transactions = [];
        updateUI({ income: 0, savings: 0 });

    } catch (error) {
        console.error("Error signing out: ", error);
    }
});

// 🔹 Load Dashboard Data
async function loadDashboard(userId) {
    document.getElementById("auth-container").style.display = "none";
    document.getElementById("dashboard").style.display = "block";

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const data = userSnap.data();
        document.getElementById("income").value = data.income || 0;
        document.getElementById("savings").value = data.savings || 0;
        transactions = data.transactions || [];
        updateUI(data);
    }
}

// 🔹 Save Finance Data
document.getElementById("save-btn").addEventListener("click", async () => {
    const userId = localStorage.getItem("userId");
    const updatedData = {
        income: parseFloat(document.getElementById("income").value) || 0,
        savings: parseFloat(document.getElementById("savings").value) || 0
    };

    try {
        await updateDoc(doc(db, "users", userId), updatedData);

        // ✅ Refresh the UI after updating
        document.getElementById("current-balance").innerText = (updatedData.income - transactions.reduce((sum, tx) => sum + tx.amount, 0)).toFixed(2);
        document.getElementById("savings-balance").innerText = updatedData.savings.toFixed(2);
        document.getElementById("loan-amount").innerText = (updatedData.income * 3).toFixed(2);

        updateCharts(updatedData.income, transactions.reduce((sum, tx) => sum + tx.amount, 0));

        alert("Income and Savings updated successfully!");
    } catch (error) {
        console.error("Error updating data:", error);
        alert("Failed to update data. Try again.");
    }
});


// 🔹 Add Transaction
document.getElementById("add-transaction-btn").addEventListener("click", async () => {
    const userId = localStorage.getItem("userId");
    const category = document.getElementById("category").value;
    const amount = parseFloat(document.getElementById("amount").value);
    
    if (!amount || amount <= 0) {
        alert("Enter a valid amount!");
        return;
    }

    transactions.push({ category, amount });

    await updateDoc(doc(db, "users", userId), {
        transactions: arrayUnion({ category, amount })
    });

    loadDashboard(userId);
});

// 🔹 Update UI & Charts
function updateUI(data) {
    const totalExpenses = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    document.getElementById("current-balance").innerText = (data.income - totalExpenses).toFixed(2);
    document.getElementById("savings-balance").innerText = data.savings.toFixed(2);
    document.getElementById("loan-amount").innerText = (data.income * 3).toFixed(2);

    // Update Transactions List
    const transactionList = document.getElementById("transaction-list");
    transactionList.innerHTML = transactions.slice(-5).map(tx => `<li>${tx.category}: ₹${tx.amount}</li>`).join("");

    updateCharts(data.income, totalExpenses);
}

// 🔹 Update Charts
function updateCharts(income, expenses) {
    const expenseByCategory = {};
    transactions.forEach(tx => {
        expenseByCategory[tx.category] = (expenseByCategory[tx.category] || 0) + tx.amount;
    });

    if (incomeChart) incomeChart.destroy();
    if (categoryChart) categoryChart.destroy();

    // 🔹 Income vs Expenditure Chart
    incomeChart = new Chart(document.getElementById("incomeExpenditureChart").getContext("2d"), {
        type: "pie",
        data: {
            labels: ["Income", "Expenditure"],
            datasets: [{
                data: [income, expenses],
                backgroundColor: ["#2ECC71", "#E74C3C"]
            }]
        }
    });

    // 🔹 Category-wise Expense Chart
    categoryChart = new Chart(document.getElementById("categoryChart").getContext("2d"), {
        type: "bar",
        data: {
            labels: Object.keys(expenseByCategory),
            datasets: [{
                label: "Category-wise Spending (₹)",
                data: Object.values(expenseByCategory),
                backgroundColor: "#3498DB"
            }]
        }
    });
}

// 🔹 Chatbot Toggle
document.getElementById("toggle-chatbot-btn").addEventListener("click", () => {
    document.getElementById("chatbot").style.display = "block";
});
document.getElementById("close-chatbot-btn").addEventListener("click", () => {
    document.getElementById("chatbot").style.display = "none";
});

// 🔹 Chatbot Smart Responses
document.getElementById("chat-input").addEventListener("keypress", function (e) {
    if (e.key === "Enter" && this.value.trim() !== "") {
        const userMessage = this.value.trim();
        const chatBody = document.getElementById("chat-body");
        chatBody.innerHTML += `<p><strong>You:</strong> ${userMessage}</p>`;
        this.value = "";

        let botResponse = "Sorry, I don't understand that.Try asking about balance, savings, loan, transactions, update chart";
        const lowerMessage = userMessage.toLowerCase();

        if (lowerMessage.includes("balance")) {
            botResponse = `Your current balance is ₹${document.getElementById("current-balance").innerText}`;
        } else if (lowerMessage.includes("savings")) {
            botResponse = `Your savings amount is ₹${document.getElementById("savings-balance").innerText}`;
        } else if (lowerMessage.includes("loan")) {
            botResponse = `Your eligible loan amount is ₹${document.getElementById("loan-amount").innerText}`;
        } else if (lowerMessage.includes("transactions")) {
            botResponse = "Here are your last 5 transactions:<br>" + transactions.slice(-5).map(tx => `${tx.category}: ₹${tx.amount}`).join("<br>");
        } else if (lowerMessage.includes("update chart")) {
            updateCharts(parseFloat(document.getElementById("income").value), transactions.reduce((sum, tx) => sum + tx.amount, 0));
            botResponse = "I've updated your charts.";
        }
        else if (lowerMessage.includes("expenses")) {  // ✅ New feature added
            botResponse = `Your total expenses are ₹${transactions.reduce((sum, tx) => sum + tx.amount, 0)}`;
        }
        chatBody.innerHTML += `<p><strong>Bot:</strong> ${botResponse}</p>`;
    }
});