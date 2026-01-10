import { Injectable } from '@angular/core';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type ExportableValue = string | number | boolean | null | undefined;
type ExportableRow = Record<string, ExportableValue>;

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor() {}

  /**
   * Export data to CSV file
   */
  exportCSV(data: ExportableRow[], filename: string): void {
    if (!data || data.length === 0) {
      console.warn('No data to export');
      return;
    }

    // Get all unique keys from all objects
    const allKeys = new Set<string>();
    data.forEach(row => {
      Object.keys(row).forEach(key => allKeys.add(key));
    });
    const headers = Array.from(allKeys);

    // Create CSV content
    let csvContent = headers.join(',') + '\n';

    data.forEach(row => {
      const values = headers.map(header => {
        let value = row[header];

        // Handle undefined/null
        if (value === undefined || value === null) {
          return '';
        }

        // Convert to string and escape quotes
        value = String(value);
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }

        return value;
      });

      csvContent += values.join(',') + '\n';
    });

    // Create Blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const fullFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
    saveAs(blob, fullFilename);
  }

  /**
   * Export HTML element to PDF
   */
  async exportPDF(elementId: string, filename: string): Promise<void> {
    try {
      const element = document.getElementById(elementId);
      if (!element) {
        console.error(`Element with id '${elementId}' not found`);
        return;
      }

      // Capture element as canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Calculate PDF dimensions
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      // Add additional pages if content is taller than one page
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const fullFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      pdf.save(fullFilename);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      throw error;
    }
  }

  /**
   * Export multiple sections to a single PDF
   */
  async exportMultipleSectionsPDF(
    elementIds: string[],
    filename: string,
    title?: string
  ): Promise<void> {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const pageHeight = 297;

      // Add title page if provided
      if (title) {
        pdf.setFontSize(24);
        pdf.text(title, imgWidth / 2, 50, { align: 'center' });
        pdf.setFontSize(12);
        pdf.text(
          `Généré le ${new Date().toLocaleDateString('fr-FR')}`,
          imgWidth / 2,
          70,
          { align: 'center' }
        );
        pdf.addPage();
      }

      // Capture and add each section
      for (let i = 0; i < elementIds.length; i++) {
        const element = document.getElementById(elementIds[i]);
        if (!element) {
          console.warn(`Element with id '${elementIds[i]}' not found, skipping`);
          continue;
        }

        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const imgData = canvas.toDataURL('image/png');

        if (i > 0 || title) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      }

      const fullFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      pdf.save(fullFilename);
    } catch (error) {
      console.error('Error exporting multi-section PDF:', error);
      throw error;
    }
  }

  /**
   * Export chart/canvas to PNG image
   */
  exportChartPNG(canvasElement: HTMLCanvasElement, filename: string): void {
    try {
      canvasElement.toBlob((blob) => {
        if (blob) {
          const fullFilename = filename.endsWith('.png') ? filename : `${filename}.png`;
          saveAs(blob, fullFilename);
        }
      });
    } catch (error) {
      console.error('Error exporting chart:', error);
      throw error;
    }
  }

  /**
   * Export data to JSON file
   */
  exportJSON(data: unknown, filename: string): void {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const fullFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
      saveAs(blob, fullFilename);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      throw error;
    }
  }

  /**
   * Generate and download a comprehensive report (PDF)
   */
  async generateReport(
    reportData: {
      title: string;
      sections: {
        title: string;
        elementId: string;
      }[];
    },
    filename: string
  ): Promise<void> {
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const margin = 15;
      const contentWidth = imgWidth - 2 * margin;

      // Title page
      pdf.setFontSize(28);
      pdf.text(reportData.title, imgWidth / 2, 60, { align: 'center' });

      pdf.setFontSize(14);
      pdf.text(
        `Rapport généré le ${new Date().toLocaleDateString('fr-FR')}`,
        imgWidth / 2,
        80,
        { align: 'center' }
      );

      pdf.setFontSize(12);
      pdf.text('Analyse de la qualité de l\'air mondiale', imgWidth / 2, 100, {
        align: 'center'
      });
      pdf.text('Période 2019-2023', imgWidth / 2, 110, { align: 'center' });

      // Table of contents
      pdf.addPage();
      pdf.setFontSize(18);
      pdf.text('Table des matières', margin, 30);

      pdf.setFontSize(12);
      let yPosition = 50;
      reportData.sections.forEach((section, index) => {
        pdf.text(`${index + 1}. ${section.title}`, margin, yPosition);
        yPosition += 10;
      });

      // Add each section
      for (const section of reportData.sections) {
        pdf.addPage();

        // Section title
        pdf.setFontSize(16);
        pdf.text(section.title, margin, 20);

        // Capture and add element
        const element = document.getElementById(section.elementId);
        if (element) {
          const canvas = await html2canvas(element, {
            scale: 1.5,
            useCORS: true,
            logging: false
          });

          const imgHeight = (canvas.height * contentWidth) / canvas.width;
          const imgData = canvas.toDataURL('image/png');

          pdf.addImage(imgData, 'PNG', margin, 35, contentWidth, imgHeight);
        }
      }

      // Footer on each page
      const pageCount = pdf.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.text(
          `Page ${i} sur ${pageCount}`,
          imgWidth / 2,
          297 - 10,
          { align: 'center' }
        );
      }

      const fullFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
      pdf.save(fullFilename);
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }

  /**
   * Helper: Format filename with timestamp
   */
  formatFilename(baseName: string, extension: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return `${baseName}_${timestamp}.${extension}`;
  }
}
