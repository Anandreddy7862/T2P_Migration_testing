/** Result of extracting one visual's data, on either platform. */
export interface VisualExtraction {
  /** Dashboard tab (Tableau) or report page (Power BI) the visual sits on. */
  dashboard: string;
  /** Zero-based index of the visual on that dashboard or page. */
  index: number;
  /** Label used for the saved file - never used to decide WHICH visual was exported. */
  title: string;
  /** Where the csv was saved, or null when extraction failed. */
  filePath: string | null;
  /** Populated instead of throwing, so one bad visual cannot end the run. */
  error?: string;
}

export interface DashboardExtraction {
  dashboard: string;
  visualCount: number;
  extracted: number;
  failed: number;
  visuals: VisualExtraction[];
}

/** Every dashboard in one workbook. */
export interface WorkbookExtraction {
  dashboardCount: number;
  dashboards: DashboardExtraction[];
}

/** One page of a Power BI report. */
export interface ReportPageExtraction {
  page: string;
  visualCount: number;
  extracted: number;
  failed: number;
  visuals: VisualExtraction[];
}

/** Every page in one Power BI report. */
export interface ReportExtraction {
  pageCount: number;
  pages: ReportPageExtraction[];
}
