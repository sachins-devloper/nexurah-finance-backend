require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { 
  initializeDatabase, 
  Customer, 
  User,
  Loan, 
  Payment, 
  Notification, 
  Setting,
  OTP
} = require('./db');
const asyncHandler = require('express-async-handler');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const { Types } = require('mongoose');


// Middleware to ensure database connection (checking isConnected is fast)
const dbMiddleware = async (req, res, next) => {
  try {
    await initializeDatabase();
    next();
  } catch (err) {
    console.error("Database connection middleware error:", err);
    res.status(500).send("Database connection failed. Please check MONGODB_URI.");
  }
};

app.use(dbMiddleware);

// Helper to build filter based on userId query param
const getFilter = async (req) => {
  const { userId } = req.query;
  if (!userId) {
    console.warn(`[WARN] No userId provided: ${req.method} ${req.url}`);
    return null; // null = reject all (don't return {} which means "all records")
  }
  if (!Types.ObjectId.isValid(userId)) {
    console.warn(`[WARN] Invalid userId format: ${userId}`);
    return null;
  }

  // New: Check user role to allow admins full access
  const requestingUser = await User.findById(userId);
  if (!requestingUser) {
    console.warn(`[WARN] User not found: ${userId}`);
    return null;
  }

  if (requestingUser.role === 'admin') {
    return {}; // Admins see everything
  }

  return { userId };
};

// --- Routes ---

// Root route for health check / status
app.get('/', (req, res) => {
  res.send('Nexurah Finance Backend is running...');
});

// --- Customers ---
app.get('/api/customers', asyncHandler(async (req, res) => {
  const filter = await getFilter(req);
  if (!filter) return res.json([]);
  console.log(`[DATA] Fetching customers for userId:`, filter.userId);
  const customers = await Customer.find(filter).sort({ createdAt: -1 });
  res.json(customers.map(c => ({ ...c.toObject(), id: c._id })));
}));

app.post('/api/customers', asyncHandler(async (req, res) => {
  console.log(`[DATA] Creating customer for user: ${req.body.userId}`);
  const customer = new Customer(req.body);
  await customer.save();
  res.status(201).json({ ...customer.toObject(), id: customer._id });
}));

app.get('/api/customers/:id', asyncHandler(async (req, res) => {
  const userFilter = await getFilter(req);
  if (!userFilter) return res.status(403).json({ message: "Unauthorized" });
  const filter = { ...userFilter, _id: req.params.id };
  const customer = await Customer.findOne(filter);
  if (!customer) return res.status(404).json({ message: "Customer not found or unauthorized" });
  res.json({ ...customer.toObject(), id: customer._id });
}));

app.put('/api/customers/:id', asyncHandler(async (req, res) => {
  const userFilter = await getFilter(req);
  if (!userFilter) return res.status(403).json({ message: "Unauthorized" });
  const filter = { ...userFilter, _id: req.params.id };
  const customer = await Customer.findOneAndUpdate(filter, req.body, { new: true });
  if (!customer) return res.status(404).json({ message: "Customer not found or unauthorized" });
  res.json({ ...customer.toObject(), id: customer._id });
}));

app.delete('/api/customers/:id', asyncHandler(async (req, res) => {
  const userFilter = await getFilter(req);
  if (!userFilter) return res.status(403).json({ message: "Unauthorized" });
  const filter = { ...userFilter, _id: req.params.id };
  const result = await Customer.findOneAndDelete(filter);
  if (!result) return res.status(404).json({ message: "Customer not found or unauthorized" });

  // Cascading delete: Remove loans and payments associated with this customer
  const customerId = req.params.id;
  await Loan.deleteMany({ customerId });
  await Payment.deleteMany({ customerId });

  res.status(204).end();
}));

// --- Loans ---
app.get('/api/loans', asyncHandler(async (req, res) => {
  const filter = await getFilter(req);
  if (!filter) return res.json([]);
  const loans = await Loan.find(filter);
  res.json(loans.map(l => ({ ...l.toObject(), id: l._id })));
}));

app.post('/api/loans', asyncHandler(async (req, res) => {
  console.log(`[DATA] Creating loan for user: ${req.body.userId}`);
  const loan = new Loan(req.body);
  await loan.save();
  res.status(201).json({ ...loan.toObject(), id: loan._id });
}));

app.get('/api/loans/:id', asyncHandler(async (req, res) => {
  const userFilter = await getFilter(req);
  if (!userFilter) return res.status(403).json({ message: "Unauthorized" });
  const filter = { ...userFilter, _id: req.params.id };
  const loan = await Loan.findOne(filter);
  if (!loan) return res.status(404).json({ message: "Loan not found or unauthorized" });
  res.json({ ...loan.toObject(), id: loan._id });
}));

app.delete('/api/loans/:id', asyncHandler(async (req, res) => {
  const userFilter = await getFilter(req);
  if (!userFilter) return res.status(403).json({ message: "Unauthorized" });
  const filter = { ...userFilter, _id: req.params.id };
  const result = await Loan.findOneAndDelete(filter);
  if (!result) return res.status(404).json({ message: "Loan not found or unauthorized" });

  // Cascading delete: Remove payments associated with this loan
  const loanId = req.params.id;
  await Payment.deleteMany({ loanId });

  res.status(204).end();
}));

app.post('/api/loans/:id/close', asyncHandler(async (req, res) => {
  const userFilter = await getFilter(req);
  if (!userFilter) return res.status(403).json({ message: "Unauthorized" });

  const { paymentAmount, paymentDate, notes } = req.body;
  const loanId = req.params.id;

  const loan = await Loan.findOne({ ...userFilter, _id: loanId });
  if (!loan) return res.status(404).json({ message: "Loan not found" });

  // 1. Record final payment
  const payment = new Payment({
    loanId,
    customerId: loan.customerId,
    date: paymentDate,
    amount: paymentAmount,
    userId: loan.userId,
    type: 'closure',
    notes: notes || "Loan Closure Payment"
  });
  await payment.save();

  // 2. Update loan status
  loan.status = 'closed';
  loan.closedDate = paymentDate;
  await loan.save();

  res.json({
    loan: { ...loan.toObject(), id: loan._id },
    payment: { ...payment.toObject(), id: payment._id }
  });
}));

// --- Payments ---
app.get('/api/payments', asyncHandler(async (req, res) => {
  const filter = await getFilter(req);
  if (!filter) return res.json([]);
  const payments = await Payment.find(filter).sort({ date: -1 });
  res.json(payments.map(p => ({ ...p.toObject(), id: p._id })));
}));

app.post('/api/payments', asyncHandler(async (req, res) => {
  console.log(`[DATA] Creating payment for user: ${req.body.userId}`);
  const payment = new Payment(req.body);
  await payment.save();
  res.status(201).json({ ...payment.toObject(), id: payment._id });
}));

app.put('/api/payments/:id', asyncHandler(async (req, res) => {
  const userFilter = await getFilter(req);
  if (!userFilter) return res.status(403).json({ message: "Unauthorized" });
  const filter = { ...userFilter, _id: req.params.id };
  const payment = await Payment.findOneAndUpdate(filter, req.body, { new: true });
  if (!payment) return res.status(404).json({ message: "Payment not found or unauthorized" });
  res.json({ ...payment.toObject(), id: payment._id });
}));


app.delete('/api/payments/:id', asyncHandler(async (req, res) => {
  const userFilter = await getFilter(req);
  if (!userFilter) return res.status(403).json({ message: "Unauthorized" });
  const filter = { ...userFilter, _id: req.params.id };
  const result = await Payment.findOneAndDelete(filter);
  if (!result) return res.status(404).json({ message: "Payment not found or unauthorized" });
  res.status(204).end();
}));

// --- Notifications ---
app.get('/api/notifications', asyncHandler(async (req, res) => {
  const filter = await getFilter(req);
  const notifications = await Notification.find(filter || {}).sort({ date: -1 });
  res.json(notifications.map(n => ({ ...n.toObject(), id: n._id })));
}));

app.patch('/api/notifications/:id/read', asyncHandler(async (req, res) => {
  const notification = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
  res.json({ ...notification.toObject(), id: notification._id });
}));

// --- Settings ---
app.get('/api/settings', asyncHandler(async (req, res) => {
  const settingsRows = await Setting.find();
  const settings = {};
  settingsRows.forEach(row => {
    settings[row.key] = row.value;
  });
  res.json(settings);
}));

app.post('/api/settings', asyncHandler(async (req, res) => {
  const updates = req.body;
  for (const [key, value] of Object.entries(updates)) {
    await Setting.findOneAndUpdate(
      { key },
      { value },
      { upsert: true, new: true }
    );
  }
  res.json(updates);
}));

// --- Auth & Sign-up ---

// Send OTP
app.post('/api/auth/send-otp', asyncHandler(async (req, res) => {
  const { email } = req.body;
  console.log(`[AUTH] Sending OTP to: ${email}`);
  if (!email) return res.status(400).json({ message: "Email is required" });

  try {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[AUTH] OTP generated for ${email}: ${otpCode} (Use this if email fails)`);
    await OTP.findOneAndUpdate(
      { email },
      { otp: otpCode, createdAt: new Date() },
      { upsert: true, new: true }
    );

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: 'Your Nexurah OTP for Sign-up',
      text: `Your OTP for Nexurah Finance sign-up is: ${otpCode}. It will expire in 10 minutes.`
    });
    
    console.log(`[AUTH] OTP sent successfully to: ${email}`);
    res.json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error("[AUTH] Mail Error:", error);
    res.status(500).json({ message: `Email failed: ${error.message}` });
  }
}));

// Verify OTP and Sign Up
app.post('/api/auth/signup', asyncHandler(async (req, res) => {
  const { name, email, password, otp, companyName } = req.body;

  // 1. Verify OTP
  const otpRecord = await OTP.findOne({ email, otp });
  if (!otpRecord) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  // 2. Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({ message: "User already exists with this email" });
  }

  // 3. Create User
  const user = new User({
    name,
    email,
    password, // Consider hashing this if needed, but the project seems to use plain text for now
    companyName,
    role: 'employee',
    status: 'active'
  });
  await user.save();

  // 4. Delete used OTP
  await OTP.deleteOne({ _id: otpRecord._id });

  res.status(201).json({ 
    message: "User registered successfully",
    user: { id: user._id, name: user.name, email: user.email, role: user.role, companyName: user.companyName }
  });
}));

// Reset Password - Send OTP
app.post('/api/auth/forgot-password', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "No account found with this email" });

  try {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(`[AUTH] Reset OTP generated for ${email}: ${otpCode}`);
    
    await OTP.findOneAndUpdate(
      { email },
      { otp: otpCode, createdAt: new Date() },
      { upsert: true, new: true }
    );

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: email,
      subject: 'Reset Your Nexurah Password',
      text: `Your OTP for resetting your Nexurah Finance password is: ${otpCode}. If you didn't request this, please ignore this email.`
    });

    res.json({ message: "Reset OTP sent successfully" });
  } catch (error) {
    console.error("[AUTH] Reset Mail Error:", error);
    res.status(500).json({ message: `Failed to send reset email: ${error.message}` });
  }
}));

// Reset Password - Finalize
app.post('/api/auth/reset-password', asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const otpRecord = await OTP.findOne({ email, otp });
  if (!otpRecord) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  user.password = newPassword;
  await user.save();

  await OTP.deleteOne({ _id: otpRecord._id });

  res.json({ message: "Password reset successful" });
}));

// --- Users & Auth ---
app.post('/api/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, password });
  if (user) {
    if (user.status === 'inactive') {
      return res.status(403).json({ message: "Your account is inactive. Please contact admin." });
    }
    res.json({ id: user._id, name: user.name, email: user.email, role: user.role, companyName: user.companyName });
  } else {
    res.status(401).json({ message: "Invalid credentials" });
  }
}));

app.get('/api/users', asyncHandler(async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 });
  res.json(users.map(u => ({ ...u.toObject(), id: u._id })));
}));

app.post('/api/users', asyncHandler(async (req, res) => {
  const user = new User(req.body);
  await user.save();
  res.status(201).json({ ...user.toObject(), id: user._id });
}));

app.put('/api/users/:id', asyncHandler(async (req, res) => {
  const updates = { ...req.body };
  if (!updates.password || updates.password.trim() === '') {
    delete updates.password;
  }
  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
  res.json({ ...user.toObject(), id: user._id });
}));

app.delete('/api/users/:id', asyncHandler(async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.status(204).end();
}));

app.post('/api/users/:id/change-password', asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.params.id);
  if (!user || user.password !== oldPassword) {
    return res.status(401).json({ message: "Invalid old password" });
  }
  user.password = newPassword;
  await user.save();
  res.json({ message: "Password updated successfully" });
}));

// Global error handler for JSON responses
app.use((err, req, res, next) => {
  console.error("Backend Error:", err.message);
  res.status(err.status || 500).json({ 
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Export for Vercel
module.exports = app;

// Listen only if running directly
if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  initializeDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`Finance Backend (MongoDB) running on port ${PORT}`);
    });
  });
}

