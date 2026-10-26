const mongoose = require("mongoose");

const visaApplicationSchema = new mongoose.Schema(
  {
    applicationId: { type: String, required: true, unique: true, uppercase: true, trim: true },
    formNumber: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Approved", "Pending", "Rejected"], default: "Approved" },

    surname: { type: String, required: true, uppercase: true, trim: true },
    givenName: { type: String, required: true, uppercase: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    nationalId: { type: String, required: true, trim: true },
    sex: { type: String, required: true, uppercase: true, default: "MALE" },
    dob: { type: String, required: true, trim: true },
    placeOfBirth: { type: String, required: true, uppercase: true, trim: true },
    currentNationality: { type: String, required: true, uppercase: true, trim: true },
    identificationMarks: { type: String, default: "None" },

    companyName: { type: String, required: true, uppercase: true, trim: true },
    dutyDuration: { type: String, required: true, uppercase: true, trim: true },
    jobTitle: { type: String, required: true, uppercase: true, trim: true },
    salary: { type: String, required: true, uppercase: true, trim: true },
    photo: { type: String, default: "" },

    passportNumber: { type: String, required: true, uppercase: true, trim: true, index: true },
    issuedCountry: { type: String, required: true, uppercase: true, trim: true },
    passportIssuedDate: { type: String, required: true, trim: true },
    passportExpireDate: { type: String, required: true, trim: true },

    documents: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

visaApplicationSchema.index({ passportNumber: 1, currentNationality: 1, dob: 1 });

module.exports = mongoose.model("VisaApplication", visaApplicationSchema);
