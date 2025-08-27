import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportActions from '../ReportActions';
import { useUserDataStore } from '@/stores/useUserDataStore';

// Mock the store module
jest.mock('@/stores/useUserDataStore');

const mockUseUserDataStore = useUserDataStore as jest.MockedFunction<typeof useUserDataStore>;

// Mock fetch for PBM email API (isolated via spy and restored after each test)
let mockFetch: jest.SpyInstance;

// Factory function to get a fresh mock state for each test
const getMockState = () => ({
  filters: {
    owedType: 'underpaid',
    pbm: 'OptumRx',
    startDate: '2025-01-01',
    endDate: '2025-01-31',
    dateFrom: '2025-01-01',
    dateTo: '2025-01-31',
  },
  filteredRows: [],
  hasSavedPdfForContext: jest.fn().mockReturnValue(false),
  getLastSavedPdfForContext: jest.fn().mockReturnValue([]),
  setLastSavedPdfForContext: jest.fn(),
  lastSavedPdf: null,
  isSaving: false,
  isSending: false,
});

describe('ReportActions', () => {
  let mockState: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset state for each test to ensure isolation
    mockState = getMockState();

    // Mock implementation to return the current state
    mockUseUserDataStore.mockImplementation((selector?: (state: any) => any) => {
      if (selector) {
        return selector(mockState);
      }
      return mockState;
    });

    // Functions are already properly mocked in getMockState()

    // Spy on global.fetch and provide a default successful response
    mockFetch = jest.spyOn(global as any, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ email: 'provider.relations@optum.com' }),
    } as Response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Conditional rendering logic', () => {
    it('should show Save PDF button when owedType is underpaid and pbm is not All', () => {
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.getByText('Save PDF')).toBeInTheDocument();
    });

    it('should hide Save PDF button when owedType is not underpaid', () => {
      mockState.filters.owedType = 'overpaid';
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.queryByText('Save PDF')).not.toBeInTheDocument();
    });

    it('should hide Save PDF button when pbm is All', () => {
      mockState.filters.pbm = 'All';
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.queryByText('Save PDF')).not.toBeInTheDocument();
    });

    it('should show Download PDF button only when PDF is saved for context', () => {
      mockState.hasSavedPdfForContext.mockReturnValue(true);
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.getByText('Download PDF')).toBeInTheDocument();
    });

    it('should hide Download PDF button when no PDF saved for context', () => {
      mockState.hasSavedPdfForContext.mockReturnValue(false);
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.queryByText('Download PDF')).not.toBeInTheDocument();
    });

    it('should show Preview Email button for commercial PBM with saved PDF', () => {
      mockState.hasSavedPdfForContext.mockReturnValue(true);
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.getByText('Preview Email')).toBeInTheDocument();
    });

    it('should hide Preview Email button for Federal PBM', () => {
      mockState.filters.pbm = 'Federal';
      mockState.hasSavedPdfForContext.mockReturnValue(true);
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.queryByText('Preview Email')).not.toBeInTheDocument();
    });

    it('should hide Preview Email button when pbm is All', () => {
      mockState.filters.pbm = 'All';
      mockState.hasSavedPdfForContext.mockReturnValue(true);
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.queryByText('Preview Email')).not.toBeInTheDocument();
    });

    it('should show Send Email button for commercial PBM with saved PDF', () => {
      mockState.hasSavedPdfForContext.mockReturnValue(true);
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.getByText('Send Email')).toBeInTheDocument();
    });

    it('should hide Send Email button for Federal PBM', () => {
      mockState.filters.pbm = 'Federal';
      mockState.hasSavedPdfForContext.mockReturnValue(true);
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.queryByText('Send Email')).not.toBeInTheDocument();
    });

    it('should hide Send Email button when no PDF saved', () => {
      mockState.hasSavedPdfForContext.mockReturnValue(false);
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.queryByText('Send Email')).not.toBeInTheDocument();
    });
  });

  describe('PBM email label display', () => {
    it('should show PBM email label for underpaid commercial PBM', async () => {
      render(<ReportActions activeTab="commercial" />);
      
      expect(await screen.findByText(/PBM Email:/)).toBeInTheDocument();
      expect(await screen.findByText(/OptumRx/)).toBeInTheDocument();
      expect(await screen.findByText('provider.relations@optum.com')).toBeInTheDocument();
    });

    it('should not show PBM email label for Federal PBM', () => {
      mockState.filters.pbm = 'Federal';
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.queryByText(/PBM Email:/)).not.toBeInTheDocument();
    });

    it('should not show PBM email label when pbm is All', () => {
      mockState.filters.pbm = 'All';
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.queryByText(/PBM Email:/)).not.toBeInTheDocument();
    });

    it('should not show PBM email label when owedType is not underpaid', () => {
      mockState.filters.owedType = 'overpaid';
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.queryByText(/PBM Email:/)).not.toBeInTheDocument();
    });

    it('should show loading state while fetching email', () => {
      // Mock slow fetch
      mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.getByText('(loading...)')).toBeInTheDocument();
    });

    it('should show fallback when email fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Not found' }),
      } as Response);
      
      render(<ReportActions activeTab="commercial" />);
      
      await waitFor(() => {
        expect(screen.getByText('(no email on file)')).toBeInTheDocument();
      });
    });
  });

  describe('Email preview dialog', () => {
    beforeEach(() => {
      mockState.hasSavedPdfForContext.mockReturnValue(true);
      mockState.getLastSavedPdfForContext.mockReturnValue(['test.pdf']);
    });

    it('should show saved PDF indicator when PDFs exist', () => {
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.getByText('1 PDF saved')).toBeInTheDocument();
    });

    it('should show plural indicator for multiple PDFs', () => {
      mockState.hasSavedPdfForContext.mockReturnValue(true);
      mockState.getLastSavedPdfForContext.mockReturnValue(['test1.pdf', 'test2.pdf']);
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.getByText('2 PDFs saved')).toBeInTheDocument();
    });

    it('should not show saved PDF indicator when no PDFs exist', () => {
      mockState.hasSavedPdfForContext.mockReturnValue(false);
      mockState.getLastSavedPdfForContext.mockReturnValue([]);
      
      render(<ReportActions activeTab="commercial" />);
      
      expect(screen.queryByText(/PDF.*saved/)).not.toBeInTheDocument();
    });

    it('should display PBM email in preview dialog', async () => {
      render(<ReportActions activeTab="commercial" />);
      
      fireEvent.click(screen.getByText('Preview Email'));
      
      // Scope queries within the dialog to avoid false positives
      const dialog = await screen.findByRole('dialog');
      const inDialog = within(dialog);
      
      expect(await inDialog.findByText('To:')).toBeInTheDocument();
      expect(await inDialog.findByText('OptumRx')).toBeInTheDocument();
      expect(await inDialog.findByText('provider.relations@optum.com')).toBeInTheDocument();
    });

    it('should display correct subject in preview dialog', async () => {
      render(<ReportActions activeTab="commercial" />);
      
      fireEvent.click(screen.getByText('Preview Email'));
      
      expect(await screen.findByText('Subject:')).toBeInTheDocument();
      expect(await screen.findByText('OptumRx Commercial Dollars Report 2025-01-01 to 2025-01-31')).toBeInTheDocument();
    });

    it('should display attachments in preview dialog', async () => {
      render(<ReportActions activeTab="commercial" />);
      
      fireEvent.click(screen.getByText('Preview Email'));
      
      expect(await screen.findByText('📎 Attachments:')).toBeInTheDocument();
      expect(await screen.findByText('1 file')).toBeInTheDocument();
      expect(await screen.findByText('test.pdf')).toBeInTheDocument();
    });
  });

  describe('Button states', () => {
    it('should disable Save PDF button while saving', async () => {
      // Component uses local state for saving, not store state
      // This test needs to simulate the saving state by triggering the save action
      render(<ReportActions activeTab="commercial" />);
      
      // Mock a slow response to keep the button in saving state
      mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      const saveButton = screen.getByText('Save PDF');
      fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeInTheDocument();
        expect(screen.getByText('Saving...')).toBeDisabled();
      });
    });

    it('should disable Download PDF button while downloading', async () => {
      mockState.hasSavedPdfForContext.mockReturnValue(true);
      
      render(<ReportActions activeTab="commercial" />);
      
      // Mock a slow response to keep the button in downloading state
      mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      const downloadButton = screen.getByText('Download PDF');
      fireEvent.click(downloadButton);
      
      await waitFor(() => {
        expect(screen.getByText('Downloading...')).toBeInTheDocument();
        expect(screen.getByText('Downloading...')).toBeDisabled();
      });
    });

    it('should disable Send Email button while preparing', async () => {
      mockState.hasSavedPdfForContext.mockReturnValue(true);
      
      render(<ReportActions activeTab="commercial" />);
      
      // Mock a slow response to keep the button in preparing state
      mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      const emailButton = screen.getByText('Send Email');
      fireEvent.click(emailButton);
      
      await waitFor(() => {
        expect(screen.getByText('Preparing...')).toBeInTheDocument();
        expect(screen.getByText('Preparing...')).toBeDisabled();
      });
    });
  });
});
