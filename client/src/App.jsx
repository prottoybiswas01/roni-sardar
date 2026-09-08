import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { Layout } from './components/layout/Layout';

import { Dashboard } from './pages/Dashboard';
import { RecordsPage } from './pages/RecordsPage';
import { AddRecordPage } from './pages/AddRecordPage';
import { MonthlyReportPage } from './pages/MonthlyReportPage';
import { RecycleBinPage } from './pages/RecycleBinPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';

import { CameraScannerModal } from './components/camera/CameraScannerModal';
import { OCRReviewModal } from './components/camera/OCRReviewModal';
import { Modal } from './components/common/Modal';
import { RecordForm } from './components/records/RecordForm';
import { ShareReportModal } from './components/reports/ShareReportModal';

const MainApplication = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('dashboard');

  // Scanner & OCR review state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [ocrReviewData, setOcrReviewData] = useState(null);
  const [prefilledRecordData, setPrefilledRecordData] = useState(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-white">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-slate-400">Loading Clinical Workspace...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleOCRComplete = (extractedResult) => {
    setOcrReviewData(extractedResult);
  };

  const handleApplyOCRToForm = (correctedFields) => {
    setPrefilledRecordData({
      patientId: correctedFields.patientId,
      patientName: correctedFields.patientName,
      date: correctedFields.date,
      time: correctedFields.time,
      remark: correctedFields.remark,
    });
    setOcrReviewData(null);
    // Open record entry form modal
    setIsRecordModalOpen(true);
  };

  const handleRecordSaved = () => {
    setIsRecordModalOpen(false);
    setPrefilledRecordData(null);
    setActiveTab('records');
  };

  return (
    <>
      <Layout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenShare={() => setIsShareModalOpen(true)}
      >
        {activeTab === 'dashboard' && (
          <Dashboard
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenShare={() => setIsShareModalOpen(true)}
          />
        )}

        {activeTab === 'records' && (
          <RecordsPage
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenAddPage={() => setActiveTab('add-record')}
          />
        )}

        {activeTab === 'add-record' && (
          <AddRecordPage
            onOpenScanner={() => setIsScannerOpen(true)}
            onRecordSaved={handleRecordSaved}
            onCancel={() => setActiveTab('records')}
          />
        )}

        {activeTab === 'reports' && (
          <MonthlyReportPage onAddNew={() => setActiveTab('add-record')} />
        )}

        {activeTab === 'recycle-bin' && <RecycleBinPage />}

        {activeTab === 'settings' && <SettingsPage initialTab="general" />}

        {activeTab === 'users' && <SettingsPage initialTab="users" />}

        {activeTab === 'backup' && <SettingsPage initialTab="backup" />}
      </Layout>

      {/* Global Share / Print Report Email Modal */}
      <ShareReportModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* Global Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onOCRComplete={handleOCRComplete}
      />

      {/* OCR Review & Field Verification Modal */}
      <OCRReviewModal
        isOpen={Boolean(ocrReviewData)}
        onClose={() => setOcrReviewData(null)}
        ocrData={ocrReviewData}
        onApply={handleApplyOCRToForm}
      />

      {/* Modal for OCR-populated Record Saving */}
      {isRecordModalOpen && (
        <Modal
          isOpen={isRecordModalOpen}
          onClose={() => {
            setIsRecordModalOpen(false);
            setPrefilledRecordData(null);
          }}
          title="Save Scanned Record"
          subtitle="Review and confirm details before writing to the database"
          maxWidth="max-w-3xl"
        >
          <RecordForm
            initialData={prefilledRecordData}
            isModal={true}
            onCancel={() => {
              setIsRecordModalOpen(false);
              setPrefilledRecordData(null);
            }}
            onSuccess={handleRecordSaved}
            onOpenScanner={() => {
              setIsRecordModalOpen(false);
              setIsScannerOpen(true);
            }}
          />
        </Modal>
      )}
    </>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <SettingsProvider>
          <MainApplication />
        </SettingsProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
