import React, { useState, useEffect } from 'react';
import { FileText, Plus, Clock, FolderOpen, Trash2, Edit2, X, Edit, Download, Moon, Sun, BarChart2, BookOpen, Star, Search, Filter, FolderPlus, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import ReportBuilder from './ReportBuilder';
import { indexedDBService } from '@/utils/indexedDB';
import { toast } from 'react-hot-toast';
import { useTheme } from '@/contexts/ThemeContext';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

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
  size?: number;
}

const MainPage: React.FC = () => {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [recentReports, setRecentReports] = useState<RecentReport[]>([]);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [selectedReport, setSelectedReport] = useState<RecentReport | null>(null);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'recent' | 'favorites'>('all');
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    const savedFavorites = localStorage.getItem('favoriteReports');
    if (savedFavorites) {
      setFavorites(JSON.parse(savedFavorites));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('favoriteReports', JSON.stringify(favorites));
  }, [favorites]);

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

  const handleOpenReport = (report: RecentReport) => {
    setSelectedReport(report);
    setShowReportBuilder(true);
  };

  const handleCloseReport = () => {
    setSelectedReport(null);
    setShowReportBuilder(false);
    loadReports(); // Reload reports to get any updates
  };

  const createNewReport = () => {
    setSelectedReport(null);
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const generatePDF = async (report: RecentReport) => {
    try {
      // Create a temporary ReportBuilder instance to generate PDF
      const tempReportBuilder = document.createElement('div');
      tempReportBuilder.innerHTML = `
        <div class="report-content">
          <h1>${report.title}</h1>
          <div class="report-date">${formatDate(report.lastModified)}</div>
          ${report.content.sections.map(section => `
            <div class="section">
              <h2>${section.title}</h2>
              <div class="content">${section.content}</div>
            </div>
          `).join('')}
        </div>
      `;
      
      // Use html2canvas to convert the content to an image
      const canvas = await html2canvas(tempReportBuilder, {
        scale: 2,
        useCORS: true,
        logging: false
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Add the image to the PDF
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      // Save the PDF
      pdf.save(`${report.name}.pdf`);
      toast.success('PDF generated successfully!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF. Please try again.');
    }
  };

  // Filter reports based on search and filter
  const filteredReports = recentReports.filter(report => {
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         report.content.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedFilter === 'favorites') {
      return matchesSearch && favorites.includes(report.id);
    }
    return matchesSearch;
  });

  const toggleFavorite = (reportId: string) => {
    setFavorites(prev => 
      prev.includes(reportId) 
        ? prev.filter(id => id !== reportId)
        : [...prev, reportId]
    );
  };

  // Calculate quick stats
  const stats = {
    totalReports: recentReports.length,
    totalSize: recentReports.reduce((acc, report) => acc + (report.size || 0), 0),
    lastWeekReports: recentReports.filter(report => {
      const reportDate = new Date(report.lastModified);
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);
      return reportDate >= lastWeek;
    }).length
  };

  // Group reports by date
  const groupedReports = filteredReports.reduce((groups, report) => {
    const date = new Date(report.lastModified);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let groupKey = 'Older';
    if (date.toDateString() === today.toDateString()) {
      groupKey = 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = 'Yesterday';
    } else if (date > new Date(today.setDate(today.getDate() - 7))) {
      groupKey = 'This Week';
    } else if (date > new Date(today.setDate(today.getDate() - 30))) {
      groupKey = 'This Month';
    }
    
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(report);
    return groups;
  }, {} as Record<string, RecentReport[]>);

  // Sort groups in chronological order
  const groupOrder = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];
  const sortedGroups = groupOrder.filter(key => groupedReports[key]?.length > 0);

  if (showReportBuilder) {
    return (
      <ReportBuilder 
        initialData={selectedReport?.content}
        reportId={selectedReport?.id}
        onClose={handleCloseReport}
      />
    );
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
      {/* Beta Version Banner */}
      <div className="bg-blue-600 text-white px-4 py-2">
        <div className="container mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-yellow-400 text-blue-800 text-xs font-bold px-2 py-1 rounded">BETA</span>
            <p className="text-sm">This is a beta version running in test mode. Some features may be experimental.</p>
          </div>
          <a 
            href="#" 
            className="text-xs text-blue-100 hover:text-white underline"
            onClick={(e) => {
              e.preventDefault();
              toast.success('Feedback feature coming soon!');
            }}
          >
            Send Feedback
          </a>
        </div>
      </div>

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
        {/* Header Section */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
              Report Builder
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Create and manage your professional reports
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-all duration-200"
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {theme === "light" ? (
                <Moon className="h-5 w-5" />
              ) : (
                <Sun className="h-5 w-5" />
              )}
            </button>
            <button
              onClick={createNewReport}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200 hover:scale-105"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Report
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Reports</h3>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white mt-2">{stats.totalReports}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-green-500" />
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Storage Used</h3>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white mt-2">{formatFileSize(stats.totalSize)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Reports This Week</h3>
            </div>
            <p className="text-2xl font-bold text-gray-800 dark:text-white mt-2">{stats.lastWeekReports}</p>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search reports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedFilter('all')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                selectedFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              <Filter className="h-4 w-4" />
              All
            </button>
            <button
              onClick={() => setSelectedFilter('recent')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                selectedFilter === 'recent'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              <Clock className="h-4 w-4" />
              Recent
            </button>
            <button
              onClick={() => setSelectedFilter('favorites')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                selectedFilter === 'favorites'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              <Star className="h-4 w-4" />
              Favorites
            </button>
          </div>
        </div>

        {/* Reports Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                All Reports
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {new Date().toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
          </div>
          
          {filteredReports.length === 0 ? (
            <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-lg">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery 
                  ? 'No reports found matching your search.'
                  : 'No reports yet. Create a new report to get started.'}
              </p>
              <button
                onClick={createNewReport}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create New Report
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedGroups.map((groupKey) => (
                <div key={groupKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                      {groupKey}
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {groupedReports[groupKey].map((report) => (
                      <div
                        key={report.id}
                        className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
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
                                  className="font-medium text-gray-800 dark:text-white cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                                  onClick={() => handleOpenReport(report)}
                                >
                                  {report.name}
                                </h3>
                                <button
                                  onClick={() => startRename(report)}
                                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                                  title="Rename report"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => toggleFavorite(report.id)}
                                  className={`p-1.5 rounded-md transition-colors ${
                                    favorites.includes(report.id)
                                      ? 'text-yellow-500 hover:text-yellow-600'
                                      : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700'
                                  }`}
                                  title={favorites.includes(report.id) ? "Remove from favorites" : "Add to favorites"}
                                >
                                  <Star className={`h-4 w-4 ${favorites.includes(report.id) ? 'fill-current' : ''}`} />
                                </button>
                              </div>
                            )}
                            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                              <span>Last modified: {formatDate(report.lastModified)}</span>
                              <span>Size: {formatFileSize(report.size || 0)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => generatePDF(report)}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                            title="Download PDF"
                          >
                            <Download className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => confirmDelete(report.id)}
                            className="p-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                            title="Delete report"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default MainPage; 