/**
 * Enhanced Export Utilities for Excel and PDF with Chart Images
 * Supports role-based exports with visualizations
 */
import html2canvas from 'html2canvas';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { saveAs } from 'file-saver';
import axios from 'axios';

/**
 * Capture chart images from DOM elements
 */
export const captureChartImages = async (chartSelectors = []) => {
  const images = [];
  
  if (!chartSelectors || chartSelectors.length === 0) {
    // Fallback: try to find all charts on the page
    const allCharts = document.querySelectorAll('.recharts-wrapper, [data-chart], [data-chart-container]');
    if (allCharts.length > 0) {
      chartSelectors = Array.from(allCharts);
    } else {
      return images;
    }
  }
  
  // Remove duplicates and invalid elements
  const uniqueElements = new Set();
  const validSelectors = [];
  
  for (const selector of chartSelectors) {
    try {
      const element = typeof selector === 'string' 
        ? document.querySelector(selector)
        : selector;
      
      if (element && element.nodeType === 1) { // Node.ELEMENT_NODE
        if (!uniqueElements.has(element)) {
          uniqueElements.add(element);
          validSelectors.push(element);
        }
      }
    } catch (e) {
      console.warn('Invalid selector:', selector, e);
    }
  }
  
  for (const element of validSelectors) {
    try {
      // Check if element is in a hidden tab - if so, make it temporarily visible
      // Handle both Radix UI tabs (shadcn/ui) and standard tabs
      const tabPanel = element.closest('[role="tabpanel"]') || 
                      element.closest('[data-state]') ||
                      element.closest('.TabsContent');
      
      const isInHiddenTab = element.closest('.hidden') ||
                           element.closest('[style*="display: none"]') ||
                           (tabPanel && (tabPanel.getAttribute('hidden') !== null || 
                                        tabPanel.getAttribute('data-state') === 'inactive' ||
                                        tabPanel.style.display === 'none'));
      
      let wasHidden = false;
      let originalDisplay = '';
      let originalHidden = '';
      let originalDataState = '';
      
      if (isInHiddenTab && tabPanel) {
        // Temporarily show hidden tabs to capture charts
        wasHidden = tabPanel.hasAttribute('hidden');
        originalDisplay = tabPanel.style.display || '';
        originalHidden = tabPanel.getAttribute('hidden') || '';
        originalDataState = tabPanel.getAttribute('data-state') || '';
        
        if (wasHidden) {
          tabPanel.removeAttribute('hidden');
        }
        tabPanel.style.display = 'block';
        tabPanel.setAttribute('data-state', 'active');
        
        // Also show parent tab container if needed
        const tabContainer = tabPanel.closest('[role="tablist"]')?.parentElement;
        if (tabContainer && tabContainer.style.display === 'none') {
          tabContainer.style.display = 'block';
        }
      }
      
      // Skip if element is not visible (but allow hidden tabs we just made visible)
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        // Restore original state
        if (wasHidden && isInHiddenTab) {
          const tabPanel = element.closest('[role="tabpanel"]');
          if (tabPanel) {
            if (wasHidden) tabPanel.setAttribute('hidden', '');
            tabPanel.style.display = originalDisplay;
          }
        }
        continue;
      }
      
      // Wait a bit for charts to render
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // For chart containers, try to find the actual chart inside
      let targetElement = element;
      if (element.hasAttribute('data-chart-container')) {
        const chartInside = element.querySelector('.recharts-wrapper');
        if (chartInside) {
          targetElement = chartInside;
        }
      }
      
      const canvas = await html2canvas(targetElement, {
        backgroundColor: '#ffffff',
        scale: 1.5, // Reduced scale for better performance
        logging: false,
        useCORS: true,
        allowTaint: false, // Changed to false for better compatibility
        width: targetElement.offsetWidth || rect.width || 800,
        height: targetElement.offsetHeight || rect.height || 600,
        windowWidth: targetElement.scrollWidth || rect.width,
        windowHeight: targetElement.scrollHeight || rect.height
      });
      
      // Restore original state if we modified it
      if (wasHidden && isInHiddenTab && tabPanel) {
        if (originalHidden) {
          tabPanel.setAttribute('hidden', originalHidden);
        } else {
          tabPanel.removeAttribute('hidden');
        }
        tabPanel.style.display = originalDisplay;
        if (originalDataState) {
          tabPanel.setAttribute('data-state', originalDataState);
        }
      }
      
      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        console.warn('Invalid canvas generated for chart:', element);
        continue;
      }
      
      const imageData = canvas.toDataURL('image/png', 0.95);
      if (!imageData || imageData === 'data:,') {
        console.warn('Failed to generate image data for chart:', element);
        continue;
      }
      
      // Get chart title from various sources
      const title = element.getAttribute('data-chart-title') || 
                   element.getAttribute('title') || 
                   element.closest('[data-chart-title]')?.getAttribute('data-chart-title') ||
                   element.closest('Card')?.querySelector('CardTitle')?.textContent ||
                   'Chart';
      
      images.push({
        data: imageData,
        width: canvas.width,
        height: canvas.height,
        title: title
      });
    } catch (error) {
      console.warn(`Failed to capture chart:`, element, error);
      // Continue with other charts
    }
  }
  
  return images;
};

/**
 * Enhanced Excel export with chart images
 */
export const exportToExcel = async (data = null, filename = 'export', filters = {}, chartImages = []) => {
  try {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const role = user.role || 'student';
    
    // Create workbook
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data');
    
    // Add header with role-based title
    const titleRow = worksheet.addRow([`${getExportTitle(filename, role)} - ${new Date().toLocaleDateString()}`]);
    titleRow.font = { size: 16, bold: true, color: { argb: 'FF003366' } };
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.mergeCells(1, 1, 1, 5);
    worksheet.addRow([]); // Empty row
    
    // Add filter information
    if (Object.keys(filters).length > 0) {
      const filterRow = worksheet.addRow(['Applied Filters:']);
      filterRow.font = { bold: true };
      Object.entries(filters).forEach(([key, value]) => {
        if (value) {
          worksheet.addRow([`${key}: ${value}`]);
        }
      });
      worksheet.addRow([]); // Empty row
    }
    
    // Add chart images if available
    if (chartImages.length > 0) {
      let currentRow = worksheet.rowCount + 1;
      for (const chart of chartImages) {
        const imageId = workbook.addImage({
          base64: chart.data.split(',')[1],
          extension: 'png',
        });
        
        worksheet.addRow([chart.title]);
        worksheet.getRow(currentRow).font = { bold: true, size: 12 };
        currentRow++;
        
        worksheet.addImage(imageId, {
          tl: { col: 0, row: currentRow - 1 },
          ext: { width: Math.min(chart.width / 2, 800), height: Math.min(chart.height / 2, 500) }
        });
        
        currentRow += Math.ceil((chart.height / 2) / 20) + 2; // Add spacing
      }
      worksheet.addRow([]); // Empty row after charts
    }
    
    // Add data table
    if (data && Array.isArray(data) && data.length > 0) {
      const headers = Object.keys(data[0]);
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF003366' }
      };
      
      data.forEach(row => {
        const values = headers.map(header => row[header] || '');
        worksheet.addRow(values);
      });
      
      // Auto-size columns
      worksheet.columns.forEach(column => {
        column.width = 15;
      });
    } else {
      // If no data, try to get from backend
      try {
        const exportType = filename.includes('fex') ? 'fex' : 
                          filename.includes('high-school') ? 'high-school' : 
                          'dashboard';
        const response = await axios.get('/api/export/excel', {
          headers: { Authorization: `Bearer ${token}` },
          params: { ...filters, type: exportType, role },
          responseType: 'blob'
        });
        
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        return true;
      } catch (err) {
        console.warn('Backend export failed, using frontend export', err);
      }
    }
    
    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    return true;
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    alert('Failed to export to Excel. Please try again.');
    throw error;
  }
};

/**
 * Enhanced PDF export with chart images
 */
export const exportToPDF = async (filters = {}, reportType = 'dashboard', chartImages = [], data = null, stats = null) => {
  try {
    const token = localStorage.getItem('token');
    let user = {};
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        user = JSON.parse(userStr);
      }
    } catch (e) {
      console.warn('Failed to parse user from localStorage:', e);
    }
    const role = user.role || 'student';
    
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPosition = 20;
    
    // Validate chartImages
    if (!Array.isArray(chartImages)) {
      chartImages = [];
    }
    
    // Add header
    doc.setFontSize(18);
    doc.setTextColor(0, 51, 102); // UCU Blue
    doc.setFont('helvetica', 'bold');
    const title = getExportTitle(reportType, role);
    const titleWidth = doc.getTextWidth(title);
    doc.text(title, (pageWidth - titleWidth) / 2, yPosition);
    yPosition += 10;
    
    // Add date
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    const dateStr = new Date().toLocaleDateString();
    const dateWidth = doc.getTextWidth(dateStr);
    doc.text(dateStr, (pageWidth - dateWidth) / 2, yPosition);
    yPosition += 15;
    
    // Add filter information
    if (Object.keys(filters).length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('Applied Filters:', 20, yPosition);
      yPosition += 7;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== 'drilldown') {
          doc.text(`${key}: ${value}`, 25, yPosition);
          yPosition += 6;
        }
      });
      yPosition += 5;
    }
    
    // Add stats/KPIs if available
    if (stats) {
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary Statistics', 20, yPosition);
      yPosition += 7;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      Object.entries(stats).forEach(([key, value]) => {
        if (typeof value === 'number' || typeof value === 'string') {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          doc.text(`${label}: ${value}`, 25, yPosition);
          yPosition += 6;
          if (yPosition > pageHeight - 30) {
            doc.addPage();
            yPosition = 20;
          }
        }
      });
      yPosition += 5;
    }
    
    // Add chart images
    for (const chart of chartImages) {
      try {
        if (!chart || !chart.data) {
          console.warn('Skipping invalid chart:', chart);
          continue;
        }
        
        if (yPosition > pageHeight - 100) {
          doc.addPage();
          yPosition = 20;
        }
        
        // Chart title
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        const chartTitle = chart.title || 'Chart';
        doc.text(chartTitle, 20, yPosition);
        yPosition += 8;
        
        // Validate image dimensions
        const chartWidth = chart.width || 800;
        const chartHeight = chart.height || 600;
        
        if (chartWidth <= 0 || chartHeight <= 0) {
          console.warn('Invalid chart dimensions, skipping:', chart);
          continue;
        }
        
        // Calculate image dimensions to fit page
        const maxWidth = pageWidth - 40;
        const maxHeight = pageHeight - yPosition - 20;
        const aspectRatio = chartWidth / chartHeight;
        
        let imgWidth = maxWidth;
        let imgHeight = imgWidth / aspectRatio;
        
        if (imgHeight > maxHeight) {
          imgHeight = maxHeight;
          imgWidth = imgHeight * aspectRatio;
        }
        
        // Ensure minimum dimensions
        if (imgWidth < 10 || imgHeight < 10) {
          console.warn('Image too small, skipping:', chart);
          continue;
        }
        
        // Add image - handle both base64 and data URL formats
        let imageData = chart.data;
        if (imageData.startsWith('data:image')) {
          // Already in correct format
        } else if (imageData.startsWith('data:')) {
          // Remove data URL prefix if present
          imageData = imageData.split(',')[1] || imageData;
        }
        
        doc.addImage(imageData, 'PNG', (pageWidth - imgWidth) / 2, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + 10;
        
        if (yPosition > pageHeight - 30) {
          doc.addPage();
          yPosition = 20;
        }
      } catch (imgError) {
        console.error('Error adding chart image to PDF:', imgError, chart);
        // Continue with next chart instead of failing completely
        continue;
      }
    }
    
    // Add data table if available
    if (data && Array.isArray(data) && data.length > 0) {
      try {
        if (yPosition > pageHeight - 50) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Detailed Data', 20, yPosition);
        yPosition += 7;
        
        const firstRow = data[0];
        if (firstRow && typeof firstRow === 'object') {
          const headers = Object.keys(firstRow);
          if (headers.length > 0) {
            const tableData = data.slice(0, 50).map(row => {
              return headers.map(h => {
                const value = row[h];
                // Convert to string, handle null/undefined
                if (value === null || value === undefined) return '';
                if (typeof value === 'object') return JSON.stringify(value);
                return String(value);
              });
            });
            
            doc.autoTable({
              head: [headers],
              body: tableData,
              startY: yPosition,
              styles: { 
                fontSize: 8,
                cellPadding: 2
              },
              headStyles: {
                fillColor: [0, 51, 102], // UCU Blue
                textColor: [255, 255, 255],
                fontStyle: 'bold'
              },
              margin: { left: 20, right: 20 }
            });
          }
        }
      } catch (tableError) {
        console.error('Error adding data table to PDF:', tableError);
        // Continue without table instead of failing
      }
    }
    
    // Add footer
    try {
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const footerText = `Page ${i} of ${totalPages} - Generated by UCU Analytics System`;
        const textWidth = doc.getTextWidth(footerText);
        doc.text(
          footerText,
          (pageWidth - textWidth) / 2,
          pageHeight - 10
        );
      }
    } catch (footerError) {
      console.warn('Error adding footer to PDF:', footerError);
      // Continue without footer
    }
    
    // Ensure we have at least one page with content
    if (yPosition <= 20 && chartImages.length === 0 && (!data || data.length === 0) && !stats) {
      doc.setFontSize(12);
      doc.text('No data available for export.', 20, yPosition);
    }
    
    // Save PDF
    const filename = `${reportType}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    return true;
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      filters,
      reportType,
      chartImagesCount: chartImages?.length || 0,
      dataCount: data?.length || 0,
      hasStats: !!stats
    });
    alert(`Failed to export to PDF: ${error.message || 'Unknown error'}. Please check the console for details.`);
    throw error;
  }
};

/**
 * Get export title based on filename and role
 */
const getExportTitle = (filename, role) => {
  const roleTitles = {
    'student': 'Student',
    'staff': 'Staff',
    'hod': 'Department',
    'dean': 'Faculty',
    'senate': 'Institution',
    'analyst': 'Analytics',
    'finance': 'Financial',
    'hr': 'HR'
  };
  
  const roleTitle = roleTitles[role] || 'Analytics';
  
  if (filename.includes('fex')) {
    return `${roleTitle} FEX Analytics Report`;
  } else if (filename.includes('high-school')) {
    return `${roleTitle} High School Analytics Report`;
  } else if (filename.includes('finance')) {
    return `${roleTitle} Financial Report`;
  } else {
    return `${roleTitle} Analytics Report`;
  }
};

/**
 * Export dashboard with charts
 */
export const exportDashboard = async (stats, charts, filters = {}, chartImages = []) => {
  return exportToExcel(null, 'dashboard_export', filters, chartImages);
};

/**
 * Admin console full export: KPIs, Users, Audit Logs, ETL Runs, Warehouse counts.
 * adminData: { kpis, users[], auditLogs[], etlRuns[], warehouse{} }
 */
export const exportAdminToExcel = async (adminData, filename = 'admin_console', chartImages = []) => {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Please log in to export.');
    return;
  }
  const workbook = new ExcelJS.Workbook();
  const dateStr = new Date().toISOString().split('T')[0];

  // Sheet 1: Summary / KPIs
  const summarySheet = workbook.addWorksheet('Summary', { pageSetup: { fitToPage: true } });
  summarySheet.addRow(['Admin Console Export', dateStr]).font = { size: 14, bold: true };
  summarySheet.addRow([]);
  if (adminData.kpis && typeof adminData.kpis === 'object') {
    summarySheet.addRow(['Metric', 'Value']).font = { bold: true };
    Object.entries(adminData.kpis).forEach(([k, v]) => {
      summarySheet.addRow([k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), v]);
    });
  }
  summarySheet.addRow([]);
  if (adminData.warehouse && typeof adminData.warehouse === 'object') {
    summarySheet.addRow(['Warehouse table', 'Count']).font = { bold: true };
    Object.entries(adminData.warehouse).forEach(([table, count]) => {
      summarySheet.addRow([table, count != null ? count : '—']);
    });
  }

  // Sheet 2: Users
  const usersSheet = workbook.addWorksheet('Users', { pageSetup: { fitToPage: true } });
  const users = adminData.users || [];
  if (users.length > 0) {
    const userHeaders = ['Name', 'Username / Access #', 'Reg. #', 'Role', 'Type', 'Faculty', 'Department'];
    usersSheet.addRow(userHeaders).font = { bold: true };
    users.forEach((u) => {
      usersSheet.addRow([
        u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || '—',
        u.username || u.access_number || '—',
        u.reg_number || '—',
        u.role || '—',
        u.type === 'app_user' ? 'App user' : u.type || '—',
        u.faculty_name || '—',
        u.department_name || '—',
      ]);
    });
  } else {
    usersSheet.addRow(['No users in this export.']);
  }

  // Sheet 3: Audit Logs
  const auditSheet = workbook.addWorksheet('Audit Logs', { pageSetup: { fitToPage: true } });
  const logs = adminData.auditLogs || [];
  if (logs.length > 0) {
    const logHeaders = ['Time', 'Username', 'Action', 'Resource', 'Role', 'Status', 'Details'];
    auditSheet.addRow(logHeaders).font = { bold: true };
    logs.forEach((l) => {
      auditSheet.addRow([
        l.created_at || l.timestamp || '—',
        l.username || '—',
        l.action || '—',
        l.resource || '—',
        l.role_name || '—',
        l.status || '—',
        typeof l.details === 'string' ? l.details : (l.details ? JSON.stringify(l.details) : '—'),
      ]);
    });
  } else {
    auditSheet.addRow(['No audit logs in this export.']);
  }

  // Sheet 4: ETL Runs
  const etlSheet = workbook.addWorksheet('ETL Runs', { pageSetup: { fitToPage: true } });
  const etlRuns = adminData.etlRuns || [];
  if (etlRuns.length > 0) {
    etlSheet.addRow(['Log file', 'Start time', 'Duration', 'Success']).font = { bold: true };
    etlRuns.forEach((r) => {
      etlSheet.addRow([r.log_file || '—', r.start_time || '—', r.duration || '—', r.success ? 'Yes' : 'No']);
    });
  } else {
    etlSheet.addRow(['No ETL runs in this export.']);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}_${dateStr}.xlsx`);
  return true;
};

/**
 * Admin console full PDF: same sections as Excel.
 */
export const exportAdminToPDF = async (adminData, filename = 'admin_console', chartImages = []) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 20;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Admin Console Report', pageWidth / 2, y, { align: 'center' });
  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString(), pageWidth / 2, y, { align: 'center' });
  y += 15;

  const addSection = (title, rows) => {
    if (y > pageHeight - 40) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 20, y);
    y += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (!rows || rows.length === 0) {
      doc.text('No data.', 25, y);
      y += 10;
      return;
    }
    const headers = rows[0];
    const body = rows.slice(1).map((row) => row.map((v) => (v == null ? '' : String(v))));
    doc.autoTable({
      head: [headers],
      body,
      startY: y,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255], fontStyle: 'bold' },
      margin: { left: 20, right: 20 },
    });
    y = doc.lastAutoTable.finalY + 10;
  };

  if (adminData.kpis && typeof adminData.kpis === 'object') {
    addSection('Summary (KPIs)', [
      ['Metric', 'Value'],
      ...Object.entries(adminData.kpis).map(([k, v]) => [k.replace(/_/g, ' '), v]),
    ]);
  }

  const users = adminData.users || [];
  if (users.length > 0) {
    addSection('Users', [
      ['Name', 'Username', 'Role', 'Type'],
      ...users.slice(0, 100).map((u) => [
        u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || '—',
        u.username || u.access_number || '—',
        u.role || '—',
        u.type === 'app_user' ? 'App user' : u.type || '—',
      ]),
    ]);
  }

  const logs = adminData.auditLogs || [];
  if (logs.length > 0) {
    addSection('Audit Logs', [
      ['Time', 'User', 'Action', 'Resource', 'Status'],
      ...logs.slice(0, 100).map((l) => [
        l.created_at || l.timestamp || '—',
        l.username || '—',
        l.action || '—',
        l.resource || '—',
        l.status || '—',
      ]),
    ]);
  }

  const etlRuns = adminData.etlRuns || [];
  if (etlRuns.length > 0) {
    addSection('ETL Runs', [
      ['Log file', 'Start time', 'Duration', 'Success'],
      ...etlRuns.slice(0, 50).map((r) => [r.log_file || '—', r.start_time || '—', r.duration || '—', r.success ? 'Yes' : 'No']),
    ]);
  }

  if (adminData.warehouse && Object.keys(adminData.warehouse).length > 0) {
    addSection('Warehouse counts', [
      ['Table', 'Count'],
      ...Object.entries(adminData.warehouse).map(([t, c]) => [t, c != null ? c : '—']),
    ]);
  }

  const dateStr = new Date().toISOString().split('T')[0];
  doc.save(`${filename}_${dateStr}.pdf`);
  return true;
};
