import mongoose from 'mongoose';

const recordSchema = new mongoose.Schema(
  {
    sl: {
      type: Number,
      required: false,
    },
    // CRITICAL: patientId MUST strictly remain a String to preserve leading zeroes (e.g., '001234', '0250474')
    patientId: {
      type: String,
      required: [true, 'Patient ID is required'],
      trim: true,
      index: true,
    },
    patientName: {
      type: String,
      required: [true, 'Patient Name is required'],
      trim: true,
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Date is required'],
      index: true,
    },
    time: {
      type: String,
      required: [true, 'Time is required'],
      trim: true,
    },
    remark: {
      type: String,
      trim: true,
      default: '',
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// High performance compound indexes for instant queries (<10ms)
recordSchema.index({ createdBy: 1, month: 1, year: 1, date: 1, sl: 1 });
recordSchema.index({ createdBy: 1, month: 1, year: 1 });
recordSchema.index({ createdBy: 1, year: 1 });
recordSchema.index({ createdBy: 1, date: -1 });
recordSchema.index({ createdBy: 1, patientId: 1, date: 1 });
recordSchema.index({ month: 1, year: 1, date: 1, sl: 1 });
recordSchema.index({ patientId: 1, date: 1 });

// Automatic Mirroring to Secondary MongoDB Cluster
recordSchema.post('save', function (doc) {
  import('../services/dbMirrorService.js')
    .then(({ mirrorRecordToSecondary }) => mirrorRecordToSecondary(doc, 'save'))
    .catch(() => {});
});

recordSchema.post('findOneAndDelete', function (doc) {
  if (doc) {
    import('../services/dbMirrorService.js')
      .then(({ mirrorRecordToSecondary }) => mirrorRecordToSecondary(doc, 'delete'))
      .catch(() => {});
  }
});

const Record = mongoose.model('Record', recordSchema);
export default Record;
