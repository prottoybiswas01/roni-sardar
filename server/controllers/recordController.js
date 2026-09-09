import mongoose from 'mongoose';
import Record from '../models/Record.js';

// Helper: Calculate next SL number for a given month, year, and specific user
const getNextSequenceNumber = async (month, year, userId = null) => {
  const query = { month, year, isDeleted: { $ne: true } };
  if (userId) {
    query.createdBy = userId;
  }
  const lastRecord = await Record.findOne(query).select('sl').sort({ sl: -1 }).lean();
  return lastRecord && typeof lastRecord.sl === 'number' ? lastRecord.sl + 1 : 1;
};

// @desc    Get next sequential SL number for a given date / month & year
// @route   GET /api/records/next-sl
// @access  Private
export const getNextSl = async (req, res, next) => {
  try {
    const { month, year, date } = req.query;
    let targetMonth, targetYear;

    if (date) {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        targetMonth = d.getMonth() + 1;
        targetYear = d.getFullYear();
      }
    }

    if (!targetMonth) {
      targetMonth = month ? Number(month) : new Date().getMonth() + 1;
      targetYear = year ? Number(year) : new Date().getFullYear();
    }

    const userId = req.user ? req.user._id : null;
    const nextSl = await getNextSequenceNumber(targetMonth, targetYear, userId);

    res.status(200).json({
      success: true,
      nextSl,
      month: targetMonth,
      year: targetYear,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all active records with filtering, search, pagination, and sorting (Excludes soft-deleted records)
// @route   GET /api/records
// @access  Private
export const getRecords = async (req, res, next) => {
  try {
    const {
      month,
      year,
      search,
      date,
      page = 1,
      limit = 50,
      sortBy = 'sl',
      sortOrder = 'asc',
      userId,
    } = req.query;

    const query = { isDeleted: { $ne: true } };

    // Strict user data isolation:
    // By default, EVERY user (including Super Admin) ONLY sees their own records.
    // Super Administrator / Admin can explicitly inspect a specific staff member's records or all records.
    if (req.user && (req.user.role === 'superadmin' || req.user.role === 'admin') && userId) {
      if (userId === 'all') {
        // Explicitly viewing all combined records
      } else if (userId !== 'me') {
        query.createdBy = userId;
      } else {
        query.createdBy = req.user._id;
      }
    } else {
      // Default: Strictly only own account records
      query.createdBy = req.user ? req.user._id : null;
    }

    if (month && Number(month) >= 1 && Number(month) <= 12) {
      query.month = Number(month);
    }

    if (year && Number(year) > 1900) {
      query.year = Number(year);
    }

    if (date) {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }

    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      query.$or = [
        { patientId: { $regex: searchTerm, $options: 'i' } },
        { patientName: { $regex: searchTerm, $options: 'i' } },
        { remark: { $regex: searchTerm, $options: 'i' } },
        { time: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(2000, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    const order = sortOrder === 'desc' ? -1 : 1;
    sortOptions[sortBy] = order;
    if (sortBy !== 'sl') {
      sortOptions.sl = 1;
    }

    // High performance query with .lean() directly returning raw JSON objects
    const [records, total] = await Promise.all([
      Record.find(query)
        .select('sl patientId patientName date time remark month year createdBy createdAt')
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate('createdBy', 'name email username')
        .lean(),
      Record.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: records,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single record by ID (Active only)
// @route   GET /api/records/:id
// @access  Private
export const getRecordById = async (req, res, next) => {
  try {
    if (!req.params.id || !mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
      });
    }

    const record = await Record.findOne({ _id: req.params.id, isDeleted: { $ne: true } }).populate('createdBy', 'name email username');

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
      });
    }

    // Ownership check: regular users can only fetch their own record
    if (
      req.user &&
      req.user.role !== 'superadmin' &&
      String(record.createdBy?._id || record.createdBy) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this record',
      });
    }

    res.status(200).json({
      success: true,
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new record
// @route   POST /api/records
// @access  Private
export const createRecord = async (req, res, next) => {
  try {
    // Check if user account is paused by Super Admin
    if (req.user && (req.user.status === 'paused' || req.user.status === 'suspended')) {
      return res.status(403).json({
        success: false,
        message: 'আপনার অ্যাকাউন্টটি সুপার অ্যাডমিন কর্তৃক সাময়িকভাবে স্থগিত (Paused) করা হয়েছে। আপনি নতুন ডাটা এন্ট্রি করতে পারবেন না।',
      });
    }

    let { patientId, patientName, date, time, remark, sl } = req.body;

    if (!patientId || !patientName || !date || !time) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: Patient ID, Patient Name, Date, and Time',
      });
    }

    // CRITICAL: Ensure patientId is strictly digits (0-9) preserving leading zeroes
    const stringPatientId = String(patientId).trim();
    if (!stringPatientId || !/^\d+$/.test(stringPatientId)) {
      return res.status(400).json({
        success: false,
        message: 'Patient ID must contain only numbers (0-9). Letters or special characters are not allowed.',
      });
    }

    const recordDate = new Date(date);
    if (isNaN(recordDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format provided',
      });
    }

    const recordMonth = recordDate.getMonth() + 1;
    const recordYear = recordDate.getFullYear();
    const userId = req.user ? req.user._id : null;

    // Auto-compute SL strictly for this user's monthly sequence if not explicitly given
    const recordSl = sl && Number(sl) > 0 ? Number(sl) : await getNextSequenceNumber(recordMonth, recordYear, userId);

    const record = await Record.create({
      sl: recordSl,
      patientId: stringPatientId,
      patientName: patientName.trim(),
      date: recordDate,
      time: time.trim(),
      remark: remark ? remark.trim() : '',
      month: recordMonth,
      year: recordYear,
      createdBy: userId,
      isDeleted: false,
    });

    res.status(201).json({
      success: true,
      message: 'Record created successfully',
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update an existing record
// @route   PUT /api/records/:id
// @access  Private
export const updateRecord = async (req, res, next) => {
  try {
    if (req.user && req.user.role !== 'superadmin' && (req.user.status === 'paused' || req.user.status === 'suspended')) {
      return res.status(403).json({
        success: false,
        message: 'আপনার অ্যাকাউন্টটি স্থগিত (Paused) থাকায় ডাটা পরিবর্তন করা সম্ভব নয়।',
      });
    }

    let record = await Record.findOne({ _id: req.params.id, isDeleted: { $ne: true } });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
      });
    }

    // Ownership check: ONLY the user who created/entered the record can edit it
    if (
      record.createdBy &&
      req.user &&
      String(record.createdBy) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'অনুমতি নেই: শুধুমাত্র যে ইউজার রেকর্ডটি তৈরি করেছেন, তিনিই এটি এডিট করতে পারবেন। (Only the record creator can edit this record)',
      });
    }

    const { patientId, patientName, date, time, remark, sl } = req.body;

    if (patientId !== undefined) {
      const stringPatientId = String(patientId).trim();
      if (!stringPatientId || !/^\d+$/.test(stringPatientId)) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID must contain only numbers (0-9). Letters or special characters are not allowed.',
        });
      }
      record.patientId = stringPatientId;
    }

    if (patientName !== undefined) {
      record.patientName = patientName.trim();
    }

    if (time !== undefined) {
      record.time = time.trim();
    }

    if (remark !== undefined) {
      record.remark = remark.trim();
    }

    if (sl !== undefined && Number(sl) > 0) {
      record.sl = Number(sl);
    }

    if (date !== undefined) {
      const recordDate = new Date(date);
      if (isNaN(recordDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format provided',
        });
      }
      record.date = recordDate;
      record.month = recordDate.getMonth() + 1;
      record.year = recordDate.getFullYear();
    }

    await record.save();

    res.status(200).json({
      success: true,
      message: 'Record updated successfully',
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Soft Delete a record (Move to Recycle Bin)
// @route   DELETE /api/records/:id
// @access  Private
export const deleteRecord = async (req, res, next) => {
  try {
    if (req.user && req.user.role !== 'superadmin' && (req.user.status === 'paused' || req.user.status === 'suspended')) {
      return res.status(403).json({
        success: false,
        message: 'আপনার অ্যাকাউন্টটি স্থগিত (Paused) থাকায় রেকর্ড ডিলিট করা সম্ভব নয়।',
      });
    }

    const record = await Record.findById(req.params.id);

    if (!record || record.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
      });
    }

    // Ownership check: ONLY the user who created/entered the record can delete it
    if (
      record.createdBy &&
      req.user &&
      String(record.createdBy) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'অনুমতি নেই: শুধুমাত্র যে ইউজার রেকর্ডটি তৈরি করেছেন, তিনিই এটি ডিলিট করতে পারবেন। (Only the record creator can delete this record)',
      });
    }

    // Soft delete: flag record as deleted and timestamp it
    record.isDeleted = true;
    record.deletedAt = new Date();
    record.deletedBy = req.user ? req.user._id : null;
    await record.save();

    res.status(200).json({
      success: true,
      message: 'Record moved to Recycle Bin (বিন এ পাঠানো হয়েছে)',
      data: { id: req.params.id },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get soft-deleted records in Recycle Bin
// @route   GET /api/records/bin
// @access  Private
export const getBinRecords = async (req, res, next) => {
  try {
    const {
      search,
      month,
      year,
      page = 1,
      limit = 50,
      userId,
    } = req.query;

    const query = { isDeleted: true };

    // Super Admin / Admin can filter by specific user or view all
    if (req.user && (req.user.role === 'superadmin' || req.user.role === 'admin') && userId) {
      if (userId === 'all') {
        // View all soft deleted records
      } else if (userId !== 'me') {
        query.createdBy = userId;
      } else {
        query.createdBy = req.user._id;
      }
    } else if (req.user && req.user.role === 'superadmin') {
      // Super Admin default: show all soft-deleted records unless explicitly scoped to 'me'
      if (userId === 'me') {
        query.createdBy = req.user._id;
      }
    } else {
      // Regular staff: strictly only see their own deleted records
      query.createdBy = req.user ? req.user._id : null;
    }

    if (month && Number(month) >= 1 && Number(month) <= 12) {
      query.month = Number(month);
    }
    if (year && Number(year) > 1900) {
      query.year = Number(year);
    }

    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      query.$or = [
        { patientId: { $regex: searchTerm, $options: 'i' } },
        { patientName: { $regex: searchTerm, $options: 'i' } },
        { remark: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const [records, total] = await Promise.all([
      Record.find(query)
        .select('sl patientId patientName date time remark month year createdBy deletedAt deletedBy createdAt')
        .sort({ deletedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .populate('createdBy', 'name email username')
        .populate('deletedBy', 'name email username')
        .lean(),
      Record.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: records,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Restore a soft-deleted record from Recycle Bin
// @route   PUT /api/records/bin/:id/restore
// @access  Private
export const restoreRecord = async (req, res, next) => {
  try {
    const record = await Record.findById(req.params.id);

    if (!record || !record.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Deleted record not found in Recycle Bin',
      });
    }

    // Strict Rule: ONLY the user who deleted this record can restore it.
    // Super Admin cannot restore records deleted by other users.
    const deleterId = record.deletedBy
      ? String(record.deletedBy._id || record.deletedBy)
      : record.createdBy
      ? String(record.createdBy._id || record.createdBy)
      : null;

    if (!req.user || (deleterId && String(req.user._id) !== deleterId)) {
      return res.status(403).json({
        success: false,
        message: 'অনুমতি নেই: শুধুমাত্র যে ইউজার রেকর্ডটি ডিলিট করেছেন, তিনিই এটি রিস্টোর করতে পারবেন। সুপার এডমিন এটি রিস্টোর করতে পারবেন না। (Only the user who deleted this record can restore it)',
      });
    }

    record.isDeleted = false;
    record.deletedAt = null;
    record.deletedBy = null;
    await record.save();

    res.status(200).json({
      success: true,
      message: `Patient Record (${record.patientName} - ID: ${record.patientId}) restored successfully!`,
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Permanently delete a record from Recycle Bin (Hard Delete)
// @route   DELETE /api/records/bin/:id/permanent
// @access  Private/SuperAdmin
export const permanentDeleteRecord = async (req, res, next) => {
  try {
    const record = await Record.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
      });
    }

    // Strictly enforce superadmin check
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only Super Administrator can permanently delete records.',
      });
    }

    await record.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Record permanently deleted from database (চিরতরে মুছে ফেলা হয়েছে)',
      data: { id: req.params.id },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Empty entire Recycle Bin (Hard Delete all soft-deleted records)
// @route   DELETE /api/records/bin/empty
// @access  Private/SuperAdmin
export const emptyBin = async (req, res, next) => {
  try {
    // Strictly enforce superadmin check
    if (!req.user || req.user.role !== 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only Super Administrator can empty the Recycle Bin.',
      });
    }

    const { deletedCount } = await Record.deleteMany({ isDeleted: true });

    // Mirror to Secondary MongoDB
    import('../services/dbMirrorService.js')
      .then(({ getSecondaryConnection }) => {
        const secConn = getSecondaryConnection();
        if (secConn && secConn.readyState === 1) {
          secConn.collection('records').deleteMany({ isDeleted: true }).catch(() => {});
        }
      })
      .catch(() => {});

    res.status(200).json({
      success: true,
      message: `Recycle Bin emptied successfully! (${deletedCount} records permanently deleted).`,
      deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check for possible duplicate record (Excludes soft-deleted records)
// @route   GET /api/records/check-duplicate
// @access  Private
export const checkDuplicate = async (req, res, next) => {
  try {
    const { patientId, date, excludeId } = req.query;

    if (!patientId || !date) {
      return res.status(200).json({
        success: true,
        isDuplicate: false,
      });
    }

    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      return res.status(200).json({
        success: true,
        isDuplicate: false,
      });
    }

    const startOfDay = new Date(new Date(date).setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date(date).setHours(23, 59, 59, 999));

    const query = {
      patientId: String(patientId).trim(),
      date: { $gte: startOfDay, $lte: endOfDay },
      isDeleted: { $ne: true },
    };

    // Duplicate check is scoped to the user's own records
    if (req.user && req.user.role !== 'superadmin') {
      query.createdBy = req.user._id;
    }

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await Record.findOne(query)
      .select('patientId patientName date')
      .lean();

    if (existing) {
      return res.status(200).json({
        success: true,
        isDuplicate: true,
        duplicateRecord: existing,
        message: `A record for Patient ID ${existing.patientId} (${existing.patientName}) already exists on ${new Date(existing.date).toLocaleDateString()}.`,
      });
    }

    return res.status(200).json({
      success: true,
      isDuplicate: false,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get dashboard statistics (Active records only)
// @route   GET /api/records/dashboard-stats
// @access  Private
export const getDashboardStats = async (req, res, next) => {
  try {
    const { month, year, userId } = req.query;
    const parsedMonth = Number(month);
    const parsedYear = Number(year);
    const currentMonth = !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : new Date().getMonth() + 1;
    const currentYear = !isNaN(parsedYear) && parsedYear > 1900 ? parsedYear : new Date().getFullYear();

    // Today's date range
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));

    // Base query scoping to user and active records
    const baseQuery = { isDeleted: { $ne: true } };
    if (req.user && (req.user.role === 'superadmin' || req.user.role === 'admin') && userId) {
      if (userId === 'all') {
        // Combined statistics
      } else if (userId !== 'me') {
        baseQuery.createdBy = userId;
      } else {
        baseQuery.createdBy = req.user._id;
      }
    } else {
      // Default: strictly own records
      baseQuery.createdBy = req.user ? req.user._id : null;
    }

    const [
      totalAllTime,
      totalToday,
      totalSelectedMonth,
      recentRecords,
      distinctPatientsMonth,
    ] = await Promise.all([
      Record.countDocuments(baseQuery),
      Record.countDocuments({ ...baseQuery, date: { $gte: todayStart, $lte: todayEnd } }),
      Record.countDocuments({ ...baseQuery, month: currentMonth, year: currentYear }),
      Record.find({ ...baseQuery, month: currentMonth, year: currentYear })
        .select('sl patientId patientName date time remark')
        .sort({ date: -1, createdAt: -1 })
        .limit(5)
        .lean(),
      Record.distinct('patientId', { ...baseQuery, month: currentMonth, year: currentYear }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalAllTime,
        totalToday,
        totalSelectedMonth,
        uniquePatientsMonth: distinctPatientsMonth.length,
        selectedMonth: currentMonth,
        selectedYear: currentYear,
        recentRecords,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get monthly entry counts for all 12 months for a given year & user scope
// @route   GET /api/records/monthly-counts
// @access  Private
export const getMonthlyCounts = async (req, res, next) => {
  try {
    const { year, userId } = req.query;
    const targetYear = year && !isNaN(Number(year)) ? Number(year) : new Date().getFullYear();

    const query = {
      year: targetYear,
      isDeleted: { $ne: true },
    };

    // Strict user data scoping
    if (req.user && (req.user.role === 'superadmin' || req.user.role === 'admin') && userId) {
      if (userId === 'all') {
        // Combined across all staff accounts
      } else if (userId !== 'me') {
        if (mongoose.Types.ObjectId.isValid(userId)) {
          query.createdBy = new mongoose.Types.ObjectId(userId);
        } else {
          query.createdBy = userId;
        }
      } else {
        query.createdBy = req.user._id;
      }
    } else {
      query.createdBy = req.user ? req.user._id : null;
    }

    const counts = await Record.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$month',
          count: { $sum: 1 },
        },
      },
    ]);

    const monthlyCounts = {};
    for (let m = 1; m <= 12; m++) {
      monthlyCounts[m] = 0;
    }
    counts.forEach((c) => {
      if (c._id >= 1 && c._id <= 12) {
        monthlyCounts[c._id] = c.count;
      }
    });

    res.status(200).json({
      success: true,
      year: targetYear,
      data: monthlyCounts,
    });
  } catch (error) {
    next(error);
  }
};
