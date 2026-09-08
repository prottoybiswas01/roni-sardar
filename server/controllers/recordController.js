import Record from '../models/Record.js';

// Helper: Calculate next SL number for a given month, year, and specific user
const getNextSequenceNumber = async (month, year, userId = null) => {
  const query = { month, year };
  if (userId) {
    query.createdBy = userId;
  }
  const lastRecord = await Record.findOne(query).sort({ sl: -1 });
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

// @desc    Get all records with filtering, search, pagination, and sorting
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
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const sortOptions = {};
    const order = sortOrder === 'desc' ? -1 : 1;
    sortOptions[sortBy] = order;
    if (sortBy !== 'sl') {
      sortOptions.sl = 1;
    }

    const [records, total] = await Promise.all([
      Record.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limitNum)
        .populate('createdBy', 'name email username'),
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
    let { patientId, patientName, date, time, remark, sl } = req.body;

    if (!patientId || !patientName || !date || !time) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: Patient ID, Patient Name, Date, and Time',
      });
    }

    // CRITICAL: Ensure patientId is preserved strictly as a trimmed string
    const stringPatientId = String(patientId).trim();
    if (!stringPatientId) {
      return res.status(400).json({
        success: false,
        message: 'Valid Patient ID string is required',
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
    let record = await Record.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
      });
    }

    // Ownership check: users can only update their own record
    if (
      req.user &&
      req.user.role !== 'superadmin' &&
      String(record.createdBy) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this record',
      });
    }

    const { patientId, patientName, date, time, remark, sl } = req.body;

    if (patientId !== undefined) {
      const stringPatientId = String(patientId).trim();
      if (!stringPatientId) {
        return res.status(400).json({
          success: false,
          message: 'Patient ID cannot be empty',
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

// @desc    Delete a record
// @route   DELETE /api/records/:id
// @access  Private
export const deleteRecord = async (req, res, next) => {
  try {
    const record = await Record.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: 'Record not found',
      });
    }

    // Ownership check: users can only delete their own record unless superadmin
    if (
      req.user &&
      req.user.role !== 'superadmin' &&
      String(record.createdBy) !== String(req.user._id)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this record',
      });
    }

    await record.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Record deleted successfully',
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
    };

    // Duplicate check is scoped to the user's own records
    if (req.user && req.user.role !== 'superadmin') {
      query.createdBy = req.user._id;
    }

    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const existing = await Record.findOne(query);

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

// @desc    Get dashboard statistics
// @route   GET /api/records/dashboard-stats
// @access  Private
export const getDashboardStats = async (req, res, next) => {
  try {
    const { month, year, userId } = req.query;

    const currentMonth = month ? Number(month) : new Date().getMonth() + 1;
    const currentYear = year ? Number(year) : new Date().getFullYear();

    // Today's date range
    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));

    // Base query scoping to user:
    // By default, EVERY user (including Super Admin) ONLY sees their own dashboard statistics.
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
        .sort({ date: -1, createdAt: -1 })
        .limit(5),
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
