// utils/email.js
require('dotenv').config();              // pastikan .env terbaca di sini juga
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendResetEmail(to, token) {
  const link = `http://localhost:${process.env.PORT || 3000}/reset-password/${token}`;
  return transporter.sendMail({
    from: `"ScentOS" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Reset Password – ScentOS',
    html: `
      <p>Klik link berikut untuk mengatur ulang password (15 m):</p>
      <a href="${link}">${link}</a>
    `
  });
}

module.exports = sendResetEmail;   // ⬅️ HANYA baris ini sebagai export
