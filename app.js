const express = require("express");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const sha256 = require("sha256");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
mongoose.set("strictQuery", true);
const app = express();

const mainDB = new mongoose.connect(
  "mongodb+srv://harsh1:qwerty123@cluster0.ixfju78.mongodb.net/?retryWrites=true&w=majority"
);
const secret = "qwerty";
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    unique: true,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  balance: {
    type: Number,
    required: true,
    default: 0,
  },
});
const transactionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model("User", userSchema);
const Transaction = mongoose.model("transaction", transactionSchema);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("view engine", "ejs");

app.get("/", async (req, res) => {
  let clientToken = req.cookies.sessionToken;
  let decoded = jwt.verify(clientToken, secret);
  let userEmail = decoded.email;
  let user = await User.findOne({ email: userEmail });
  let balance = user.balance;
  let transactions = await Transaction.find({ email: userEmail }).sort({
    date: -1,
  });
  res.render("index", { balance, transactions });
});
app.post("/", async (req, res) => {
  let amount = parseInt(req.body.amount);
  let type = req.body.type;
  let clientToken = req.cookies.sessionToken;
  let decoded = jwt.verify(clientToken, secret);
  let userEmail = decoded.email;
  let newTransaction = new Transaction({
    amount,
    type,
    email: userEmail,
  });
  await newTransaction.save();
  let user = await User.findOne({ email: userEmail });
  let balance = user.balance;
  if (type == "income") {
    balance = amount + balance;
  } else if (type == "expense") {
    balance = balance - amount;
  }
  await User.findOneAndUpdate({ email: userEmail }, { balance });
  res.redirect("/");
});
app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/report", async (req, res) => {
  let clientToken = req.cookies.sessionToken; //extracting email
  let decoded = jwt.verify(clientToken, secret); //extracting email
  let userEmail = decoded.email; //extracting email
  const transactions = await Transaction.find({
    email: userEmail,
    date: {
      //search via date of entry before listed time
      $gte: new Date(new Date().getTime() - 30 * 60 * 1000), //gte means greater than eaqual to
    },
  });
  let totalIncome = 0,
    totalExpense = 0;
  for (transaction of transactions) {
    if (transaction.type == "income") {
      totalIncome = totalIncome + transaction.amount;
    } else if (transaction.type == "expense") {
      totalExpense = totalExpense + transaction.amount;
    }
  }
  res.render("report", { totalExpense, totalIncome });
});

app.post("/register", async (req, res) => {
  let name = req.body.Name;
  let email = req.body.Email;
  let password = req.body.password;
  let balance = parseInt(req.body.initialBalance);
  let newUser = new User({
    name,
    email,
    password: sha256(password),
    balance,
  });
  await newUser.save();
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  let loginEmail = req.body.userEmail;
  let loginPassword = sha256(req.body.userPassword);

  const user = await User.findOne({
    email: loginEmail,
    password: loginPassword,
  });

  if (user == null) {
    res.redirect("/login");
  } else {
    var token = jwt.sign(
      {
        email: user.email,
      },
      secret
    );
    res.cookie("sessionToken", token);
    res.redirect("/");
  }
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
