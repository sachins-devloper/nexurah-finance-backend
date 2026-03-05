const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

let isConnected = false;

async function initializeDatabase() {
  if (isConnected) {
    console.log("Using existing MongoDB connection");
    return;
  }

  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in environment variables");
  }

  try {
    const db = await mongoose.connect(MONGODB_URI);
    isConnected = db.connections[0].readyState === 1;
    console.log("Connected to MongoDB Atlas");
  } catch (err) {
    console.error("MongoDB connection error:", err);
    throw err; // Rethrow instead of process.exit(1)
  }
}

// Schemas
const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: String,
  address: String,
  idProof: String,
  notes: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: String, default: () => new Date().toISOString().split('T')[0] }
});
customerSchema.index({ userId: 1 });
customerSchema.index({ createdAt: -1 });

const loanSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  amount: { type: Number, required: true },
  interestRate: { type: Number, required: true },
  startDate: { type: String, required: true },
  notes: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, enum: ['active', 'closed'], default: 'active' }
});
loanSchema.index({ userId: 1 });
loanSchema.index({ customerId: 1 });

const paymentSchema = new mongoose.Schema({
  loanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Loan', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  date: { type: String, required: true },
  amount: { type: Number, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  notes: String
});
paymentSchema.index({ userId: 1 });
paymentSchema.index({ loanId: 1 });
paymentSchema.index({ customerId: 1 });
paymentSchema.index({ date: -1 });

const notificationSchema = new mongoose.Schema({
  type: { type: String, required: true },
  message: { type: String, required: true },
  customerName: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: String, required: true },
  read: { type: Boolean, default: false }
});
notificationSchema.index({ userId: 1 });
notificationSchema.index({ date: -1 });

const settingSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true },
  value: mongoose.Schema.Types.Mixed
});

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'employee'], default: 'employee' },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  createdAt: { type: String, default: () => new Date().toISOString().split('T')[0] }
});
userSchema.index({ email: 1 });

const Customer = mongoose.model('Customer', customerSchema);
const User = mongoose.model('User', userSchema);
const Loan = mongoose.model('Loan', loanSchema);
const Payment = mongoose.model('Payment', paymentSchema);
const Notification = mongoose.model('Notification', notificationSchema);
const Setting = mongoose.model('Setting', settingSchema);

module.exports = { 
  initializeDatabase,
  Customer,
  User,
  Loan,
  Payment,
  Notification,
  Setting
};
