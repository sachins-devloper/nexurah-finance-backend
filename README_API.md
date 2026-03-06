# Nexurah Finance API Documentation

Base URL: `http://localhost:4000`

## Authentication

### Login
`POST /api/login`

**Request Payload:**
```json
{
  "email": "admin@nexurah.com",
  "password": "admin"
}
```

**Successful Response (200 OK):**
```json
{
  "id": "69a9585fd3af3f357d16989b",
  "name": "System Admin",
  "email": "admin@nexurah.com",
  "role": "admin"
}
```

---

## Data Isolation Note
Most endpoints require a `userId` query parameter for data isolation. For employees, this filter restricts access to their own data. For admins, providing their `userId` grants access to all records in the system.

---

## Customers

### Get All Customers
`GET /api/customers?userId={userId}`

**Response:** Array of Customer objects.

### Create Customer
`POST /api/customers`

**Request Payload:**
```json
{
  "name": "Vijay",
  "phone": "9912345123",
  "address": "123 Main St",
  "idProof": "728812341234",
  "notes": "Good borrower",
  "userId": "69a9585fd3af3f357d16989b"
}
```

### Update Customer
`PUT /api/customers/:id?userId={userId}`

### Delete Customer
`DELETE /api/customers/:id?userId={userId}`
**Note:** Performing this action will trigger a **cascading delete**, automatically removing all loans and payments associated with this customer.

---

## Loans

### Get All Loans
`GET /api/loans?userId={userId}`

### Create Loan
`POST /api/loans`

**Request Payload:**
```json
{
  "customerId": "69a96099ca10aa5b15aa6b01",
  "amount": 50000,
  "interestRate": 3,
  "startDate": "2026-03-05",
  "notes": "Emergency loan",
  "userId": "69a9585fd3af3f357d16989b",
  "status": "active" 
}
```
**Status Options:** `active`, `closed`, `overdue`

### Close Loan (Settlement)
`POST /api/loans/:id/close?userId={userId}`

Used to finalize a loan with a principal repayment.

**Request Payload:**
```json
{
  "paymentAmount": 51500,
  "paymentDate": "2026-06-10",
  "notes": "Full settlement"
}
```

**Response (200 OK):**
```json
{
  "loan": { "status": "closed", "closedDate": "2026-06-10", ... },
  "payment": { "type": "closure", "amount": 51500, ... }
}
```

### Delete Loan
`DELETE /api/loans/:id?userId={userId}`
**Note:** triggers a **cascading delete**, removing all payment history for this loan.

---

## Payments

### Get All Payments
`GET /api/payments?userId={userId}`

### Create Payment
`POST /api/payments`

**Request Payload:**
```json
{
  "loanId": "69a96178ca10aa5b15aa6b0b",
  "customerId": "69a96099ca10aa5b15aa6b01",
  "amount": 1500,
  "date": "2026-04-05",
  "notes": "First installment",
  "userId": "69a9585fd3af3f357d16989b",
  "type": "interest"
}
```
**Type Options:** `interest` (default), `closure`

### Update Payment
`PUT /api/payments/:id?userId={userId}`

### Delete Payment
`DELETE /api/payments/:id?userId={userId}`


---

## Notifications

### Get Notifications
`GET /api/notifications?userId={userId}`

### Mark as Read
`PATCH /api/notifications/:id/read`

---

## Settings

### Get Settings
`GET /api/settings`

### Update Settings
`POST /api/settings`

**Request Payload:**
```json
{
  "businessName": "Nexurah",
  "currency": "INR",
  "interestModel": "monthly"
}
```

---

## User Management (Admin Only)

### Get Users
`GET /api/users`

### Create User
`POST /api/users`

### Change Password
`POST /api/users/:id/change-password`
**Payload:** `{ "oldPassword": "...", "newPassword": "..." }`
