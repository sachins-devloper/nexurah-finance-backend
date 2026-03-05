const mongoose = require('mongoose');
const { Customer, Loan, Payment, User } = require('./db');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

const tamilNames = [
  "K. Arulmurugan", "S. Balaji", "M. Chandrasekhar", "R. Devaraj", "P. Elangovan",
  "A. Ganesan", "K. Harikrishnan", "T. Iniyavan", "S. Jagadeesan", "V. Kathirvel",
  "R. Loganathan", "M. Manikandan", "J. Naveenkumar", "S. Palanisamy", "G. Raghuraman",
  "K. Selvakumar", "M. Tamilselvan", "R. Udhayakumar", "S. Velmurugan", "J. Venkatesh"
];

const tamilCities = [
  "Chennai", "Madurai", "Coimbatore", "Trichy", "Salem", 
  "Tiruppur", "Erode", "Vellore", "Thoothukudi", "Tirunelveli"
];

const districts = [
  "Anna Nagar", "T. Nagar", "KK Nagar", "Gandhi Nagar", "KPN Colony", 
  "Thillai Nagar", "Meyyanur", "Katpadi", "Millerpuram", "Palayamkottai"
];

const userId = "69a96499ca10aa5b15aa6b18"; // From user's screenshot/data

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB for seeding...");

    // Optional: Clear existing demo data
    // await Customer.deleteMany({ notes: "Demo Data" });
    // await Loan.deleteMany({ notes: "Demo Loan" });
    // await Payment.deleteMany({ notes: "Demo Payment" });

    for (let i = 0; i < 20; i++) {
      const city = tamilCities[i % tamilCities.length];
      const district = districts[i % districts.length];
      
      const customer = await Customer.create({
        name: tamilNames[i],
        phone: `984${Math.floor(1000000 + Math.random() * 9000000)}`.substring(0, 10),
        address: `${Math.floor(Math.random() * 100) + 1}, ${district}, ${city}, Tamil Nadu`,
        idProof: `6371${Math.floor(10000000 + Math.random() * 90000000)}`,
        notes: "Demo Data",
        userId: userId,
        createdAt: new Date().toISOString().split('T')[0]
      });

      // Create a loan for each customer
      const loanAmount = Math.floor(10000 + Math.random() * 90000);
      const loan = await Loan.create({
        customerId: customer._id,
        amount: loanAmount,
        interestRate: 2, // 2% per month common in local finance
        startDate: "2026-01-01",
        notes: "Demo Loan",
        userId: userId,
        status: 'active'
      });

      // Create 2-3 payments for each loan
      const numPayments = 2 + Math.floor(Math.random() * 2);
      for (let j = 0; j < numPayments; j++) {
        const paymentAmount = Math.floor(loanAmount / 10);
        await Payment.create({
          loanId: loan._id,
          customerId: customer._id,
          date: `2026-02-0${j + 1}`,
          amount: paymentAmount,
          userId: userId,
          notes: "Demo Payment"
        });
      }
    }

    console.log("Seeding completed: 20 customers, loans, and multiple payments added.");
    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
}

seed();
