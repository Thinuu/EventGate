const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  // Basic Information
  name: { type: String, required: [true, 'Organization name is required'], trim: true },
  registeredBusinessName: { type: String, required: [true, 'Registered business name is required'], trim: true },
  organizationType: { 
    type: String, 
    required: [true, 'Organization type is required'],
    enum: [
      'Sole Proprietorship', 
      'Partnership', 
      'Incorporated Company', 
      'State Company',
      'NGO', 
      'Cooperative Society', 
      'Government Department',
      'Association'
    ]
  },
  isProfitable: { type: Boolean, required: true }, // Logic: [Sole Proprietorship, Partnership, Incorporated Company, State Company] = true
  organizationCode: { type: String, trim: true },
  establishmentDate: { type: Date },

  // Conditional Fields (Profitable only)
  brNumber: { type: String, trim: true },
  tinNumber: { type: String, trim: true },
  vatNumber: { type: String, trim: true },

  // Contact Information
  primaryContactPerson: { type: String, required: [true, 'Primary contact person is required'], trim: true },
  designation: { type: String, required: [true, 'Designation is required'], trim: true },
  officialEmail: { 
    type: String, 
    required: [true, 'Official email is required'], 
    trim: true, 
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  contactNumber: { type: String, required: [true, 'Contact number is required'], trim: true },
  websiteUrl: { type: String, trim: true },

  // Address Information
  registeredAddress: { type: String, required: [true, 'Registered address is required'], trim: true },
  operationalAddress: { type: String, trim: true },
  city: { type: String, trim: true },
  district: { type: String, trim: true },
  province: { type: String, trim: true },
  postalCode: { type: String, trim: true },
  country: { type: String, default: 'Sri Lanka', trim: true },

  // Legal & Compliance Uploads
  brCertificate: { type: String },
  vatCertificate: { type: String },
  licensingDetails: { type: String },
  authorizedSignatoryInfo: { type: String },

  // Financial Information
  bankDetails: { type: String, required: [true, 'Bank details are required'], trim: true },
  billingAddress: { type: String, trim: true },
  paymentContact: { type: String, required: [true, 'Payment contact is required'], trim: true },
  preferredCurrency: { type: String, default: 'LKR' },
  invoiceEmail: { 
    type: String, 
    required: [true, 'Invoice email is required'], 
    trim: true, 
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },

  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = mongoose.model('Company', companySchema);
