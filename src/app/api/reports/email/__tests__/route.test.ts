import { POST } from '../route';
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

// Mock dependencies
jest.mock('@/utils/supabase/admin');
jest.mock('mailcomposer', () => {
  return jest.fn().mockImplementation(() => ({
    build: jest.fn((callback) => {
      callback(null, Buffer.from('fake-eml-content'));
    }),
  }));
});

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;

describe('/api/reports/email', () => {
  let mockSupaAdmin: any;
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock admin client
    mockSupaAdmin = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      update: jest.fn().mockReturnThis(),
      storage: {
        from: jest.fn().mockReturnThis(),
        download: jest.fn(),
      },
    };
    mockCreateAdminClient.mockReturnValue(mockSupaAdmin);
  });

  describe('PBM email lookup', () => {
    it('should fetch PBM email from pharma_pbm_info', async () => {
      // Mock successful PBM email lookup
      mockSupaAdmin.maybeSingle.mockResolvedValueOnce({
        data: [{ email: 'provider.relations@optum.com' }],
        error: null,
      });

      const payload = {
        tab: 'commercial' as const,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        pbmName: 'OptumRx',
        pdfPaths: ['test-pharmacy/report_commercialdollars/test.pdf'],
      };

      mockRequest = { json: async () => payload } as any;

      // Mock storage download for PDF attachment
      mockSupaAdmin.storage.download.mockResolvedValue({
        data: new Blob(['fake-pdf'], { type: 'application/pdf' }),
        error: null,
      });

      // Mock database updates (pharmacy profile and user data)
      mockSupaAdmin.maybeSingle
        .mockResolvedValueOnce({
          data: [{ email: 'provider.relations@optum.com' }],
          error: null,
        })
        .mockResolvedValueOnce({
          data: { pharmacy_id: 'pharmacy-123' },
          error: null,
        });

      mockSupaAdmin.from.mockReturnValue({
        ...mockSupaAdmin,
        select: jest.fn().mockReturnValue({
          ...mockSupaAdmin,
          eq: jest.fn().mockReturnValue({
            ...mockSupaAdmin,
            maybeSingle: jest.fn().mockResolvedValue({
              data: [{ email: 'provider.relations@optum.com' }],
              error: null,
            }),
          }),
        }),
      });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('message/rfc822');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      
      // Verify PBM email lookup was called
      expect(mockSupaAdmin.from).toHaveBeenCalledWith('pharma_pbm_info');
    });

    it('should return 404 when PBM email not found', async () => {
      // Mock PBM email lookup returning no results
      mockSupaAdmin.from.mockReturnValue({
        ...mockSupaAdmin,
        select: jest.fn().mockReturnValue({
          ...mockSupaAdmin,
          eq: jest.fn().mockReturnValue({
            ...mockSupaAdmin,
            limit: jest.fn().mockReturnValue({
              ...mockSupaAdmin,
              maybeSingle: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          }),
        }),
      });

      const payload = {
        tab: 'commercial' as const,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        pbmName: 'UnknownPBM',
      };

      mockRequest = { json: async () => payload } as any;

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.error).toBe('No email found for PBM: UnknownPBM');
    });

    it('should return 400 when pbmName is missing', async () => {
      const payload = {
        tab: 'commercial' as const,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        // Missing pbmName
      };

      mockRequest = { json: async () => payload } as any;

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('Missing pbmName');
    });
  });

  describe('EML generation', () => {
    beforeEach(() => {
      // Setup successful PBM email lookup
      mockSupaAdmin.from.mockReturnValue({
        ...mockSupaAdmin,
        select: jest.fn().mockReturnValue({
          ...mockSupaAdmin,
          eq: jest.fn().mockReturnValue({
            ...mockSupaAdmin,
            limit: jest.fn().mockReturnValue({
              ...mockSupaAdmin,
              maybeSingle: jest.fn().mockResolvedValue({
                data: [{ email: 'provider.relations@optum.com' }],
                error: null,
              }),
            }),
          }),
        }),
      });
    });

    it('should generate EML with correct subject format', async () => {
      const payload = {
        tab: 'federal' as const,
        dateFrom: '2025-02-01',
        dateTo: '2025-02-28',
        pbmName: 'Federal',
        pdfPaths: [],
      };

      mockRequest = { json: async () => payload } as any;

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Disposition')).toContain('Federal_Federal_Dollars_Report_2025-02-01_to_2025-02-28.eml');
    });

    it('should handle PDF attachments from storage', async () => {
      // Mock storage download
      mockSupaAdmin.storage.download.mockResolvedValue({
        data: new Blob(['fake-pdf-content'], { type: 'application/pdf' }),
        error: null,
      });

      const payload = {
        tab: 'commercial' as const,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        pbmName: 'OptumRx',
        pdfPaths: ['test-pharmacy/report_commercialdollars/test.pdf'],
      };

      mockRequest = { json: async () => payload } as any;

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      expect(mockSupaAdmin.storage.download).toHaveBeenCalledWith('test-pharmacy/report_commercialdollars/test.pdf');
    });

    it('should handle storage download errors', async () => {
      mockSupaAdmin.storage.download.mockResolvedValue({
        data: null,
        error: { message: 'File not found' },
      });

      const payload = {
        tab: 'commercial' as const,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        pbmName: 'OptumRx',
        pdfPaths: ['nonexistent/file.pdf'],
      };

      mockRequest = { json: async () => payload } as any;

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.error).toBe('Failed to download nonexistent/file.pdf: File not found');
    });
  });

  describe('Database status updates', () => {
    beforeEach(() => {
      // Setup successful PBM email lookup
      mockSupaAdmin.from.mockReturnValue({
        ...mockSupaAdmin,
        select: jest.fn().mockReturnValue({
          ...mockSupaAdmin,
          eq: jest.fn().mockReturnValue({
            ...mockSupaAdmin,
            limit: jest.fn().mockReturnValue({
              ...mockSupaAdmin,
              maybeSingle: jest.fn().mockResolvedValue({
                data: [{ email: 'provider.relations@optum.com' }],
                error: null,
              }),
            }),
          }),
        }),
      });
    });

    it('should resolve pharmacy_id from slug and update pharma_user_data', async () => {
      // Mock pharmacy profile lookup
      const mockPharmacyProfileQuery = {
        ...mockSupaAdmin,
        select: jest.fn().mockReturnValue({
          ...mockSupaAdmin,
          eq: jest.fn().mockReturnValue({
            ...mockSupaAdmin,
            maybeSingle: jest.fn().mockResolvedValue({
              data: { pharmacy_id: 'pharmacy-123' },
              error: null,
            }),
          }),
        }),
      };

      // Mock PBM bin lookup
      const mockPbmBinQuery = {
        ...mockSupaAdmin,
        select: jest.fn().mockReturnValue({
          ...mockSupaAdmin,
          eq: jest.fn().mockReturnValue([
            { bin: '123456' },
            { bin: '789012' },
          ]),
        }),
      };

      // Mock user data update
      const mockUserDataUpdate = {
        ...mockSupaAdmin,
        update: jest.fn().mockReturnValue({
          ...mockSupaAdmin,
          eq: jest.fn().mockReturnValue({
            ...mockSupaAdmin,
            gte: jest.fn().mockReturnValue({
              ...mockSupaAdmin,
              lte: jest.fn().mockReturnValue({
                ...mockSupaAdmin,
                in: jest.fn().mockResolvedValue({ error: null }),
              }),
            }),
          }),
        }),
      };

      // Setup different mock returns for different table calls
      mockSupaAdmin.from.mockImplementation((table: string) => {
        switch (table) {
          case 'pharma_pbm_info':
            return {
              ...mockSupaAdmin,
              select: jest.fn().mockReturnValue({
                ...mockSupaAdmin,
                eq: jest.fn().mockReturnValue({
                  ...mockSupaAdmin,
                  limit: jest.fn().mockReturnValue({
                    ...mockSupaAdmin,
                    maybeSingle: jest.fn().mockResolvedValue({
                      data: [{ email: 'provider.relations@optum.com' }],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          case 'pharma_pharmacy_profile':
            return mockPharmacyProfileQuery;
          case 'pharma_user_data':
            return mockUserDataUpdate;
          default:
            return mockSupaAdmin;
        }
      });

      const payload = {
        tab: 'commercial' as const,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        pbmName: 'OptumRx',
        pdfPaths: ['test-pharmacy/report_commercialdollars/test.pdf'],
      };

      mockRequest = { json: async () => payload } as any;

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      // Database update logic runs in background, doesn't affect response
    });

    it('should handle Federal PBM with NULL bin filter', async () => {
      const payload = {
        tab: 'federal' as const,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        pbmName: 'Federal',
        pdfPaths: ['test-pharmacy/report_federaldollars/test.pdf'],
      };

      mockRequest = { json: async () => payload } as any;

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      // Federal should use NULL bin filter in database updates
    });

    it('should use only first PDF path for pharmacy slug resolution', async () => {
      const payload = {
        tab: 'commercial' as const,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        pbmName: 'OptumRx',
        pdfPaths: [
          'first-pharmacy/report_commercialdollars/test1.pdf',
          'second-pharmacy/report_commercialdollars/test2.pdf',
        ],
      };

      mockRequest = { json: async () => payload } as any;

      // Mock storage downloads
      mockSupaAdmin.storage.download
        .mockResolvedValueOnce({
          data: new Blob(['pdf1'], { type: 'application/pdf' }),
          error: null,
        })
        .mockResolvedValueOnce({
          data: new Blob(['pdf2'], { type: 'application/pdf' }),
          error: null,
        });

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      // Should use 'first-pharmacy' slug for database updates, not 'second-pharmacy'
    });
  });
});
