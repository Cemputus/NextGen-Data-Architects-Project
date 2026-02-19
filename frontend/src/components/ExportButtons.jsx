/**
 * Enhanced Export Buttons Component
 * Provides Excel and PDF export functionality with chart images
 */
import React, { useState, useRef, useEffect } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { exportToExcel, exportToPDF, exportDashboard, captureChartImages } from '../utils/exportUtils';

const ExportButtons = ({ 
  stats, 
  charts, 
  filters = {}, 
  data = null, 
  filename = 'export',
  chartSelectors = [] // Array of CSS selectors or refs for charts to capture
}) => {
  const [exporting, setExporting] = useState({ excel: false, pdf: false });
  const [capturingCharts, setCapturingCharts] = useState(false);

  // Auto-detect chart containers if selectors not provided
  useEffect(() => {
    if (chartSelectors.length === 0) {
      // Try to find common chart containers
      const autoSelectors = [];
      const chartContainers = document.querySelectorAll('[class*="chart"], [class*="Chart"], .recharts-wrapper, [data-chart]');
      chartContainers.forEach(container => {
        autoSelectors.push(container);
      });
      // Store for later use
      if (autoSelectors.length > 0) {
        chartSelectors.push(...autoSelectors);
      }
    }
  }, []);

  const captureCharts = async () => {
    try {
      setCapturingCharts(true);
      
      // Use provided selectors or auto-detect
      let selectors = chartSelectors;
      if (selectors.length === 0) {
        // Auto-detect charts - comprehensive search
        const chartElements = document.querySelectorAll(
          '.recharts-wrapper, [class*="chart"], [class*="Chart"], [data-chart], [data-chart-container], .h-\\[350px\\], .h-\\[300px\\], .h-\\[400px\\]'
        );
        selectors = Array.from(chartElements);
      } else {
        // Process string selectors to actual elements
        const processedSelectors = [];
        for (const selector of selectors) {
          if (typeof selector === 'string') {
            const elements = document.querySelectorAll(selector);
            processedSelectors.push(...Array.from(elements));
          } else {
            processedSelectors.push(selector);
          }
        }
        selectors = processedSelectors;
      }
      
      // Also capture chart containers (parent elements that contain charts)
      const chartContainers = document.querySelectorAll('[data-chart-container]');
      selectors = [...selectors, ...Array.from(chartContainers)];
      
      // Remove duplicates
      selectors = [...new Set(selectors)];
      
      const images = await captureChartImages(selectors);
      return images;
    } catch (error) {
      console.warn('Error capturing charts:', error);
      return [];
    } finally {
      setCapturingCharts(false);
    }
  };

  const handleExcelExport = async () => {
    try {
      setExporting({ ...exporting, excel: true });
      
      // Capture chart images
      const chartImages = await captureCharts();
      
      if (data) {
        // Export specific data with charts
        await exportToExcel(data, filename, filters, chartImages);
      } else if (stats && charts) {
        // Export dashboard with charts
        await exportDashboard(stats, charts, filters, chartImages);
      } else {
        // Export stats with charts
        await exportToExcel([stats], filename, filters, chartImages);
      }
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export to Excel. Please try again.');
    } finally {
      setExporting({ ...exporting, excel: false });
    }
  };

  const handlePDFExport = async () => {
    try {
      setExporting({ ...exporting, pdf: true });
      
      // Capture chart images
      const chartImages = await captureCharts();
      
      await exportToPDF(filters, filename.includes('fex') ? 'fex' : filename.includes('high-school') ? 'high-school' : 'dashboard', chartImages, data, stats);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Failed to export to PDF. Please try again.');
    } finally {
      setExporting({ ...exporting, pdf: false });
    }
  };

  const isExporting = exporting.excel || exporting.pdf || capturingCharts;

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={handleExcelExport}
        disabled={isExporting}
        className="gap-2"
        title="Export to Excel with charts and data"
      >
        {exporting.excel || capturingCharts ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {capturingCharts ? 'Capturing charts...' : 'Exporting...'}
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Excel
          </>
        )}
      </Button>
      <Button
        variant="outline"
        onClick={handlePDFExport}
        disabled={isExporting}
        className="gap-2"
        title="Export to PDF with charts and data"
      >
        {exporting.pdf || capturingCharts ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {capturingCharts ? 'Capturing charts...' : 'Exporting...'}
          </>
        ) : (
          <>
            <FileText className="h-4 w-4" />
            PDF
          </>
        )}
      </Button>
    </div>
  );
};

export default ExportButtons;

