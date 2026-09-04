import Settings from '../models/Settings.js';

// @desc    Get hospital configuration & report settings
// @route   GET /api/settings
// @access  Private
export const getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({
        hospitalName: 'Ad-din Akij Medical College Hospital',
        location: 'Boyra, Khulna',
        reportTitle: 'OVER DUTY / PATIENT REPORT',
        checkDuplicates: true,
      });
    } else if (settings.hospitalName === 'GENERAL HOSPITAL & MEDICAL CENTER') {
      settings.hospitalName = 'Ad-din Akij Medical College Hospital';
      settings.location = 'Boyra, Khulna';
      await settings.save();
    }

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update hospital configuration settings
// @route   PUT /api/settings
// @access  Private/Admin/Manager
export const updateSettings = async (req, res, next) => {
  try {
    const {
      hospitalName,
      location,
      reportTitle,
      checkDuplicates,
      defaultMonth,
      defaultYear,
    } = req.body;

    let settings = await Settings.findOne();

    if (!settings) {
      settings = new Settings();
    }

    if (hospitalName !== undefined) settings.hospitalName = hospitalName.trim();
    if (location !== undefined) settings.location = location.trim();
    if (reportTitle !== undefined) settings.reportTitle = reportTitle.trim();
    if (checkDuplicates !== undefined) settings.checkDuplicates = Boolean(checkDuplicates);
    if (defaultMonth !== undefined) settings.defaultMonth = Number(defaultMonth);
    if (defaultYear !== undefined) settings.defaultYear = Number(defaultYear);

    await settings.save();

    res.status(200).json({
      success: true,
      message: 'Settings updated successfully',
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};
