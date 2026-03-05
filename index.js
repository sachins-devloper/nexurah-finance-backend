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
  Setting 
} = require('./db');
const asyncHandler = require('express-async-handler');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

(async () => {
  await initializeDatabase();

  // Root route for health check / status
  app.get('/', (req, res) => {
    res.send('Nexurah Finance Backend is running...');
  });

  // Seed default admin if no users exist
  const userCount = await User.countDocuments();
  if (userCount === 0) {
    const defaultAdmin = new User({
      name: "System Admin",
      email: "admin@nexurah.com",
      password: "admin", // In a real app, use hashing!
      role: "admin",
      status: "active"
    });
    await defaultAdmin.save();
    console.log("Default admin account created: admin@nexurah.com / admin");
  }

  // Ensure all users have a status (migration for existing users)
  await User.updateMany({ status: { $exists: false } }, { $set: { status: 'active' } });
  
  // Assign existing records to the first admin if no userId exists (migration)
  const defaultUser = await User.findOne({ role: 'admin' });
  if (defaultUser) {
    const counts = await Promise.all([
      Customer.updateMany({ userId: { $exists: false } }, { $set: { userId: defaultUser._id } }),
      Loan.updateMany({ userId: { $exists: false } }, { $set: { userId: defaultUser._id } }),
      Payment.updateMany({ userId: { $exists: false } }, { $set: { userId: defaultUser._id } }),
      Notification.updateMany({ userId: { $exists: false } }, { $set: { userId: defaultUser._id } }),
    ]);
    console.log(`Migration complete. Records assigned to admin (${defaultUser.name}).`);
  }
  console.log("Database synchronization complete.");

  // Helper to build filter based on userId query param
  const { Types } = require('mongoose');
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

  // --- Notifications ---
  app.get('/api/notifications', asyncHandler(async (req, res) => {
    const filter = await getFilter(req);
    const notifications = await Notification.find(filter || {}).sort({ date: -1 });
    res.json(notifications.map(n => ({ ...n.toObject(), id: n._id })));
  }));

  app.patch('/api/notifications/:id/read', asyncHandler(async (req, res) => {
    // Note: patch doesn't strictly filter by userId here as it doesn't leak data, but we could add it
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

  // --- Users & Auth ---
  app.post('/api/login', asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (user) {
      if (user.status === 'inactive') {
        return res.status(403).json({ message: "Your account is inactive. Please contact admin." });
      }
      res.json({ id: user._id, name: user.name, email: user.email, role: user.role });
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

  app.listen(PORT, () => {
    console.log(`Finance Backend (MongoDB) running on port ${PORT}`);
  });
})();
