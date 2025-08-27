import { POST } from '../route';
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { generateReportPdfBuffer } from '@/server/reports/pdf';

// Mock dependencies
jest.mock('@/utils/supabase/admin');
jest.mock('@/utils/supabase/server');
jest.mock('@/server/reports/pdf');

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockCreateServerClient = createServerClient as jest.MockedFunction<typeof createServerClient>;
const mockGenerateReportPdfBuffer = generateReportPdfBuffer as jest.MockedFunction<typeof generateReportPdfBuffer>;

describe('/api/reports/save', () => {
  let mockSupaAdmin: any;
  let mockSupaServer: any;
  let mockRequest: NextRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock PDF generation
    mockGenerateReportPdfBuffer.mockResolvedValue(Buffer.from('fake-pdf-content'));
    
    // Mock admin client
    mockSupaAdmin = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      storage: {
        from: jest.fn().mockReturnThis(),
        upload: jest.fn(),
        createSignedUrl: jest.fn(),
      },
    };
    mockCreateAdminClient.mockReturnValue(mockSupaAdmin);
    
    // Mock server client
    mockSupaServer = {
      auth: {
        getUser: jest.fn(),
      },
    };
    mockCreateServerClient.mockResolvedValue(mockSupaServer);
  });

  describe('getPharmacySlugForUser logic', () => {
    it('should return pharmacy slug when user is found in pharma_pharmacy_members', async () => {
      // Setup mocks for successful lookup
      mockSupaServer.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Mock pharmacy_members lookup
      mockSupaAdmin.maybeSingle
        .mockResolvedValueOnce({
          data: { pharmacy_id: 'pharmacy-456' },
          error: null,
        })
        // Mock pharmacy_profile lookup
        .mockResolvedValueOnce({
          data: { pharmacy_slug: 'test-pharmacy' },
          error: null,
        });

      mockSupaAdmin.storage.upload.mockResolvedValue({ error: null });
      mockSupaAdmin.storage.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://signed-url.com' },
        error: null,
      });

      const payload = {
        tab: 'commercial' as const,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        pbmName: 'OptumRx',
        rows: [],
      };

      mockRequest = { json: async () => payload } as any;

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(200);
      expect(result.ok).toBe(true);
      expect(result.pdfPath).toBe('test-pharmacy/report_commercialdollars/report_commercialdollars_optumrx_2025-01-01_2025-01-31.pdf');
      expect(result.signedUrl).toBe('https://signed-url.com');
    });

    it('should return 403 when no pharmacy slug found for user', async () => {
      mockSupaServer.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // Mock no pharmacy found
      mockSupaAdmin.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const payload = {
        tab: 'commercial' as const,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        pbmName: 'OptumRx',
        rows: [],
      };

      mockRequest = { json: async () => payload } as any;

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(403);
      expect(result.error).toBe('No pharmacy slug found for current user');
    });

    it('should return 401 when user is not authenticated', async () => {
      mockSupaServer.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const payload = {
        tab: 'commercial' as const,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        pbmName: 'OptumRx',
        rows: [],
      };

      mockRequest = { json: async () => payload } as any;

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(401);
      expect(result.error).toBe('Not authenticated');
    });
  });

  describe('Save PDF logic', () => {
    beforeEach(() => {
      // Setup successful auth and pharmacy lookup
      mockSupaServer.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockSupaAdmin.maybeSingle
        .mockResolvedValueOnce({
          data: { pharmacy_id: 'pharmacy-456' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { pharmacy_slug: 'test-pharmacy' },
          error: null,
        });
    });

    it('should use correct storage path format', async () => {
      mockSupaAdmin.storage.upload.mockResolvedValue({ error: null });
      mockSupaAdmin.storage.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://signed-url.com' },
        error: null,
      });

      const payload = {
        tab: 'federal' as const,
        dateFrom: '2025-02-01',
        dateTo: '2025-02-28',
        pbmName: 'Federal',
        rows: [],
      };

      mockRequest = { json: async () => payload } as any;

      await POST(mockRequest);

      expect(mockSupaAdmin.storage.upload).toHaveBeenCalledWith(
        'test-pharmacy/report_federaldollars/report_federaldollars_federal_2025-02-01_2025-02-28.pdf',
        expect.any(Buffer),
        {
          contentType: 'application/pdf',
          upsert: true,
        }
      );
    });

    it('should handle upload errors', async () => {
      mockSupaAdmin.storage.upload.mockResolvedValue({
        error: { message: 'Storage quota exceeded' },
      });

      const payload = {
        tab: 'commercial' as const,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        pbmName: 'OptumRx',
        rows: [],
      };

      mockRequest = { json: async () => payload } as any;

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.error).toBe('Upload failed: Storage quota exceeded');
    });

    it('should handle signed URL errors', async () => {
      mockSupaAdmin.storage.upload.mockResolvedValue({ error: null });
      mockSupaAdmin.storage.createSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'Invalid path' },
      });

      const payload = {
        tab: 'commercial' as const,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        pbmName: 'OptumRx',
        rows: [],
      };

      mockRequest = { json: async () => payload } as any;

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.error).toBe('Signed URL failed: Invalid path');
    });
  });

  describe('noAuthDownload mode', () => {
    it('should return PDF directly when noAuthDownload is true', async () => {
      const payload = {
        tab: 'summary' as const,
        dateFrom: '2025-01-01',
        dateTo: '2025-01-31',
        pbmName: 'OptumRx',
        rows: [],
        noAuthDownload: true,
      };

      mockRequest = { json: async () => payload } as any;

      const response = await POST(mockRequest);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/pdf');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
      expect(response.headers.get('Content-Disposition')).toContain('report_summary_optumrx_2025-01-01_2025-01-31.pdf');
      
      // Should not call auth or storage methods
      expect(mockSupaServer.auth.getUser).not.toHaveBeenCalled();
      expect(mockSupaAdmin.storage.upload).not.toHaveBeenCalled();
    });
  });

  describe('validation', () => {
    it('should return 400 for missing required fields', async () => {
      const payload = {
        tab: 'commercial' as const,
        // Missing pbmName and rows
      };

      mockRequest = { json: async () => payload } as any;

      const response = await POST(mockRequest);
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.error).toBe('Missing required fields: tab, pbmName, rows');
    });
  });
});
