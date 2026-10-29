const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Normalizes input roles to match the EventGate standard hierarchy.
 */
const normalizeRoleForStorage = (role) => {
  const normalized = String(role || '').trim().toUpperCase();

  if (normalized === 'MAINADMIN' || normalized === 'ADMIN' || normalized === 'MAIN_ADMIN') return 'MainAdmin';
  if (normalized === 'MAINORGANISER' || normalized === 'ORGANISER' || normalized === 'MAIN_ORGANISER') return 'MainOrganiser';
  if (normalized === 'SUBORGANISER' || normalized === 'SUB_ORGANISER') return 'SubOrganiser';
  if (normalized === 'STAFF') return 'Staff';
  if (normalized === 'VOLUNTEER') return 'Volunteer';
  if (normalized === 'AUDITOR') return 'Auditor';
  if (normalized === 'SPONSOR') return 'Sponsor';
  if (normalized === 'ATTENDEE' || normalized === 'USER' || normalized === 'BUYER') return 'Attendee';
  if (normalized === 'NONE') return 'None';

  return String(role || '').trim();
};

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false,
  },
  role: {
    type: String,
    enum: ['MainAdmin', 'MainOrganiser', 'SubOrganiser', 'Staff', 'Volunteer', 'Auditor', 'Sponsor', 'Attendee', 'None'],
    required: true,
    set: normalizeRoleForStorage,
  },
  phone: { 
    type: String, 
    trim: true 
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active',
  },

  // Scoped Event Assignments
  assignedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  assignedGates: [{ type: String }],
  assignedZones: [{ type: String }],

  // Granular Permissions (JSON Object as requested)
  permissions: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // Explicit permission flags for better type safety and validation
  canCollectCash: {
    type: Boolean,
    default: false,
  },
  canConfirmCashPayments: {
    type: Boolean,
    default: false,
  },
  canApproveBankTransfer: {
    type: Boolean,
    default: false,
  },
  canViewPayments: {
    type: Boolean,
    default: false,
  },
  canProcessRefunds: {
    type: Boolean,
    default: false,
  },
  canManagePaymentMethods: {
    type: Boolean,
    default: false,
  },
  canViewPaymentHistory: {
    type: Boolean,
    default: false,
  },
  canHandlePaymentDisputes: {
    type: Boolean,
    default: false,
  },
  canGeneratePaymentReports: {
    type: Boolean,
    default: false,
  },
  canAddAttendees: {
    type: Boolean,
    default: false,
  },
  canPhotoVerification: {
    type: Boolean,
    default: false,
  },
  canSendInvitations: {
    type: Boolean,
    default: false,
  },
  canExcelBulkImports: {
    type: Boolean,
    default: false,
  },
  canGateScanAccess: {
    type: Boolean,
    default: false,
  },
  canViewEvents: {
    type: Boolean,
    default: false,
  },
  canEditEvents: {
    type: Boolean,
    default: false,
  },
  canViewAttendees: {
    type: Boolean,
    default: false,
  },
  canEditAttendees: {
    type: Boolean,
    default: false,
  },
  canViewTickets: {
    type: Boolean,
    default: false,
  },
  canEditTickets: {
    type: Boolean,
    default: false,
  },
  canScanTickets: {
    type: Boolean,
    default: false,
  },
  canViewZones: {
    type: Boolean,
    default: false,
  },
  canManageZones: {
    type: Boolean,
    default: false,
  },
  canViewReports: {
    type: Boolean,
    default: false,
  },
  canExportReports: {
    type: Boolean,
    default: false,
  },
  canViewRevenue: {
    type: Boolean,
    default: false,
  },
  canSendNotifications: {
    type: Boolean,
    default: false,
  },
  responsibilities: {
    zoneIds: [{ type: String }],
    verificationAccess: { type: Boolean, default: false },
    entryAccess: { type: Boolean, default: false },
  },

  profilePhoto: { type: String },
  profilePhotoS3Key: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  lastLogin: { type: Date },

  // Password reset fields
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },

  // Email verification and security fields
  isVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, select: false },
  emailVerificationExpires: { type: Date, select: false },
  isTempPassword: { type: Boolean, default: false },
  // Security & MFA
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: { type: String, select: false },
  mfaBackupCodes: [{ type: String, select: false }],
  lastMfaVerification: { type: Date },
  passwordHistory: [{ type: String, select: false }],
  
  refreshToken: { type: String, select: false },
}, {
  timestamps: true,
});

// Hash password before save & track password history
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // Save current password hash to history if this is not a new user
  if (!this.isNew) {
    try {
      const oldUser = await mongoose.model('User').findById(this._id).select('+password +passwordHistory');
      if (oldUser && oldUser.password) {
        const history = oldUser.passwordHistory || [];
        history.unshift(oldUser.password);
        this.passwordHistory = history.slice(0, 3);
      }
    } catch (err) {
      console.error('Error saving password history:', err);
    }
  }

  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if password has been reused
userSchema.methods.isPasswordReused = async function (candidatePassword) {
  // Compare against current password hash
  if (this.password && await bcrypt.compare(candidatePassword, this.password)) {
    return true;
  }
  // Compare against password history hashes
  if (this.passwordHistory && this.passwordHistory.length > 0) {
    const bcrypt = require('bcryptjs');
    for (const oldHash of this.passwordHistory) {
      if (await bcrypt.compare(candidatePassword, oldHash)) {
        return true;
      }
    }
  }
  return false;
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  for (const field of ['refreshToken', 'mfaSecret', 'mfaBackupCodes', 'passwordHistory']) delete obj[field];
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
