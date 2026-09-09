import mongoose from 'mongoose';
import Record from '../models/Record.js';

// Helper: Calculate next SL number for a given month, year, and specific user
const getNextSequenceNumber = async (month, year, userId = null) => {
  const query = { month, year };
  if (userId) {
    query.createdBy = userId;
  }
  const count = await Record.countDocuments(query);
  return count + 1;
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

// @desc    Get all active records with filtering, search, pagination, and sorting
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

    const query = {};

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

// @desc    Get single record by ID
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

    const record = await Record.findById(req.params.id).populate('createdBy', 'name email username');

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

    // Strict Duplicate Patient ID Prevention: A patient ID cannot be entered more than once per user in the month
    const duplicateQuery = {
      patientId: stringPatientId,
      month: recordMonth,
      year: recordYear,
    };
    if (userId) {
      duplicateQuery.createdBy = userId;
    }

    const existingRecord = await Record.findOne(duplicateQuery);
    if (existingRecord) {
      return res.status(400).json({
        success: false,
        message: `পেশেন্ট আইডি #${stringPatientId} দিয়ে "${existingRecord.patientName}" রোগীর একটি রেকর্ড ইতিমধ্যে এই মাসে এন্ট্রি করা হয়েছে। একই পেশেন্ট আইডি একাধিকবার ব্যবহার করা যাবে না। (Duplicate Patient ID not allowed)`,
      });
    }

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

    let record = await Record.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
      });
    }

    // Ownership check: ONLY the user who created/entered the record (or Superadmin/Admin) can edit it
    if (
      record.createdBy &&
      req.user &&
      req.user.role !== 'superadmin' &&
      req.user.role !== 'admin' &&
      String(record.createdBy._id || record.createdBy) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'অনুমতি নেই: শুধুমাত্র যে ইউজার রেকর্ডটি তৈরি করেছেন, তিনিই এটি এডিট করতে পারবেন। (Only the record creator or administrator can edit this record)',
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

    const newPatientId = patientId !== undefined ? String(patientId).trim() : record.patientId;
    let newDate = record.date;
    if (date !== undefined) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format provided',
        });
      }
      newDate = parsedDate;
    }
    const newMonth = newDate.getMonth() + 1;
    const newYear = newDate.getFullYear();

    // Strict duplicate check on update excluding this current record
    const duplicateQuery = {
      _id: { $ne: record._id },
      patientId: newPatientId,
      month: newMonth,
      year: newYear,
    };
    if (record.createdBy) {
      duplicateQuery.createdBy = record.createdBy;
    }
    const existingOther = await Record.findOne(duplicateQuery);
    if (existingOther) {
      return res.status(400).json({
        success: false,
        message: `পেশেন্ট আইডি #${newPatientId} দিয়ে "${existingOther.patientName}" রোগীর একটি এন্ট্রি ইতিমধ্যে এই মাসে রয়েছে (SL: ${existingOther.sl})। একই আইডি ডুপ্লিকেট করা যাবে না।`,
      });
    }

    if (patientId !== undefined) {
      record.patientId = newPatientId;
    }
    if (date !== undefined) {
      record.date = newDate;
      record.month = newMonth;
      record.year = newYear;
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

// @desc    Permanently delete a record directly from database
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

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
      });
    }

    // Ownership check: ONLY the user who created/entered the record (or Superadmin/Admin) can delete it
    if (
      record.createdBy &&
      req.user &&
      req.user.role !== 'superadmin' &&
      req.user.role !== 'admin' &&
      String(record.createdBy._id || record.createdBy) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'অনুমতি নেই: শুধুমাত্র যে ইউজার রেকর্ডটি তৈরি করেছেন, তিনিই এটি ডিলিট করতে পারবেন। (Only the record creator or administrator can delete this record)',
      });
    }

    // Direct permanent deletion from MongoDB
    await Record.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'রেকর্ডটি ডাটাবেজ থেকে স্থায়ীভাবে মুছে ফেলা হয়েছে (Record permanently deleted)',
      data: { id: req.params.id },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check for possible duplicate record
// @route   GET /api/records/check-duplicate
// @access  Private
export const checkDuplicate = async (req, res, next) => {
  try {
    const { patientId, date, month, year, excludeId } = req.query;

    if (!patientId) {
      return res.status(200).json({
        success: true,
        isDuplicate: false,
      });
    }

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

    const query = {
      patientId: String(patientId).trim(),
      month: targetMonth,
      year: targetYear,
    };

    // Duplicate check is scoped to the user's own records
    if (req.user) {
      query.createdBy = req.user._id;
    }

    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
      query._id = { $ne: excludeId };
    }

    const existing = await Record.findOne(query)
      .select('patientId patientName date sl month year time')
      .lean();

    if (existing) {
      return res.status(200).json({
        success: true,
        isDuplicate: true,
        duplicateRecord: existing,
        message: `পেশেন্ট আইডি #${existing.patientId} (${existing.patientName}) দিয়ে এই মাসে ইতিমধ্যে এন্ট্রি আছে (SL: ${existing.sl})।`,
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

    // Base query scoping to user
    const baseQuery = {};
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
        query.createdBy = new mongoose.Types.ObjectId(req.user._id);
      }
    } else {
      if (req.user && req.user._id) {
        query.createdBy = new mongoose.Types.ObjectId(req.user._id);
      }
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
