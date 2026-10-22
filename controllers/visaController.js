const VisaApplication = require("../models/visaApplication");
const { uploadToCloudinary } = require("../middleware/upload");

const normalizeDate = (dateStr) => {
  if (!dateStr) return "";
  const parts = dateStr.trim().split(/[-/]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, "0")}-${parts[2].padStart(2, "0")}`;
    }
  }
  return dateStr.trim();
};

const formatDateForDisplay = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.toUpperCase();
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const day = String(d.getDate()).padStart(2, "0");
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

exports.verifyVisaStatus = async (req, res) => {
  try {
    const { passportNumber, nationality, dob } = req.body;

    if (!passportNumber || !nationality || !dob) {
      return res.status(400).json({
        success: false,
        message: "Passport number, nationality and date of birth are required."
      });
    }

    const cleanPassport = passportNumber.trim().toUpperCase();
    const cleanNationality = nationality.trim();
    const cleanDob = dob.trim();

    const visa = await VisaApplication.findOne({
      passportNumber: { $regex: new RegExp(`^${cleanPassport}$`, "i") },
      currentNationality: { $regex: new RegExp(`^${cleanNationality}$`, "i") }
    });

    if (!visa) {
      return res.status(404).json({
        success: false,
        message: "No visa application record found. Please verify your passport number, nationality, and date of birth."
      });
    }

    const inputNormalized = normalizeDate(cleanDob);
    const storedNormalized = normalizeDate(visa.dob);
    const inputDisplay = formatDateForDisplay(cleanDob);
    const storedDisplay = formatDateForDisplay(visa.dob);

    const isDobMatch =
      cleanDob.toLowerCase() === visa.dob.toLowerCase() ||
      inputNormalized === storedNormalized ||
      inputDisplay === storedDisplay ||
      visa.dob.includes(cleanDob) ||
      cleanDob.includes(visa.dob);

    if (!isDobMatch) {
      return res.status(404).json({
        success: false,
        message: "No visa application record found. Date of birth does not match passport details."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Visa record found successfully",
      data: {
        ...visa.toObject(),
        displayDob: formatDateForDisplay(visa.dob),
        displayIssuedDate: formatDateForDisplay(visa.passportIssuedDate),
        displayExpireDate: formatDateForDisplay(visa.passportExpireDate)
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error while verifying visa status",
      error: error.message
    });
  }
};

exports.createVisaApplication = async (req, res) => {
  try {
    let photoUrl = req.body.photo || "";

    if (req.file) {
      photoUrl = await uploadToCloudinary(req.file.buffer);
    }

    const applicationData = {
      ...req.body,
      photo: photoUrl
    };

    if (!applicationData.applicationId) {
      applicationData.applicationId = String(Math.floor(1000 + Math.random() * 9000));
    }
    if (!applicationData.formNumber) {
      applicationData.formNumber = String(Math.floor(1000 + Math.random() * 9000));
    }

    const newVisa = new VisaApplication(applicationData);
    await newVisa.save();

    return res.status(201).json({
      success: true,
      message: "Visa application created successfully",
      data: newVisa
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to create visa application"
    });
  }
};

exports.getAllVisaApplications = async (req, res) => {
  try {
    const visas = await VisaApplication.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: visas.length,
      data: visas
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch visa applications"
    });
  }
};

exports.getVisaApplicationById = async (req, res) => {
  try {
    const visa = await VisaApplication.findById(req.params.id);
    if (!visa) {
      return res.status(404).json({
        success: false,
        message: "Visa application not found"
      });
    }
    return res.status(200).json({
      success: true,
      data: visa
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch visa application"
    });
  }
};

exports.updateVisaApplication = async (req, res) => {
  try {
    let updateData = { ...req.body };

    if (req.file) {
      updateData.photo = await uploadToCloudinary(req.file.buffer);
    }

    const updatedVisa = await VisaApplication.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedVisa) {
      return res.status(404).json({
        success: false,
        message: "Visa application not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Visa application updated successfully",
      data: updatedVisa
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to update visa application"
    });
  }
};

exports.deleteVisaApplication = async (req, res) => {
  try {
    const deletedVisa = await VisaApplication.findByIdAndDelete(req.params.id);
    if (!deletedVisa) {
      return res.status(404).json({
        success: false,
        message: "Visa application not found"
      });
    }
    return res.status(200).json({
      success: true,
      message: "Visa application deleted successfully"
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete visa application"
    });
  }
};
