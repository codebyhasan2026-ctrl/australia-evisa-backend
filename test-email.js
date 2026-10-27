require("dotenv").config();
const { testEmailConnection } = require("./utils/emailService");

const targetEmail = process.argv[2] || process.env.EMAIL_USER;

if (!targetEmail) {
  console.log("Usage: node test-email.js <target-email@example.com>");
  console.log("Or make sure EMAIL_USER is configured in .env");
  process.exit(1);
}

console.log("--------------------------------------------------");
console.log("Testing Australia Work E-Visa Email Configuration...");
console.log(`Sender: ${process.env.EMAIL_USER || "Not configured"}`);
console.log(`Target Recipient: ${targetEmail}`);
console.log("--------------------------------------------------");

testEmailConnection(targetEmail)
  .then((res) => {
    if (res.success) {
      console.log(" SUCCESS! Email sent successfully.");
      console.log("Details:", res);
    } else {
      console.error(" FAILED to send email.");
      console.error("Reason:", res.message || res.error);
      console.error("\nPlease check that EMAIL_USER and EMAIL_PASS (16-character App Password) are correctly set in .env.");
    }
    process.exit(res.success ? 0 : 1);
  })
  .catch((err) => {
    console.error(" Unexpected error:", err);
    process.exit(1);
  });
