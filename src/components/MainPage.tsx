import React, { useState, useEffect } from 'react';
import { FileText, Plus, Clock, FolderOpen, Trash2, Edit2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ReportBuilder from './ReportBuilder';
import { indexedDBService } from '@/utils/indexedDB';
import { toast } from 'react-hot-toast';

interface RecentReport {
  id: string;
  name: string;
  title: string;
  lastModified: string;
  content: {
    title: string;
    startDate: string;
    endDate: string;
    sections: any[];
  };
}

const MainPage: React.FC = () => {
  const router = useRouter();
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [selectedReport, setSelectedReport] = useState<RecentReport | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setIsLoading(true);
      const reports = await indexedDBService.getAllReports();
      setRecentReports(reports.sort((a, b) => 
        new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
      ));
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load reports. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const createNewReport = () => {
    setSelectedReport(null);
    setShowReportBuilder(true);
  };

  const openReport = (report: RecentReport) => {
    setSelectedReport(report);
    setShowReportBuilder(true);
  };

  const startRename = (report: RecentReport) => {
    setEditingReportId(report.id);
    setEditingTitle(report.name);
  };

  const handleRename = async () => {
    if (!editingReportId || !editingTitle.trim()) return;
    try {
      await indexedDBService.updateReportName(editingReportId, editingTitle.trim());
      await loadReports();
      setEditingReportId(null);
      toast.success('Report renamed successfully');
    } catch (error) {
      console.error('Error renaming report:', error);
      toast.error('Failed to rename report. Please try again.');
    }
  };

  const confirmDelete = (reportId: string) => {
    setShowDeleteConfirm(reportId);
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) return;
    try {
      await indexedDBService.deleteReport(showDeleteConfirm);
      await loadReports();
      setShowDeleteConfirm(null);
      toast.success('Report deleted successfully');
    } catch (error) {
      console.error('Error deleting report:', error);
      toast.error('Failed to delete report. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (showReportBuilder) {
    return <ReportBuilder 
      initialData={selectedReport?.content} 
      reportId={selectedReport?.id}
      onClose={() => {
        setShowReportBuilder(false);
        // Reload recent reports when returning to main page
        const savedReports = localStorage.getItem('recentReports');
        if (savedReports) {
          try {
            setRecentReports(JSON.parse(savedReports));
          } catch (e) {
            console.error('Error loading recent reports:', e);
          }
        }
      }}
    />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Report
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete this report? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Report Builder
          </h1>
          <button
            onClick={createNewReport}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Report
          </button>
        </div>

        {/* Recent Reports Section */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center mb-4">
            <Clock className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Recent Reports
            </h2>
          </div>
          
          {recentReports.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No recent reports. Create a new report to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {recentReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                >
                  <div className="flex items-center flex-1">
                    <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3" />
                    <div className="flex-1">
                      {editingReportId === report.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleRename();
                              }
                            }}
                            className="flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-slate-800 dark:text-white"
                            autoFocus
                          />
                          <button
                            onClick={handleRename}
                            className="p-1 text-green-600 hover:text-green-700"
                            title="Save name"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingReportId(null)}
                            className="p-1 text-gray-500 hover:text-gray-700"
                            title="Cancel"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <h3 
                            className="font-medium text-gray-800 dark:text-white cursor-pointer"
                            onClick={() => openReport(report)}
                          >
                            {report.name}
                          </h3>
                          <button
                            onClick={() => startRename(report)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title="Rename report"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Last modified: {formatDate(report.lastModified)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => confirmDelete(report.id)}
                    className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Delete report"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions Section */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center mb-4">
            <FolderOpen className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
              Quick Actions
            </h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={createNewReport}
              className="flex items-center justify-center p-4 bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
            >
              <Plus className="h-6 w-6 text-gray-500 dark:text-gray-400 mr-2" />
              <span className="text-gray-700 dark:text-gray-300">New Report</span>
            </button>
            
            <button
              onClick={() => {
                // TODO: Implement file upload functionality
                alert('File upload coming soon!');
              }}
              className="flex items-center justify-center p-4 bg-gray-50 dark:bg-slate-700 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
            >
              <FileText className="h-6 w-6 text-gray-500 dark:text-gray-400 mr-2" />
              <span className="text-gray-700 dark:text-gray-300">Open PDF</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainPage; 